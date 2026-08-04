"use client";

/**
 * Delivery chrome audio controls — UI reserved for TTS playback.
 * Progress/speed work locally; wire real audio src later when TTS packs land.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const SPEEDS = [0.8, 1, 1.25, 1.5] as const;

export function DeliveryAudioChrome({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations("workspace.deliveryShelf");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = null;
  }, []);

  useEffect(() => () => stopRaf(), [stopRaf]);

  useEffect(() => {
    if (!playing || disabled) {
      stopRaf();
      return;
    }
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const rate = SPEEDS[speedIdx] ?? 1;
      setProgress((p) => {
        const next = p + dt * 0.04 * rate;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return stopRaf;
  }, [playing, disabled, speedIdx, stopRaf]);

  const togglePlay = () => {
    if (disabled) return;
    setPlaying((v) => {
      if (!v && progress >= 1) setProgress(0);
      return !v;
    });
  };

  const onSeek = (value: number) => {
    if (disabled) return;
    setProgress(Math.max(0, Math.min(1, value)));
  };

  const cycleSpeed = () => {
    if (disabled) return;
    setSpeedIdx((i) => (i + 1) % SPEEDS.length);
  };

  const speed = SPEEDS[speedIdx] ?? 1;

  return (
    <div
      className={`delivery-book-stage__audio${disabled ? " is-disabled" : ""}`}
      role="group"
      aria-label={t("audio_label")}
    >
      <button
        type="button"
        className="delivery-book-stage__chrome-btn delivery-book-stage__audio-play"
        disabled={disabled}
        aria-label={playing ? t("audio_pause") : t("audio_play")}
        onClick={togglePlay}
      >
        <span className="material-symbols-outlined" aria-hidden>
          {playing ? "pause" : "play_arrow"}
        </span>
      </button>
      <input
        type="range"
        className="delivery-book-stage__audio-seek"
        min={0}
        max={1}
        step={0.001}
        value={progress}
        disabled={disabled}
        aria-label={t("audio_seek")}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <button
        type="button"
        className="delivery-book-stage__chrome-btn delivery-book-stage__audio-speed"
        disabled={disabled}
        aria-label={t("audio_speed")}
        onClick={cycleSpeed}
      >
        {speed}x
      </button>
    </div>
  );
}
