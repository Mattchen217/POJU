"use client";

import { useEffect, useMemo, useState } from "react";
import { getThinkingStreamLines } from "@/lib/poju/thinking-stream-lines";
import type { ThinkingStreamMode } from "@/lib/poju/thinking-stream-mode";

export interface ThinkingStreamProps {
  mode: ThinkingStreamMode | null;
  locale: string;
}

export function ThinkingStream({ mode, locale }: ThinkingStreamProps) {
  const lines = useMemo(
    () => (mode ? getThinkingStreamLines(mode, locale) : []),
    [mode, locale],
  );
  const [lineIndex, setLineIndex] = useState(0);
  const currentLine = lines[lineIndex] ?? "";

  useEffect(() => {
    if (!mode || lines.length === 0) {
      setLineIndex(0);
      return;
    }
    setLineIndex(0);
    const interval = setInterval(() => {
      setLineIndex((prev) => (prev + 1) % lines.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [mode, locale, lines.length]);

  if (!mode || lines.length === 0) return null;

  return (
    <div className="pchat__thinking" role="status" aria-live="polite">
      <div className="pchat__thinking-bar">
        <div className="pchat__thinking-spinner" aria-hidden />
        <p key={`${mode}-${lineIndex}`} className="pchat__thinking-line">
          {currentLine}
        </p>
      </div>
    </div>
  );
}
