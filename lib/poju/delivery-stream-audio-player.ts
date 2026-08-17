/**
 * Web Audio gapless-ish queue player for progressive TTS (PCM 16-bit LE).
 * First buffer can start as soon as it arrives — no wait for the full report.
 */

import {
  DEFAULT_PCM_CHANNELS,
  DEFAULT_PCM_RATE,
  pcmToWavBytes,
} from "@/lib/tts/pcm-wav";

export type StreamAudioPlayerHooks = {
  onPlayingChange?: (playing: boolean) => void;
  onEndedAll?: () => void;
  onError?: (err: Error) => void;
};

export class DeliveryStreamAudioPlayer {
  private ctx: AudioContext | null = null;
  private queue: AudioBuffer[] = [];
  private source: AudioBufferSourceNode | null = null;
  private playing = false;
  private stopped = false;
  private playbackRate = 1;
  private hooks: StreamAudioPlayerHooks;

  constructor(hooks: StreamAudioPlayerHooks = {}) {
    this.hooks = hooks;
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate > 0 ? rate : 1;
    if (this.source) {
      try {
        this.source.playbackRate.value = this.playbackRate;
      } catch {
        /* ignore */
      }
    }
  }

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  /** Enqueue raw PCM (s16le). Starts playback if idle. */
  async enqueuePcm(
    pcm: Uint8Array,
    rate = DEFAULT_PCM_RATE,
    channels = DEFAULT_PCM_CHANNELS,
  ): Promise<void> {
    if (this.stopped) return;
    const ctx = await this.ensureContext();
    const wav = pcmToWavBytes(pcm, rate, channels);
    const copy = new Uint8Array(wav.byteLength);
    copy.set(wav);
    const audioBuffer = await ctx.decodeAudioData(copy.buffer);
    if (this.stopped) return;
    this.queue.push(audioBuffer);
    if (!this.playing) {
      this.playNext();
    }
  }

  /** Insert a quiet gap (seconds) into the play queue. */
  async enqueueSilence(
    seconds: number,
    rate = DEFAULT_PCM_RATE,
    channels = DEFAULT_PCM_CHANNELS,
  ): Promise<void> {
    if (this.stopped || !(seconds > 0)) return;
    const ctx = await this.ensureContext();
    const frames = Math.max(1, Math.floor(seconds * rate));
    const buffer = ctx.createBuffer(channels, frames, rate);
    this.queue.push(buffer);
    if (!this.playing) {
      this.playNext();
    }
  }

  private playNext(): void {
    if (this.stopped) return;
    if (!this.ctx) return;
    if (this.queue.length === 0) {
      this.playing = false;
      this.hooks.onPlayingChange?.(false);
      this.hooks.onEndedAll?.();
      return;
    }

    const buffer = this.queue.shift()!;
    this.playing = true;
    this.hooks.onPlayingChange?.(true);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.playbackRate;
    source.connect(this.ctx.destination);
    source.onended = () => {
      if (this.source === source) this.source = null;
      this.playNext();
    };
    this.source = source;
    try {
      source.start(0);
    } catch (e) {
      this.hooks.onError?.(e instanceof Error ? e : new Error(String(e)));
      this.playNext();
    }
  }

  stop(): void {
    this.stopped = true;
    this.queue = [];
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* ignore */
      }
      this.source = null;
    }
    this.playing = false;
    this.hooks.onPlayingChange?.(false);
    if (this.ctx) {
      const ctx = this.ctx;
      this.ctx = null;
      void ctx.close().catch(() => undefined);
    }
  }

  /** Allow reuse after stop (new narration session). Recreates AudioContext on next play. */
  resetForReuse(): void {
    this.stop();
    this.stopped = false;
  }

  isPlaying(): boolean {
    return this.playing;
  }
}
