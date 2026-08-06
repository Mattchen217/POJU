"use client";

import { useEffect, useRef, useState } from "react";

type TypewriterPlainTextProps = {
  text: string;
  className?: string;
  /** Target reveal duration; long texts stay readable without hanging. */
  durationMs?: number;
  onDone?: () => void;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Fast character-by-character reveal for stages 1–3 plain replies (no glossary marks).
 */
export function TypewriterPlainText({
  text,
  className,
  durationMs,
  onDone,
}: TypewriterPlainTextProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    doneRef.current = false;
    const full = text;
    if (!full) {
      setVisibleCount(0);
      return;
    }

    if (prefersReducedMotion()) {
      setVisibleCount(full.length);
      if (!doneRef.current) {
        doneRef.current = true;
        onDoneRef.current?.();
      }
      return;
    }

    setVisibleCount(0);
    const targetMs = durationMs ?? Math.min(4000, Math.max(700, full.length * 6));
    const started = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / targetMs);
      // Slight ease-out so the last stretch is a bit slower.
      const eased = 1 - (1 - t) * (1 - t);
      const next = Math.min(full.length, Math.floor(eased * full.length));
      setVisibleCount(next);
      if (next >= full.length) {
        if (!doneRef.current) {
          doneRef.current = true;
          onDoneRef.current?.();
        }
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [text, durationMs]);

  const shown = text.slice(0, visibleCount);
  const incomplete = visibleCount < text.length;

  return (
    <p className={className} aria-busy={incomplete}>
      {shown}
      {incomplete ? (
        <span className="pchat__typewriter-caret" aria-hidden>
          ▍
        </span>
      ) : null}
    </p>
  );
}
