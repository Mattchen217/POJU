"use client";

import { useEffect, useRef } from "react";

const N_PARTICLES = 140;

const GOLD_COLORS = [
  [255, 220, 140],
  [232, 185, 129],
  [255, 200, 90],
  [212, 165, 116],
  [255, 235, 180],
  [248, 210, 120],
] as const;

type Particle = {
  ox: number;
  oy: number;
  angle: number;
  r: number;
  dr: number;
  rMax: number;
  size: number;
  phase: number;
  twist: number;
  cr: number;
  cg: number;
  cb: number;
};

type ProductWhatIsCardGlowProps = {
  /** Normalized horizontal origin (0–1), default center */
  originX?: number;
  /** Normalized vertical origin (0–1) on object-cover art */
  originY: number;
  cardWRatio?: number;
  cardHRatio?: number;
};

function pickGold(): readonly [number, number, number] {
  return GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)]!;
}

/** Golden particles radiating from a focal point on product what-is art */
export function ProductWhatIsCardGlow({
  originX = 0.5,
  originY,
  cardWRatio = 0.12,
  cardHRatio = 0.155,
}: ProductWhatIsCardGlowProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let particles: Particle[] = [];
    let last = performance.now();
    let rafId = 0;

    function resetParticle(p: Particle, nw: number, nh: number): void {
      const cardW = nw * cardWRatio;
      const cardH = nh * cardHRatio;
      const cx = nw * originX;
      const cy = nh * originY;
      p.ox = cx + (Math.random() - 0.5) * cardW;
      p.oy = cy + (Math.random() - 0.5) * cardH;
      p.angle = Math.random() * Math.PI * 2;
      p.r = Math.random() * 6;
      p.dr = 16 + Math.random() * 42;
      p.rMax = Math.min(nw, nh) * (0.12 + Math.random() * 0.32);
      p.size = 0.35 + Math.random() * 1.15;
      p.phase = Math.random() * Math.PI * 2;
      p.twist = (Math.random() - 0.5) * 0.35;
      const [cr, cg, cb] = pickGold();
      p.cr = cr;
      p.cg = cg;
      p.cb = cb;
    }

    function init(nw: number, nh: number) {
      particles = [];
      for (let i = 0; i < N_PARTICLES; i++) {
        const p: Particle = {
          ox: 0,
          oy: 0,
          angle: 0,
          r: 0,
          dr: 0,
          rMax: 0,
          size: 0,
          phase: 0,
          twist: 0,
          cr: 255,
          cg: 220,
          cb: 140,
        };
        resetParticle(p, nw, nh);
        p.r = Math.random() * p.rMax;
        particles.push(p);
      }
    }

    function syncSize() {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2);
      const nw = wrap!.clientWidth;
      const nh = wrap!.clientHeight;
      if (nw < 2 || nh < 2) return;
      canvas!.width = Math.floor(nw * dpr);
      canvas!.height = Math.floor(nh * dpr);
      canvas!.style.width = `${nw}px`;
      canvas!.style.height = `${nh}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      init(nw, nh);
    }

    const ro = new ResizeObserver(syncSize);
    ro.observe(wrap);
    syncSize();

    function drawGlow(nw: number, nh: number, now: number) {
      const cx = nw * originX;
      const cy = nh * originY;
      const pulse = 0.88 + 0.12 * Math.sin(now * 0.0018);
      const cardW = nw * cardWRatio * 0.55;
      const cardH = nh * cardHRatio * 0.55;

      ctx!.save();
      ctx!.globalCompositeOperation = "lighter";

      const core = ctx!.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cardW, cardH) * 1.4 * pulse);
      core.addColorStop(0, "rgba(255, 240, 190, 0.55)");
      core.addColorStop(0.35, "rgba(255, 210, 120, 0.28)");
      core.addColorStop(0.65, "rgba(232, 185, 129, 0.1)");
      core.addColorStop(1, "rgba(212, 165, 116, 0)");
      ctx!.fillStyle = core;
      ctx!.fillRect(cx - cardW * 2, cy - cardH * 2, cardW * 4, cardH * 4);

      const halo = ctx!.createRadialGradient(cx, cy, cardW * 0.2, cx, cy, Math.min(nw, nh) * 0.42);
      halo.addColorStop(0, "rgba(255, 200, 90, 0.14)");
      halo.addColorStop(0.45, "rgba(212, 165, 116, 0.06)");
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx!.fillStyle = halo;
      ctx!.fillRect(0, 0, nw, nh);

      ctx!.restore();
    }

    function paint(now: number) {
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;

      const nw = wrap.clientWidth;
      const nh = wrap.clientHeight;
      if (nw < 2 || nh < 2) {
        if (!reduceMotion) rafId = requestAnimationFrame(paint);
        return;
      }

      ctx.clearRect(0, 0, nw, nh);
      drawGlow(nw, nh, now);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const t = now * 0.001;
      for (const p of particles) {
        if (!reduceMotion) {
          p.angle += p.twist * dt;
          p.r += p.dr * dt;
          if (p.r > p.rMax) resetParticle(p, nw, nh);
        }

        const wob = Math.sin(t * 1.15 + p.phase) * 0.45;
        const x = p.ox + Math.cos(p.angle) * p.r + wob;
        const y = p.oy + Math.sin(p.angle) * p.r + wob * 0.7;
        const fade = Math.max(0, 1 - p.r / p.rMax);
        const alpha = (0.08 + fade * 0.42) * (reduceMotion ? 0.85 : 1);

        ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (0.55 + fade * 0.65), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      if (!reduceMotion) rafId = requestAnimationFrame(paint);
    }

    if (reduceMotion) {
      paint(0);
    } else {
      rafId = requestAnimationFrame(paint);
    }

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [originX, originY, cardWRatio, cardHRatio]);

  return (
    <div ref={wrapRef} className="product-what-is__card-glow" aria-hidden>
      <canvas ref={canvasRef} className="product-what-is__card-glow-canvas" />
    </div>
  );
}
