"use client";

import { PojuAiAvatar } from "@/components/poju/PojuAiAvatar";

type StreamingAssistantBubbleProps = {
  content: string;
};

export function StreamingAssistantBubble({ content }: StreamingAssistantBubbleProps) {
  if (!content.trim()) return null;

  return (
    <div className="pchat__msg pchat__msg--ai">
      <div className="pchat__ai-row">
        <PojuAiAvatar />
        <div className="pchat__ai">
          <p className="pchat__streaming-line">
            {content}
            <span className="pchat__streaming-cursor">▊</span>
          </p>
        </div>
      </div>
    </div>
  );
}
