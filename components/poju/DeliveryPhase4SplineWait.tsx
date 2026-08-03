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

/** Leave at least this fraction of shell height as cinema bars (split top/bottom). */
const LETTERBOX_MAX_STAGE_HEIGHT_RATIO = 0.82;

type Props = {
  /** When true, run exit fade then unmount via onExitComplete. */
  exiting?: boolean;
  onExitComplete?: () => void;
  className?: string;
};

type StagePx = { width: number; height: number };

/**
 * Fit a 16:9 frame inside the shell.
 * Prefer full width; if that would fill (or nearly fill) the column, shrink
 * so top/bottom cinema bars stay visible. Never stretch to column height.
 */
function measureLetterbox(shellW: number, shellH: number): StagePx {
  const wMax = Math.max(0, Math.floor(shellW));
  const hMax = Math.max(0, Math.floor(shellH * LETTERBOX_MAX_STAGE_HEIGHT_RATIO));
  if (wMax < 64 || hMax < 36) return { width: 0, height: 0 };

  let width = wMax;
  let height = Math.round((width * 9) / 16);
  if (height > hMax) {
    height = hMax;
    width = Math.round((height * 16) / 9);
  }
  return { width, height };
}

/**
 * Center-column Pivot Hero Spline while Phase-4 waits for preface segment:ready.
 * Explicit 16:9 letterbox (not full-column stretch). Continuous render + rAF.
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

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const measure = () => {
      const next = measureLetterbox(shell.clientWidth, shell.clientHeight);
      setStagePx((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(shell);
    return () => ro.disconnect();
  }, []);

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
    const shell = shellRef.current;
    if (shell) {
      const next = measureLetterbox(shell.clientWidth, shell.clientHeight);
      if (next.width >= 64) {
        try {
          app.setSize(next.width, next.height);
        } catch {
          // optional
        }
      }
    }
  }, []);

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
        data-sized={stageReady ? "true" : undefined}
        style={
          stageReady
            ? {
                width: `${stagePx.width}px`,
                height: `${stagePx.height}px`,
                maxWidth: "100%",
                maxHeight: "100%",
                paddingBottom: 0,
              }
            : undefined
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
