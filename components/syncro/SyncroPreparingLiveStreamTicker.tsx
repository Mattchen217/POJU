"use client";

import { useEffect, useRef } from "react";

type Props = {
  text: string;
  active: boolean;
  placeholder?: string;
};

/**
 * Fixed 2-line SSE viewport — auto-scrolls up, blurred so users see motion not content.
 */
export function SyncroPreparingLiveStreamTicker({ text, active, placeholder = "…" }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [text]);

  if (!active && !text) return null;

  const tail = text.length > 480 ? text.slice(-480) : text;

  return (
    <div className="syncro-preparing-live-stream" aria-hidden>
      <div ref={viewportRef} className="syncro-preparing-live-stream__viewport">
        <div className="syncro-preparing-live-stream__content">{tail || placeholder}</div>
      </div>
    </div>
  );
}
