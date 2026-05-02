"use client";

import type { StaticImageData } from "next/image";
import Image from "next/image";
import { useEffect, useRef } from "react";

import { clsx } from "clsx";

export type WindCardParticleKey =
  | "crosswind"
  | "divine-tailwind"
  | "eye-of-storm"
  | "fair-sky"
  | "still-water";

/** 与卡面主题一致：外圈略实、中部略亮（lighter 叠色） */
const PARTICLE_PALETTE: Record<
  WindCardParticleKey,
  { border: readonly [number, number, number]; center: readonly [number, number, number] }
> = {
  crosswind: { border: [200, 130, 255], center: [235, 210, 255] },
  "divine-tailwind": { border: [255, 210, 120], center: [255, 228, 160] },
  "eye-of-storm": { border: [255, 85, 110], center: [255, 165, 175] },
  "fair-sky": { border: [115, 185, 255], center: [185, 220, 255] },
  "still-water": { border: [70, 210, 155], center: [150, 255, 210] },
};

function cornerRadius(w: number, h: number): number {
  const m = Math.min(w, h);
  return Math.min(m * 0.07, w / 2 - 0.5, h / 2 - 0.5);
}

function perimeterLength(w: number, h: number, R: number): number {
  const top = Math.max(0.001, w - 2 * R);
  const side = Math.max(0.001, h - 2 * R);
  const arc = (Math.PI / 2) * R;
  return 2 * top + 2 * side + 4 * arc;
}

function perimeterPointFromDistance(
  d: number,
  w: number,
  h: number,
  R: number,
): { x: number; y: number } {
  const top = Math.max(0.001, w - 2 * R);
  const side = Math.max(0.001, h - 2 * R);
  const arc = (Math.PI / 2) * R;
  const L = 2 * top + 2 * side + 4 * arc;
  d = ((d % L) + L) % L;

  let r = d;

  if (r < top) return { x: R + r, y: 0 };
  r -= top;
  if (r < arc) {
    const theta = -Math.PI / 2 + r / R;
    return { x: w - R + R * Math.cos(theta), y: R + R * Math.sin(theta) };
  }
  r -= arc;
  if (r < side) return { x: w, y: R + r };
  r -= side;
  if (r < arc) {
    const theta = r / R;
    return { x: w - R + R * Math.cos(theta), y: h - R + R * Math.sin(theta) };
  }
  r -= arc;
  if (r < top) return { x: w - R - r, y: h };
  r -= top;
  if (r < arc) {
    const theta = Math.PI / 2 + r / R;
    return { x: R + R * Math.cos(theta), y: h - R + R * Math.sin(theta) };
  }
  r -= arc;
  if (r < side) return { x: 0, y: h - R - r };
  r -= side;
  const theta = Math.PI + r / R;
  return { x: R + R * Math.cos(theta), y: R + R * Math.sin(theta) };
}

type BorderParticle = {
  along: number;
  phase: number;
  buzz: number;
  size: number;
};

type CenterParticle = {
  ox: number;
  oy: number;
  angle: number;
  r: number;
  dr: number;
  rMax: number;
  twist: number;
  size: number;
  rxK: number;
  ryK: number;
  phase: number;
};

function resetCenterParticle(p: CenterParticle, nw: number, nh: number): void {
  const pad = 0.04;
  p.ox = nw * (pad + Math.random() * (1 - 2 * pad));
  p.oy = nh * (pad + Math.random() * (1 - 2 * pad));
  p.angle = Math.random() * Math.PI * 2;
  p.r = 1 + Math.random() * 22;
  p.dr = 9 + Math.random() * 26;
  p.rMax = Math.min(nw, nh) * (0.04 + Math.random() * 0.18);
  p.twist = (Math.random() - 0.5) * 0.55;
  p.size = 0.22 + Math.random() * 0.42;
  p.rxK = 0.82 + Math.random() * 0.45;
  p.ryK = 0.82 + Math.random() * 0.45;
  p.phase = Math.random() * Math.PI * 2;
}

const N_BORDER = 2000;
const N_CENTER = 200;

type Props = {
  src: StaticImageData;
  alt: string;
  particleKey: WindCardParticleKey;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/** 五风卡面共用：外缘 2000 点顺时针；中部 200 点全卡随机原点外扩；颜色由 particleKey 决定。 */
export function WindCardWithParticles({
  src,
  alt,
  particleKey,
  className,
  sizes,
  priority,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const wrapEl = wrap;
    const canvasEl = canvas;
    const ctxEl = ctx;

    const { border: brgb, center: crgb } = PARTICLE_PALETTE[particleKey];

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let border: BorderParticle[] = [];
    let center: CenterParticle[] = [];
    let borderTravel = 0;
    let last = performance.now();
    let rafId = 0;

    function initParticles(nw: number, nh: number) {
      border = [];
      for (let i = 0; i < N_BORDER; i++) {
        border.push({
          along: i / N_BORDER + (Math.random() - 0.5) * 0.0005,
          phase: Math.random() * Math.PI * 2,
          buzz: 0.45 + Math.random() * 2.2,
          size: 0.32 + Math.random() * 0.48,
        });
      }

      center = [];
      for (let i = 0; i < N_CENTER; i++) {
        const p: CenterParticle = {
          ox: 0,
          oy: 0,
          angle: 0,
          r: 0,
          dr: 0,
          rMax: 0,
          twist: 0,
          size: 0,
          rxK: 1,
          ryK: 1,
          phase: 0,
        };
        resetCenterParticle(p, nw, nh);
        center.push(p);
      }
    }

    function syncCanvasSize() {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2);
      const nw = wrapEl.clientWidth;
      const nh = wrapEl.clientHeight;
      if (nw < 2 || nh < 2) return;
      canvasEl.width = Math.floor(nw * dpr);
      canvasEl.height = Math.floor(nh * dpr);
      canvasEl.style.width = `${nw}px`;
      canvasEl.style.height = `${nh}px`;
      ctxEl.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles(nw, nh);
    }

    const ro = new ResizeObserver(() => {
      syncCanvasSize();
    });
    ro.observe(wrapEl);
    syncCanvasSize();

    if (reduceMotion) {
      return () => {
        ro.disconnect();
      };
    }

    function draw(now: number) {
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;

      const nw = wrapEl.clientWidth;
      const nh = wrapEl.clientHeight;
      if (nw < 2 || nh < 2) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      ctxEl.clearRect(0, 0, nw, nh);

      const R = cornerRadius(nw, nh);
      const L = perimeterLength(nw, nh, R);
      const t = now * 0.001;

      borderTravel += dt * 52;

      const cx = nw * 0.5;
      const cy = nh * 0.5;

      ctxEl.save();
      ctxEl.globalCompositeOperation = "lighter";
      for (const p of center) {
        p.angle += p.twist * dt;
        p.r += p.dr * dt;
        if (p.r > p.rMax) {
          resetCenterParticle(p, nw, nh);
        }
        const wob = Math.sin(t * 1.1 + p.phase) * 0.55;
        const wob2 = Math.cos(t * 0.95 + p.phase * 1.3) * 0.45;
        const x = p.ox + Math.cos(p.angle) * p.r * p.rxK + wob;
        const y = p.oy + Math.sin(p.angle) * p.r * p.ryK + wob2;
        const fade = Math.max(0, 1 - p.r / p.rMax);
        const alpha = 0.06 + fade * 0.34;
        ctxEl.fillStyle = `rgba(${crgb[0]},${crgb[1]},${crgb[2]},${alpha})`;
        ctxEl.beginPath();
        ctxEl.arc(x, y, p.size + fade * 0.9, 0, Math.PI * 2);
        ctxEl.fill();
      }
      ctxEl.restore();

      ctxEl.save();
      ctxEl.globalCompositeOperation = "source-over";
      for (const p of border) {
        const d =
          p.along * L +
          borderTravel +
          Math.sin(t * 1.15 + p.phase) * p.buzz * 0.28;
        const pt = perimeterPointFromDistance(d, nw, nh, R);
        const ix = cx - pt.x;
        const iy = cy - pt.y;
        const inv = 1 / (Math.hypot(ix, iy) + 0.001);
        const nx = ix * inv;
        const ny = iy * inv;
        const buzz = Math.sin(t * 1.65 + p.phase * 2) * 0.85;
        const x = pt.x + nx * buzz;
        const y = pt.y + ny * buzz;
        const alpha = Math.min(
          0.92,
          0.22 + 0.28 * (0.5 + 0.5 * Math.sin(t * 1.7 + p.phase)),
        );
        ctxEl.fillStyle = `rgba(${brgb[0]},${brgb[1]},${brgb[2]},${alpha})`;
        ctxEl.beginPath();
        ctxEl.arc(x, y, p.size, 0, Math.PI * 2);
        ctxEl.fill();
      }
      ctxEl.restore();
      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [particleKey]);

  return (
    <div ref={wrapRef} className={clsx("relative inline-block max-w-full", className)}>
      <Image
        src={src}
        alt={alt}
        width={src.width}
        height={src.height}
        className="relative z-0 block h-auto max-w-full w-auto"
        sizes={sizes}
        priority={priority}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-10 block"
        aria-hidden
      />
    </div>
  );
}
