"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useState } from "react";
import type { Application } from "@splinetool/runtime";

import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";

import "@/styles/wait-ritual.css";
import "@/styles/delivery-phase4-ritual.css";

/** Same scene as Pivot marketing hero (`poju-product-hero.tsx`). */
export const PHASE4_HERO_SPLINE_SCENE = "/animations/POJURENscene.splinecode";

/**
 * Wider than marketing hero (0.62) — center column is narrower; pull camera back
 * so the wireframe figure sits smaller in frame.
 */
export const PHASE4_HERO_SPLINE_ZOOM = 0.36;

type Props = {
  /** When true, run exit fade then unmount via onExitComplete. */
  exiting?: boolean;
  onExitComplete?: () => void;
  className?: string;
};

/**
 * Full-center Pivot Hero Spline while Phase-4 waits for preface segment:ready.
 */
export function DeliveryPhase4SplineWait({
  exiting = false,
  onExitComplete,
  className,
}: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!exiting) return;
    if (reduceMotion) {
      onExitComplete?.();
      return;
    }
    const t = window.setTimeout(() => onExitComplete?.(), 700);
    return () => window.clearTimeout(t);
  }, [exiting, reduceMotion, onExitComplete]);

  const onSplineLoad = useCallback((app: Application) => {
    // Ensure timeline / idle motion runs (renderOnDemand=false alone is not always enough).
    try {
      app.play();
    } catch {
      // optional
    }
  }, []);

  return (
    <PreparingSplineShell
      blockInteraction
      eagerSpline
      scene={PHASE4_HERO_SPLINE_SCENE}
      sceneZoom={PHASE4_HERO_SPLINE_ZOOM}
      renderOnDemand={false}
      onSplineLoad={onSplineLoad}
      className={clsx(
        "delivery-phase4-spline",
        exiting && "delivery-phase4-spline--exit",
        reduceMotion && "delivery-phase4-spline--instant",
        className,
      )}
    >
      <div className="delivery-phase4-spline__veil" aria-hidden />
    </PreparingSplineShell>
  );
}
