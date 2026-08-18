"use client";

import type { Application } from "@splinetool/runtime";

import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";
import { getPreparingDeviceProfile } from "@/lib/client/preparing-device-profile";
import { PREPARING_ANALYZING_ZOOM } from "@/lib/poju/preparing-spline-timing";
import { useSplineBlocked } from "@/lib/spline/spline-runtime-registry";

/** `public/spline/Analyzing-scene.splinecode` */
export const PREPARING_ANALYZING_SCENE = "/spline/Analyzing-scene.splinecode";

export { PREPARING_ANALYZING_ZOOM };

type PreparingAnalyzingSplineProps = {
  className?: string;
  initialZoom?: number;
  scene?: string;
  onLoad?: (app: Application) => void;
  /** false = continuous render (idle animations keep moving). Default true. */
  renderOnDemand?: boolean;
};

/**
 * Full-screen analyzing scene for `/preparing` — unmounts when navigating to chat.
 */
export function PreparingAnalyzingSpline({
  className,
  initialZoom = PREPARING_ANALYZING_ZOOM,
  scene = PREPARING_ANALYZING_SCENE,
  onLoad,
  renderOnDemand = true,
}: PreparingAnalyzingSplineProps) {
  const splineBlocked = useSplineBlocked();
  const profile = getPreparingDeviceProfile();

  if (splineBlocked) {
    return <div className={className} aria-hidden />;
  }

  return (
    <SplineInteractiveScene
      key={scene}
      scene={scene}
      className={className}
      initialZoom={initialZoom}
      pointerFollow={profile.pointerFollow}
      renderScale={profile.renderScale}
      webGLContext="preparing"
      renderOnDemand={renderOnDemand}
      onLoad={onLoad}
    />
  );
}
