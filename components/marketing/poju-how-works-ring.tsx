"use client";

import { useEffect, useMemo, useState } from "react";

import {
  POJU_HOW_STEP_PARTICLE_RGB,
  PojuHowWorksFrameParticles,
  PojuHowWorksGoldRing,
} from "@/components/marketing/poju-how-works-particles";

type Accent = "purple" | "cyan" | "pink";

const accents: Accent[] = ["purple", "cyan", "pink", "purple", "cyan", "pink"];

/** 背板圆；节点中心与圆线重合 */
const R_RING = 112;

/**
 * 线框中心相对亮点的平移（rem）：
 * 半框 + 节点半宽（h-9 / sm:h-10 及描边光晕）+ 空隙，避免左右框内侧仍压住亮点。
 */
const NODE_OUTSET_REM = 1.4;
const LABEL_GAP_REM = 1.05;
const SIDE_SHIFT_X = `calc(8rem + ${NODE_OUTSET_REM}rem + ${LABEL_GAP_REM}rem)`; // 16rem 半宽 + 节点 + 空隙
const VERT_SHIFT_Y = `calc(4.875rem / 2 + ${NODE_OUTSET_REM}rem + ${LABEL_GAP_REM}rem)`;

function labelOffsetTransform(i: number, cos: number): string {
  const c = "translate(-50%, -50%)";
  if (i === 0) return `${c} translateY(calc(-1 * (${VERT_SHIFT_Y})))`;
  if (i === 3) return `${c} translateY(${VERT_SHIFT_Y})`;
  if (cos >= 0) return `${c} translateX(${SIDE_SHIFT_X})`;
  return `${c} translateX(calc(-1 * (${SIDE_SHIFT_X})))`;
}

/** 线框本体（描边由 canvas 粒子承担） */
const combinedFrameShell = (active: boolean) =>
  `relative overflow-visible pointer-events-auto flex min-h-0 h-[4.625rem] w-[15rem] shrink-0 flex-col justify-center gap-1.5 rounded-[6px] bg-black/22 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:h-[4.875rem] sm:w-[16rem] sm:px-2.5 sm:py-2 ${
    active ? "bg-black/30" : ""
  }`;

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

function stepTitleClass(accent: Accent, active: boolean, align: "center" | "left" | "right") {
  const alignCls =
    align === "center" ? "text-center" : align === "left" ? "text-left" : "text-right";
  const base = `${alignCls} min-w-0 truncate whitespace-nowrap text-sm font-bold uppercase tracking-[0.14em] transition-colors duration-500 sm:text-base sm:tracking-[0.16em]`;
  if (!active) return `${base} text-text-dim/88`;
  if (accent === "purple") return `${base} text-[#c4b5fd]`;
  if (accent === "cyan") return `${base} text-[#7ee8f7]`;
  return `${base} text-[#fbcfe8]`;
}

function stepBodyClass(active: boolean, align: "center" | "left" | "right") {
  const alignCls =
    align === "center" ? "text-center" : align === "left" ? "text-left" : "text-right";
  return `${alignCls} min-w-0 truncate whitespace-nowrap text-[15px] font-medium leading-none text-[#e6e8f4] transition-opacity duration-500 sm:text-[17px] ${
    active ? "opacity-100" : "opacity-52"
  }`;
}

/** 线框中心在射线外点；框内文字仍按象限左/右/中对齐 */
function labelLayout(i: number): { align: "center" | "left" | "right" } {
  if (i === 0 || i === 3) return { align: "center" };
  if (i === 1 || i === 2) return { align: "left" };
  return { align: "right" };
}

type PojuHowWorksRingProps = {
  steps: readonly string[];
};

const VB = 400;
const CX = 200;
const CY = 200;

export function PojuHowWorksRing({ steps }: PojuHowWorksRingProps) {
  const [tick, setTick] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const t = window.setInterval(() => {
      setTick((k) => k + 1);
    }, 2400);
    return () => window.clearInterval(t);
  }, [reduceMotion]);

  const activeIndex = reduceMotion ? 0 : tick % steps.length;

  const points = useMemo(() => {
    return steps.map((label, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / steps.length;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nx = CX + R_RING * cos;
      const ny = CY + R_RING * sin;
      const layout = labelLayout(i);
      return { label, i, nx, ny, cos, accent: accents[i % accents.length]!, align: layout.align };
    });
  }, [steps]);

  return (
    <div className="relative mx-auto mt-8 w-full max-w-[min(100%,580px)] overflow-visible sm:mt-10 md:max-w-[640px]">
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Current step: {activeIndex + 1}. {steps[activeIndex]}.
      </span>

      <div className="relative mx-auto aspect-square w-full max-w-[min(100%,540px)] overflow-visible sm:max-w-[560px]">
        <PojuHowWorksGoldRing reduceMotion={reduceMotion} />

        <div className="pointer-events-none absolute inset-0 z-[3] overflow-visible">
          {points.map(({ label, i, nx, ny, cos, accent, align }) => {
            const active = i === activeIndex;
            return (
              <div key={label}>
                <div
                  className="absolute z-[5]"
                  style={{
                    left: `${(nx / VB) * 100}%`,
                    top: `${(ny / VB) * 100}%`,
                    transform: labelOffsetTransform(i, cos),
                  }}
                >
                  <div className={combinedFrameShell(active)} title={`Step ${i + 1}: ${label}`}>
                    <PojuHowWorksFrameParticles
                      stepIndex={i}
                      rgb={POJU_HOW_STEP_PARTICLE_RGB[i]!}
                      active={active}
                      reduceMotion={reduceMotion}
                    />
                    <div className="relative z-[1] flex min-h-0 min-w-0 flex-col justify-center gap-1.5">
                      <p className={stepTitleClass(accent, active, align)}>✦ Step {i + 1}</p>
                      <p className={stepBodyClass(active, align)}>{label}</p>
                    </div>
                  </div>
                </div>

                <div
                  className="absolute z-20"
                  style={{
                    left: `${(nx / VB) * 100}%`,
                    top: `${(ny / VB) * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className={ringGlowClass(accent, active)} aria-hidden>
                    <span
                      className={`rounded-full bg-white/90 transition-all duration-500 ${
                        active ? "h-2.5 w-2.5 shadow-[0_0_14px_rgba(255,255,255,0.92)]" : "h-2 w-2"
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
