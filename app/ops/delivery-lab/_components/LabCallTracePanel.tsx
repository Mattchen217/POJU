"use client";

/**
 * Lab · full invoke observability panels.
 * Evaluate feed → prompts → reasoning → output as one call.
 */

import type { ReactNode } from "react";

type LabCallTraceView = {
  phase?: string;
  system?: string;
  user?: string;
  user_feed?: string;
  reasoning?: string | null;
  reasoning_details?: unknown;
  raw_text?: string | null;
  parsed?: unknown;
  meta?: Record<string, unknown>;
};

function pretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch {
    return String(v);
  }
}

function TraceBlock({
  title,
  accent,
  children,
  defaultOpen = true,
}: {
  title: string;
  accent?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-md border border-white/10 bg-[#101417]"
    >
      <summary
        className={`cursor-pointer px-3 py-2 text-xs uppercase tracking-wider ${
          accent ?? "text-[#71717a]"
        }`}
      >
        {title}
      </summary>
      <div className="max-h-[28rem] overflow-auto border-t border-white/10 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[#e4e4e7]">
        {children}
      </div>
    </details>
  );
}

export function LabCallTracePanel({
  call_trace,
  fallback_raw,
  fallback_input,
}: {
  call_trace?: LabCallTraceView | null;
  fallback_raw?: unknown;
  fallback_input?: unknown;
}) {
  if (!call_trace) {
    return (
      <div className="flex flex-col gap-2 lg:col-span-2">
        <div className="rounded-md border border-amber-500/30 bg-[#101417] px-3 py-2 text-xs text-amber-200/90">
          本 attempt 无完整 Call trace（旧跑次或非 LLM 步）。下方仍显示 Input / Raw。
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <TraceBlock title="① Input payload（摘要）" defaultOpen>
            {pretty(fallback_input)}
          </TraceBlock>
          <TraceBlock title="⑤ Raw model output" defaultOpen>
            {pretty(fallback_raw)}
          </TraceBlock>
        </div>
      </div>
    );
  }

  const meta = call_trace.meta ?? {};
  const reasoning =
    (typeof call_trace.reasoning === "string" && call_trace.reasoning.trim()) ||
    (call_trace.reasoning_details != null
      ? pretty(call_trace.reasoning_details)
      : "");

  return (
    <div className="flex flex-col gap-2 lg:col-span-2">
      <div className="rounded-md border border-[#f2ca50]/25 bg-[#101417] px-3 py-2 text-[11px] text-[#e4e4e7]">
        <span className="text-[#f2ca50]">Call trace</span>
        {call_trace.phase ? ` · ${call_trace.phase}` : ""}
        {typeof meta.actual_model === "string" ? ` · ${meta.actual_model}` : ""}
        {meta.thinking_effort != null ? ` · effort=${String(meta.thinking_effort)}` : ""}
        {meta.tokens_used != null ? ` · tokens=${String(meta.tokens_used)}` : ""}
        {meta.reasoning_tokens != null
          ? ` · reasoning_tok=${String(meta.reasoning_tokens)}`
          : ""}
        {meta.latency_ms != null ? ` · ${String(meta.latency_ms)}ms` : ""}
        {meta.generation_id != null ? ` · gen=${String(meta.generation_id)}` : ""}
      </div>

      <TraceBlock title="① 接收数据 · user_feed（喂料）" accent="text-[#9cf0ff]">
        {call_trace.user_feed?.trim()
          ? call_trace.user_feed
          : "（无独立 user_feed — 见下方完整 User 提示词）"}
      </TraceBlock>

      <TraceBlock title="② System 提示词" accent="text-[#f2ca50]">
        {call_trace.system?.trim() || "（空）"}
      </TraceBlock>

      <TraceBlock title="③ User 提示词（完整 · 含 duty/形状/喂料）" accent="text-[#f2ca50]">
        {call_trace.user?.trim() || "（空）"}
      </TraceBlock>

      <TraceBlock
        title={
          reasoning
            ? "④ 模型推理过程（reasoning）"
            : "④ 模型推理过程（本 invoke 未返回 reasoning 文本）"
        }
        accent="text-[#c4b5fd]"
      >
        {reasoning ||
          "thinking_effort 已开但供应商未回 reasoning 字段，或本步未走 LLM。可对照 meta.reasoning_tokens。"}
      </TraceBlock>

      <div className="grid gap-2 lg:grid-cols-2">
        <TraceBlock title="⑤ 输出 · 解析后 JSON" accent="text-emerald-400/90">
          {call_trace.parsed !== undefined
            ? pretty(call_trace.parsed)
            : pretty(fallback_raw)}
        </TraceBlock>
        <TraceBlock title="⑤b 输出 · 模型原文 raw_text" accent="text-emerald-400/90">
          {call_trace.raw_text?.trim() || pretty(fallback_raw) || "（空）"}
        </TraceBlock>
      </div>

      <TraceBlock title="⓪ Input payload 摘要（元数据）" defaultOpen={false}>
        {pretty(fallback_input)}
      </TraceBlock>
    </div>
  );
}
