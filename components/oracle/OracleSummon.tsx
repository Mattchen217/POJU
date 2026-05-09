"use client";

import { useEffect, useRef, useState } from "react";
import Spline from "@splinetool/react-spline";
import type { UserInput } from "@/types/oracle";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#0B0815] to-black">
      <div
        className={`absolute inset-0 select-none ${isPressing && phase === "idle" ? "cursor-none touch-none" : ""}`}
        onMouseDown={(e) => {
          if (!isWithinCenterZone(e.clientX, e.clientY)) return;
          handlePressStart();
        }}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          if (!isWithinCenterZone(touch.clientX, touch.clientY)) return;
          handlePressStart();
        }}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
      >
        <div
          className={`absolute inset-0 transition-[transform,opacity] ease-out ${
            phase === "burst" ? "scale-[5] opacity-0 duration-1000" : "scale-100 opacity-100 duration-150"
          }`}
        >
          <Spline scene="/spline/oracle-explosion.splinecode" className="h-full w-full" />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-24 left-1/2 w-[90vw] max-w-md -translate-x-1/2 text-center text-white/70">
        {phase === "burst" ? (
          <p className="whitespace-nowrap text-lg italic">Glyph received...</p>
        ) : isPressing ? (
          <p className="whitespace-nowrap text-lg italic">
            Hold steady... {Math.floor(holdProgress * 100)}%
          </p>
        ) : (
          <p className="whitespace-nowrap text-lg italic">
            Long press in the selected area to receive your glyph
          </p>
        )}
        {phase === "idle" ? (
          <div className="mx-auto mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-purple-300 transition-[width] duration-75"
              style={{ width: `${holdProgress * 100}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
