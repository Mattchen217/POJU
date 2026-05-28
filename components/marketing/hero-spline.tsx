"use client";

import type { Application } from "@splinetool/runtime";

import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";

type HeroSplineProps = {
  className?: string;
  /** Public path under `/`, e.g. `/animations/POJURENscene.splinecode` */
  scene?: string;
  /** Camera zoom after load (1 = default; smaller = wider framing). */
  initialZoom?: number;
  onLoad?: (app: Application) => void;
  pointerFollow?: boolean;
};

const DEFAULT_SCENE = "/animations/XYscene.splinecode";

export function HeroSpline({
  className,
  scene = DEFAULT_SCENE,
  initialZoom,
  onLoad,
  pointerFollow = true,
}: HeroSplineProps) {
  return (
    <SplineInteractiveScene
      scene={scene}
      className={className}
      initialZoom={initialZoom ?? 1}
      pointerFollow={pointerFollow}
      onLoad={onLoad}
    />
  );
}
