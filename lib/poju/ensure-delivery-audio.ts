/**
 * Client: cache hit or stream PCM from /api/poju/delivery-tts → WAV → IndexedDB.
 * Full body in one OpenRouter call (no text slicing) for voice continuity.
 */

import {
  blobToBase64,
  getDeliveryAudio,
  putDeliveryAudio,
} from "@/lib/poju/delivery-audio-store";
import { extractDeliveryMainText } from "@/lib/poju/delivery-main-text";
import { DELIVERY_TTS_MAX_CHARS } from "@/lib/tts/delivery-tts-constants";
import {
  concatUint8,
  parsePcmContentType,
  pcmToWavBytes,
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

export async function ensureDeliveryAudio(opts: {
  sessionId: string;
  fullText: string;
  locale: string;
  onBytes?: (totalBytes: number) => void;
  signal?: AbortSignal;
}): Promise<EnsureDeliveryAudioResult> {
  const main = extractDeliveryMainText(opts.fullText, opts.locale).trim();
  if (!main) {
    throw new Error("tts_no_main_text");
  }
  if (main.length > DELIVERY_TTS_MAX_CHARS) {
    throw new Error("tts_text_too_long");
  }

  const contentHash = await sha256Hex(`${opts.locale}\n${main}`);
  const dedupeKey = `${opts.sessionId}::${contentHash}`;

  const existing = inflight.get(dedupeKey);
  if (existing) return existing;

  const run = (async (): Promise<EnsureDeliveryAudioResult> => {
    const cached = await getDeliveryAudio(opts.sessionId, contentHash);
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

    const res = await fetch("/api/poju/delivery-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        text: main,
        locale: opts.locale,
        session_id: opts.sessionId,
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
      throw new Error(data.detail || data.error || `tts_http_${res.status}`);
    }

    if (!res.body) {
      throw new Error("tts_empty_audio");
    }

    const headerRate = Number(res.headers.get("X-Delivery-Tts-Rate") || "");
    const headerCh = Number(res.headers.get("X-Delivery-Tts-Channels") || "");
    const meta = parsePcmContentType(res.headers.get("Content-Type"));
    const rate = Number.isFinite(headerRate) && headerRate > 0 ? headerRate : meta.rate;
    const channels = Number.isFinite(headerCh) && headerCh > 0 ? headerCh : meta.channels;

    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const copy = new Uint8Array(value.byteLength);
      copy.set(value);
      parts.push(copy);
      totalBytes += copy.byteLength;
      opts.onBytes?.(totalBytes);
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
      charCount: main.length,
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
      charCount: main.length,
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
