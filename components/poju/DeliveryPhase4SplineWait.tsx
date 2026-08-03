"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";

import { HeroSpline } from "@/components/marketing/hero-spline";

import "@/styles/product-hero.css";
import "@/styles/delivery-phase4-ritual.css";

/** Same scene + zoom as Pivot marketing / workspace hero (`poju-product-hero.tsx`). */
export const PHASE4_HERO_SPLINE_SCENE = "/animations/POJURENscene.splinecode";
export const PHASE4_HERO_SPLINE_ZOOM = 0.62;

type Props = {
  /** When true, run exit fade then unmount via onExitComplete. */
  exiting?: boolean;
  onExitComplete?: () => void;
  className?: string;
};

/**
 * Phase-4 wait: same HeroSpline as Pivot hero, centered in the center column.
 * No custom letterbox sizing — layout mirrors workspace `.poju-hero-spline`.
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
    <div
      className={clsx(
        "delivery-phase4-spline",
        reduceMotion && "delivery-phase4-spline--instant",
        className,
      )}
      aria-hidden
    >
      <HeroSpline
        scene={PHASE4_HERO_SPLINE_SCENE}
        initialZoom={PHASE4_HERO_SPLINE_ZOOM}
        className="poju-hero-spline"
        pointerFollow={false}
        renderOnDemand={false}
      />
      <div
        className={clsx(
          "delivery-phase4-spline__fade",
          !reduceMotion && "delivery-phase4-spline__fade--enter",
          exiting && "delivery-phase4-spline__fade--exit",
          reduceMotion && exiting && "delivery-phase4-spline__fade--solid",
        )}
      />
    </div>
  );
}
