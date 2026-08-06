/**
 * Client: plan narration queue locally → one Kokoro call per speech piece →
 * stitch PCM + silence → WAV → IndexedDB.
 *
 * Avoids Vercel 300s timeout from multi-segment server streams.
 */

import {
  blobToBase64,
  deleteAllDeliveryAudioForSession,
  getDeliveryAudio,
  putDeliveryAudio,
} from "@/lib/poju/delivery-audio-store";
import {
  buildDeliveryTtsSpeakQueue,
  extractDeliveryNarrationUnits,
  narrationUnitsPlainCorpus,
} from "@/lib/poju/delivery-narration-units";
import {
  DELIVERY_TTS_CACHE_VERSION,
  DELIVERY_TTS_MAX_CHARS,
} from "@/lib/tts/delivery-tts-constants";
import {
  concatUint8,
  DEFAULT_PCM_CHANNELS,
  DEFAULT_PCM_RATE,
  parsePcmContentType,
  pcmToWavBytes,
  silencePcmBytes,
} from "@/lib/tts/pcm-wav";

export type EnsureDeliveryAudioResult = {
  blob: Blob;
  mime: string;
  objectUrl: string;
  base64: string;
  fromCache: boolean;
  charCount: number;
  contentHash: string;
  pcmDurationSec?: number;
};

const inflight = new Map<string, Promise<EnsureDeliveryAudioResult>>();

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function revokeLater(url: string): void {
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }, 120_000);
}

async function fetchUtterancePcm(opts: {
  text: string;
  locale: string;
  sessionId: string;
  signal?: AbortSignal;
}): Promise<{ pcm: Uint8Array; rate: number; channels: number }> {
  const res = await fetch("/api/poju/delivery-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      text: opts.text,
      locale: opts.locale,
      session_id: opts.sessionId,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    throw new Error(data.detail || data.error || `tts_http_${res.status}`);
  }

  const headerRate = Number(res.headers.get("X-Delivery-Tts-Rate") || "");
  const headerCh = Number(res.headers.get("X-Delivery-Tts-Channels") || "");
  const meta = parsePcmContentType(res.headers.get("Content-Type"));
  const rate = Number.isFinite(headerRate) && headerRate > 0 ? headerRate : meta.rate;
  const channels = Number.isFinite(headerCh) && headerCh > 0 ? headerCh : meta.channels;

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 32) {
    throw new Error("tts_empty_audio");
  }
  return { pcm: buf, rate, channels };
}

export async function ensureDeliveryAudio(opts: {
  sessionId: string;
  fullText: string;
  locale: string;
  /** Wipe session cache and re-fetch from TTS (ignore IndexedDB hit). */
  forceRefresh?: boolean;
  onBytes?: (totalBytes: number) => void;
  /** Optional progress: speech piece i of n. */
  onPiece?: (done: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<EnsureDeliveryAudioResult> {
  const units = extractDeliveryNarrationUnits(opts.fullText, opts.locale);
  const corpus = narrationUnitsPlainCorpus(units).trim();
  if (!corpus) {
    throw new Error("tts_no_main_text");
  }
  if (corpus.length > DELIVERY_TTS_MAX_CHARS) {
    throw new Error("tts_text_too_long");
  }

  const queue = buildDeliveryTtsSpeakQueue(units);
  const speechTotal = queue.filter((p) => p.kind === "speech").length;
  if (speechTotal === 0) {
    throw new Error("tts_no_main_text");
  }

  const contentHash = await sha256Hex(
    `${DELIVERY_TTS_CACHE_VERSION}\n${opts.locale}\n${corpus}`,
  );
  const dedupeKey = `${opts.sessionId}::${contentHash}${opts.forceRefresh ? "::force" : ""}`;

  const existing = inflight.get(dedupeKey);
  if (existing) return existing;

  const run = (async (): Promise<EnsureDeliveryAudioResult> => {
    if (opts.forceRefresh) {
      await deleteAllDeliveryAudioForSession(opts.sessionId);
    }

    const cached = opts.forceRefresh
      ? null
      : await getDeliveryAudio(opts.sessionId, contentHash);
    if (cached?.blob && cached.blob.size > 32) {
      const objectUrl = URL.createObjectURL(cached.blob);
      revokeLater(objectUrl);
      const base64 = await blobToBase64(cached.blob);
      return {
        blob: cached.blob,
        mime: cached.mime || "audio/wav",
        objectUrl,
        base64,
        fromCache: true,
        charCount: cached.char_count,
        contentHash,
      };
    }

    const parts: Uint8Array[] = [];
    let totalBytes = 0;
    let rate = DEFAULT_PCM_RATE;
    let channels = DEFAULT_PCM_CHANNELS;
    let speechDone = 0;

    for (const piece of queue) {
      if (opts.signal?.aborted) {
        throw new Error("tts_aborted");
      }

      if (piece.kind === "silence") {
        const quiet = silencePcmBytes(piece.seconds, rate, channels);
        if (quiet.byteLength > 0) {
          parts.push(quiet);
          totalBytes += quiet.byteLength;
          opts.onBytes?.(totalBytes);
        }
        continue;
      }

      const utt = await fetchUtterancePcm({
        text: piece.text,
        locale: opts.locale,
        sessionId: opts.sessionId,
        signal: opts.signal,
      });
      rate = utt.rate;
      channels = utt.channels;
      parts.push(utt.pcm);
      totalBytes += utt.pcm.byteLength;
      speechDone += 1;
      opts.onBytes?.(totalBytes);
      opts.onPiece?.(speechDone, speechTotal);
    }

    if (totalBytes < 32) {
      throw new Error("tts_empty_audio");
    }

    const pcm = concatUint8(parts);
    const wavBytes = pcmToWavBytes(pcm, rate, channels);
    const wavCopy = new Uint8Array(wavBytes.byteLength);
    wavCopy.set(wavBytes);
    const blob = new Blob([wavCopy], { type: "audio/wav" });

    await putDeliveryAudio({
      sessionId: opts.sessionId,
      contentHash,
      locale: opts.locale,
      mime: "audio/wav",
      blob,
      charCount: corpus.length,
    });

    const objectUrl = URL.createObjectURL(blob);
    revokeLater(objectUrl);
    const base64 = await blobToBase64(blob);
    const frameBytes = 2 * channels;
    const pcmDurationSec = pcm.byteLength / frameBytes / rate;

    return {
      blob,
      mime: "audio/wav",
      objectUrl,
      base64,
      fromCache: false,
      charCount: corpus.length,
      contentHash,
      pcmDurationSec,
    };
  })();

  inflight.set(dedupeKey, run);
  try {
    return await run;
  } finally {
    inflight.delete(dedupeKey);
  }
}
