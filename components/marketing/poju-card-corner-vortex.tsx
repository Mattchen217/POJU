"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type PojuCardCornerVortexProps = {
  className?: string;
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dust = { x: number; y: number; r: number; g: number; b: number; a: number; s: number };
type Star = { x: number; y: number; r: number; g: number; b: number; a: number; rad: number; ph: number };

type Scene = {
  cx: number;
  cy: number;
  dust: Dust[];
  stars: Star[];
  outerFeather: number;
};

function buildScene(W: number, H: number, rnd: () => number): Scene {
  const m = Math.min(W, H);
  const cx = W * 0.76;
  const cy = H * 0.76;
  const rSpiral = m * 0.46;

  const dust: Dust[] = [];
  const arms = 5;
  const perArm = 520;

  for (let arm = 0; arm < arms; arm++) {
    const arm0 = (arm / arms) * Math.PI * 2;
    for (let i = 0; i < perArm; i++) {
      const t = i / (perArm - 1);
      const theta = arm0 + t * 10.2 + t * t * 1.35;
      const r = 1.8 + Math.pow(t, 0.52) * rSpiral;
      const jx = (rnd() - 0.5) * (1.2 + t * 2.9);
      const jy = (rnd() - 0.5) * (1.2 + t * 2.9);
      const x = cx + Math.cos(theta) * r * 0.9 + jx;
      const y = cy + Math.sin(theta) * r * 0.9 + jy;
      if (x < -6 || y < -6 || x > W + 6 || y > H + 6) continue;

      const dist = Math.hypot(x - cx, y - cy);
      const edgeFade = Math.max(0, Math.min(1, 1.08 - dist / (rSpiral * 1.05)));

      const mix = t;
      const rCol = 70 + mix * 120 + rnd() * 18;
      const gCol = 140 + mix * 95 + rnd() * 22;
      const bCol = 245 - mix * 55 + rnd() * 12;
      const alpha = (0.018 + (1 - mix) * 0.22) * edgeFade * (0.45 + rnd() * 0.55);
      const s = rnd() < 0.9 ? 0.55 + rnd() * 0.75 : 1.05 + rnd() * 1.15;

      dust.push({ x, y, r: rCol, g: gCol, b: bCol, a: alpha, s });
    }
  }

  const stars: Star[] = [];
  for (let k = 0; k < 32; k++) {
    const t = rnd() * 0.88 + 0.06;
    const ang = rnd() * Math.PI * 7;
    const rr = 4 + t * rSpiral * 1.02;
    stars.push({
      x: cx + Math.cos(ang) * rr * 0.93,
      y: cy + Math.sin(ang) * rr * 0.93,
      r: 190 + rnd() * 60,
      g: 225 + rnd() * 30,
      b: 255,
      a: 0.12 + rnd() * 0.36,
      rad: 0.7 + rnd() * 1.6,
      ph: rnd() * Math.PI * 2,
    });
  }

  const outerFeather =
    Math.max(
      Math.hypot(cx, cy),
      Math.hypot(W - cx, cy),
      Math.hypot(cx, H - cy),
      Math.hypot(W - cx, H - cy),
    ) + 10;

  return { cx, cy, dust, stars, outerFeather };
}

export function PojuCardCornerVortex({ className }: PojuCardCornerVortexProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const measure = () => {
      const r = wrap.getBoundingClientRect();
      setSize({ w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w < 8 || size.h < 8) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const W = size.w;
    const H = size.h;
    const rnd = mulberry32(90210);
    const scene = buildScene(W, H, rnd);

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { cx, cy, dust, stars, outerFeather } = scene;

    let raf = 0;
    let t0 = 0;

    const paint = (now: number) => {
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      const spin = t * 0.042;

      ctx.clearRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spin);
      ctx.translate(-cx, -cy);
      ctx.globalCompositeOperation = "lighter";
      for (const p of dust) {
        ctx.fillStyle = `rgba(${p.r | 0},${p.g | 0},${p.b | 0},${p.a})`;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      ctx.restore();

      ctx.globalCompositeOperation = "lighter";
      for (const s of stars) {
        const tw = 0.82 + 0.18 * Math.sin(now * 0.0018 + s.ph);
        ctx.fillStyle = `rgba(${s.r | 0},${s.g | 0},${s.b | 0},${s.a * tw})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.rad, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(125,211,252,0.2)";
      ctx.lineWidth = 2.1;
      ctx.filter = "blur(3px)";
      ctx.beginPath();
      ctx.moveTo(W * 0.08, H * 0.62);
      ctx.bezierCurveTo(W * 0.34, H * 0.54, W * 0.48, H * 0.7, cx + 10, cy + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(192,132,252,0.16)";
      ctx.moveTo(W * 0.16, H * 0.74);
      ctx.bezierCurveTo(W * 0.42, H * 0.66, W * 0.54, H * 0.8, cx + 6, cy + 6);
      ctx.stroke();
      ctx.filter = "none";
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "destination-in";
      const feather = ctx.createRadialGradient(cx, cy, 8, cx, cy, outerFeather + 4);
      feather.addColorStop(0, "rgba(255,255,255,1)");
      feather.addColorStop(0.58, "rgba(255,255,255,0.98)");
      feather.addColorStop(0.82, "rgba(255,255,255,0.45)");
      feather.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = feather;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h]);

  return (
    <div
      ref={wrapRef}
      className={[
        "pointer-events-none absolute inset-0 z-[1] mix-blend-screen select-none",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <canvas ref={canvasRef} className="block h-full w-full bg-transparent" />
    </div>
  );
}
