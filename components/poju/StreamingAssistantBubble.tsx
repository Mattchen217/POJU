"use client";

import { PojuAiAvatar } from "@/components/poju/PojuAiAvatar";

type StreamingAssistantBubbleProps = {
  content: string;
  /** Show cursor while JSON preamble streams before `response` text is extractable. */
  pending?: boolean;
};

/** In-progress stream only — finalized assistant turns render via MessageBubble / PojuChat + RichReadingText. */
export function StreamingAssistantBubble({ content, pending = false }: StreamingAssistantBubbleProps) {
  if (!content.trim() && !pending) return null;

  return (
    <div className="pchat__msg pchat__msg--ai">
      <div className="pchat__ai-row">
        <PojuAiAvatar />
        <div className="pchat__ai">
          <p className="pchat__streaming-line">
            {content}
            <span className="pchat__streaming-cursor">▍</span>
          </p>
        </div>
      </div>
    </div>
  );
}
