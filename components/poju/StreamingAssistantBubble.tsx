"use client";

import { PojuAiAvatar } from "@/components/poju/PojuAiAvatar";

type StreamingAssistantBubbleProps = {
  /** Localized "POJU is replying…" — never shows raw model stream. */
  label: string;
};

/** In-progress reply — placeholder + cursor only; finalized turns use RichReadingText. */
export function StreamingAssistantBubble({ label }: StreamingAssistantBubbleProps) {
  return (
    <div className="pchat__msg pchat__msg--ai">
      <div className="pchat__ai-row">
        <PojuAiAvatar />
        <div className="pchat__ai">
          <p className="pchat__streaming-line pchat__streaming-placeholder">
            <span className="pchat__streaming-placeholder-text">{label}</span>
            <span className="pchat__streaming-cursor" aria-hidden>
              ▍
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
