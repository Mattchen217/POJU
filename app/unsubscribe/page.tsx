"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// 1. 强制动态渲染，确保 build 时不尝试将其静态化
export const dynamic = "force-dynamic";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  // 这里是你原本的退订逻辑和 UI
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-deep px-4 text-text-body">
      <div className="poju-glass-card max-w-md p-8 text-center">
        <h1 className="text-2xl font-semibold text-text-primary">Unsubscribe</h1>
        <p className="mt-4 text-sm text-text-secondary">
          We will erase {email ? <span className="text-text-primary">{email}</span> : "your email"} from our temporary sending list.
        </p>
        
        <button
          type="button"
          className="poju-button-primary mt-8 w-full"
          onClick={() => {
            // 这里放你原本的退订处理函数
            console.log("Unsubscribing...");
          }}
        >
          Confirm Unsubscribe
        </button>

        <div className="mt-6">
          <Link href="/" className="text-sm text-text-dim hover:text-text-primary">
            Return to POJU Home
          </Link>
        </div>
      </div>
    </main>
  );
}

// 2. 默认导出的入口组件
export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-deep flex items-center justify-center text-text-secondary">
        Loading...
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}