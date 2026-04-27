"use client";

import { useCallback } from "react";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

type HeroSplineProps = {
  className?: string;
  /** Public path under `/`, e.g. `/animations/POJURENscene.splinecode` */
  scene?: string;
  /** Camera zoom after load (1 = default; smaller = wider framing). For tight exports in hero layouts. */
  initialZoom?: number;
};

const DEFAULT_SCENE = "/animations/XYscene.splinecode";

export function HeroSpline({ className, scene = DEFAULT_SCENE, initialZoom }: HeroSplineProps) {
  const onLoad = useCallback(
    (app: Application) => {
      if (initialZoom == null || initialZoom <= 0) return;
      const apply = () => app.setZoom(initialZoom);
      apply();
      requestAnimationFrame(apply);
      window.setTimeout(apply, 120);
    },
    [initialZoom]
  );

  return (
    <div className={`overflow-visible [&_canvas]:!max-h-none [&_canvas]:!max-w-none ${className ?? ""}`.trim()}>
      <Spline
        scene={scene}
        className="h-full w-full !overflow-visible"
        style={{ overflow: "visible" }}
        onLoad={initialZoom != null ? onLoad : undefined}
      />
    </div>
  );
}
