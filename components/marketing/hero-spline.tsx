"use client";

import type { Application } from "@splinetool/runtime";

import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";
import { useSplineBlocked } from "@/lib/spline/spline-runtime-registry";

type HeroSplineProps = {
  className?: string;
  /** Public path under `/`, e.g. `/animations/POJURENscene.splinecode` */
  scene?: string;
  /** Camera zoom after load (1 = default; smaller = wider framing). */
  initialZoom?: number;
  onLoad?: (app: Application) => void;
  pointerFollow?: boolean;
  /** When false, keeps idle scene motion running without pointer input. */
  renderOnDemand?: boolean;
  /** Workspace: keep the scene loaded; do not dispose after a few seconds idle. */
  keepAlive?: boolean;
};

const DEFAULT_SCENE = "/animations/XYscene.splinecode";

export function HeroSpline({
  className,
  scene = DEFAULT_SCENE,
  initialZoom,
  onLoad,
  pointerFollow = true,
  renderOnDemand = true,
  keepAlive = false,
}: HeroSplineProps) {
  const splineBlocked = useSplineBlocked();
  if (splineBlocked) {
    return <div className={className} aria-hidden />;
  }

  return (
    <SplineInteractiveScene
      scene={scene}
      className={className}
      initialZoom={initialZoom ?? 1}
      pointerFollow={pointerFollow}
      renderOnDemand={keepAlive ? false : renderOnDemand}
      keepAlive={keepAlive}
      onLoad={onLoad}
    />
  );
}
