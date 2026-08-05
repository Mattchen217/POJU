"use client";

/**
 * Delivery chrome audio controls — UI reserved for TTS playback.
 * Progress/speed work locally; wire real audio src later when TTS packs land.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { DeliveryChromeIconBtn } from "@/components/poju/DeliveryChromeIconBtn";

const SPEEDS = [1, 1.5, 2, 3] as const;
const PLAY_ICON = "/v2/bofangicon.svg";
const STOP_ICON = "/v2/stopicon.svg";

export function DeliveryAudioChrome({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations("workspace.deliveryShelf");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
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
  const speedLabel = Number.isInteger(speed) ? `${speed}x` : `${speed}x`;

  return (
    <div
      className={`delivery-book-stage__audio${disabled ? " is-disabled" : ""}`}
      role="group"
      aria-label={t("audio_label")}
    >
      <DeliveryChromeIconBtn
        src={playing ? STOP_ICON : PLAY_ICON}
        label={playing ? t("audio_pause") : t("audio_play")}
        disabled={disabled}
        onClick={togglePlay}
      />
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
        className="delivery-book-stage__audio-speed"
        disabled={disabled}
        aria-label={t("audio_speed")}
        onClick={cycleSpeed}
      >
        {speedLabel}
      </button>
    </div>
  );
}
