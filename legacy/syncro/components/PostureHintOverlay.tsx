"use client";

import { useEffect, useState } from "react";
import { IconDeviceMobile } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { checkPosture, type PostureMode } from "@/lib/syncro/posture-check";

import "@/styles/syncro-posture.css";

export type PostureHintOverlayProps = {
  mode: PostureMode;
  beta: number | null;
};

export function PostureHintOverlay({ mode, beta }: PostureHintOverlayProps) {
  const t = useTranslations("syncro.posture");
  const isPostureCorrect = checkPosture(mode, beta);

  const [mounted, setMounted] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (isPostureCorrect) {
      setFadingOut(true);
      const timer = window.setTimeout(() => setMounted(false), 500);
      return () => window.clearTimeout(timer);
    }

    setMounted(true);
    setFadingOut(false);
  }, [isPostureCorrect]);

  if (!mounted) {
    return null;
  }

  const iconRotation = mode === "compass" ? 90 : 0;

  return (
    <div
      className={`posture-overlay ${fadingOut ? "fading-out" : "showing"}`}
      role="status"
      aria-live="polite"
    >
      <div className="posture-content">
        <div className="posture-icon">
          <span
            className="posture-icon-glyph"
            style={{ transform: `rotate(${iconRotation}deg)` }}
            aria-hidden
          >
            <IconDeviceMobile size={30} stroke={1.5} />
          </span>
        </div>

        <h3 className="posture-title">
          {mode === "compass" ? t("hold_flat_title") : t("hold_upright_title")}
        </h3>

        <p className="posture-desc">
          {mode === "compass" ? t("hold_flat_desc") : t("hold_upright_desc")}
        </p>
      </div>
    </div>
  );
}
