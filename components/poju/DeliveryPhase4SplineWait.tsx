"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";

import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";

import "@/styles/wait-ritual.css";
import "@/styles/delivery-phase4-ritual.css";

/** Same scene as Pivot marketing hero (`poju-product-hero.tsx`). */
export const PHASE4_HERO_SPLINE_SCENE = "/animations/POJURENscene.splinecode";

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

  return (
    <PreparingSplineShell
      blockInteraction
      eagerSpline
      scene={PHASE4_HERO_SPLINE_SCENE}
      sceneZoom={0.62}
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
