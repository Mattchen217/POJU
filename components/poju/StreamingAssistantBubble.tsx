"use client";

import { pojuChatAssistantProse, pojuChatMessageBlock } from "@/lib/poju/chat-layout";

type StreamingAssistantBubbleProps = {
  content: string;
};

export function StreamingAssistantBubble({ content }: StreamingAssistantBubbleProps) {
  if (!content.trim()) return null;

  return (
    <div className={`${pojuChatMessageBlock} poju-chat-message-block--assistant`}>
      <div className={pojuChatAssistantProse}>
        <p className="m-0 whitespace-pre-wrap">
          {content}
          <span className="streaming-cursor ml-0.5 inline-block animate-pulse text-primary">▊</span>
        </p>
      </div>
    </div>
  );
}
