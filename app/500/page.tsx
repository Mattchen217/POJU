"use client"; // 必须放在第一行，声明为客户端组件以支持 onClick 事件

import Link from "next/link";

import { GlassCard } from "@/components/ui/GlassCard";

// 强制动态渲染，防止 Build 时因环境差异导致的预渲染错误
export const dynamic = "force-dynamic";

export default function Error500Page() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-text-body">
      <GlassCard variant="elevated" padding="lg" className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-text-primary">
          Something in the signal is unclear.
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          The system hit a bump. This is not your fault.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button type="button" className="glass-btn glass-btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
          <Link href="/" className="glass-btn">
            Return home
          </Link>
        </div>
        <p className="mt-4 text-xs text-text-dim">
          If this keeps happening, email support@pojulife.com
        </p>
      </GlassCard>
    </div>
  );
}