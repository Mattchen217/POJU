"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

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
export function PreparingSplineShell({ children }: { children: ReactNode }) {
  return (
    <div className="preparing-spline-page preparing-spline-page--transition">
      <PreparingAnalyzingSpline className="preparing-spline-page__scene" />
      {children}
    </div>
  );
}
