"use client";

import { useCallback, useState } from "react";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";
import { clsx } from "clsx";

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
  const [sceneReady, setSceneReady] = useState(false);

  const onLoad = useCallback(
    (app: Application) => {
      if (initialZoom != null && initialZoom > 0) {
        const apply = () => app.setZoom(initialZoom);
        apply();
        requestAnimationFrame(apply);
        window.setTimeout(apply, 120);
      }
      window.setTimeout(() => setSceneReady(true), 80);
    },
    [initialZoom],
  );

  return (
    <div
      className={clsx(
        "preparing-analyzing-spline",
        sceneReady && "preparing-analyzing-spline--ready",
        className,
      )}
      aria-hidden
    >
      <Spline scene={PREPARING_ANALYZING_SCENE} className="h-full w-full" onLoad={onLoad} />
    </div>
  );
}
