/**
 * Progressive delivery narration: first Kokoro clip plays ASAP;
 * remaining clips prefetch in parallel and enqueue in order.
 */

import {
  deleteAllDeliveryAudioForSession,
  getDeliveryAudio,
  putDeliveryAudio,
} from "@/lib/poju/delivery-audio-store";
import { DeliveryStreamAudioPlayer } from "@/lib/poju/delivery-stream-audio-player";
import {
  buildDeliveryTtsSpeakQueue,
  extractDeliveryNarrationUnits,
  narrationUnitsPlainCorpus,
  type DeliveryTtsSpeakPiece,
} from "@/lib/poju/delivery-narration-units";
import {
  DELIVERY_TTS_CACHE_VERSION,
  DELIVERY_TTS_FETCH_CONCURRENCY,
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

export type StreamNarrationHandles = {
  player: DeliveryStreamAudioPlayer;
  stop: () => void;
  done: Promise<void>;
  fromCache: boolean;
  /** Set when fromCache — chrome can play via HTMLAudioElement. */
  cacheObjectUrl?: string;
  speechTotal: number;
};

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function fetchUtterancePcm(opts: {
  text: string;
  locale: string;
  sessionId: string;
  signal?: AbortSignal;
}): Promise<{ pcm: Uint8Array; rate: number; channels: number }> {
  const once = async () => {
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
    if (buf.byteLength < 32) throw new Error("tts_empty_audio");
    return { pcm: buf, rate, channels };
  };

  try {
    return await once();
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (
      !(
        msg.includes("504") ||
        msg.includes("502") ||
        msg.includes("timeout") ||
        msg.includes("tts_upstream_5") ||
        msg.includes("tts_failed")
      )
    ) {
      throw e;
    }
    return once();
  }
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function runWorker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!, i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => runWorker()));
  return results;
}

export async function startDeliveryStreamNarration(opts: {
  sessionId: string;
  fullText: string;
  locale: string;
  forceRefresh?: boolean;
  playbackRate?: number;
  signal?: AbortSignal;
  onPiece?: (done: number, total: number) => void;
  onFirstAudio?: (ttfaMs: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onError?: (err: Error) => void;
}): Promise<StreamNarrationHandles> {
  const units = extractDeliveryNarrationUnits(opts.fullText, opts.locale);
  const corpus = narrationUnitsPlainCorpus(units).trim();
  if (!corpus) throw new Error("tts_no_main_text");
  if (corpus.length > DELIVERY_TTS_MAX_CHARS) throw new Error("tts_text_too_long");

  const queue = buildDeliveryTtsSpeakQueue(units, undefined, { shortFirstClip: true });
  const speechPieces = queue.filter(
    (p): p is Extract<DeliveryTtsSpeakPiece, { kind: "speech" }> => p.kind === "speech",
  );
  if (speechPieces.length === 0) throw new Error("tts_no_main_text");

  const contentHash = await sha256Hex(
    `${DELIVERY_TTS_CACHE_VERSION}\nstream-v1\n${opts.locale}\n${corpus}`,
  );

  if (opts.forceRefresh) {
    await deleteAllDeliveryAudioForSession(opts.sessionId);
  }

  const player = new DeliveryStreamAudioPlayer({
    onPlayingChange: opts.onPlayingChange,
    onError: opts.onError,
  });
  if (opts.playbackRate) player.setPlaybackRate(opts.playbackRate);

  const cached = opts.forceRefresh
    ? null
    : await getDeliveryAudio(opts.sessionId, contentHash);
  if (cached?.blob && cached.blob.size > 32) {
    const cacheObjectUrl = URL.createObjectURL(cached.blob);
    return {
      player,
      stop: () => {
        player.stop();
        try {
          URL.revokeObjectURL(cacheObjectUrl);
        } catch {
          /* ignore */
        }
      },
      done: Promise.resolve(),
      fromCache: true,
      cacheObjectUrl,
      speechTotal: speechPieces.length,
    };
  }

  const speechSlots: Array<{ pcm: Uint8Array; rate: number; channels: number } | null> =
    speechPieces.map(() => null);
  let rate = DEFAULT_PCM_RATE;
  let channels = DEFAULT_PCM_CHANNELS;
  let speechDone = 0;
  let drainAt = 0;
  let speechCursor = 0;
  const tStart = Date.now();
  let firstAudioSent = false;
  let stopped = false;
  let drainChain: Promise<void> = Promise.resolve();

  const stop = () => {
    stopped = true;
    player.stop();
  };

  /** Serialize drain — parallel fetch workers must not double-enqueue. */
  const drainReady = (): Promise<void> => {
    drainChain = drainChain.then(async () => {
      while (!stopped && drainAt < queue.length) {
        if (opts.signal?.aborted) throw new Error("tts_aborted");
        const piece = queue[drainAt]!;
        if (piece.kind === "silence") {
          await player.enqueueSilence(piece.seconds, rate, channels);
          drainAt += 1;
          continue;
        }
        const slot = speechSlots[speechCursor];
        if (!slot) return;
        await player.enqueuePcm(slot.pcm, slot.rate, slot.channels);
        if (!firstAudioSent) {
          firstAudioSent = true;
          opts.onFirstAudio?.(Date.now() - tStart);
        }
        speechCursor += 1;
        drainAt += 1;
      }
    });
    return drainChain;
  };

  const done = (async () => {
    const first = speechPieces[0]!;
    const firstUtt = await fetchUtterancePcm({
      text: first.text,
      locale: opts.locale,
      sessionId: opts.sessionId,
      signal: opts.signal,
    });
    if (stopped) return;
    rate = firstUtt.rate;
    channels = firstUtt.channels;
    speechSlots[0] = firstUtt;
    speechDone = 1;
    opts.onPiece?.(speechDone, speechPieces.length);
    await drainReady();

    const rest = speechPieces.slice(1);
    if (rest.length > 0) {
      await mapPool(rest, DELIVERY_TTS_FETCH_CONCURRENCY, async (piece, restIdx) => {
        if (stopped || opts.signal?.aborted) throw new Error("tts_aborted");
        const utt = await fetchUtterancePcm({
          text: piece.text,
          locale: opts.locale,
          sessionId: opts.sessionId,
          signal: opts.signal,
        });
        speechSlots[restIdx + 1] = utt;
        rate = utt.rate;
        channels = utt.channels;
        speechDone += 1;
        opts.onPiece?.(speechDone, speechPieces.length);
        await drainReady();
        return utt.pcm;
      });
    }

    await drainReady();

    try {
      const parts: Uint8Array[] = [];
      let sIdx = 0;
      for (const piece of queue) {
        if (piece.kind === "silence") {
          parts.push(silencePcmBytes(piece.seconds, rate, channels));
        } else {
          const slot = speechSlots[sIdx++];
          if (slot) parts.push(slot.pcm);
        }
      }
      const pcm = concatUint8(parts);
      const wav = pcmToWavBytes(pcm, rate, channels);
      const wavCopy = new Uint8Array(wav.byteLength);
      wavCopy.set(wav);
      await putDeliveryAudio({
        sessionId: opts.sessionId,
        contentHash,
        locale: opts.locale,
        mime: "audio/wav",
        blob: new Blob([wavCopy], { type: "audio/wav" }),
        charCount: corpus.length,
      });
    } catch (e) {
      console.warn("[delivery-audio] cache write skipped", e);
    }
  })();

  done.catch((e) => {
    if (stopped) return;
    opts.onError?.(e instanceof Error ? e : new Error(String(e)));
  });

  return {
    player,
    stop,
    done,
    fromCache: false,
    speechTotal: speechPieces.length,
  };
}
