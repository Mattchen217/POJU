/**
 * Whole-window companion gate — cross-day diversity + completeness.
 * Categories only (no case-phrase patches). Lab + production share this ruler.
 */

import type { CompanionDayCards } from "./types";
import { COMPANION_WINDOW_DAYS } from "./types";

export type CompanionBatchDayInput = {
  day_index: number;
  cards: CompanionDayCards | null | undefined;
};

export type CompanionBatchGateResult = {
  passed: boolean;
  failed_rule?: string;
  detail?: string;
  checked_at: string;
  generated_count: number;
  near_dup_pairs?: Array<{ a: number; b: number; score: number }>;
};

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。,.!！?？：:；;""''「」『』、·…—\-]/g, "");
}

/** Character bigram Jaccard — catches near-clone today_is across adjacent days. */
export function companionTextSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na.length < 6 || nb.length < 6) return 0;
  if (na === nb) return 1;
  const setA = new Set<string>();
  const setB = new Set<string>();
  for (let i = 0; i < na.length - 1; i++) setA.add(na.slice(i, i + 2));
  for (let i = 0; i < nb.length - 1; i++) setB.add(nb.slice(i, i + 2));
  let inter = 0;
  for (const g of setA) if (setB.has(g)) inter += 1;
  const union = setA.size + setB.size - inter;
  return union <= 0 ? 0 : inter / union;
}

const ADJACENT_SIM_FAIL = 0.52;

function hasEngineeringWeights(evidence: string): boolean {
  return /绿\s*\d+|红\s*\d+|\bgreen\s*[:=]?\s*\d+|\bred\s*[:=]?\s*\d+/i.test(
    evidence,
  );
}

/**
 * Gate all 30 days. Incomplete window → fail.
 * Adjacent today_is near-dup → fail.
 */
export function gateCompanionBatch(
  days: CompanionBatchDayInput[],
  opts?: { require_full_window?: boolean },
): CompanionBatchGateResult {
  const checked_at = new Date().toISOString();
  const requireFull = opts?.require_full_window !== false;
  const byIndex = new Map<number, CompanionDayCards>();
  for (const d of days) {
    if (d.cards) byIndex.set(d.day_index, d.cards);
  }
  const generated_count = byIndex.size;

  if (requireFull && generated_count < COMPANION_WINDOW_DAYS) {
    return {
      passed: false,
      failed_rule: "companion_batch_incomplete",
      detail: `已生成 ${generated_count}/${COMPANION_WINDOW_DAYS} 日；须满窗再过整体闸`,
      checked_at,
      generated_count,
    };
  }

  if (generated_count < 2) {
    return {
      passed: false,
      failed_rule: "companion_batch_too_thin",
      detail: "至少 2 日有稿才能做跨日近似闸",
      checked_at,
      generated_count,
    };
  }

  const near_dup_pairs: Array<{ a: number; b: number; score: number }> = [];
  const indexes = [...byIndex.keys()].sort((a, b) => a - b);
  for (let i = 0; i < indexes.length - 1; i++) {
    const a = indexes[i]!;
    const b = indexes[i + 1]!;
    if (b !== a + 1) continue;
    const ca = byIndex.get(a)!;
    const cb = byIndex.get(b)!;
    const score = companionTextSimilarity(ca.today_is, cb.today_is);
    if (score >= ADJACENT_SIM_FAIL) {
      near_dup_pairs.push({ a, b, score: Math.round(score * 100) / 100 });
    }
  }
  if (near_dup_pairs.length > 0) {
    const sample = near_dup_pairs
      .slice(0, 3)
      .map((p) => `D${p.a + 1}≈D${p.b + 1}(${p.score})`)
      .join(" · ");
    return {
      passed: false,
      failed_rule: "companion_adjacent_today_is_near_dup",
      detail: `邻日 today_is 过像：${sample}`,
      checked_at,
      generated_count,
      near_dup_pairs,
    };
  }

  for (const idx of indexes) {
    const cards = byIndex.get(idx)!;
    if (hasEngineeringWeights(cards.evidence)) {
      return {
        passed: false,
        failed_rule: "companion_evidence_weight_dump",
        detail: `Day ${idx + 1} evidence 含绿/红数字或 green/red 工程量`,
        checked_at,
        generated_count,
      };
    }
    const face = [
      cards.today_is,
      cards.suitable,
      cards.unsuitable,
      cards.suggestion,
    ].join(" ");
    if (face.trim().length < 40) {
      return {
        passed: false,
        failed_rule: "companion_face_too_thin",
        detail: `Day ${idx + 1} 前四段过薄`,
        checked_at,
        generated_count,
      };
    }
  }

  return {
    passed: true,
    detail: `满窗 ${generated_count} 日 · 邻日 today_is 无近复 · evidence 无工程量`,
    checked_at,
    generated_count,
  };
}
