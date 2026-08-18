"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import type { Application } from "@splinetool/runtime";

import { useAllowHeavyWebGL } from "@/lib/client/allow-heavy-webgl";
import { getPreparingDeviceProfile } from "@/lib/client/preparing-device-profile";
import { PREPARING_ANALYZING_ZOOM } from "@/lib/poju/preparing-spline-timing";
import { PreparingSplineControlContext } from "@/components/poju/preparing-spline-control";
import {
  registerSplineRuntime,
  unregisterSplineRuntime,
} from "@/lib/spline/spline-runtime-registry";
import { pauseSplineRuntime } from "@/lib/spline/throttle-spline-runtime";

import "@/styles/chart-loader.css";
import "@/styles/spline-interactive.css";

const PreparingAnalyzingSpline = dynamic(
  () =>
    import("@/components/poju/PreparingAnalyzingSpline").then((m) => ({
      default: m.PreparingAnalyzingSpline,
    })),
  { ssr: false },
);

const PREPARING_ANALYZING_SCENE = "/spline/Analyzing-scene.splinecode";

/**
 * Full-screen POJU analyzing Spline + overlay children (status steps, errors).
 * Mount once per `/preparing` route (see preparing/layout.tsx).
 */
type PreparingSplineShellProps = {
  children: ReactNode;
  sceneZoom?: number;
  /** Spline scene URL — defaults to matrix bazi analyzing scene */
  scene?: string;
  /** Standalone pages (Glyph/Match) without layout parent. Merges with `usePreparingBlockInput`. */
  blockInteraction?: boolean;
  /**
   * Skip desktop deferSplineMs — mount WebGL immediately.
   * Use for workspace crossfade so the scene is ready when birth UI fades out.
   */
  eagerSpline?: boolean;
  /** Extra framing / backdrop clear after scene load (e.g. workspace zoom). */
  onSplineLoad?: (app: Application) => void;
  /**
   * false keeps the WebGL loop running so Spline idle animations move
   * (Phase-4 hero wait). Default true matches analyzing cost profile.
   */
  renderOnDemand?: boolean;
  className?: string;
};

export function PreparingSplineShell({
  children,
  sceneZoom = PREPARING_ANALYZING_ZOOM,
  scene,
  blockInteraction: blockInteractionProp = false,
  eagerSpline = false,
  onSplineLoad,
  renderOnDemand = true,
  className,
}: PreparingSplineShellProps) {
  const allowWebGL = useAllowHeavyWebGL("preparing");
  const profile = useMemo(() => getPreparingDeviceProfile(), []);
  const appRef = useRef<Application | null>(null);
  const deferMs = eagerSpline ? 0 : profile.deferSplineMs;
  const [mountSpline, setMountSpline] = useState(deferMs === 0);
  const [blockFromContext, setBlockFromContext] = useState(false);
  const blockInteraction = blockInteractionProp || blockFromContext;
  const activeScene = scene ?? PREPARING_ANALYZING_SCENE;

  useEffect(() => {
    if (mountSpline || deferMs <= 0) return;
    const timer = window.setTimeout(() => setMountSpline(true), deferMs);
    return () => window.clearTimeout(timer);
  }, [mountSpline, deferMs]);

  const registerApp = useCallback((app: Application | null) => {
    if (appRef.current && appRef.current !== app) {
      pauseSplineRuntime(appRef.current);
      unregisterSplineRuntime(appRef.current);
    }
    appRef.current = app;
    if (app) registerSplineRuntime(app);
  }, []);

  const pauseScene = useCallback(() => {
    pauseSplineRuntime(appRef.current);
  }, []);

  const handleSplineLoad = useCallback(
    (app: Application) => {
      registerApp(app);
      onSplineLoad?.(app);
    },
    [registerApp, onSplineLoad],
  );

  useEffect(() => {
    return () => {
      const app = appRef.current;
      if (!app) return;
      pauseSplineRuntime(app);
      unregisterSplineRuntime(app);
      try {
        app.dispose();
      } catch {
        // optional
      }
      appRef.current = null;
    };
  }, [activeScene]);

  const controlValue = useMemo(
    () => ({
      registerApp,
      pauseScene,
      setBlockInteraction: setBlockFromContext,
    }),
    [registerApp, pauseScene],
  );

  const showSpline = allowWebGL && mountSpline;

  return (
    <PreparingSplineControlContext.Provider value={controlValue}>
      <div
        className={clsx(
          "preparing-spline-page preparing-spline-page--transition",
          blockInteraction && "preparing-spline-page--block-input",
          !allowWebGL && "preparing-spline-page--no-webgl",
          className,
        )}
      >
        {blockInteraction ? (
          <div className="preparing-spline-page__shield" aria-hidden tabIndex={-1} />
        ) : null}
        <div className="preparing-spline-page__scene-wrap" aria-hidden>
          {showSpline ? (
            <PreparingAnalyzingSpline
              key={activeScene}
              className="preparing-spline-page__scene"
              initialZoom={sceneZoom}
              scene={activeScene}
              renderOnDemand={renderOnDemand}
              onLoad={handleSplineLoad}
            />
          ) : (
            <div className="preparing-spline-page__scene preparing-spline-page__scene--static" />
          )}
        </div>
        {children}
      </div>
    </PreparingSplineControlContext.Provider>
  );
}
