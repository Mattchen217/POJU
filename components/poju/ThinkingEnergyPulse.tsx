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
  /** `bar` = composer strip; `inline` = beside POJU avatar, transparent. */
  variant?: "bar" | "inline";
  /** Show bottom HUD dot + label (off for inline avatar layout). */
  showHud?: boolean;
};

export const ThinkingEnergyPulse = forwardRef<ThinkingEnergyPulseHandle, ThinkingEnergyPulseProps>(
  function ThinkingEnergyPulse(
    {
      streaming = true,
      onFadeComplete,
      reasoningText,
      hudLabel = "THOUGHT METRICS: ACTIVE",
      variant = "bar",
      showHud = variant === "bar",
    },
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

      let lastW = 0;
      let lastH = 0;

      const resize = () => {
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

        const alpha = engine.fadeAlpha;
        const steps = Math.max(64, Math.floor(w / 4));

        for (const layer of engine.layers) {
          ctx.beginPath();
          for (let i = 0; i <= steps; i++) {
            const xNorm = i / steps;
            const x = xNorm * w;
            const y = engine.waveY(layer, xNorm, now);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }

          if (layer.glow) {
            ctx.strokeStyle = "rgba(229, 193, 88, 0.32)";
            ctx.lineWidth = layer.lineWidth + 5;
            ctx.globalAlpha = alpha * 0.38 * engine.energy;
            ctx.stroke();
          }

          ctx.strokeStyle = layer.color;
          ctx.lineWidth = layer.lineWidth;
          ctx.globalAlpha = alpha * (layer.glow ? 0.88 : 0.58);
          ctx.stroke();
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
        if (showHud) {
          for (const flash of engine.hudFlashes) {
            const age = nowMs - flash.born;
            const t = 1 - age / flash.ttl;
            ctx.font = "9px ui-monospace, monospace";
            ctx.fillStyle = `rgba(177, 242, 121, ${t * 0.35})`;
            ctx.fillText(flash.text, flash.x, flash.y);
          }

          const dotPulse = 0.55 + Math.sin(engine.hudDotPhase) * 0.2;
          ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
          ctx.fillStyle = `rgba(177, 242, 121, ${dotPulse * alpha * 0.85})`;
          ctx.fillText("●", 12, h - 12);
          ctx.fillStyle = `rgba(177, 242, 121, ${0.45 * alpha})`;
          ctx.fillText(hudLabel, 22, h - 12);
        } else {
          for (const flash of engine.hudFlashes) {
            const age = nowMs - flash.born;
            const t = 1 - age / flash.ttl;
            ctx.font = "8px ui-monospace, monospace";
            ctx.fillStyle = `rgba(177, 242, 121, ${t * 0.22})`;
            ctx.fillText(flash.text, flash.x, flash.y * 0.92);
          }
        }

        ctx.globalAlpha = 1;
        rafRef.current = requestAnimationFrame(draw);
      };

      rafRef.current = requestAnimationFrame(draw);

      return () => {
        cancelAnimationFrame(rafRef.current);
        ro.disconnect();
      };
    }, [hudLabel, onFadeComplete, showHud]);

    const className = variant === "inline" ? "tep tep--inline" : "tep";

    return (
      <div className={className} ref={wrapRef} role="status" aria-live="polite" aria-label={hudLabel}>
        <canvas ref={canvasRef} className="tep__canvas" aria-hidden />
      </div>
    );
  },
);
