"use client";

type StreamingAssistantBubbleProps = {
  content: string;
};

export function StreamingAssistantBubble({ content }: StreamingAssistantBubbleProps) {
  if (!content.trim()) return null;

  return (
    <div className="pchat__msg pchat__msg--ai">
      <p className="pchat__streaming-line">
        {content}
        <span className="pchat__streaming-cursor">▊</span>
      </p>
    </div>
  );
}
