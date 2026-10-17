"use client";

import { useEffect, useId, useRef } from "react";

type AtmosDot = { id: number; cx: number; cy: number; r: number };

/** Concentric Atmos mark (local recreation of old gold-dot lattice). */
const ATMOS_DOTS: readonly AtmosDot[] = [
  { id: 0, cx: 50.0, cy: 50.0, r: 4.2 },
  { id: 1, cx: 62.472, cy: 55.166, r: 3.35 },
  { id: 2, cx: 55.166, cy: 62.472, r: 3.35 },
  { id: 3, cx: 44.834, cy: 62.472, r: 3.35 },
  { id: 4, cx: 37.528, cy: 55.166, r: 3.35 },
  { id: 5, cx: 37.528, cy: 44.834, r: 3.35 },
  { id: 6, cx: 44.834, cy: 37.528, r: 3.35 },
  { id: 7, cx: 55.166, cy: 37.528, r: 3.35 },
  { id: 8, cx: 62.472, cy: 44.834, r: 3.35 },
  { id: 9, cx: 75.0, cy: 50.0, r: 2.65 },
  { id: 10, cx: 71.651, cy: 62.5, r: 2.65 },
  { id: 11, cx: 62.5, cy: 71.651, r: 2.65 },
  { id: 12, cx: 50.0, cy: 75.0, r: 2.65 },
  { id: 13, cx: 37.5, cy: 71.651, r: 2.65 },
  { id: 14, cx: 28.349, cy: 62.5, r: 2.65 },
  { id: 15, cx: 25.0, cy: 50.0, r: 2.65 },
  { id: 16, cx: 28.349, cy: 37.5, r: 2.65 },
  { id: 17, cx: 37.5, cy: 28.349, r: 2.65 },
  { id: 18, cx: 50.0, cy: 25.0, r: 2.65 },
  { id: 19, cx: 62.5, cy: 28.349, r: 2.65 },
  { id: 20, cx: 71.651, cy: 37.5, r: 2.65 },
  { id: 21, cx: 84.818, cy: 56.926, r: 2.05 },
  { id: 22, cx: 79.517, cy: 69.723, r: 2.05 },
  { id: 23, cx: 69.723, cy: 79.517, r: 2.05 },
  { id: 24, cx: 56.926, cy: 84.818, r: 2.05 },
  { id: 25, cx: 43.074, cy: 84.818, r: 2.05 },
  { id: 26, cx: 30.277, cy: 79.517, r: 2.05 },
  { id: 27, cx: 20.483, cy: 69.723, r: 2.05 },
  { id: 28, cx: 15.182, cy: 56.926, r: 2.05 },
  { id: 29, cx: 15.182, cy: 43.074, r: 2.05 },
  { id: 30, cx: 20.483, cy: 30.277, r: 2.05 },
  { id: 31, cx: 30.277, cy: 20.483, r: 2.05 },
  { id: 32, cx: 43.074, cy: 15.182, r: 2.05 },
  { id: 33, cx: 56.926, cy: 15.182, r: 2.05 },
  { id: 34, cx: 69.723, cy: 20.483, r: 2.05 },
  { id: 35, cx: 79.517, cy: 30.277, r: 2.05 },
  { id: 36, cx: 84.818, cy: 43.074, r: 2.05 },
  { id: 37, cx: 94.5, cy: 50.0, r: 1.45 },
  { id: 38, cx: 92.322, cy: 63.751, r: 1.45 },
  { id: 39, cx: 86.001, cy: 76.156, r: 1.45 },
  { id: 40, cx: 76.156, cy: 86.001, r: 1.45 },
  { id: 41, cx: 63.751, cy: 92.322, r: 1.45 },
  { id: 42, cx: 50.0, cy: 94.5, r: 1.45 },
  { id: 43, cx: 36.249, cy: 92.322, r: 1.45 },
  { id: 44, cx: 23.844, cy: 86.001, r: 1.45 },
  { id: 45, cx: 13.999, cy: 76.156, r: 1.45 },
  { id: 46, cx: 7.678, cy: 63.751, r: 1.45 },
  { id: 47, cx: 5.5, cy: 50.0, r: 1.45 },
  { id: 48, cx: 7.678, cy: 36.249, r: 1.45 },
  { id: 49, cx: 13.999, cy: 23.844, r: 1.45 },
  { id: 50, cx: 23.844, cy: 13.999, r: 1.45 },
  { id: 51, cx: 36.249, cy: 7.678, r: 1.45 },
  { id: 52, cx: 50.0, cy: 5.5, r: 1.45 },
  { id: 53, cx: 63.751, cy: 7.678, r: 1.45 },
  { id: 54, cx: 76.156, cy: 13.999, r: 1.45 },
  { id: 55, cx: 86.001, cy: 23.844, r: 1.45 },
  { id: 56, cx: 92.322, cy: 36.249, r: 1.45 },
];

type Props = {
  className?: string;
  /** When true, randomly light metallic-gold dots in an organic loop. */
  thinking?: boolean;
};

/**
 * Atmos concentric-dot avatar for workbench chat.
 * Idle = flat muted gold; thinking = random metallic pulses.
 * Legacy glyph avatar kept in PojuAiAvatar.legacy.tsx + assets/icons/P.png.
 */
export function AtmosThinkingAvatar({ className, thinking = false }: Props) {
  const reactId = useId().replace(/:/g, "");
  const gradId = `atmosGoldGrad-${reactId}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const litTimersRef = useRef<Map<number, number>>(new Map());
  const burstTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const clearLit = () => {
      litTimersRef.current.forEach((t) => window.clearTimeout(t));
      litTimersRef.current.clear();
      svg.querySelectorAll(".atmos-dot.is-lit").forEach((el) => {
        el.classList.remove("is-lit");
        el.style.fill = "";
      });
      if (burstTimerRef.current != null) {
        window.clearTimeout(burstTimerRef.current);
        burstTimerRef.current = null;
      }
    };

    if (!thinking) {
      clearLit();
      return;
    }

    const gradUrl = `url(#${gradId})`;
    const lightOne = (id: number) => {
      const el = svg.querySelector(`#atmos-d-${reactId}-${id}`) as SVGCircleElement | null;
      if (!el) return;
      el.classList.add("is-lit");
      el.style.fill = gradUrl;
      const prev = litTimersRef.current.get(id);
      if (prev != null) window.clearTimeout(prev);
      const hold = 520 + Math.random() * 880;
      const t = window.setTimeout(() => {
        el.classList.remove("is-lit");
        el.style.fill = "";
        litTimersRef.current.delete(id);
      }, hold);
      litTimersRef.current.set(id, t);
    };

    const scheduleBurst = () => {
      const n = ATMOS_DOTS.length;
      const min = Math.max(4, Math.floor(n * 0.12));
      const max = Math.max(min + 1, Math.floor(n * 0.28));
      const count = min + Math.floor(Math.random() * (max - min + 1));
      const pool = ATMOS_DOTS.map((d) => d.id);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }
      const chosen: number[] = [];
      for (let i = 0; i < pool.length && chosen.length < count; i++) {
        const id = pool[i];
        if (litTimersRef.current.has(id) && Math.random() < 0.65) continue;
        chosen.push(id);
      }
      chosen.forEach((id, i) => {
        window.setTimeout(() => {
          if (!svg.isConnected) return;
          lightOne(id);
        }, i * (18 + Math.random() * 42));
      });
      burstTimerRef.current = window.setTimeout(scheduleBurst, 280 + Math.random() * 420);
    };

    scheduleBurst();
    return () => clearLit();
  }, [thinking, reactId, gradId]);

  return (
    <span
      className={["pchat__ai-avatar", "pchat__ai-avatar--atmos", className].filter(Boolean).join(" ")}
      aria-hidden
      data-thinking={thinking ? "true" : "false"}
    >
      <svg
        ref={svgRef}
        className={`atmos-avatar-svg${thinking ? " is-thinking" : ""}`}
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
      >
        <defs>
          <linearGradient id={gradId} x1="18%" y1="12%" x2="86%" y2="88%">
            <stop offset="0%" stopColor="#BF953F" />
            <stop offset="28%" stopColor="#F5D78E" />
            <stop offset="52%" stopColor="#FFF6D0" />
            <stop offset="78%" stopColor="#F5D78E" />
            <stop offset="100%" stopColor="#BF953F" />
          </linearGradient>
        </defs>
        {ATMOS_DOTS.map((d) => (
          <circle
            key={d.id}
            id={`atmos-d-${reactId}-${d.id}`}
            className="atmos-dot"
            cx={d.cx}
            cy={d.cy}
            r={d.r}
          />
        ))}
      </svg>
    </span>
  );
}
