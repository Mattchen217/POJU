"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BaseAnalysisAuditListItem } from "@/lib/dev/base-analysis-audit-types";

export default function BaseAnalysisAuditListPage() {
  const [items, setItems] = useState<BaseAnalysisAuditListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/base-analysis-audit");
      const data = (await res.json()) as {
        ok?: boolean;
        items?: BaseAnalysisAuditListItem[];
        error?: string;
        hint?: string | null;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setHint(typeof data.hint === "string" ? data.hint : null);
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
      setHint(typeof data.hint === "string" ? data.hint : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0f0f12] text-[#e8e6e3]">
      <header className="border-b border-white/10 px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight">命主基础分析 · 审核台</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          每次调用 DeepSeek 生成基础分析时，服务端会尝试保存明文 JSON。本地 <code className="text-white/70">pnpm dev</code>{" "}
          默认可用；线上 pojulife.com 默认关闭或无法持久化，见下方说明。
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/15"
          >
            刷新列表
          </button>
          <span className="text-white/40">目录：pojulife/.data/base-analysis-audit/</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {loading ? <p className="text-white/50">加载中…</p> : null}
        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
        ) : null}
        {hint ? (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            {hint}
          </p>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <p className="text-white/50">
            暂无记录。若在本地开发：新建档案后走 POJU preparing / Glyph 抽牌前 / Profile 确认页「生成基础分析」会写入此目录。
            已有 <code className="text-white/60">has_base_analysis</code> 的档案不会再次调 API。线上分析结果在浏览器 IndexedDB，不会出现在此列表。
          </p>
        ) : null}

        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/base-analysis-audit/${item.id}`}
                className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-amber-500/40 hover:bg-white/[0.06]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-amber-200/90">{item.birth_summary}</span>
                  <time className="text-xs text-white/45">{new Date(item.created_at).toLocaleString()}</time>
                </div>
                <p className="mt-1 text-sm text-white/70">
                  {item.display_name ? `${item.display_name} · ` : ""}
                  四柱：{item.four_pillars} · 日主：{item.day_master}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  model: {item.model} · tokens: {item.tokens_used}
                  {item.stored_profile_id ? ` · profile: ${item.stored_profile_id.slice(0, 8)}…` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}