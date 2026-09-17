/**
 * D1 closed-menu SSOT: thesis present facts → assign-eligible (dim, slug, hint).
 * Shadow 神煞/长生/hollow/bare stem-branch never enter the menu.
 */

import { CLOSED_LIFE_STAGES } from "@/lib/glossary/term-closed-set";
import type {
  ChartThesis,
  ChecklistItemStatus,
  ThesisDimension,
  ThesisDimensionId,
} from "@/lib/llm/pro/delivery/thesis/types";
import { THESIS_DIMENSION_IDS } from "@/lib/llm/pro/delivery/thesis/types";
import {
  extractThesisFactTokens,
  HOLLOW_STRUCTURAL_SLUGS,
  buildThesisDimensionCorpora,
} from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";

export type ThesisAssignMenuItem = {
  dimension_id: ThesisDimensionId;
  slug: string;
  fact_hint: string;
};

const CHANGSHENG = new Set<string>(CLOSED_LIFE_STAGES);
const STEM_ONE_RE = /^[甲乙丙丁戊己庚辛壬癸]$/;
const BRANCH_ONE_RE = /^[子丑寅卯辰巳午未申酉戌亥]$/;
/** Sixty-jiazi pillar — natal labels must not crowd closed-menu primaries. */
const GANZHI_PILLAR_RE =
  /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;

/** 日柱十神槽占位（「日柱元男」）— 字段标签，不是可承重命理信号。 */
const STRUCTURAL_PLACEHOLDER_SLUGS: ReadonlySet<string> = new Set([
  "元男",
  "元女",
  "日元",
]);

/** 方案 A #7：裸关系类名不可单独承重（须 辰酉六合 / 巳寅相刑 等完整句） */
const BARE_MATCH_SHELL_SLUGS: ReadonlySet<string> = new Set([
  "六合",
  "六冲",
  "三刑",
  "六害",
  "三合",
  "半合",
]);

/** Menu-eligible concrete token (same bans as assign hard gates). */
export function isAssignMenuEligibleSlug(slug: string): boolean {
  const s = slug.trim();
  if (!s) return false;
  if (HOLLOW_STRUCTURAL_SLUGS.has(s)) return false;
  if (CHANGSHENG.has(s)) return false;
  if (STRUCTURAL_PLACEHOLDER_SLUGS.has(s)) return false;
  if (BARE_MATCH_SHELL_SLUGS.has(s)) return false;
  if (STEM_ONE_RE.test(s) || BRANCH_ONE_RE.test(s)) return false;
  // Bare pillars: only cycle_rhythm may keep them (see buildThesisAssignMenu).
  // Shape-ok here; dim filter applied at menu build.
  return true;
}

/** True when slug is a bare sixty-jiazi pillar (乙巳 / 丁酉…). */
export function isBareGanzhiPillarSlug(slug: string): boolean {
  return GANZHI_PILLAR_RE.test(slug.trim());
}

function clipHint(s: string, max = 80): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function factHintForSlug(dim: ThesisDimension, slug: string): string {
  if (Array.isArray(dim.classical_basis)) {
    for (const it of dim.classical_basis as ChecklistItemStatus[]) {
      if (!it.present || !it.summary_zh?.trim()) continue;
      if (it.summary_zh.includes(slug)) return clipHint(it.summary_zh);
    }
  }
  for (const h of dim.usable_claims_hint ?? []) {
    if (h.trim() && h.includes(slug)) return clipHint(h);
  }
  if (dim.strength_verdict?.trim() && dim.strength_verdict.includes(slug)) {
    return clipHint(dim.strength_verdict);
  }
  for (const it of Array.isArray(dim.classical_basis) ? dim.classical_basis : []) {
    if ((it as ChecklistItemStatus).present && (it as ChecklistItemStatus).summary_zh) {
      return clipHint((it as ChecklistItemStatus).summary_zh);
    }
  }
  return clipHint(dim.usable_claims_hint?.[0] ?? dim.strength_verdict ?? dim.conclusion_zh ?? slug);
}

/**
 * Build closed assign menu from thesis present corpora.
 * One row per (dimension_id, slug); empty dims omitted.
 */
export function buildThesisAssignMenu(
  thesis: ChartThesis | null | undefined,
): ThesisAssignMenuItem[] {
  if (!thesis?.dimensions?.length) return [];
  const corpora = buildThesisDimensionCorpora(thesis);
  const out: ThesisAssignMenuItem[] = [];
  const seen = new Set<string>();

  for (const dimId of THESIS_DIMENSION_IDS) {
    const dim = thesis.dimensions.find((d) => d.dimension_id === dimId);
    if (!dim || dim.depth === "skip") continue;
    const corpus = corpora.get(dimId) ?? "";
    if (!corpus.trim()) continue;
    const tokens = extractThesisFactTokens(corpus);
    for (const raw of tokens) {
      if (!isAssignMenuEligibleSlug(raw)) continue;
      // 方案 A #7：裸柱只许进 cycle_rhythm（大运/流年 present）；禁纳音柱占科学/结构槽
      if (isBareGanzhiPillarSlug(raw) && dimId !== "cycle_rhythm") {
        continue;
      }
      const key = `${dimId}::${raw}`;
      if (seen.has(key)) continue;
      // Prefer first dim that owns the token (THESIS_DIMENSION_IDS order).
      const alreadyOtherDim = [...seen].some((k) => k.endsWith(`::${raw}`));
      if (alreadyOtherDim) continue;
      seen.add(key);
      out.push({
        dimension_id: dimId,
        slug: raw,
        fact_hint: factHintForSlug(dim, raw),
      });
    }
  }
  return out;
}

/** Group menu by dimension for alloc round-robin. */
export function groupAssignMenuByDimension(
  menu: readonly ThesisAssignMenuItem[],
): Map<ThesisDimensionId, ThesisAssignMenuItem[]> {
  const map = new Map<ThesisDimensionId, ThesisAssignMenuItem[]>();
  for (const id of THESIS_DIMENSION_IDS) map.set(id, []);
  for (const item of menu) {
    map.get(item.dimension_id)?.push(item);
  }
  return map;
}
