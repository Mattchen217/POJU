"use client";

import { useCallback, useEffect, useRef } from "react";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";
import { clsx } from "clsx";

import {
  type HeavyWebGLContext,
  useAllowHeavyWebGL,
} from "@/lib/client/allow-heavy-webgl";
import { bindSplinePointerBridge } from "@/lib/spline/spline-pointer-bridge";

import "@/styles/spline-interactive.css";

type SplineInteractiveSceneProps = {
  scene: string;
  className?: string;
  /** Camera zoom after load (smaller = wider framing, circle fits on screen). */
  initialZoom?: number;
  /** Route pointer / touch to the WebGL canvas (mobile follow). */
  pointerFollow?: boolean;
  /** `preparing` keeps WebGL in installed PWA (single scene); default skips marketing WebGL in PWA. */
  webGLContext?: HeavyWebGLContext;
  onLoad?: (app: Application) => void;
};

export function SplineInteractiveScene({
  scene,
  className,
  initialZoom = 1,
  pointerFollow = true,
  webGLContext = "marketing",
  onLoad,
}: SplineInteractiveSceneProps) {
  const allowWebGL = useAllowHeavyWebGL(webGLContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  const handleLoad = useCallback(
    (app: Application) => {
      appRef.current = app;
      if (initialZoom > 0) {
        const apply = () => app.setZoom(initialZoom);
        apply();
        requestAnimationFrame(apply);
        window.setTimeout(apply, 120);
        window.setTimeout(apply, 400);
      }
      try {
        app.setBackgroundColor("transparent");
      } catch {
        // optional
      }
      onLoad?.(app);
    },
    [initialZoom, onLoad],
  );

  useEffect(() => {
    if (!allowWebGL || !pointerFollow) return;
    return bindSplinePointerBridge(rootRef.current);
  }, [allowWebGL, pointerFollow, scene]);

  if (!allowWebGL) {
    return (
      <div
        className={clsx("spline-interactive-scene spline-interactive-scene--static", className)}
        aria-hidden
      />
    );
  }

  return (
    <div ref={rootRef} className={clsx("spline-interactive-scene", className)}>
      <Spline scene={scene} className="h-full w-full" onLoad={handleLoad} />
    </div>
  );
}
