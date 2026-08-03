"use client";

import { clsx } from "clsx";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";

import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";

import "@/styles/delivery-phase4-ritual.css";

/** Same scene as Pivot marketing hero (`poju-product-hero.tsx`). */
export const PHASE4_HERO_SPLINE_SCENE = "/animations/POJURENscene.splinecode";

/** Framing inside a measured 16:9 letterbox. */
export const PHASE4_HERO_SPLINE_ZOOM = 0.55;

type Props = {
  /** When true, run exit fade then unmount via onExitComplete. */
  exiting?: boolean;
  onExitComplete?: () => void;
  className?: string;
};

type StagePx = { width: number; height: number };

/**
 * Center-column Pivot Hero Spline while Phase-4 waits for preface segment:ready.
 * Letterbox is JS-measured 16:9 (CSS aspect-ratio fails in this flex column).
 * Continuous renderMode + rAF requestRender so idle motion runs.
 */
export function DeliveryPhase4SplineWait({
  exiting = false,
  onExitComplete,
  className,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [stagePx, setStagePx] = useState<StagePx>({ width: 0, height: 0 });

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

  // Explicit 16:9 from shell width — full width, cinema bars top/bottom.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const measure = () => {
      const w = Math.max(0, Math.floor(shell.clientWidth));
      const h = Math.max(0, Math.round((w * 9) / 16));
      setStagePx((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(shell);
    return () => ro.disconnect();
  }, []);

  // Keep canvas buffer matched to letterbox stage.
  useEffect(() => {
    const app = appRef.current;
    if (!app || stagePx.width < 64 || stagePx.height < 36) return;
    try {
      app.setSize(stagePx.width, stagePx.height);
    } catch {
      // optional
    }
  }, [stagePx.height, stagePx.width]);

  const onSplineLoad = useCallback((app: Application) => {
    appRef.current = app;
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
  }, []);

  // Keep frames dirty while mounted — some builds stall after first paint without pointer input.
  useEffect(() => {
    if (reduceMotion || stagePx.width < 64) return;
    let raf = 0;
    const tick = () => {
      const app = appRef.current;
      if (app && !app.isStopped) {
        try {
          app.requestRender();
        } catch {
          // optional
        }
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [reduceMotion, stagePx.width]);

  useEffect(() => {
    return () => {
      appRef.current = null;
    };
  }, []);

  const stageReady = stagePx.width >= 64 && stagePx.height >= 36;

  return (
    <div
      ref={shellRef}
      className={clsx(
        "delivery-phase4-spline",
        reduceMotion && "delivery-phase4-spline--instant",
        className,
      )}
      aria-hidden
    >
      <div
        className="delivery-phase4-spline__stage"
        style={
          stageReady
            ? { width: stagePx.width, height: stagePx.height }
            : { width: "100%", aspectRatio: "16 / 9" }
        }
      >
        {stageReady ? (
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
        ) : (
          <div className="delivery-phase4-spline__fallback" />
        )}
      </div>
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
