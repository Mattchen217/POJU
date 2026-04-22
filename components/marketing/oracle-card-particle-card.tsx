"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type OracleCardParticleCardProps = {
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

function insideRoundRect(px: number, py: number, cx: number, cy: number, hw: number, hh: number, r: number) {
  const rr = Math.min(r, hw, hh);
  const x = Math.abs(px - cx);
  const y = Math.abs(py - cy);
  if (x > hw || y > hh) return false;
  if (x <= hw - rr || y <= hh - rr) return true;
  const dx = x - (hw - rr);
  const dy = y - (hh - rr);
  return dx * dx + dy * dy <= rr * rr;
}

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

type Pt =
  | {
      kind: "neb";
      ang: number;
      rad: number;
      radWobble: number;
      s: number;
      a0: number;
      ph: number;
      cr: number;
      cg: number;
      cb: number;
      squash: number;
    }
  | {
      kind: "fill";
      x: number;
      y: number;
      s: number;
      a0: number;
      ph: number;
      cr: number;
      cg: number;
      cb: number;
    }
  | {
      kind: "edge";
      u: number;
      off: number;
      s: number;
      a0: number;
      ph: number;
      cr: number;
      cg: number;
      cb: number;
    };

function buildField(W: number, H: number, rnd: () => number) {
  const m = Math.min(W, H);
  const cx = W * 0.76;
  const cy = H * 0.76;
  const hw = m * 0.21;
  const hh = m * 0.29;
  const rCorner = m * 0.055;
  const pts: Pt[] = [];

  const pickNeb = () => {
    const k = rnd();
    if (k < 0.28) return { cr: 251, cg: 191, cb: 36 };
    if (k < 0.52) return { cr: 232, cg: 121, cb: 249 };
    if (k < 0.78) return { cr: 167, cg: 139, cb: 250 };
    return { cr: 244, cg: 114, cb: 182 };
  };

  const pickFill = () => {
    const k = rnd();
    if (k < 0.22) return { cr: 253, cg: 224, cb: 150 };
    if (k < 0.5) return { cr: 216, cg: 180, cb: 254 };
    if (k < 0.75) return { cr: 196, cg: 181, cb: 253 };
    return { cr: 245, cg: 208, cb: 254 };
  };

  const pickEdge = () => {
    const k = rnd();
    if (k < 0.35) return { cr: 255, cg: 237, cb: 200 };
    if (k < 0.65) return { cr: 250, cg: 204, cb: 21 };
    return { cr: 233, cg: 213, cb: 255 };
  };

  for (let i = 0; i < 460; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = m * (0.26 + rnd() * 1.05);
    const squash = 0.76 + rnd() * 0.36;
    const { cr, cg, cb } = pickNeb();
    pts.push({
      kind: "neb",
      ang,
      rad,
      radWobble: 1.4 + rnd() * 5,
      s: 1.2 + rnd() * 2.6,
      a0: 0.02 + rnd() * 0.075,
      ph: rnd() * Math.PI * 2,
      cr,
      cg,
      cb,
      squash,
    });
  }

  for (let i = 0; i < 560; i++) {
    let guard = 0;
    let px = cx;
    let py = cy;
    while (guard++ < 40) {
      px = cx + (rnd() - 0.5) * hw * 1.85;
      py = cy + (rnd() - 0.5) * hh * 1.95;
      if (insideRoundRect(px, py, cx, cy, hw, hh, rCorner)) break;
    }
    const { cr, cg, cb } = pickFill();
    pts.push({
      kind: "fill",
      x: px,
      y: py,
      s: 0.5 + rnd() * 0.95,
      a0: 0.032 + rnd() * 0.07,
      ph: rnd() * Math.PI * 2,
      cr,
      cg,
      cb,
    });
  }

  for (let i = 0; i < 780; i++) {
    const u = i / 780 + rnd() * 0.001;
    const jitter = (rnd() - 0.5) * 1.35;
    const { cr, cg, cb } = pickEdge();
    pts.push({
      kind: "edge",
      u,
      off: jitter,
      s: 0.62 + rnd() * 1.05,
      a0: 0.14 + rnd() * 0.32,
      ph: rnd() * Math.PI * 2,
      cr,
      cg,
      cb,
    });
  }

  for (let i = 0; i < 420; i++) {
    const u = i / 420 + rnd() * 0.001;
    const jitter = -2.1 + (rnd() - 0.5) * 0.9;
    const { cr, cg, cb } = pickFill();
    pts.push({
      kind: "edge",
      u,
      off: jitter,
      s: 0.45 + rnd() * 0.75,
      a0: 0.08 + rnd() * 0.18,
      ph: rnd() * Math.PI * 2,
      cr,
      cg,
      cb,
    });
  }

  return { cx, cy, hw, hh, rCorner, pts };
}

export function OracleCardParticleCard({ className }: OracleCardParticleCardProps) {
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
    const rnd = mulberry32(77821);
    const { cx, cy, hw, hh, rCorner, pts } = buildField(W, H, rnd);

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const m = Math.min(W, H);
    const Rglow = m * 0.52;

    let raf = 0;

    const paint = (now: number) => {
      const rot = now * 0.000045;
      ctx.clearRect(0, 0, W, H);

      const drift = now * 0.000065;
      ctx.globalCompositeOperation = "source-over";
      for (let b = 0; b < 6; b++) {
        const ox = cx + Math.cos(drift + b * 1.05) * Rglow * 0.38;
        const oy = cy + Math.sin(drift * 0.82 + b * 1.1) * Rglow * 0.32;
        const rr = Rglow * (1.05 + b * 0.07);
        const g = ctx.createRadialGradient(ox, oy, 1, ox, oy, rr);
        g.addColorStop(0, "rgba(251,191,36,0.12)");
        g.addColorStop(0.32, "rgba(232,121,249,0.08)");
        g.addColorStop(0.58, "rgba(139,92,246,0.06)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.globalCompositeOperation = "lighter";

      for (const p of pts) {
        let x: number;
        let y: number;
        if (p.kind === "neb") {
          const a = p.ang + rot * 0.12;
          const rr = p.rad + Math.sin(now * 0.001 + p.ph) * p.radWobble;
          x = cx + Math.cos(a) * rr * p.squash;
          y = cy + Math.sin(a) * rr * (2 - p.squash) * 0.9;
        } else if (p.kind === "fill") {
          const dx = p.x - cx;
          const dy = p.y - cy;
          const c = Math.cos(rot * 0.35);
          const s = Math.sin(rot * 0.35);
          x = cx + dx * c - dy * s;
          y = cy + dx * s + dy * c;
        } else {
          const { x: bx, y: by, nx, ny } = roundRectPerimeter(cx, cy, hw, hh, rCorner, p.u + rot * 0.018);
          x = bx + nx * p.off;
          y = by + ny * p.off;
        }

        const tw = 0.58 + 0.42 * Math.sin(now * 0.0017 + p.ph);
        const alpha = p.a0 * tw;

        ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h]);

  return (
    <div
      ref={wrapRef}
      className={[
        "pointer-events-none absolute inset-0 z-[11] select-none opacity-[0.94] mix-blend-screen",
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
