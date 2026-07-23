"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";
import { clsx } from "clsx";

import {
  type HeavyWebGLContext,
  useAllowHeavyWebGL,
} from "@/lib/client/allow-heavy-webgl";
import { bindSplinePointerBridge } from "@/lib/spline/spline-pointer-bridge";
import { applySplineZoom } from "@/lib/spline/apply-spline-zoom";

import "@/styles/spline-interactive.css";

type SplineInteractiveSceneProps = {
  scene: string;
  className?: string;
  style?: CSSProperties;
  /** Camera zoom after load (smaller = wider framing, circle fits on screen). */
  initialZoom?: number;
  /** Route pointer / touch to the WebGL canvas (mobile follow). */
  pointerFollow?: boolean;
  /** `preparing` keeps WebGL in installed PWA (single scene); default skips marketing WebGL in PWA. */
  webGLContext?: HeavyWebGLContext;
  /** Lower internal canvas resolution while keeping full-screen CSS size. */
  renderScale?: number;
  /** When false, keeps rendering so camera framing updates apply (Match card). */
  renderOnDemand?: boolean;
  onLoad?: (app: Application, root: HTMLDivElement | null) => void;
};

export function SplineInteractiveScene({
  scene,
  className,
  style,
  initialZoom = 1,
  pointerFollow = true,
  webGLContext = "marketing",
  renderScale = 1,
  renderOnDemand = true,
  onLoad,
}: SplineInteractiveSceneProps) {
  const allowWebGL = useAllowHeavyWebGL(webGLContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  const disposeSplineApp = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    const canvas = rootRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    try {
      (app as unknown as { dispose?: () => void }).dispose?.();
    } catch {
      // optional
    }
    try {
      const gl =
        (canvas?.getContext("webgl2") as WebGLRenderingContext | null) ??
        (canvas?.getContext("webgl") as WebGLRenderingContext | null) ??
        (canvas?.getContext("experimental-webgl") as WebGLRenderingContext | null);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      // optional
    }
    appRef.current = null;
  }, []);

  useEffect(() => {
    setSceneReady(false);
    return () => {
      disposeSplineApp();
    };
  }, [scene, disposeSplineApp]);

  const handleLoad = useCallback(
    (app: Application) => {
      appRef.current = app;
      if (initialZoom > 0) {
        applySplineZoom(app, initialZoom);
      }
      if (renderScale > 0 && renderScale < 1) {
        const root = rootRef.current;
        const rw = root?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0);
        const rh = root?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 0);
        if (rw > 0 && rh > 0) {
          const w = Math.max(320, Math.floor(rw * renderScale));
          const h = Math.max(240, Math.floor(rh * renderScale));
          try {
            app.setSize(w, h);
          } catch {
            // optional
          }
        }
      }
      try {
        app.setBackgroundColor("transparent");
      } catch {
        // optional
      }
      const canvas = rootRef.current?.querySelector("canvas");
      if (canvas) {
        canvas.style.background = "transparent";
      }
      onLoad?.(app, rootRef.current);
      setSceneReady(true);
    },
    [initialZoom, onLoad, renderScale],
  );

  useEffect(() => {
    const root = rootRef.current;
    const app = appRef.current;
    if (!allowWebGL || !sceneReady || !root || !app || initialZoom <= 0) return;

    const reapply = () => {
      applySplineZoom(app, initialZoom);
      try {
        app.setBackgroundColor("transparent");
      } catch {
        // optional
      }
      const canvas = root.querySelector("canvas");
      if (canvas) {
        canvas.style.background = "transparent";
      }
    };
    reapply();
    const observer = new ResizeObserver(reapply);
    observer.observe(root);
    return () => observer.disconnect();
  }, [allowWebGL, initialZoom, scene, sceneReady]);

  useEffect(() => {
    if (!allowWebGL || !pointerFollow) return;
    return bindSplinePointerBridge(rootRef.current);
  }, [allowWebGL, pointerFollow, scene]);

  if (!allowWebGL) {
    return (
      <div
        className={clsx("spline-interactive-scene spline-interactive-scene--static", className)}
        style={style}
        aria-hidden
      />
    );
  }

  return (
    <div ref={rootRef} className={clsx("spline-interactive-scene", className)} style={style}>
      <Spline scene={scene} className="h-full w-full" renderOnDemand={renderOnDemand} onLoad={handleLoad} />
    </div>
  );
}
