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

import "@/styles/chart-loader.css";
import "@/styles/spline-interactive.css";

const PreparingAnalyzingSpline = dynamic(
  () =>
    import("@/components/poju/PreparingAnalyzingSpline").then((m) => ({
      default: m.PreparingAnalyzingSpline,
    })),
  { ssr: false },
);

/**
 * Full-screen POJU analyzing Spline + overlay children (status steps, errors).
 * Mount once per `/preparing` route (see preparing/layout.tsx).
 */
type PreparingSplineShellProps = {
  children: ReactNode;
  sceneZoom?: number;
  /** Standalone pages (Glyph/Match) without layout parent. Merges with `usePreparingBlockInput`. */
  blockInteraction?: boolean;
};

export function PreparingSplineShell({
  children,
  sceneZoom = PREPARING_ANALYZING_ZOOM,
  blockInteraction: blockInteractionProp = false,
}: PreparingSplineShellProps) {
  const allowWebGL = useAllowHeavyWebGL("preparing");
  const profile = useMemo(() => getPreparingDeviceProfile(), []);
  const appRef = useRef<Application | null>(null);
  const [mountSpline, setMountSpline] = useState(profile.deferSplineMs === 0);
  const [blockFromContext, setBlockFromContext] = useState(false);
  const blockInteraction = blockInteractionProp || blockFromContext;

  useEffect(() => {
    if (mountSpline || profile.deferSplineMs <= 0) return;
    const timer = window.setTimeout(() => setMountSpline(true), profile.deferSplineMs);
    return () => window.clearTimeout(timer);
  }, [mountSpline, profile.deferSplineMs]);

  const registerApp = useCallback((app: Application | null) => {
    appRef.current = app;
  }, []);

  const pauseScene = useCallback(() => {
    try {
      appRef.current?.stop();
    } catch {
      // optional
    }
  }, []);

  const handleSplineLoad = useCallback(
    (app: Application) => {
      registerApp(app);
    },
    [registerApp],
  );

  useEffect(() => {
    return () => {
      try {
        appRef.current?.dispose();
      } catch {
        // optional
      }
      appRef.current = null;
    };
  }, []);

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
        )}
      >
        {blockInteraction ? (
          <div className="preparing-spline-page__shield" aria-hidden tabIndex={-1} />
        ) : null}
        <div className="preparing-spline-page__scene-wrap" aria-hidden>
          {showSpline ? (
            <PreparingAnalyzingSpline
              className="preparing-spline-page__scene"
              initialZoom={sceneZoom}
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
