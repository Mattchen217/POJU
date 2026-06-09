"use client";

import { reasoningToLiveLine } from "@/lib/llm/thinking-live-line";

type LiveThinkingTickerProps = {
  line: string | null;
  waitingLabel?: string;
};

export function LiveThinkingTicker({ line, waitingLabel }: LiveThinkingTickerProps) {
  const display = line?.trim() ? reasoningToLiveLine(line) : waitingLabel?.trim() ?? "";
  if (!display) return null;

  return (
    <div className="pchat__thinking" role="status" aria-live="polite">
      <div className="pchat__thinking-bar">
        <div className="pchat__thinking-spinner" aria-hidden />
        <p className="pchat__thinking-line">{display}</p>
      </div>
    </div>
  );
}
