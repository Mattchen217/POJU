"use client";

import { useEffect, useRef, useState } from "react";

import { RichReadingText } from "@/components/cross-product/RichReadingText";

type Props = {
  text: string;
  locale: string;
  className?: string;
  dualLayer?: boolean;
  durationMs?: number;
  onDone?: () => void;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Avoid cutting mid-`**bold**` or mid-⟦marker⟧ so the rich renderer doesn't flash raw syntax.
 */
function safeRevealEnd(text: string, count: number): number {
  let n = Math.max(0, Math.min(count, text.length));
  if (n <= 0 || n >= text.length) return n;

  const head = text.slice(0, n);

  // Unclosed ** … **
  const boldMarks = head.match(/\*\*/g);
  if (boldMarks && boldMarks.length % 2 === 1) {
    const next = text.indexOf("**", n);
    if (next !== -1 && next - n < 120) {
      n = next + 2;
    } else {
      const prev = head.lastIndexOf("**");
      if (prev >= 0) n = prev;
    }
  }

  // Unclosed ⟦ … ⟧
  const open = (head.match(/⟦/g) ?? []).length;
  const close = (head.match(/⟧/g) ?? []).length;
  if (open > close) {
    const next = text.indexOf("⟧", n);
    if (next !== -1 && next - n < 200) {
      n = next + 1;
    } else {
      const prev = head.lastIndexOf("⟦");
      if (prev >= 0) n = prev;
    }
  }

  return Math.max(0, Math.min(n, text.length));
}

/**
 * Typewriter that reveals through RichReadingText (Word-like layout), never raw markdown.
 * Call only after the model turn is complete.
 */
export function TypewriterRichReadingText({
  text,
  locale,
  className,
  dualLayer = true,
  durationMs,
  onDone,
}: Props) {
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
    const targetMs = durationMs ?? Math.min(5200, Math.max(900, full.length * 5));
    const started = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / targetMs);
      const eased = 1 - (1 - t) * (1 - t);
      const raw = Math.min(full.length, Math.floor(eased * full.length));
      const next = safeRevealEnd(full, raw);
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

  const shown = text.slice(0, safeRevealEnd(text, visibleCount));
  const incomplete = visibleCount < text.length;

  return (
    <div className="pchat__typewriter-rich" aria-busy={incomplete}>
      <RichReadingText text={shown} locale={locale} dualLayer={dualLayer} className={className} />
      {incomplete ? (
        <span className="pchat__typewriter-caret" aria-hidden>
          ▍
        </span>
      ) : null}
    </div>
  );
}
