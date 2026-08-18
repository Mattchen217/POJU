"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Application } from "@splinetool/runtime";
import { clsx } from "clsx";

import {
  type HeavyWebGLContext,
  useAllowHeavyWebGL,
} from "@/lib/client/allow-heavy-webgl";
import { bindSplinePointerBridge } from "@/lib/spline/spline-pointer-bridge";
import { applySplineZoom } from "@/lib/spline/apply-spline-zoom";
import {
  isSplineBlocked,
  registerSplineRuntime,
  unregisterSplineRuntime,
} from "@/lib/spline/spline-runtime-registry";
import {
  hardDisposeSplineApp,
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

type LoadOpts = {
  initialZoom: number;
  renderScale: number;
  renderOnDemand: boolean;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const optsRef = useRef<LoadOpts>({
    initialZoom,
    renderScale,
    renderOnDemand,
    onLoad,
  });
  optsRef.current = { initialZoom, renderScale, renderOnDemand, onLoad };

  const disposeSplineApp = useCallback(() => {
    const app = appRef.current;
    appRef.current = null;
    setSceneReady(false);
    if (!app) return;
    unregisterSplineRuntime(app);
    hardDisposeSplineApp(app, canvasRef.current);
  }, []);

  const applyLoadedApp = useCallback((app: Application) => {
    const { initialZoom: zoom, renderScale: scale, renderOnDemand: onDemand, onLoad: loaded } =
      optsRef.current;
    registerSplineRuntime(app);
    if (isSplineBlocked()) {
      unregisterSplineRuntime(app);
      hardDisposeSplineApp(app, canvasRef.current);
      appRef.current = null;
      return;
    }
    softCapSplineParticles(app);

    if (!onDemand) {
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
    if (zoom > 0) {
      applySplineZoom(app, zoom);
    }
    const root = rootRef.current;
    const rw = root?.clientWidth ?? 0;
    const rh = root?.clientHeight ?? 0;
    if (rw > 0 && rh > 0) {
      const factor = scale > 0 && scale < 1 ? scale : 1;
      const w = Math.max(1, Math.floor(rw * factor));
      const h = Math.max(1, Math.floor(rh * factor));
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
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.background = "transparent";
    }
    loaded?.(app, rootRef.current);
    setSceneReady(true);
  }, []);

  useEffect(() => {
    if (!allowWebGL) {
      disposeSplineApp();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let app: Application | null = null;

    void (async () => {
      const { Application } = await import("@splinetool/runtime");
      if (cancelled || isSplineBlocked()) return;
      app = new Application(canvas);
      try {
        await app.load(scene);
      } catch {
        if (!cancelled) hardDisposeSplineApp(app, canvas);
        return;
      }
      if (cancelled || isSplineBlocked()) {
        hardDisposeSplineApp(app, canvas);
        return;
      }
      appRef.current = app;
      applyLoadedApp(app);
    })();

    return () => {
      cancelled = true;
      if (appRef.current) {
        disposeSplineApp();
      } else if (app) {
        hardDisposeSplineApp(app, canvas);
      }
    };
  }, [allowWebGL, scene, applyLoadedApp, disposeSplineApp]);

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
      const canvas = canvasRef.current;
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

  /** Pause when off-screen (SPA hide) — leftover heroes must not keep simulating. */
  useEffect(() => {
    const root = rootRef.current;
    if (!allowWebGL || !sceneReady || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0);
        if (!visible) pauseSplineRuntime(appRef.current);
        else if (!document.hidden) {
          resumeSplineRuntime(appRef.current, { continuous: continuousRef.current });
        }
      },
      { threshold: 0.02 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [allowWebGL, sceneReady]);

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
      <canvas
        ref={canvasRef}
        className="spline-interactive-scene__canvas"
        aria-hidden
      />
    </div>
  );
}
