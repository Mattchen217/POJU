"use client";

import { useCallback } from "react";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

/** `public/spline/Analyzing-scene.splinecode` */
export const PREPARING_ANALYZING_SCENE = "/spline/Analyzing-scene.splinecode";

type PreparingAnalyzingSplineProps = {
  className?: string;
  /** Camera zoom after load (1 = default). */
  initialZoom?: number;
};

/**
 * Full-screen analyzing scene for `/preparing` — unmounts when navigating to chat.
 */
export function PreparingAnalyzingSpline({
  className,
  initialZoom = 1,
}: PreparingAnalyzingSplineProps) {
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
    <div className={`preparing-analyzing-spline ${className ?? ""}`.trim()} aria-hidden>
      <Spline scene={PREPARING_ANALYZING_SCENE} className="h-full w-full" onLoad={onLoad} />
    </div>
  );
}
