"use client";

import { useCallback } from "react";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

import { useAllowHeavyWebGL } from "@/lib/client/allow-heavy-webgl";

const SYNCRO_SCENE = "/spline/syncro-energy-ball.splinecode";

type SyncroEnergyBallProps = {
  className?: string;
  /** Camera zoom after load (1 = default). */
  initialZoom?: number;
  /** Hero 全屏背景：不裁切、无圆角 */
  variant?: "default" | "hero";
};

/**
 * Syncro 能量球：直接加载 `public/spline/syncro-energy-ball.splinecode`（v4.0）。
 */
export function SyncroEnergyBall({ className, initialZoom = 1, variant = "default" }: SyncroEnergyBallProps) {
  const allowWebGL = useAllowHeavyWebGL();
  const onLoad = useCallback(
    (app: Application) => {
      if (initialZoom == null || initialZoom <= 0) return;
      const apply = () => app.setZoom(initialZoom);
      apply();
      requestAnimationFrame(apply);
      window.setTimeout(apply, 120);
    },
    [initialZoom],
  );

  const shellClass =
    variant === "hero"
      ? `overflow-visible [&_canvas]:!max-h-none [&_canvas]:!max-w-none ${className ?? ""}`
      : `overflow-hidden rounded-2xl [&_canvas]:max-h-full [&_canvas]:max-w-full ${className ?? ""}`;

  if (!allowWebGL) {
    return <div className={`${shellClass.trim()} bg-bg-deep/80`} aria-hidden />;
  }

  return (
    <div className={shellClass.trim()}>
      <Spline
        scene={SYNCRO_SCENE}
        className="h-full w-full"
        onLoad={initialZoom != null ? onLoad : undefined}
      />
    </div>
  );
}
