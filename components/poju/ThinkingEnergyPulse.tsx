"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { ThinkingEnergyPulseEngine } from "@/lib/poju/thinking-energy-pulse-engine";

import "@/styles/thinking-energy-pulse.css";

export type ThinkingEnergyPulseHandle = {
  onChunkReceived: (chunkText?: string) => void;
  startFadeOut: () => void;
};

export type ThinkingEnergyPulseProps = {
  /** Stream still active — keeps animating; false triggers fade-out. */
  streaming?: boolean;
  /** When false after fade, parent can unmount. */
  onFadeComplete?: () => void;
  /**
   * Accumulated reasoning text from SSE (never rendered).
   * Component detects deltas and boosts energy per chunk.
   */
  reasoningText?: string | null;
  hudLabel?: string;
};

export const ThinkingEnergyPulse = forwardRef<ThinkingEnergyPulseHandle, ThinkingEnergyPulseProps>(
  function ThinkingEnergyPulse(
    { streaming = true, onFadeComplete, reasoningText, hudLabel = "THOUGHT METRICS: ACTIVE" },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef(new ThinkingEnergyPulseEngine());
    const rafRef = useRef<number>(0);
    const prevReasoningLenRef = useRef(0);
    const prevStreamingRef = useRef(streaming);
    const fadeReportedRef = useRef(false);

    useImperativeHandle(ref, () => ({
      onChunkReceived(chunkText?: string) {
        engineRef.current.onChunkReceived(chunkText);
      },
      startFadeOut() {
        engineRef.current.startFadeOut();
      },
    }));

    useEffect(() => {
      const text = reasoningText ?? "";
      const prevLen = prevReasoningLenRef.current;
      if (text.length > prevLen) {
        engineRef.current.onChunkReceived(text.slice(prevLen));
      }
      prevReasoningLenRef.current = text.length;
    }, [reasoningText]);

    useEffect(() => {
      if (prevStreamingRef.current && !streaming) {
        engineRef.current.startFadeOut();
      }
      prevStreamingRef.current = streaming;
    }, [streaming]);

    useEffect(() => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;

      const engine = engineRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let lastTs = performance.now();

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        engine.resize(w, h);
      };

      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(wrap);

      const draw = (now: number) => {
        const dt = Math.min(48, now - lastTs);
        lastTs = now;
        engine.tick(now, dt);

        if (engine.isDone() && !fadeReportedRef.current) {
          fadeReportedRef.current = true;
          onFadeComplete?.();
        }

        const { width: w, height: h } = engine;
        ctx.clearRect(0, 0, w, h);

        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, "rgba(11, 9, 20, 0.98)");
        bg.addColorStop(1, "rgba(14, 11, 26, 0.95)");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        const alpha = engine.fadeAlpha;
        const steps = Math.max(80, Math.floor(w / 3));

        for (const layer of engine.layers) {
          ctx.beginPath();
          for (let i = 0; i <= steps; i++) {
            const xNorm = i / steps;
            const x = xNorm * w;
            const y = engine.waveY(layer, xNorm, now);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = layer.color;
          ctx.lineWidth = layer.lineWidth;
          ctx.globalAlpha = alpha * (layer.glow ? 0.85 : 0.55);
          if (layer.glow) {
            ctx.shadowBlur = 15 * engine.energy * alpha;
            ctx.shadowColor = "rgba(229, 193, 88, 0.75)";
          } else {
            ctx.shadowBlur = 0;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = alpha;
        for (const p of engine.particles) {
          const t = p.life / p.maxLife;
          ctx.beginPath();
          ctx.fillStyle = `rgba(229, 193, 88, ${t * 0.7})`;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        const nowMs = performance.now();
        for (const flash of engine.hudFlashes) {
          const age = nowMs - flash.born;
          const t = 1 - age / flash.ttl;
          ctx.font = "9px ui-monospace, monospace";
          ctx.fillStyle = `rgba(177, 242, 121, ${t * 0.35})`;
          ctx.fillText(flash.text, flash.x, flash.y);
        }

        const dotPulse = 0.45 + Math.sin(engine.hudDotPhase) * 0.35;
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = `rgba(177, 242, 121, ${dotPulse * alpha * 0.85})`;
        ctx.fillText("●", 12, h - 12);
        ctx.fillStyle = `rgba(177, 242, 121, ${0.45 * alpha})`;
        ctx.fillText(hudLabel, 22, h - 12);

        ctx.globalAlpha = 1;
        rafRef.current = requestAnimationFrame(draw);
      };

      rafRef.current = requestAnimationFrame(draw);

      return () => {
        cancelAnimationFrame(rafRef.current);
        ro.disconnect();
      };
    }, [hudLabel, onFadeComplete]);

    return (
      <div className="tep" ref={wrapRef} role="status" aria-live="polite" aria-label={hudLabel}>
        <canvas ref={canvasRef} className="tep__canvas" aria-hidden />
      </div>
    );
  },
);
