"use client";

import { useEffect, useRef, useState } from "react";

import { reasoningToLiveLine } from "@/lib/llm/thinking-live-line";

type Props = {
  /** Full or partial model reasoning stream. */
  text: string | null | undefined;
};

/** Single-line thinking ticker under activity caption — streams RTL when overflowing. */
export function PojuThinkingTicker({ text }: Props) {
  const line = text?.trim() ? reasoningToLiveLine(text) : "";
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const [scroll, setScroll] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || !line) {
      setScroll(false);
      return;
    }
    setScroll(track.scrollWidth > viewport.clientWidth + 6);
  }, [line]);

  if (!line) return null;

  return (
    <div className="poju-activity__thinking" aria-live="polite">
      <div ref={viewportRef} className="poju-activity__thinking-viewport">
        <span
          ref={trackRef}
          className={`poju-activity__thinking-track${scroll ? " is-scrolling" : ""}`}
        >
          {line}
        </span>
      </div>
    </div>
  );
}
