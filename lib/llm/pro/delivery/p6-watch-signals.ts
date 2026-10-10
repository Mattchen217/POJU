/**
 * P6 · 本周对照信号（正向自检）——现成 self_check 正向桶装配/盖回。
 * 无新真算；不挂 chart_anchors；不与 P5 切辅叙事重复。
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import { splitSelfCheckSignals } from "@/lib/llm/pro/delivery/page-plan/self-check-split";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";

function clipSignal(s: string, max = 160): string {
  const t = s.trim();
  if (!t) return "";
  return t.length <= max ? t : t.slice(0, max);
}

function normKey(s: string): string {
  return s.replace(/\s+/g, "").slice(0, 28);
}

/** 从 breakthrough_core 抽出正向自检（P6 对照信号种子）。 */
export function positiveSelfCheckSeed(
  core: BreakthroughCore | null | undefined,
): string[] {
  const { positive } = splitSelfCheckSignals(core?.self_check_signals ?? []);
  return positive.map((s) => clipSignal(s)).filter(Boolean).slice(0, 5);
}

export function normalizeWatchSignalsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const t = clipSignal(String(item ?? ""));
    if (!t) continue;
    const k = normKey(t);
    if (out.some((x) => normKey(x) === k)) continue;
    out.push(t);
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * 正文/润色后盖回：模型已写满 ≥3 则只截断到 5；不足则用正向自检种子补齐。
 */
export function stampP6WatchSignals(
  page: DeliveryPageData,
  seed: readonly string[],
): DeliveryPageData {
  if (page.page !== "signals_close") return page;
  const existing = normalizeWatchSignalsList(
    (page as { watch_signals?: unknown }).watch_signals,
  );
  if (existing.length >= 3) {
    return {
      ...page,
      watch_signals: existing.slice(0, 5),
    } as DeliveryPageData;
  }
  const merged = [...existing];
  for (const s of seed) {
    const t = clipSignal(s);
    if (!t || merged.length >= 5) continue;
    const k = normKey(t);
    if (merged.some((x) => normKey(x) === k)) continue;
    merged.push(t);
  }
  return {
    ...page,
    watch_signals: merged.slice(0, 5),
  } as DeliveryPageData;
}
