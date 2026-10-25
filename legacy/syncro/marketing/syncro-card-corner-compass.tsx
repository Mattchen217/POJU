"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type SyncroCardCornerCompassProps = {
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

type Pt =
  | {
      kind: "ring";
      ang: number;
      rad: number;
      s: number;
      a0: number;
      ph: number;
      cr: number;
      cg: number;
      cb: number;
    }
  | {
      kind: "fix";
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
    };

function buildField(W: number, H: number, rnd: () => number) {
  const m = Math.min(W, H);
  const cx = W * 0.76;
  const cy = H * 0.76;
  const R = m * 0.228;
  const pts: Pt[] = [];

  const pickColor = () => {
    const k = rnd();
    if (k < 0.12) return { cr: 248, cg: 250, cb: 252 };
    if (k < 0.55) return { cr: 34, cg: 211, cb: 238 };
    return { cr: 45, cg: 212, cb: 191 };
  };

  const pickNebColor = () => {
    const k = rnd();
    if (k < 0.35) return { cr: 34, cg: 211, cb: 238 };
    if (k < 0.62) return { cr: 56, cg: 189, cb: 248 };
    if (k < 0.82) return { cr: 129, cg: 140, cb: 248 };
    return { cr: 94, cg: 234, cb: 212 };
  };

  for (let i = 0; i < 420; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = R * (0.28 + rnd() * 1.12);
    const squash = 0.78 + rnd() * 0.38;
    const { cr, cg, cb } = pickNebColor();
    pts.push({
      kind: "neb",
      ang,
      rad,
      radWobble: 1.2 + rnd() * 4.5,
      s: 1.1 + rnd() * 2.4,
      a0: 0.018 + rnd() * 0.07,
      ph: rnd() * Math.PI * 2,
      cr,
      cg,
      cb,
      squash,
    });
  }

  for (let i = 0; i < 720; i++) {
    const ang = (i / 720) * Math.PI * 2;
    const band = (rnd() - 0.5) * 4.2;
    const rad = R + 0.4 + band * 0.55;
    const { cr, cg, cb } = pickColor();
    pts.push({
      kind: "ring",
      ang,
      rad,
      s: 0.62 + rnd() * 1.15,
      a0: 0.12 + rnd() * 0.32,
      ph: rnd() * Math.PI * 2,
      cr,
      cg,
      cb,
    });
  }

  for (let i = 0; i < 560; i++) {
    const ang = (i / 560) * Math.PI * 2;
    const band = (rnd() - 0.5) * 3.4;
    const rad = R - 0.35 + band * 0.48;
    const { cr, cg, cb } = pickColor();
    pts.push({
      kind: "ring",
      ang,
      rad,
      s: 0.52 + rnd() * 0.95,
      a0: 0.09 + rnd() * 0.22,
      ph: rnd() * Math.PI * 2,
      cr,
      cg,
      cb,
    });
  }

  for (let i = 0; i < 380; i++) {
    const ang = (i / 380) * Math.PI * 2;
    const band = (rnd() - 0.5) * 2.8;
    const rad = R - 2.6 + band * 0.55;
    const { cr, cg, cb } = pickColor();
    pts.push({
      kind: "ring",
      ang,
      rad,
      s: 0.45 + rnd() * 0.75,
      a0: 0.055 + rnd() * 0.14,
      ph: rnd() * Math.PI * 2,
      cr,
      cg,
      cb,
    });
  }

  const ticks = 24;
  for (let k = 0; k < ticks; k++) {
    const ang = (k / ticks) * Math.PI * 2 - Math.PI / 2;
    const major = k % 6 === 0;
    const steps = major ? 11 : 6;
    for (let j = 0; j < steps; j++) {
      const t = j / Math.max(1, steps - 1);
      const rad = R - 0.8 - t * (major ? 11.5 : 6.8);
      const { cr, cg, cb } = major && j === 0 ? { cr: 240, cg: 249, cb: 255 } : pickColor();
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      pts.push({
        kind: "fix",
        x,
        y,
        s: major ? 0.85 + rnd() * 0.65 : 0.58 + rnd() * 0.5,
        a0: (major ? 0.26 : 0.14) + rnd() * 0.14,
        ph: rnd() * Math.PI * 2,
        cr,
        cg,
        cb,
      });
    }
  }

  for (let i = 0; i < 110; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = rnd() * 4.2;
    const { cr, cg, cb } = pickColor();
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    pts.push({
      kind: "fix",
      x,
      y,
      s: 0.55 + rnd() * 1.15,
      a0: 0.16 + rnd() * 0.45,
      ph: rnd() * Math.PI * 2,
      cr,
      cg,
      cb,
    });
  }

  return { cx, cy, R, pts };
}

export function SyncroCardCornerCompass({ className }: SyncroCardCornerCompassProps) {
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
    const rnd = mulberry32(4411);
    const { cx, cy, R, pts } = buildField(W, H, rnd);

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const m = Math.min(W, H);
    const fs = Math.max(11, Math.round(m * 0.05));
    const labelOffset = fs * 0.92;
    const fillText = "rgba(248, 250, 252, 0.88)";

    let raf = 0;

    const paint = (now: number) => {
      const rot = now * 0.000052;
      ctx.clearRect(0, 0, W, H);

      const drift = now * 0.00007;
      ctx.globalCompositeOperation = "source-over";
      for (let b = 0; b < 5; b++) {
        const ox = cx + Math.cos(drift + b * 1.25) * R * 0.52;
        const oy = cy + Math.sin(drift * 0.85 + b * 0.9) * R * 0.42;
        const rr = R * (1.15 + b * 0.12);
        const g = ctx.createRadialGradient(ox, oy, 1, ox, oy, rr);
        g.addColorStop(0, "rgba(34,211,238,0.11)");
        g.addColorStop(0.35, "rgba(99,102,241,0.06)");
        g.addColorStop(0.65, "rgba(45,212,191,0.05)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.globalCompositeOperation = "lighter";

      for (const p of pts) {
        let x: number;
        let y: number;
        if (p.kind === "ring") {
          const a = p.ang + rot;
          x = cx + Math.cos(a) * p.rad;
          y = cy + Math.sin(a) * p.rad;
        } else if (p.kind === "neb") {
          const a = p.ang + rot * 0.14;
          const rr = p.rad + Math.sin(now * 0.0011 + p.ph) * p.radWobble;
          x = cx + Math.cos(a) * rr * p.squash;
          y = cy + Math.sin(a) * rr * (2 - p.squash) * 0.92;
        } else {
          x = p.x;
          y = p.y;
        }
        const tw = 0.58 + 0.42 * Math.sin(now * 0.0018 + p.ph);
        const edge = 1 - Math.min(1, Math.hypot(x - cx, y - cy) / (R * 1.75));
        const alpha = p.a0 * tw * (p.kind === "neb" ? 0.92 + 0.08 * edge : 0.52 + 0.48 * edge);

        ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "lighter";
      const pulse = 0.55 + 0.45 * Math.sin(now * 0.0024);
      ctx.fillStyle = `rgba(248,250,252,${0.58 * pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(34,211,238,${0.38 * pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalCompositeOperation = "source-over";
      ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = fillText;
      ctx.shadowColor = "rgba(34,211,238,0.5)";
      ctx.shadowBlur = 7;
      ctx.fillText("N", cx, cy - R - labelOffset);
      ctx.fillText("E", cx + R + labelOffset, cy);
      ctx.fillText("S", cx, cy + R + labelOffset);
      ctx.fillText("W", cx - R - labelOffset, cy);
      ctx.shadowBlur = 0;

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
