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

const IDLE_PAUSE_MS = 12_000;

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
  const [idleFrozen, setIdleFrozen] = useState(false);
  const runScene = allowWebGL && !idleFrozen;
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

  const inflightRef = useRef<Application | null>(null);
  const optsRef = useRef<LoadOpts>({
    initialZoom,
    renderScale,
    renderOnDemand,
    onLoad,
  });
  optsRef.current = { initialZoom, renderScale, renderOnDemand, onLoad };

  const disposeSplineApp = useCallback(() => {
    const app = appRef.current ?? inflightRef.current;
    appRef.current = null;
    inflightRef.current = null;
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
    if (!runScene) {
      disposeSplineApp();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    void (async () => {
      const { Application } = await import("@splinetool/runtime");
      if (cancelled || isSplineBlocked()) return;
      const app = new Application(canvas);
      inflightRef.current = app;
      try {
        await app.load(scene);
      } catch {
        if (inflightRef.current === app) {
          inflightRef.current = null;
          hardDisposeSplineApp(app, canvas);
        }
        return;
      }
      if (cancelled || isSplineBlocked() || inflightRef.current !== app) {
        hardDisposeSplineApp(app, canvas);
        if (inflightRef.current === app) inflightRef.current = null;
        return;
      }
      appRef.current = app;
      applyLoadedApp(app);
    })();

    return () => {
      cancelled = true;
      disposeSplineApp();
    };
  }, [runScene, scene, applyLoadedApp, disposeSplineApp]);

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

  /** Pause Spline when tab hidden; marketing disposes after idle (stop() does not halt particles). */
  useEffect(() => {
    if (!allowWebGL) return;
    const idleEnabled = webGLContext !== "preparing";

    if (!idleEnabled) {
      const onVisibility = () => {
        if (document.hidden) pauseSplineRuntime(appRef.current);
        else resumeSplineRuntime(appRef.current, { continuous: continuousRef.current });
      };
      document.addEventListener("visibilitychange", onVisibility);
      onVisibility();
      return () => document.removeEventListener("visibilitychange", onVisibility);
    }

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const clearIdle = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const freeze = () => {
      setIdleFrozen(true);
    };

    const thaw = () => {
      if (document.hidden) return;
      setIdleFrozen(false);
    };

    const armIdle = () => {
      clearIdle();
      idleTimer = setTimeout(() => {
        idleTimer = null;
        freeze();
      }, IDLE_PAUSE_MS);
    };

    const onActivity = () => {
      if (document.hidden) return;
      thaw();
      armIdle();
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearIdle();
        freeze();
      } else {
        thaw();
        armIdle();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true, capture: true });
    armIdle();

    return () => {
      clearIdle();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity, true);
    };
  }, [allowWebGL, webGLContext]);

  if (!runScene) {
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
