"use client";

import { clsx } from "clsx";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { Application } from "@splinetool/runtime";

import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";

import "@/styles/delivery-phase4-ritual.css";

/** Same scene as Pivot marketing hero (`poju-product-hero.tsx`). */
export const PHASE4_HERO_SPLINE_SCENE = "/animations/POJURENscene.splinecode";

/**
 * Framing inside a 16:9 letterbox (not full-column stretch).
 * Closer to marketing hero 0.62 than the old full-bleed 0.36.
 */
export const PHASE4_HERO_SPLINE_ZOOM = 0.55;

type Props = {
  /** When true, run exit fade then unmount via onExitComplete. */
  exiting?: boolean;
  onExitComplete?: () => void;
  className?: string;
};

/**
 * Center-column Pivot Hero Spline while Phase-4 waits for preface segment:ready.
 * Letterboxed 16:9 (full width, cinema bars top/bottom). Continuous render so
 * idle motion runs — does not use PreparingSplineShell (desktop renderScale 0.5
 * + parent opacity animation freeze WebGL).
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
    try {
      app.play();
    } catch {
      // optional
    }
    // Some Spline builds need a second kick after first layout.
    window.setTimeout(() => {
      try {
        app.play();
      } catch {
        // optional
      }
    }, 120);
  }, []);

  return (
    <div
      className={clsx(
        "delivery-phase4-spline",
        reduceMotion && "delivery-phase4-spline--instant",
        className,
      )}
      aria-hidden
    >
      <div className="delivery-phase4-spline__stage">
        <Suspense fallback={<div className="delivery-phase4-spline__fallback" />}>
          <SplineInteractiveScene
            scene={PHASE4_HERO_SPLINE_SCENE}
            className="delivery-phase4-spline__scene"
            initialZoom={PHASE4_HERO_SPLINE_ZOOM}
            pointerFollow={false}
            webGLContext="preparing"
            renderScale={1}
            renderOnDemand={false}
            onLoad={onSplineLoad}
          />
        </Suspense>
      </div>
      {/* Fade only this veil — never opacity-animate the WebGL parent (freezes canvas). */}
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
