"use client";

/**
 * Delivery chrome audio — lazy TTS on first Play; optional force regen.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  DeliveryChromeIconBtn,
  DeliveryChromeTipButton,
} from "@/components/poju/DeliveryChromeIconBtn";
import { ensureDeliveryAudio } from "@/lib/poju/ensure-delivery-audio";

const SPEEDS = [0.8, 1, 1.25, 1.5] as const;
const PLAY_ICON = "/v2/bofangicon.svg";
const STOP_ICON = "/v2/stopicon.svg";

type Status = "idle" | "generating" | "ready" | "error";

type Props = {
  disabled?: boolean;
  sessionId: string;
  fullText: string;
  locale: string;
  enabled?: boolean;
};

export function DeliveryAudioChrome({
  disabled = false,
  sessionId,
  fullText,
  locale,
  enabled = true,
}: Props) {
  const t = useTranslations("workspace.deliveryShelf");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [recvKb, setRecvKb] = useState(0);
  const [pieceProgress, setPieceProgress] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const blocked = disabled || !enabled;
  const speed = SPEEDS[speedIdx] ?? 1;

  useEffect(() => {
    const el = document.createElement("audio");
    el.preload = "metadata";
    audioRef.current = el;

    const onTime = () => {
      if (!el.duration || !Number.isFinite(el.duration)) return;
      setProgress(el.currentTime / el.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(1);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    return () => {
      abortRef.current?.abort();
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = speed;
  }, [speed]);

  const clearPlayerSrc = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {
        /* ignore */
      }
      objectUrlRef.current = null;
    }
    setPlaying(false);
    setProgress(0);
  }, []);

  const ensureReady = useCallback(
    async (forceRefresh = false): Promise<boolean> => {
      if (blocked) return false;
      if (!forceRefresh && status === "ready" && audioRef.current?.src) return true;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (forceRefresh) {
        clearPlayerSrc();
      }

      setStatus("generating");
      setErrorKey(null);
      setRecvKb(0);
      setPieceProgress(null);

      try {
        const pack = await ensureDeliveryAudio({
          sessionId,
          fullText,
          locale,
          forceRefresh,
          onBytes: (n) => setRecvKb(Math.round(n / 1024)),
          onPiece: (done, total) => setPieceProgress(`${done}/${total}`),
          signal: ac.signal,
        });

        if (ac.signal.aborted) return false;

        objectUrlRef.current = pack.objectUrl;
        const el = audioRef.current;
        if (!el) return false;
        el.src = pack.objectUrl;
        el.load();
        setStatus("ready");
        setRecvKb(0);
        setPieceProgress(null);
        return true;
      } catch (e) {
        if (ac.signal.aborted) return false;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[delivery-audio]", msg);
        setStatus("error");
        if (msg.includes("too_long")) setErrorKey("audio_too_long");
        else if (msg.includes("not_configured") || msg.includes("503"))
          setErrorKey("audio_unavailable");
        else setErrorKey("audio_failed");
        setPlaying(false);
        return false;
      }
    },
    [blocked, status, sessionId, fullText, locale, clearPlayerSrc],
  );

  const togglePlay = () => {
    if (blocked) return;
    void (async () => {
      const el = audioRef.current;
      if (!el) return;

      if (playing) {
        el.pause();
        return;
      }

      if (status === "ready" && el.src) {
        if (progress >= 0.995) {
          el.currentTime = 0;
          setProgress(0);
        }
        try {
          await el.play();
        } catch (err) {
          console.warn("[delivery-audio] play failed", err);
          setStatus("error");
          setErrorKey("audio_failed");
        }
        return;
      }

      const ok = await ensureReady(false);
      if (!ok || !audioRef.current) return;

      if (progress >= 0.995) {
        audioRef.current.currentTime = 0;
        setProgress(0);
      }
      try {
        await audioRef.current.play();
      } catch (err) {
        console.warn("[delivery-audio] play failed", err);
        setStatus("error");
        setErrorKey("audio_failed");
      }
    })();
  };

  const regenerate = () => {
    if (blocked || status === "generating") return;
    void (async () => {
      const ok = await ensureReady(true);
      if (!ok || !audioRef.current) return;
      try {
        await audioRef.current.play();
      } catch (err) {
        console.warn("[delivery-audio] play after regen failed", err);
        setStatus("error");
        setErrorKey("audio_failed");
      }
    })();
  };

  const onSeek = (value: number) => {
    if (blocked || status !== "ready") return;
    const el = audioRef.current;
    const next = Math.max(0, Math.min(1, value));
    setProgress(next);
    if (el && el.duration && Number.isFinite(el.duration)) {
      el.currentTime = next * el.duration;
    }
  };

  const cycleSpeed = () => {
    if (blocked) return;
    setSpeedIdx((i) => (i + 1) % SPEEDS.length);
  };

  const speedLabel = Number.isInteger(speed) ? `${speed}x` : `${speed}x`;
  const busy = status === "generating";
  const tip =
    status === "generating"
      ? [
          t("audio_generating"),
          pieceProgress ? pieceProgress : null,
          recvKb > 0 ? `${recvKb} KB` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : status === "error"
        ? t(
            errorKey === "audio_too_long"
              ? "audio_too_long"
              : errorKey === "audio_unavailable"
                ? "audio_unavailable"
                : "audio_failed",
          )
        : playing
          ? t("tip_stop")
          : t("tip_listen");

  return (
    <div
      className={`delivery-book-stage__audio${blocked ? " is-disabled" : ""}${busy ? " is-generating" : ""}`}
      role="group"
      aria-label={t("audio_label")}
      aria-busy={busy || undefined}
    >
      <div
        className={`delivery-book-stage__audio-play${busy ? " is-generating" : ""}${
          status === "ready" || playing ? " is-ready" : ""
        }`}
      >
        {busy ? (
          <span className="delivery-book-stage__audio-spin" aria-hidden />
        ) : null}
        <DeliveryChromeIconBtn
          src={playing ? STOP_ICON : PLAY_ICON}
          label={playing ? t("audio_pause") : busy ? t("audio_generating") : t("audio_play")}
          tip={tip}
          disabled={blocked || busy}
          onClick={togglePlay}
        />
      </div>
      <input
        type="range"
        className="delivery-book-stage__audio-seek"
        min={0}
        max={1}
        step={0.001}
        value={progress}
        disabled={blocked || busy || status === "error"}
        aria-label={t("audio_seek")}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <DeliveryChromeTipButton
        className="delivery-book-stage__audio-speed"
        disabled={blocked || busy}
        aria-label={t("audio_speed")}
        tip={t("tip_speed")}
        onClick={cycleSpeed}
      >
        {speedLabel}
      </DeliveryChromeTipButton>
      <DeliveryChromeTipButton
        className="delivery-book-stage__audio-regen"
        disabled={blocked || busy}
        aria-label={t("audio_regen")}
        tip={t("tip_regen_audio")}
        onClick={regenerate}
      >
        {t("audio_regen")}
      </DeliveryChromeTipButton>
    </div>
  );
}
