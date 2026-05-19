"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { BaseAnalysisAuditRecord } from "@/lib/dev/base-analysis-audit-types";

type Tab = "analysis" | "profile" | "prompts" | "reasoning" | "raw";

function JsonBlock({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-emerald-100/90">
      {text}
    </pre>
  );
}

export default function BaseAnalysisAuditDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [record, setRecord] = useState<BaseAnalysisAuditRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("analysis");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dev/base-analysis-audit/${id}`);
      const data = (await res.json()) as { ok?: boolean; record?: BaseAnalysisAuditRecord; error?: string };
      if (!res.ok || !data.ok || !data.record) {
        setError(data.error || `HTTP ${res.status}`);
        setRecord(null);
        return;
      }
      setRecord(data.record);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "analysis", label: "DeepSeek 分析 JSON", show: true },
    { key: "profile", label: "出生与排盘输入", show: true },
    { key: "prompts", label: "发给模型的 Prompt", show: true },
    { key: "reasoning", label: "推理过程 (reasoning)", show: Boolean(record?.reasoning?.trim()) },
    { key: "raw", label: "模型原始输出", show: Boolean(record?.raw_model_text?.trim()) },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f12] text-[#e8e6e3]">
      <header className="border-b border-white/10 px-6 py-5">
        <Link href="/base-analysis-audit" className="text-sm text-amber-300/80 hover:text-amber-200">
          ← 返回列表
        </Link>
        {record ? (
          <>
            <h1 className="mt-2 text-xl font-semibold">{record.birth_summary}</h1>
            <p className="mt-1 text-sm text-white/55">
              {record.display_name ? `${record.display_name} · ` : ""}
              {new Date(record.created_at).toLocaleString()} · {record.model} · {record.tokens_used} tokens
            </p>
            {record.stored_profile_id ? (
              <p className="mt-1 font-mono text-xs text-white/40">profile_id: {record.stored_profile_id}</p>
            ) : null}
          </>
        ) : (
          <h1 className="mt-2 text-xl font-semibold">分析详情</h1>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {loading ? <p className="text-white/50">加载中…</p> : null}
        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
        ) : null}

        {record ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {tabs
                .filter((t) => t.show)
                .map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      tab === t.key ? "bg-amber-500/25 text-amber-100" : "bg-white/8 text-white/60 hover:bg-white/12"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
            </div>

            {tab === "analysis" ? <JsonBlock value={record.analysis} /> : null}
            {tab === "profile" ? <JsonBlock value={record.user_profile} /> : null}
            {tab === "prompts" ? (
              <div className="space-y-4">
                <div>
                  <h2 className="mb-2 text-sm font-medium text-white/70">System</h2>
                  <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs whitespace-pre-wrap text-white/80">
                    {record.prompts.system}
                  </pre>
                </div>
                <div>
                  <h2 className="mb-2 text-sm font-medium text-white/70">User</h2>
                  <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs whitespace-pre-wrap text-white/80">
                    {record.prompts.user}
                  </pre>
                </div>
              </div>
            ) : null}
            {tab === "reasoning" ? (
              <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs whitespace-pre-wrap text-violet-200/90">
                {record.reasoning}
              </pre>
            ) : null}
            {tab === "raw" ? (
              <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs whitespace-pre-wrap text-white/75">
                {record.raw_model_text}
              </pre>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
