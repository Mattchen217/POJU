"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 与 `oracle-card-particle-card` 同源：圆角矩形周长参数化 */
function roundRectPerimeter(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  r: number,
  u: number,
): { x: number; y: number; nx: number; ny: number } {
  const rc = Math.min(r, hw, hh);
  const Lb = 2 * hw - 2 * rc;
  const Lr = 2 * hh - 2 * rc;
  const Larc = (Math.PI / 2) * rc;
  const P = 2 * Lb + 2 * Lr + 4 * Larc;
  let d = ((u % 1) + 1) % 1 * P;

  const Cbrx = cx + hw - rc;
  const Cbry = cy + hh - rc;
  const Ctrx = cx + hw - rc;
  const Ctry = cy - hh + rc;
  const Ctlx = cx - hw + rc;
  const Ctly = cy - hh + rc;
  const Cblx = cx - hw + rc;
  const Cbly = cy + hh - rc;

  if (d < Lb) {
    const x = cx - hw + rc + (d / Lb) * (2 * hw - 2 * rc);
    const y = cy + hh;
    return { x, y, nx: 0, ny: 1 };
  }
  d -= Lb;
  if (d < Larc) {
    const a = (Math.PI / 2) * (1 - d / Larc);
    return {
      x: Cbrx + Math.cos(a) * rc,
      y: Cbry + Math.sin(a) * rc,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= Larc;
  if (d < Lr) {
    const x = cx + hw;
    const y = cy + hh - rc - (d / Lr) * (2 * hh - 2 * rc);
    return { x, y, nx: 1, ny: 0 };
  }
  d -= Lr;
  if (d < Larc) {
    const a = (d / Larc) * (-Math.PI / 2);
    return {
      x: Ctrx + Math.cos(a) * rc,
      y: Ctry + Math.sin(a) * rc,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= Larc;
  if (d < Lb) {
    const x = cx + hw - rc - (d / Lb) * (2 * hw - 2 * rc);
    const y = cy - hh;
    return { x, y, nx: 0, ny: -1 };
  }
  d -= Lb;
  if (d < Larc) {
    const a = (-Math.PI / 2) + (d / Larc) * (-Math.PI / 2);
    return {
      x: Ctlx + Math.cos(a) * rc,
      y: Ctly + Math.sin(a) * rc,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= Larc;
  if (d < Lr) {
    const x = cx - hw;
    const y = cy - hh + rc + (d / Lr) * (2 * hh - 2 * rc);
    return { x, y, nx: -1, ny: 0 };
  }
  d -= Lr;
  const a = Math.PI / 2 + (d / Larc) * (Math.PI / 2);
  return {
    x: Cblx + Math.cos(a) * rc,
    y: Cbly + Math.sin(a) * rc,
    nx: Math.cos(a),
    ny: Math.sin(a),
  };
}

function circlePerimeter(cx: number, cy: number, R: number, u: number) {
  const a = ((u % 1) + 1) % 1 * Math.PI * 2;
  const nx = Math.cos(a);
  const ny = Math.sin(a);
  return { x: cx + R * nx, y: cy + R * ny, nx, ny };
}

type GoldEdgePt = {
  u: number;
  off: number;
  s: number;
  a0: number;
  ph: number;
  cr: number;
  cg: number;
  cb: number;
};

function buildGoldRingPts(count: number, rnd: () => number): GoldEdgePt[] {
  const pts: GoldEdgePt[] = [];
  const pickGold = () => {
    const k = rnd();
    if (k < 0.32) return { cr: 255, cg: 248, cb: 220 };
    if (k < 0.58) return { cr: 255, cg: 220, cb: 120 };
    if (k < 0.82) return { cr: 255, cg: 214, cb: 90 };
    return { cr: 255, cg: 235, cb: 175 };
  };
  for (let i = 0; i < count; i++) {
    const u = i / count + rnd() * 0.0008;
    const jitter = (rnd() - 0.5) * 2.4;
    const { cr, cg, cb } = pickGold();
    pts.push({
      u,
      off: jitter,
      s: 0.62 + rnd() * 1.25,
      a0: 0.22 + rnd() * 0.42,
      ph: rnd() * Math.PI * 2,
      cr,
      cg,
      cb,
    });
  }
  return pts;
}

type FrameEdgePt = GoldEdgePt;

function buildFrameEdgePts(count: number, rnd: () => number, cr: number, cg: number, cb: number): FrameEdgePt[] {
  const pts: FrameEdgePt[] = [];
  const vary = () => {
    const k = rnd();
    const f = 0.94 + k * 0.12;
    return {
      cr: Math.min(255, Math.round(cr * f + 28 * (rnd() - 0.5)) + 18),
      cg: Math.min(255, Math.round(cg * f + 28 * (rnd() - 0.5)) + 18),
      cb: Math.min(255, Math.round(cb * f + 28 * (rnd() - 0.5)) + 18),
    };
  };
  for (let i = 0; i < count; i++) {
    const u = i / count + rnd() * 0.0006;
    const jitter = (rnd() - 0.5) * 1.85;
    const c = vary();
    pts.push({
      u,
      off: jitter,
      s: 0.58 + rnd() * 1.1,
      a0: 0.2 + rnd() * 0.38,
      ph: rnd() * Math.PI * 2,
      cr: c.cr,
      cg: c.cg,
      cb: c.cb,
    });
  }
  return pts;
}

const VB = 400;
const R_RING_VB = 112;

type PojuHowWorksGoldRingProps = {
  reduceMotion: boolean;
  className?: string;
};

/** 与登录 Oracle 卡同思路：canvas + lighter 叠加、沿路径抖动 + 微漂移 */
export function PojuHowWorksGoldRing({ reduceMotion, className }: PojuHowWorksGoldRingProps) {
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
    const rnd = mulberry32(88401);
    const pts = buildGoldRingPts(520, rnd);

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * (R_RING_VB / VB);

    let raf = 0;

    const paint = (now: number) => {
      const rot = reduceMotion ? 0 : now * 0.000038;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      for (const p of pts) {
        const wobble = reduceMotion ? 0 : Math.sin(now * 0.00085 + p.ph) * 0.014;
        const uu = p.u + rot * 0.022 + wobble;
        const { x: bx, y: by, nx, ny } = circlePerimeter(cx, cy, R, uu);
        const x = bx + nx * p.off;
        const y = by + ny * p.off;

        const tw = 0.72 + 0.28 * Math.sin(now * 0.0016 + p.ph);
        const alpha = p.a0 * tw * (reduceMotion ? 1.05 : 1.12);

        ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion) raf = requestAnimationFrame(paint);
    };

    if (reduceMotion) {
      paint(0);
    } else {
      raf = requestAnimationFrame(paint);
    }
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h, reduceMotion]);

  return (
    <div
      ref={wrapRef}
      className={["pointer-events-none absolute inset-0 z-[1] select-none", className ?? ""].filter(Boolean).join(" ")}
      aria-hidden
    >
      <canvas ref={canvasRef} className="block h-full w-full bg-transparent opacity-100 mix-blend-screen" />
    </div>
  );
}

type PojuHowWorksFrameParticlesProps = {
  stepIndex: number;
  rgb: readonly [number, number, number];
  active: boolean;
  reduceMotion: boolean;
  className?: string;
};

export function PojuHowWorksFrameParticles({
  stepIndex,
  rgb,
  active,
  reduceMotion,
  className,
}: PojuHowWorksFrameParticlesProps) {
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
    const rnd = mulberry32(62011 + stepIndex * 104729);
    const [cr0, cg0, cb0] = rgb;
    const pts = buildFrameEdgePts(400, rnd, cr0, cg0, cb0);

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2;
    const cy = H / 2;
    const hw = W / 2 - 0.75;
    const hh = H / 2 - 0.75;
    const rCorner = Math.min(6, hw, hh);

    let raf = 0;

    const paint = (now: number) => {
      const rot = reduceMotion ? 0 : now * 0.000042;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      const boost = active ? 1.48 : 1.12;

      for (const p of pts) {
        const wobble = reduceMotion ? 0 : Math.sin(now * 0.0009 + p.ph) * 0.006;
        const { x: bx, y: by, nx, ny } = roundRectPerimeter(cx, cy, hw, hh, rCorner, p.u + rot * 0.016 + wobble);
        const x = bx + nx * p.off;
        const y = by + ny * p.off;

        const tw = 0.68 + 0.32 * Math.sin(now * 0.00175 + p.ph);
        const alpha = p.a0 * tw * boost * (reduceMotion ? 1.05 : 1.08);

        ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion) raf = requestAnimationFrame(paint);
    };

    if (reduceMotion) {
      paint(0);
    } else {
      raf = requestAnimationFrame(paint);
    }
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h, stepIndex, rgb[0], rgb[1], rgb[2], active, reduceMotion]);

  return (
    <div
      ref={wrapRef}
      className={["pointer-events-none absolute inset-0 z-0 overflow-visible rounded-[6px]", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <canvas ref={canvasRef} className="block h-full w-full bg-transparent opacity-100 mix-blend-screen" />
    </div>
  );
}

/** 六步边框粒子色（与步骤紫 / 青 / 粉系高亮区分，六色互不重复） */
export const POJU_HOW_STEP_PARTICLE_RGB: readonly (readonly [number, number, number])[] = [
  [228, 210, 255],
  [150, 245, 255],
  [255, 220, 240],
  [200, 175, 255],
  [120, 255, 235],
  [255, 185, 220],
] as const;
