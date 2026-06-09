"use client";

import { reasoningToLiveLine } from "@/lib/llm/thinking-live-line";
import "@/styles/thinking-stream.css";

type LiveThinkingTickerProps = {
  line: string | null;
  waitingLabel?: string;
};

/** Single-line blurred/scrolling thinking indicator during LLM reasoning. */
export function LiveThinkingTicker({ line, waitingLabel }: LiveThinkingTickerProps) {
  const display = line?.trim() ? reasoningToLiveLine(line) : waitingLabel?.trim() ?? "";
  if (!display) return null;

  return (
    <div className="thinking-stream-bar live-thinking-ticker" role="status" aria-live="polite">
      <div className="thinking-spinner-mini" aria-hidden />
      <p className="thinking-stream-line live-thinking-ticker__line">{display}</p>
    </div>
  );
}
