"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export function SyncroVRMode() {
  const t = useTranslations("syncro.vr");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t("not_supported"));
        setStarting(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            /* autoplay policies — muted inline usually ok */
          });
        }

        setStarting(false);
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setError(message);
          setStarting(false);
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [t]);

  if (error) {
    return (
      <div className="syncro-vr-error" role="alert">
        <p>{t("denied")}</p>
        <p className="syncro-vr-error-detail">{error}</p>
      </div>
    );
  }

  return (
    <div className="syncro-vr-frame" aria-label={t("frame_label")}>
      {starting ? <div className="syncro-vr-loading" aria-hidden /> : null}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="vr-video"
      />
    </div>
  );
}
