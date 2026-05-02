"use client";

import { useEffect, useRef } from "react";

import type { WindCardParticleKey } from "./WindCardWithParticles";

const PARTICLE_PALETTE: Record<WindCardParticleKey, readonly [number, number, number]> = {
  crosswind: [200, 130, 255],
  "divine-tailwind": [255, 210, 120],
  "eye-of-storm": [255, 85, 110],
  "fair-sky": [115, 185, 255],
  "still-water": [70, 210, 155],
};

type BorderParticle = {
  along: number;
  phase: number;
  buzz: number;
  size: number;
};

function cornerRadius(w: number, h: number): number {
  const m = Math.min(w, h);
  return Math.min(m * 0.07, w / 2 - 0.5, h / 2 - 0.5);
}

function perimeterLength(w: number, h: number, r: number): number {
  const top = Math.max(0.001, w - 2 * r);
  const side = Math.max(0.001, h - 2 * r);
  const arc = (Math.PI / 2) * r;
  return 2 * top + 2 * side + 4 * arc;
}

function perimeterPointFromDistance(
  d: number,
  w: number,
  h: number,
  r: number,
): { x: number; y: number } {
  const top = Math.max(0.001, w - 2 * r);
  const side = Math.max(0.001, h - 2 * r);
  const arc = (Math.PI / 2) * r;
  const len = 2 * top + 2 * side + 4 * arc;
  d = ((d % len) + len) % len;

  let rem = d;
  if (rem < top) return { x: r + rem, y: 0 };
  rem -= top;
  if (rem < arc) {
    const t = -Math.PI / 2 + rem / r;
    return { x: w - r + r * Math.cos(t), y: r + r * Math.sin(t) };
  }
  rem -= arc;
  if (rem < side) return { x: w, y: r + rem };
  rem -= side;
  if (rem < arc) {
    const t = rem / r;
    return { x: w - r + r * Math.cos(t), y: h - r + r * Math.sin(t) };
  }
  rem -= arc;
  if (rem < top) return { x: w - r - rem, y: h };
  rem -= top;
  if (rem < arc) {
    const t = Math.PI / 2 + rem / r;
    return { x: r + r * Math.cos(t), y: h - r + r * Math.sin(t) };
  }
  rem -= arc;
  if (rem < side) return { x: 0, y: h - r - rem };
  rem -= side;
  const t = Math.PI + rem / r;
  return { x: r + r * Math.cos(t), y: r + r * Math.sin(t) };
}

interface WindBorderParticlesOverlayProps {
  particleKey: WindCardParticleKey;
}

const N_BORDER = 1200;

export function WindBorderParticlesOverlay({ particleKey }: WindBorderParticlesOverlayProps) {
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

    const rgb = PARTICLE_PALETTE[particleKey];
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let border: BorderParticle[] = [];
    let borderTravel = 0;
    let last = performance.now();
    let rafId = 0;

    function initParticles() {
      border = [];
      for (let i = 0; i < N_BORDER; i++) {
        border.push({
          along: i / N_BORDER + (Math.random() - 0.5) * 0.0005,
          phase: Math.random() * Math.PI * 2,
          buzz: 0.45 + Math.random() * 2.0,
          size: 0.96 + Math.random() * 1.44,
        });
      }
    }

    function syncCanvasSize() {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2);
      const w = wrapEl.clientWidth;
      const h = wrapEl.clientHeight;
      if (w < 2 || h < 2) return;
      canvasEl.width = Math.floor(w * dpr);
      canvasEl.height = Math.floor(h * dpr);
      canvasEl.style.width = `${w}px`;
      canvasEl.style.height = `${h}px`;
      ctxEl.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    }

    const ro = new ResizeObserver(syncCanvasSize);
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

      const w = wrapEl.clientWidth;
      const h = wrapEl.clientHeight;
      if (w < 2 || h < 2) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      ctxEl.clearRect(0, 0, w, h);

      const r = cornerRadius(w, h);
      const len = perimeterLength(w, h, r);
      const t = now * 0.001;
      borderTravel += dt * 15;
      const cx = w * 0.5;
      const cy = h * 0.5;

      ctxEl.save();
      for (const p of border) {
        const d = p.along * len + borderTravel + Math.sin(t * 1.15 + p.phase) * p.buzz * 0.28;
        const pt = perimeterPointFromDistance(d, w, h, r);
        const ix = cx - pt.x;
        const iy = cy - pt.y;
        const inv = 1 / (Math.hypot(ix, iy) + 0.001);
        const x = pt.x + ix * inv * Math.sin(t * 1.65 + p.phase * 2) * 0.85;
        const y = pt.y + iy * inv * Math.sin(t * 1.65 + p.phase * 2) * 0.85;
        const alpha = Math.min(0.92, 0.22 + 0.28 * (0.5 + 0.5 * Math.sin(t * 1.7 + p.phase)));
        ctxEl.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
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
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 z-10">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden />
    </div>
  );
}

