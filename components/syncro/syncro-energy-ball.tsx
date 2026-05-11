"use client";

import { useCallback } from "react";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

const SYNCRO_SCENE = "/spline/syncro-energy-ball.splinecode";

type SyncroEnergyBallProps = {
  className?: string;
  /** Camera zoom after load (1 = default). */
  initialZoom?: number;
};

/**
 * Syncro 能量球：直接加载 `public/spline/syncro-energy-ball.splinecode`（v4.0）。
 */
export function SyncroEnergyBall({ className, initialZoom = 1 }: SyncroEnergyBallProps) {
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

  return (
    <div className={`overflow-hidden rounded-2xl [&_canvas]:max-h-full [&_canvas]:max-w-full ${className ?? ""}`.trim()}>
      <Spline
        scene={SYNCRO_SCENE}
        className="h-full w-full"
        onLoad={initialZoom != null ? onLoad : undefined}
      />
    </div>
  );
}
