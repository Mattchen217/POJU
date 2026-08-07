"use client";

/**
 * Delivery chrome audio — progressive stream play (first clip ASAP).
 * Tutorial UX (SSE/Web Audio queue) adapted to Next.js + existing Kokoro route.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  DeliveryChromeIconBtn,
  DeliveryChromeTipButton,
} from "@/components/poju/DeliveryChromeIconBtn";
import type { DeliveryStreamAudioPlayer } from "@/lib/poju/delivery-stream-audio-player";
import { startDeliveryStreamNarration } from "@/lib/poju/start-delivery-stream-narration";

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
  const streamStopRef = useRef<(() => void) | null>(null);
  const streamPlayerRef = useRef<DeliveryStreamAudioPlayer | null>(null);
  const cacheUrlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pieceProgress, setPieceProgress] = useState<string | null>(null);
  const [ttfaMs, setTtfaMs] = useState<number | null>(null);
  const [mode, setMode] = useState<"stream" | "cache">("stream");

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
      streamStopRef.current?.();
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
    streamPlayerRef.current?.setPlaybackRate(speed);
  }, [speed]);

  const hardStop = useCallback(() => {
    streamStopRef.current?.();
    streamStopRef.current = null;
    streamPlayerRef.current = null;
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    if (cacheUrlRef.current) {
      try {
        URL.revokeObjectURL(cacheUrlRef.current);
      } catch {
        /* ignore */
      }
      cacheUrlRef.current = null;
    }
    setPlaying(false);
  }, []);

  const startStream = useCallback(
    async (forceRefresh: boolean) => {
      if (blocked) return;
      hardStop();
      const ac = new AbortController();

      setStatus("generating");
      setErrorKey(null);
      setPieceProgress(null);
      setTtfaMs(null);
      setProgress(0);
      setMode("stream");

      try {
        const handles = await startDeliveryStreamNarration({
          sessionId,
          fullText,
          locale,
          forceRefresh,
          playbackRate: speed,
          signal: ac.signal,
          onPiece: (done, total) => setPieceProgress(`${done}/${total}`),
          onFirstAudio: (ms) => {
            setTtfaMs(ms);
            setStatus("ready");
            setPlaying(true);
          },
          onPlayingChange: (p) => setPlaying(p),
          onError: (err) => {
            console.warn("[delivery-audio]", err.message);
            setStatus("error");
            setErrorKey("audio_failed");
            setPlaying(false);
          },
        });

        streamPlayerRef.current = handles.player;
        streamStopRef.current = () => {
          ac.abort();
          handles.stop();
        };

        if (handles.fromCache && handles.cacheObjectUrl) {
          setMode("cache");
          cacheUrlRef.current = handles.cacheObjectUrl;
          const el = audioRef.current;
          if (el) {
            el.src = handles.cacheObjectUrl;
            el.playbackRate = speed;
            el.load();
            setStatus("ready");
            await el.play();
            setPlaying(true);
          }
          setPieceProgress(null);
          return;
        }

        void handles.done.then(() => {
          setPieceProgress(null);
          setStatus((s) => (s === "error" ? s : "ready"));
        });
      } catch (e) {
        if (ac.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[delivery-audio]", msg);
        setStatus("error");
        if (msg.includes("too_long")) setErrorKey("audio_too_long");
        else if (msg.includes("not_configured") || msg.includes("503"))
          setErrorKey("audio_unavailable");
        else setErrorKey("audio_failed");
        setPlaying(false);
      }
    },
    [blocked, hardStop, sessionId, fullText, locale, speed],
  );

  const togglePlay = () => {
    if (blocked) return;
    void (async () => {
      if (playing) {
        hardStop();
        setStatus("ready");
        return;
      }

      if (mode === "cache" && audioRef.current?.src) {
        try {
          await audioRef.current.play();
        } catch {
          setStatus("error");
          setErrorKey("audio_failed");
        }
        return;
      }

      await startStream(false);
    })();
  };

  const regenerate = () => {
    if (blocked || status === "generating") return;
    void startStream(true);
  };

  const cycleSpeed = () => {
    if (blocked) return;
    setSpeedIdx((i) => (i + 1) % SPEEDS.length);
  };

  const speedLabel = Number.isInteger(speed) ? `${speed}x` : `${speed}x`;
  const busy = status === "generating" && !playing;
  const tip =
    status === "generating" || (playing && pieceProgress)
      ? [
          playing ? t("tip_stop") : t("audio_generating"),
          pieceProgress,
          ttfaMs != null ? `${ttfaMs}ms` : null,
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
        value={mode === "cache" ? progress : playing ? 0.05 : progress}
        disabled={blocked || busy || status === "error" || mode === "stream"}
        aria-label={t("audio_seek")}
        onChange={(e) => {
          if (mode !== "cache") return;
          const el = audioRef.current;
          const next = Math.max(0, Math.min(1, Number(e.target.value)));
          setProgress(next);
          if (el && el.duration && Number.isFinite(el.duration)) {
            el.currentTime = next * el.duration;
          }
        }}
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
