import type { Metadata } from "next";
import { ChatPageClient } from "@/components/chat/chat-page-client";
import { Suspense } from "react";

// 1. 保留元数据（只能在服务端组件导出）
export const metadata: Metadata = {
  title: "pojulife Session",
  description: "pojulife chat session",
};

// 2. 强制动态渲染（解决 build 时的 Prerender 错误）
export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-black">
      {/* 关键修改：必须用 Suspense 包裹包含 useSearchParams 的客户端组件。
          fallback 可以是你自定义的加载动画或简单的黑色背景。
      */}
      <Suspense fallback={<div className="h-full w-full bg-black flex items-center justify-center text-zinc-500 text-sm">Initializing Session...</div>}>
        <ChatPageClient />
      </Suspense>
    </main>
  );
}