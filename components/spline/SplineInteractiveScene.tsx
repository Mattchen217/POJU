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
import {
  registerSplineRuntime,
  unregisterSplineRuntime,
} from "@/lib/spline/spline-runtime-registry";
import {
  pauseSplineRuntime,
  resumeSplineRuntime,
  softCapSplineParticles,
} from "@/lib/spline/throttle-spline-runtime";

import "@/styles/spline-interactive.css";

const IDLE_PAUSE_MS = 40_000;

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
  renderScale: renderScaleProp,
  renderOnDemand = true,
  onLoad,
}: SplineInteractiveSceneProps) {
  const allowWebGL = useAllowHeavyWebGL(webGLContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const continuousRef = useRef(!renderOnDemand);
  continuousRef.current = !renderOnDemand;
  /** Marketing heroes: half-res GPU. Preparing keep full res. */
  const renderScale =
    typeof renderScaleProp === "number"
      ? renderScaleProp
      : webGLContext === "preparing"
        ? 1
        : 0.55;

  const disposeSplineApp = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    const canvas = rootRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    pauseSplineRuntime(app);
    unregisterSplineRuntime(app);
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
    setSceneReady(false);
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
      registerSplineRuntime(app);
      softCapSplineParticles(app);

      // Deprecated renderOnDemand=false → force continuous so idle animations keep moving.
      if (!renderOnDemand) {
        try {
          app.renderOnDemand = false;
        } catch {
          // optional
        }
        try {
          (app as unknown as { renderMode?: string }).renderMode = "continuous";
        } catch {
          // optional
        }
        try {
          app.play();
        } catch {
          // optional
        }
      } else {
        try {
          app.renderOnDemand = true;
        } catch {
          // optional
        }
      }
      if (initialZoom > 0) {
        applySplineZoom(app, initialZoom);
      }
      // Use the host box only — never fall back to window (that blows past letterbox parents).
      const root = rootRef.current;
      const rw = root?.clientWidth ?? 0;
      const rh = root?.clientHeight ?? 0;
      if (rw > 0 && rh > 0) {
        const scale = renderScale > 0 && renderScale < 1 ? renderScale : 1;
        const w = Math.max(1, Math.floor(rw * scale));
        const h = Math.max(1, Math.floor(rh * scale));
        try {
          app.setSize(w, h);
        } catch {
          // optional
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
    [initialZoom, onLoad, renderOnDemand, renderScale],
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
    if (!allowWebGL || !pointerFollow || !sceneReady) return;
    return bindSplinePointerBridge(rootRef.current);
  }, [allowWebGL, pointerFollow, scene, sceneReady]);

  /** Pause Spline when tab hidden; marketing also freezes after idle (particle CPU). */
  useEffect(() => {
    if (!allowWebGL || !sceneReady) return;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let pausedForIdle = false;
    const idleEnabled = webGLContext !== "preparing";

    const clearIdle = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const pause = () => {
      pauseSplineRuntime(appRef.current);
    };

    const resume = () => {
      if (document.hidden) return;
      resumeSplineRuntime(appRef.current, { continuous: continuousRef.current });
      pausedForIdle = false;
    };

    const armIdle = () => {
      if (!idleEnabled) return;
      clearIdle();
      idleTimer = setTimeout(() => {
        idleTimer = null;
        pausedForIdle = true;
        pause();
      }, IDLE_PAUSE_MS);
    };

    const onActivity = () => {
      if (document.hidden) return;
      if (pausedForIdle) resume();
      armIdle();
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearIdle();
        pause();
      } else {
        resume();
        armIdle();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (idleEnabled) {
      window.addEventListener("pointerdown", onActivity, { passive: true });
      window.addEventListener("mousemove", onActivity, { passive: true });
      window.addEventListener("keydown", onActivity);
      window.addEventListener("scroll", onActivity, { passive: true, capture: true });
      armIdle();
    }
    onVisibility();

    return () => {
      clearIdle();
      document.removeEventListener("visibilitychange", onVisibility);
      if (idleEnabled) {
        window.removeEventListener("pointerdown", onActivity);
        window.removeEventListener("mousemove", onActivity);
        window.removeEventListener("keydown", onActivity);
        window.removeEventListener("scroll", onActivity, true);
      }
    };
  }, [allowWebGL, sceneReady, webGLContext]);

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
