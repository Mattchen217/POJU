"use client";

import type { Application } from "@splinetool/runtime";

import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";
import { PREPARING_ANALYZING_ZOOM } from "@/lib/poju/preparing-spline-timing";

/** `public/spline/Analyzing-scene.splinecode` */
export const PREPARING_ANALYZING_SCENE = "/spline/Analyzing-scene.splinecode";

export { PREPARING_ANALYZING_ZOOM };

type PreparingAnalyzingSplineProps = {
  className?: string;
  initialZoom?: number;
  onLoad?: (app: Application) => void;
};

/**
 * Full-screen analyzing scene for `/preparing` — unmounts when navigating to chat.
 */
export function PreparingAnalyzingSpline({
  className,
  initialZoom = PREPARING_ANALYZING_ZOOM,
  onLoad,
}: PreparingAnalyzingSplineProps) {
  return (
    <SplineInteractiveScene
      scene={PREPARING_ANALYZING_SCENE}
      className={className}
      initialZoom={initialZoom}
      pointerFollow
      webGLContext="preparing"
      onLoad={onLoad}
    />
  );
}
