"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { clsx } from "clsx";

import { useAllowHeavyWebGL } from "@/lib/client/allow-heavy-webgl";
import { PREPARING_ANALYZING_ZOOM } from "@/lib/poju/preparing-spline-timing";

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
 * Used on POJU `/preparing`, Glyph draw prep, and Glyph full-reading wait.
 */
type PreparingSplineShellProps = {
  children: ReactNode;
  /** Block mouse / touch until the next step (errors still use overlay buttons). */
  blockInteraction?: boolean;
  sceneZoom?: number;
};

export function PreparingSplineShell({
  children,
  blockInteraction = false,
  sceneZoom = PREPARING_ANALYZING_ZOOM,
}: PreparingSplineShellProps) {
  const allowWebGL = useAllowHeavyWebGL();

  return (
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
        {allowWebGL ? (
          <PreparingAnalyzingSpline className="preparing-spline-page__scene" initialZoom={sceneZoom} />
        ) : (
          <div className="preparing-spline-page__scene preparing-spline-page__scene--static" />
        )}
      </div>
      {children}
    </div>
  );
}
