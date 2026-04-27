"use client"; // 必须放在第一行，声明为客户端组件以支持 onClick 事件

import Link from "next/link";

// 强制动态渲染，防止 Build 时因环境差异导致的预渲染错误
export const dynamic = "force-dynamic";

export default function Error500Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-deep px-4 text-text-body">
      <div className="poju-glass-card max-w-md p-6 text-center">
        <h1 className="text-2xl font-semibold text-text-primary">
          Something in the signal is unclear.
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          The system hit a bump. This is not your fault.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          {/* 在 "use client" 下，onClick 现在可以正常工作 */}
          <button 
            type="button" 
            className="poju-button-primary" 
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
          <Link href="/" className="poju-button-secondary">
            Return home
          </Link>
        </div>
        <p className="mt-4 text-xs text-text-dim">
          If this keeps happening, email support@pojulife.com
        </p>
      </div>
    </div>
  );
}