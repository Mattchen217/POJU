"use client";

import { useEffect, useRef, useState } from "react";
import Spline from "@splinetool/react-spline";
import type { UserInput } from "@/types/oracle";

import "@/styles/oracle-summon.css";

interface OracleSummonProps {
  userInput: UserInput;
  onComplete: () => void;
}

const HOLD_MS = 3000;
const BURST_MS = 1000;

export function OracleSummon({ userInput: _userInput, onComplete }: OracleSummonProps) {
  const [isPressing, setIsPressing] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "burst">("idle");

  const holdStartRef = useRef<number | null>(null);
  const holdTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isWithinCenterZone = (clientX: number, clientY: number): boolean => {
    if (typeof window === "undefined") return false;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.36;
    const dx = clientX - cx;
    const dy = clientY - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  const clearHoldTimers = () => {
    if (holdTickRef.current) {
      clearInterval(holdTickRef.current);
      holdTickRef.current = null;
    }
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const beginBurst = () => {
    if (phase !== "idle") return;
    clearHoldTimers();
    holdStartRef.current = null;
    setIsPressing(false);
    setHoldProgress(1);
    setPhase("burst");
    burstTimeoutRef.current = setTimeout(() => {
      onComplete();
    }, BURST_MS);
  };

  const handlePressStart = () => {
    if (phase !== "idle") return;
    clearHoldTimers();
    holdStartRef.current = Date.now();
    setIsPressing(true);
    setHoldProgress(0);

    holdTickRef.current = setInterval(() => {
      if (holdStartRef.current == null) return;
      const elapsed = Date.now() - holdStartRef.current;
      setHoldProgress(Math.min(1, elapsed / HOLD_MS));
    }, 50);

    holdTimeoutRef.current = setTimeout(() => {
      beginBurst();
    }, HOLD_MS);
  };

  const handlePressEnd = () => {
    if (phase !== "idle") return;
    clearHoldTimers();
    holdStartRef.current = null;
    setIsPressing(false);
    setHoldProgress(0);
  };

  useEffect(() => {
    return () => {
      clearHoldTimers();
      if (burstTimeoutRef.current) {
        clearTimeout(burstTimeoutRef.current);
        burstTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div className="oracle-summon-page">
      <div className="oracle-summon-shield" aria-hidden />

      <div className="oracle-summon-scene" aria-hidden>
        <div
          className={`oracle-summon-scene-inner ${
            phase === "burst" ? "oracle-summon-scene-inner--burst" : ""
          }`}
        >
          <Spline scene="/spline/oracle-explosion.splinecode" className="h-full w-full" />
        </div>
      </div>

      <div
        className={`oracle-summon-press-zone ${isPressing && phase === "idle" ? "oracle-summon-press-zone--pressing" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          if (!isWithinCenterZone(e.clientX, e.clientY)) return;
          handlePressStart();
        }}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          if (!isWithinCenterZone(touch.clientX, touch.clientY)) return;
          e.preventDefault();
          handlePressStart();
        }}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className="oracle-summon-hint">
        {phase === "burst" ? (
          <p>Glyph received...</p>
        ) : isPressing ? (
          <p>Hold steady... {Math.floor(holdProgress * 100)}%</p>
        ) : (
          <p>Long press in the center to receive your glyph</p>
        )}
        {phase === "idle" ? (
          <div className="oracle-summon-progress">
            <div
              className="oracle-summon-progress-bar"
              style={{ width: `${holdProgress * 100}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
