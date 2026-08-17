/**
 * Progressive delivery narration:
 * - Parallel Kokoro fetches (first clip plays ASAP; body prefetched during title)
 * - Per-piece IndexedDB checkpoint; full WAV when complete
 * - UI should call abortGeneration on stop/unmount so PCM does not keep growing in RAM
 */

import {
  deleteAllDeliveryAudioForSession,
  deleteDeliveryAudioPieces,
  getDeliveryAudio,
  listDeliveryAudioPieces,
  putDeliveryAudio,
  putDeliveryAudioPiece,
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
  /** Stop audible playback (ears only). */
  stopPlayback: () => void;
  /** Abort generation + drop in-memory job (stop / unmount / regenerate). */
  abortGeneration: () => void;
  done: Promise<void>;
  fromCache: boolean;
  cacheObjectUrl?: string;
  speechTotal: number;
  /** True while pieces are still being fetched / cached. */
  isCaching: () => boolean;
};

type SpeechSlot = { pcm: Uint8Array; rate: number; channels: number };

type NarrationJob = {
  key: string;
  sessionId: string;
  contentHash: string;
  locale: string;
  corpusLen: number;
  queue: DeliveryTtsSpeakPiece[];
  speechPieces: Array<Extract<DeliveryTtsSpeakPiece, { kind: "speech" }>>;
  speechSlots: Array<SpeechSlot | null>;
  speechDone: number;
  rate: number;
  channels: number;
  genAbort: AbortController;
  generationDone: Promise<void>;
  caching: boolean;
  listeners: Set<(done: number, total: number) => void>;
  errorListeners: Set<(err: Error) => void>;
};

const jobs = new Map<string, NarrationJob>();

/** Drop PCM + map entry when generation finished and nothing is listening. */
function releaseJobIfIdle(job: NarrationJob): void {
  if (jobs.get(job.key) !== job) return;
  if (job.caching) return;
  if (!job.genAbort.signal.aborted && job.listeners.size > 0) return;
  job.speechSlots = [];
  job.listeners.clear();
  job.errorListeners.clear();
  jobs.delete(job.key);
}

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
}): Promise<SpeechSlot> {
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

function jobKey(sessionId: string, contentHash: string): string {
  return `${sessionId}__${contentHash}`;
}

function notifyPiece(job: NarrationJob): void {
  for (const fn of job.listeners) {
    try {
      fn(job.speechDone, job.speechPieces.length);
    } catch {
      /* ignore */
    }
  }
}

async function persistPiece(
  job: NarrationJob,
  index: number,
  slot: SpeechSlot,
): Promise<void> {
  try {
    await putDeliveryAudioPiece({
      sessionId: job.sessionId,
      contentHash: job.contentHash,
      pieceIndex: index,
      locale: job.locale,
      rate: slot.rate,
      channels: slot.channels,
      pcm: slot.pcm,
    });
  } catch (e) {
    console.warn("[delivery-audio] piece cache skipped", e);
  }
}

async function finalizeFullWav(job: NarrationJob): Promise<void> {
  const parts: Uint8Array[] = [];
  let sIdx = 0;
  for (const piece of job.queue) {
    if (piece.kind === "silence") {
      parts.push(silencePcmBytes(piece.seconds, job.rate, job.channels));
    } else {
      const slot = job.speechSlots[sIdx++];
      if (slot) parts.push(slot.pcm);
    }
  }
  const pcm = concatUint8(parts);
  const wav = pcmToWavBytes(pcm, job.rate, job.channels);
  const wavCopy = new Uint8Array(wav.byteLength);
  wavCopy.set(wav);
  await putDeliveryAudio({
    sessionId: job.sessionId,
    contentHash: job.contentHash,
    locale: job.locale,
    mime: "audio/wav",
    blob: new Blob([wavCopy], { type: "audio/wav" }),
    charCount: job.corpusLen,
  });
  await deleteDeliveryAudioPieces(job.sessionId, job.contentHash);
}

function startGeneration(job: NarrationJob): Promise<void> {
  return (async () => {
    job.caching = true;
    try {
      const missing: number[] = [];
      for (let i = 0; i < job.speechPieces.length; i++) {
        if (!job.speechSlots[i]) missing.push(i);
      }

      // Prefer index 0 first in the pool ordering by sorting missing with 0 first
      // (mapPool still parallel — 0 is just claimed early).
      missing.sort((a, b) => a - b);

      await mapPool(missing, DELIVERY_TTS_FETCH_CONCURRENCY, async (speechIdx) => {
        if (job.genAbort.signal.aborted) throw new Error("tts_aborted");
        const piece = job.speechPieces[speechIdx]!;
        const utt = await fetchUtterancePcm({
          text: piece.text,
          locale: job.locale,
          sessionId: job.sessionId,
          signal: job.genAbort.signal,
        });
        job.speechSlots[speechIdx] = utt;
        job.rate = utt.rate;
        job.channels = utt.channels;
        job.speechDone = job.speechSlots.filter(Boolean).length;
        notifyPiece(job);
        await persistPiece(job, speechIdx, utt);
        return utt.pcm;
      });

      if (job.genAbort.signal.aborted) return;
      if (job.speechSlots.every(Boolean)) {
        await finalizeFullWav(job);
      }
    } catch (e) {
      if (job.genAbort.signal.aborted) return;
      const err = e instanceof Error ? e : new Error(String(e));
      for (const fn of job.errorListeners) {
        try {
          fn(err);
        } catch {
          /* ignore */
        }
      }
      throw e;
    } finally {
      job.caching = false;
      releaseJobIfIdle(job);
    }
  })();
}

type PlaybackSession = {
  player: DeliveryStreamAudioPlayer;
  stopPlayback: () => void;
};

/**
 * Attach a Web Audio playback session to an in-flight or completed piece set.
 * Waits for the next speech before enqueueing the silence that precedes it
 * (avoids title ending into a long underrun).
 */
function attachPlayback(
  job: NarrationJob,
  opts: {
    playbackRate?: number;
    onFirstAudio?: (ttfaMs: number) => void;
    onPlayingChange?: (playing: boolean) => void;
    onError?: (err: Error) => void;
  },
): PlaybackSession {
  const player = new DeliveryStreamAudioPlayer({
    onPlayingChange: opts.onPlayingChange,
    onError: opts.onError,
  });
  if (opts.playbackRate) player.setPlaybackRate(opts.playbackRate);

  let playbackActive = true;
  let drainAt = 0;
  let speechCursor = 0;
  let drainChain: Promise<void> = Promise.resolve();
  let firstAudioSent = false;
  const tStart = Date.now();
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const followingSpeechPending = (silenceAt: number): boolean => {
    let look = silenceAt + 1;
    while (look < job.queue.length && job.queue[look]!.kind === "silence") look += 1;
    if (look >= job.queue.length) return false;
    return !job.speechSlots[speechCursor];
  };

  const drainReady = (): Promise<void> => {
    drainChain = drainChain.then(async () => {
      while (playbackActive && drainAt < job.queue.length) {
        const piece = job.queue[drainAt]!;
        if (piece.kind === "silence") {
          if (followingSpeechPending(drainAt)) return;
          await player.enqueueSilence(piece.seconds, job.rate, job.channels);
          drainAt += 1;
          continue;
        }
        const slot = job.speechSlots[speechCursor];
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

  const onPiece = () => {
    void drainReady();
  };

  const stopPlayback = () => {
    playbackActive = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    job.listeners.delete(onPiece);
    player.stop();
    releaseJobIfIdle(job);
  };

  job.listeners.add(onPiece);

  // Kick immediately for already-cached pieces; poll lightly while caching.
  void drainReady();
  pollTimer = setInterval(() => {
    if (!playbackActive) return;
    void drainReady();
    if (!job.caching && drainAt >= job.queue.length) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      job.listeners.delete(onPiece);
      releaseJobIfIdle(job);
    }
  }, 120);

  void job.generationDone.finally(() => {
    void drainReady().finally(() => {
      job.listeners.delete(onPiece);
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      releaseJobIfIdle(job);
    });
  });

  return { player, stopPlayback };
}

export async function startDeliveryStreamNarration(opts: {
  sessionId: string;
  fullText: string;
  locale: string;
  forceRefresh?: boolean;
  playbackRate?: number;
  /** Abort generation (page leave / hard cancel). Stop-listening should NOT pass this. */
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
    `${DELIVERY_TTS_CACHE_VERSION}\nstream-v3\n${opts.locale}\n${corpus}`,
  );
  const key = jobKey(opts.sessionId, contentHash);

  if (opts.forceRefresh) {
    const prev = jobs.get(key);
    if (prev) {
      prev.genAbort.abort();
      jobs.delete(key);
    }
    await deleteAllDeliveryAudioForSession(opts.sessionId);
  }

  const cached = opts.forceRefresh
    ? null
    : await getDeliveryAudio(opts.sessionId, contentHash);
  if (cached?.blob && cached.blob.size > 32) {
    const cacheObjectUrl = URL.createObjectURL(cached.blob);
    const player = new DeliveryStreamAudioPlayer({
      onPlayingChange: opts.onPlayingChange,
      onError: opts.onError,
    });
    return {
      player,
      stopPlayback: () => {
        player.stop();
        try {
          URL.revokeObjectURL(cacheObjectUrl);
        } catch {
          /* ignore */
        }
      },
      abortGeneration: () => {
        /* nothing generating */
      },
      done: Promise.resolve(),
      fromCache: true,
      cacheObjectUrl,
      speechTotal: speechPieces.length,
      isCaching: () => false,
    };
  }

  let job = jobs.get(key);
  if (!job) {
    const speechSlots: Array<SpeechSlot | null> = speechPieces.map(() => null);
    let speechDone = 0;
    let rate = DEFAULT_PCM_RATE;
    let channels = DEFAULT_PCM_CHANNELS;

    // Resume from piece checkpoint
    const existing = await listDeliveryAudioPieces(opts.sessionId, contentHash);
    for (const row of existing) {
      if (row.piece_index < 0 || row.piece_index >= speechSlots.length) continue;
      const buf = new Uint8Array(await row.blob.arrayBuffer());
      if (buf.byteLength < 32) continue;
      speechSlots[row.piece_index] = {
        pcm: buf,
        rate: row.rate || DEFAULT_PCM_RATE,
        channels: row.channels || DEFAULT_PCM_CHANNELS,
      };
      rate = row.rate || rate;
      channels = row.channels || channels;
    }
    speechDone = speechSlots.filter(Boolean).length;

    const genAbort = new AbortController();
    if (opts.signal) {
      if (opts.signal.aborted) genAbort.abort();
      else {
        opts.signal.addEventListener(
          "abort",
          () => {
            genAbort.abort();
          },
          { once: true },
        );
      }
    }

    job = {
      key,
      sessionId: opts.sessionId,
      contentHash,
      locale: opts.locale,
      corpusLen: corpus.length,
      queue,
      speechPieces,
      speechSlots,
      speechDone,
      rate,
      channels,
      genAbort,
      generationDone: Promise.resolve(),
      caching: false,
      listeners: new Set(),
      errorListeners: new Set(),
    };
    jobs.set(key, job);
    job.generationDone = startGeneration(job);
  }

  if (opts.onPiece) {
    const progressFn = opts.onPiece;
    progressFn(job.speechDone, job.speechPieces.length);
    job.listeners.add(progressFn);
    void job.generationDone.finally(() => {
      job!.listeners.delete(progressFn);
      releaseJobIfIdle(job!);
    });
  }
  if (opts.onError) job.errorListeners.add(opts.onError);

  const playback = attachPlayback(job, {
    playbackRate: opts.playbackRate,
    onFirstAudio: opts.onFirstAudio,
    onPlayingChange: opts.onPlayingChange,
    onError: opts.onError,
  });

  const abortGeneration = () => {
    job!.genAbort.abort();
    playback.stopPlayback();
    job!.listeners.clear();
    job!.errorListeners.clear();
    job!.speechSlots = [];
    jobs.delete(key);
  };

  return {
    player: playback.player,
    stopPlayback: playback.stopPlayback,
    abortGeneration,
    done: job.generationDone.then(() => undefined),
    fromCache: false,
    speechTotal: job.speechPieces.length,
    isCaching: () => job!.caching || job!.speechDone < job!.speechPieces.length,
  };
}
