"use client";

import Image from "next/image";
import pojuLogo from "@/assets/images/POJUlogo.png";
import { pojuChatAssistantContent, pojuChatMessageBody } from "@/lib/poju/chat-layout";

type StreamingAssistantBubbleProps = {
  content: string;
};

export function StreamingAssistantBubble({ content }: StreamingAssistantBubbleProps) {
  if (!content.trim()) return null;

  return (
    <div className="flex w-full gap-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-outline-variant">
        <Image src={pojuLogo} alt="" width={32} height={32} className="object-cover" />
      </div>
      <div className={`${pojuChatAssistantContent} rounded-2xl border border-outline-variant/30 bg-surface-container-high/80 px-4 py-3`}>
        <p className={`${pojuChatMessageBody} whitespace-pre-wrap text-on-surface`}>
          {content}
          <span className="streaming-cursor ml-0.5 inline-block animate-pulse text-primary">▊</span>
        </p>
      </div>
    </div>
  );
}
