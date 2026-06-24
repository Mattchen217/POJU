"use client";

import { useEffect, useMemo, useState } from "react";

import {
  POJU_HOW_STEP_PARTICLE_RGB,
  PojuHowWorksFrameParticles,
  PojuHowWorksGoldRing,
} from "@/components/marketing/poju-how-works-particles";
import { ACTIVITY_CAPTION_RING_ROTATE_MS } from "@/lib/ui/activity-caption-timing";
import {
  POJU_HOW_RING_RADIUS_VB,
  POJU_HOW_WORKS_VB,
} from "@/lib/poju/poju-how-works-layout";

type Accent = "purple" | "cyan" | "pink";

export type PojuHowWorksStep = {
  title: string;
  description: string;
};

const accents: Accent[] = ["purple", "cyan", "pink", "purple", "cyan", "pink"];

/** 沿节点外法线方向推出文本框；左右两步略远，避免被圆点光晕遮挡 */
const OUTWARD_DIST_INACTIVE_REM = [7, 8.5, 8.5, 7, 9.25, 9.25] as const;
const OUTWARD_DIST_ACTIVE_REM = [9, 10.75, 10.75, 9, 11.5, 11.5] as const;

function labelOutwardTransform(cos: number, sin: number, stepIndex: number, active: boolean): string {
  const dist = active ? OUTWARD_DIST_ACTIVE_REM[stepIndex]! : OUTWARD_DIST_INACTIVE_REM[stepIndex]!;
  return `translate(-50%, -50%) translate(calc(${cos} * ${dist}rem), calc(${sin} * ${dist}rem))`;
}

function labelAlign(cos: number): "center" | "left" | "right" {
  if (cos > 0.28) return "left";
  if (cos < -0.28) return "right";
  return "center";
}

function combinedFrameShell(active: boolean) {
  return `relative overflow-visible pointer-events-auto flex min-h-0 shrink-0 flex-col justify-center rounded-[6px] bg-black/22 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-3.5 sm:py-3 ${
    active
      ? "min-h-[9.5rem] w-[15.5rem] gap-2 bg-black/30 sm:min-h-[10.25rem] sm:w-[17rem] sm:gap-2.5"
      : "h-[4.5rem] w-[12.5rem] gap-1 sm:h-[4.75rem] sm:w-[13.5rem]"
  }`;
}

function ringGlowClass(accent: Accent, active: boolean) {
  const base =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-[#0b1022]/95 transition-all duration-500 ease-out sm:h-10 sm:w-10";
  const ring =
    accent === "purple"
      ? "ring-2 ring-[#a78bfa]/90"
      : accent === "cyan"
        ? "ring-2 ring-[#4fd1ed]/90"
        : "ring-2 ring-[#f9a8d4]/90";
  const activeGlow =
    accent === "purple"
      ? "scale-110 shadow-[0_0_28px_rgba(167,139,250,0.62),0_0_12px_rgba(167,139,250,0.34)]"
      : accent === "cyan"
        ? "scale-110 shadow-[0_0_28px_rgba(79,209,237,0.52),0_0_12px_rgba(79,209,237,0.3)]"
        : "scale-110 shadow-[0_0_28px_rgba(249,168,212,0.5),0_0_12px_rgba(249,168,212,0.28)]";
  const dim = "scale-95 opacity-[0.44]";
  return `${base} ${ring} ${active ? activeGlow : dim}`;
}

function stepTitleClass(active: boolean, align: "center" | "left" | "right") {
  const alignCls =
    align === "center" ? "text-center" : align === "left" ? "text-left" : "text-right";
  return `${alignCls} min-w-0 text-[13px] font-semibold leading-snug text-[#e6e8f4] transition-opacity duration-500 sm:text-[15px] ${
    active ? "opacity-100" : "opacity-78 line-clamp-2"
  }`;
}

function stepBodyClass(active: boolean, align: "center" | "left" | "right") {
  const alignCls =
    align === "center" ? "text-center" : align === "left" ? "text-left" : "text-right";
  return `${alignCls} min-w-0 text-[12px] font-normal leading-[1.55] text-[#c8cbdc] transition-all duration-500 sm:text-[13.5px] sm:leading-[1.6] ${
    active ? "opacity-100" : "pointer-events-none h-0 overflow-hidden opacity-0"
  }`;
}

type PojuHowWorksRingProps = {
  steps: readonly PojuHowWorksStep[];
};

const VB = POJU_HOW_WORKS_VB;
const CX = VB / 2;
const CY = VB / 2;
const R_RING = POJU_HOW_RING_RADIUS_VB;

export function PojuHowWorksRing({ steps }: PojuHowWorksRingProps) {
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion || paused) return;
    const t = window.setInterval(() => {
      setTick((k) => k + 1);
    }, ACTIVITY_CAPTION_RING_ROTATE_MS);
    return () => window.clearInterval(t);
  }, [reduceMotion, paused]);

  const activeIndex = reduceMotion ? 0 : tick % steps.length;

  const points = useMemo(() => {
    return steps.map((step, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / steps.length;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nx = CX + R_RING * cos;
      const ny = CY + R_RING * sin;
      return {
        step,
        i,
        nx,
        ny,
        cos,
        sin,
        accent: accents[i % accents.length]!,
        align: labelAlign(cos),
      };
    });
  }, [steps]);

  const activeStep = steps[activeIndex];

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,920px)] overflow-visible">
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Current step: {activeIndex + 1}. {activeStep?.title}. {activeStep?.description}
      </span>

      <div className="relative mx-auto w-full max-w-[min(100%,920px)] overflow-visible px-1 pb-16 pt-12 sm:px-2 sm:pb-20 sm:pt-14">
        <div className="relative mx-auto aspect-square w-full max-w-[min(100%,540px)] overflow-visible sm:max-w-[580px]">
          <PojuHowWorksGoldRing reduceMotion={reduceMotion} />

          <div className="pointer-events-none absolute inset-0 z-[3] overflow-visible">
            {points.map(({ step, i, nx, ny, cos, sin, accent, align }) => {
              const active = i === activeIndex;
              return (
                <div key={i}>
                  <div
                    className={`absolute ${active ? "z-[30] pointer-events-auto" : "z-[5] pointer-events-none"}`}
                    style={{
                      left: `${(nx / VB) * 100}%`,
                      top: `${(ny / VB) * 100}%`,
                      transform: labelOutwardTransform(cos, sin, i, active),
                    }}
                    onMouseEnter={active ? () => setPaused(true) : undefined}
                    onMouseLeave={active ? () => setPaused(false) : undefined}
                  >
                    <div
                      className={combinedFrameShell(active)}
                      title={`Step ${i + 1}: ${step.title}. ${step.description}`}
                    >
                      <PojuHowWorksFrameParticles
                        stepIndex={i}
                        rgb={POJU_HOW_STEP_PARTICLE_RGB[i]!}
                        active={active}
                        reduceMotion={reduceMotion}
                      />
                      <div className="relative z-[1] flex min-h-0 min-w-0 flex-col justify-center">
                        <p className={stepTitleClass(active, align)}>{step.title}</p>
                        <p className={stepBodyClass(active, align)}>{step.description}</p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="pointer-events-none absolute z-20"
                    style={{
                      left: `${(nx / VB) * 100}%`,
                      top: `${(ny / VB) * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className={ringGlowClass(accent, active)} aria-hidden>
                      {active ? (
                        <span className="text-[13px] font-bold leading-none text-white sm:text-[15px]">
                          {i + 1}
                        </span>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-white/90 transition-all duration-500" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
