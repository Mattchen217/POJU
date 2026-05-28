"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { clsx } from "clsx";

import "@/styles/chart-loader.css";

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
  /** Shrink scene so bottom status + hint stay on screen (Glyph draw prep). */
  compactScene?: boolean;
  sceneZoom?: number;
};

export function PreparingSplineShell({
  children,
  blockInteraction = false,
  compactScene = false,
  sceneZoom,
}: PreparingSplineShellProps) {
  const zoom = sceneZoom ?? (compactScene ? 0.72 : 1);

  return (
    <div
      className={clsx(
        "preparing-spline-page preparing-spline-page--transition",
        blockInteraction && "preparing-spline-page--block-input",
        compactScene && "preparing-spline-page--compact",
      )}
    >
      {blockInteraction ? (
        <div className="preparing-spline-page__shield" aria-hidden tabIndex={-1} />
      ) : null}
      <PreparingAnalyzingSpline
        className="preparing-spline-page__scene"
        initialZoom={zoom}
      />
      {children}
    </div>
  );
}
