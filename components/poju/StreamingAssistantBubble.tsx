"use client";

import Image from "next/image";
import pojuLogo from "@/assets/images/POJUlogo.png";
import { pojuChatAssistantCard, pojuChatAssistantContent, pojuChatAvatar, pojuChatMessageBody, pojuChatMessageRow } from "@/lib/poju/chat-layout";

type StreamingAssistantBubbleProps = {
  content: string;
};

export function StreamingAssistantBubble({ content }: StreamingAssistantBubbleProps) {
  if (!content.trim()) return null;

  return (
    <div className={pojuChatMessageRow}>
      <div className={pojuChatAvatar}>
        <Image src={pojuLogo} alt="" width={36} height={36} className="h-full w-full object-cover" />
      </div>
      <div className={`${pojuChatAssistantContent} ${pojuChatAssistantCard} poju-chat-streaming-bubble`}>
        <p className={`${pojuChatMessageBody} m-0 whitespace-pre-wrap`}>
          {content}
          <span className="streaming-cursor ml-0.5 inline-block animate-pulse text-primary">▊</span>
        </p>
      </div>
    </div>
  );
}
