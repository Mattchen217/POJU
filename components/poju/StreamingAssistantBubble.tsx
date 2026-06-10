"use client";

import Image from "next/image";
import pojuAvatar from "@/assets/icons/P.png";

type StreamingAssistantBubbleProps = {
  content: string;
};

export function StreamingAssistantBubble({ content }: StreamingAssistantBubbleProps) {
  if (!content.trim()) return null;

  return (
    <div className="pchat__msg pchat__msg--ai">
      <div className="pchat__ai-row">
        <Image
          src={pojuAvatar}
          alt=""
          width={40}
          height={40}
          className="pchat__ai-avatar"
        />
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
