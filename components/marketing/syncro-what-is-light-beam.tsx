"use client";

import { useEffect, useRef } from "react";

/** Matches `.product-what-is--syncro` CSS vars — object-cover / object-center */
const ORIGIN_X = 0.5;
const ORIGIN_Y = 0.55;
const BEAM_LENGTH_RATIO = 0.44;

const SWEEP_MS = 3800;
const FADE_IN_MS = 900;
const TRAIL_FADE_MS = 3200;
const TRAIL_DECAY = 0.038;
const TRAIL_DECAY_FADE = 0.05;

type Phase = "fade_in" | "sweep" | "trail_fade";

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function drawBeam(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  length: number,
  intensity: number,
) {
  const x2 = cx + Math.cos(angle) * length;
  const y2 = cy + Math.sin(angle) * length;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  const grad = ctx.createLinearGradient(cx, cy, x2, y2);
  grad.addColorStop(0, `rgba(255, 248, 220, ${0.96 * intensity})`);
  grad.addColorStop(0.12, `rgba(255, 225, 160, ${0.82 * intensity})`);
  grad.addColorStop(0.45, `rgba(255, 200, 90, ${0.5 * intensity})`);
  grad.addColorStop(0.82, `rgba(232, 185, 129, ${0.14 * intensity})`);
  grad.addColorStop(1, "rgba(212, 165, 116, 0)");

  ctx.strokeStyle = grad;
  ctx.lineWidth = 6;
  ctx.filter = "blur(3px)";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.filter = "none";
  ctx.lineWidth = 1;
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
  core.addColorStop(0, `rgba(255, 248, 220, ${0.92 * intensity})`);
  core.addColorStop(0.45, `rgba(255, 210, 120, ${0.4 * intensity})`);
  core.addColorStop(1, "rgba(212, 165, 116, 0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function fadeTrail(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = `rgba(0, 0, 0, ${amount})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Golden compass beam with persisting trail — sweep, fade trail, pause, repeat */
export function SyncroWhatIsLightBeam() {
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

    let rafId = 0;
    let phase: Phase = "fade_in";
    let phaseStart = performance.now();

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
    }

    const ro = new ResizeObserver(syncSize);
    ro.observe(wrap);
    syncSize();

    function paint(now: number) {
      const nw = wrap!.clientWidth;
      const nh = wrap!.clientHeight;
      if (nw < 2 || nh < 2) {
        rafId = requestAnimationFrame(paint);
        return;
      }

      const cx = nw * ORIGIN_X;
      const cy = nh * ORIGIN_Y;
      const length = Math.min(nw, nh) * BEAM_LENGTH_RATIO;
      const elapsed = now - phaseStart;

      if (reduceMotion) {
        ctx!.clearRect(0, 0, nw, nh);
        drawBeam(ctx!, cx, cy, -Math.PI / 2, length, 0.65);
        return;
      }

      const decay =
        phase === "trail_fade"
          ? TRAIL_DECAY_FADE * (1 + Math.min(1, elapsed / TRAIL_FADE_MS) * 0.35)
          : TRAIL_DECAY;
      fadeTrail(ctx!, nw, nh, decay);

      if (phase === "fade_in") {
        const t = Math.min(1, elapsed / FADE_IN_MS);
        const intensity = easeInOut(t);
        drawBeam(ctx!, cx, cy, -Math.PI / 2, length, intensity);

        if (elapsed >= FADE_IN_MS) {
          phase = "sweep";
          phaseStart = now;
        }
      } else if (phase === "sweep") {
        const t = Math.min(1, elapsed / SWEEP_MS);
        const angle = -Math.PI / 2 + t * Math.PI * 2;
        drawBeam(ctx!, cx, cy, angle, length, 1);

        if (elapsed >= SWEEP_MS) {
          phase = "trail_fade";
          phaseStart = now;
        }
      } else if (phase === "trail_fade") {
        if (elapsed >= TRAIL_FADE_MS) {
          phase = "fade_in";
          phaseStart = now;
        }
      }

      rafId = requestAnimationFrame(paint);
    }

    if (reduceMotion) {
      paint(performance.now());
    } else {
      rafId = requestAnimationFrame(paint);
    }

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={wrapRef} className="product-what-is__syncro-beam" aria-hidden>
      <canvas ref={canvasRef} className="product-what-is__syncro-beam-canvas" />
    </div>
  );
}
