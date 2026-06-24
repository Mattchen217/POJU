"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { DsWhenProductCard } from "@/components/ds/marketing/DsWhenProductCard";
import { DsFlowStepRow, type FlowStep } from "@/components/ds/marketing/DsFlowStepRow";
import { ACTIVITY_CAPTION_ROTATE_MS } from "@/lib/ui/activity-caption-timing";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const SYNCRO_ANG = [0, 45, 90, 135, 180];

/** DS SyncroFlow — 24h timeline sweep + compass */
export function DsSyncroFlow({ steps }: { steps: FlowStep[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const period = ACTIVITY_CAPTION_ROTATE_MS * Math.max(steps.length, 1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = host.getBoundingClientRect();
      w = Math.max(1, Math.floor(r.width));
      h = Math.max(1, Math.floor(r.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const draw = (now: number) => {
      if (!ctx) return;
      const padX = Math.min(64, w * 0.1);
      const trackY = h * 0.5;
      const x0 = padX;
      const x1 = w - padX;
      const span = x1 - x0;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, trackY);
      ctx.lineTo(x1, trackY);
      ctx.stroke();

      for (let i = 0; i <= 24; i++) {
        const tx = x0 + (span * i) / 24;
        const big = i % 6 === 0;
        ctx.strokeStyle = big ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx, trackY - (big ? 10 : 5));
        ctx.lineTo(tx, trackY + (big ? 10 : 5));
        ctx.stroke();
      }

      const raw = (now % period) / period;
      const p = easeInOut(Math.min(1, raw / 0.82));
      const sx = x0 + span * p;

      const grad = ctx.createLinearGradient(x0, 0, sx, 0);
      grad.addColorStop(0, "rgba(34,211,238,0.15)");
      grad.addColorStop(1, "rgba(34,211,238,0.9)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, trackY);
      ctx.lineTo(sx, trackY);
      ctx.stroke();

      ctx.globalCompositeOperation = "lighter";
      const hg = ctx.createRadialGradient(sx, trackY, 1, sx, trackY, 46);
      hg.addColorStop(0, "rgba(165,243,252,0.5)");
      hg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(sx, trackY, 46, 0, Math.PI * 2);
      ctx.fill();

      const activeIdx = Math.min(steps.length - 1, Math.floor(p * steps.length + 0.0001));
      for (let i = 0; i < steps.length; i++) {
        const nx = x0 + span * ((i + 0.5) / steps.length);
        const on = i <= activeIdx;
        const cur = i === activeIdx;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#0b1320";
        ctx.beginPath();
        ctx.arc(nx, trackY, cur ? 15 : 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = on ? `rgba(34,211,238,${cur ? 1 : 0.7})` : "rgba(255,255,255,0.18)";
        ctx.lineWidth = cur ? 2 : 1.5;
        ctx.stroke();
        if (cur) {
          const ang = now * 0.0022;
          ctx.globalCompositeOperation = "lighter";
          for (let d = 0; d < 8; d++) {
            const a = ang + (d * Math.PI) / 4;
            ctx.strokeStyle = "rgba(34,211,238,0.5)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nx + Math.cos(a) * 8, trackY + Math.sin(a) * 8);
            ctx.lineTo(nx + Math.cos(a) * 15, trackY + Math.sin(a) * 15);
            ctx.stroke();
          }
          ctx.strokeStyle = "rgba(165,243,252,0.95)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(nx, trackY);
          ctx.lineTo(nx + Math.cos(ang) * 11, trackY + Math.sin(ang) * 11);
          ctx.stroke();
        } else {
          ctx.fillStyle = on ? "rgba(165,243,252,0.9)" : "rgba(255,255,255,0.3)";
          ctx.beginPath();
          ctx.arc(nx, trackY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      canvas.remove();
    };
  }, [steps.length]);

  return (
    <div>
      <div ref={hostRef} className="ds-syncro-flow-canvas" />
      <DsFlowStepRow steps={steps} accentRgb="34,211,238" cycleMs={period / steps.length} />
    </div>
  );
}

export function DsSyncroFitCard({ title, description, index }: { title: string; description: string; index: number }) {
  const angle = SYNCRO_ANG[index % SYNCRO_ANG.length];

  return (
    <DsWhenProductCard
      theme="syncro"
      index={index + 1}
      icon={
        <span
          className="inline-block text-lg font-bold leading-none"
          style={{ transform: `rotate(${angle}deg)` }}
          aria-hidden
        >
          ↑
        </span>
      }
      title={title}
      description={description}
    />
  );
}

/** DS MatchFlow — dual streams converge */
export function DsMatchFlow({ steps }: { steps: FlowStep[] }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rnd = mulberry32(21);
    const pts = Array.from({ length: 64 }, (_, i) => ({
      from: i % 2,
      off: rnd(),
      sp: 0.5 + rnd() * 0.6,
      sz: 0.8 + rnd() * 1.7,
      wob: (rnd() - 0.5) * 0.16,
    }));

    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = host.getBoundingClientRect();
      w = Math.max(1, Math.floor(r.width));
      h = Math.max(1, Math.floor(r.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const draw = (now: number) => {
      if (!ctx) return;
      const A = { x: w * 0.16, y: h * 0.3 };
      const B = { x: w * 0.84, y: h * 0.3 };
      const C = { x: w * 0.5, y: h * 0.78 };
      const colA = "244,114,182";
      const colB = "167,139,250";

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (const pt of pts) {
        const src = pt.from ? B : A;
        const col = pt.from ? colB : colA;
        const t = (now * 0.00018 * pt.sp + pt.off) % 1;
        const mx = (src.x + C.x) / 2 + (pt.from ? -1 : 1) * w * pt.wob;
        const my = (src.y + C.y) / 2 - h * 0.12;
        const x = (1 - t) * (1 - t) * src.x + 2 * (1 - t) * t * mx + t * t * C.x;
        const y = (1 - t) * (1 - t) * src.y + 2 * (1 - t) * t * my + t * t * C.y;
        const alpha = Math.sin(Math.PI * t) * 0.7;
        ctx.fillStyle = `rgba(${col},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, pt.sz, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const [P, col] of [
        [A, colA],
        [B, colB],
      ] as const) {
        const pr = 0.7 + 0.3 * Math.sin(now * 0.003 + (col === colA ? 0 : 1.6));
        const g = ctx.createRadialGradient(P.x, P.y, 1, P.x, P.y, 34);
        g.addColorStop(0, `rgba(${col},${0.5 * pr})`);
        g.addColorStop(0.5, `rgba(${col},${0.18 * pr})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(P.x, P.y, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(P.x, P.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const mp = 0.6 + 0.4 * Math.sin(now * 0.0035);
      const cr = 30 + 8 * mp;
      const cg = ctx.createRadialGradient(C.x, C.y, 1, C.x, C.y, cr);
      cg.addColorStop(0, `rgba(255,225,240,${0.55 * mp})`);
      cg.addColorStop(0.4, `rgba(244,114,182,${0.3 * mp})`);
      cg.addColorStop(0.7, `rgba(167,139,250,${0.18 * mp})`);
      cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(C.x, C.y, cr, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#0b0a14";
      ctx.beginPath();
      ctx.arc(C.x, C.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,180,210,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = "600 13px var(--pj-font-sans), sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,180,210,0.95)";
      ctx.fillText("A", A.x, A.y + 4.5);
      ctx.fillStyle = "rgba(196,181,253,0.95)";
      ctx.fillText("B", B.x, B.y + 4.5);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      canvas.remove();
    };
  }, []);

  return (
    <div>
      <div ref={hostRef} className="ds-match-flow-canvas" />
      <DsFlowStepRow steps={steps} accentRgb="244,114,182" />
    </div>
  );
}

export function DsMatchUseCard({
  index,
  icon,
  title,
  description,
}: {
  index: number;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <DsWhenProductCard
      theme="match"
      index={index}
      icon={icon}
      title={title}
      description={description}
    />
  );
}
