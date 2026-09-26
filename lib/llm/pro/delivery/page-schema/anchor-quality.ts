/**
 * P0-4 · 单元 chart_anchors 质量闸（Fill sanitize 侧）
 *
 * - 内容单元非空：P2–P5 内容单元缺锚 → note；若该页全部单元皆空 → structural fail
 * - 跨页复读：单元级 echo 只记 note；硬闸与 write 同尺
 *   {@link assessCrossPagePrimaryAnchorReuse}（Jaccard≥0.72 且无新类目）
 * - inventory 交集：可选 inventoryTokens；无交集只 note，不硬闸（宽入）
 *
 * Fact-pack write leaves plan.unit.chart_anchors empty by design. That must NOT
 * disable the body-anchor gate on P3+ — only P2 (foundation) may allow empty.
 */

import { CLOSED_TEN_GODS } from "@/lib/glossary/term-closed-set";
import { WUXING_ELEMENTS } from "@/lib/glossary/wuxing-semantic-ssot";
import {
  PLAIN_FALLBACK_BODY_SINGLES,
  PLAIN_FALLBACK_COMPOUNDS,
  SOFT_GLOSS_TO_VERNACULAR,
} from "@/lib/base-analysis-v2/compute/plain-fallback-map";
import { assessCrossPagePrimaryAnchorReuse } from "./cross-page-primary-reuse";
import type { CategoryTokenSets } from "./anchor-category-tally";
import type { DeepEvidencePlan, DeepEvidenceUnit } from "./deep-evidence-prompt";
import {
  anchorsIncludeQimenStructure,
  extractQimenStructureAnchorsFromProse,
} from "./qimen-structure-anchors";

export type AnchorUnitSample = {
  path: string;
  anchors: readonly string[];
};

export type AnchorQualityResult = {
  notes: string[];
  /** true → sanitize 应 structural fail */
  structuralFail: boolean;
  reason?: string;
};

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

const GANZHI_PILLAR_GLOBAL =
  /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;

/** Closed phase / strength labels (same family as fact-pack structure claims). */
const CHART_PHASE_LABELS = [
  "用神",
  "喜神",
  "忌神",
  "身强",
  "身弱",
  "大运",
  "流年",
  "流月",
  "印星",
  "食伤",
  "官杀",
  "财星",
] as const;

/**
 * SSOT: empty body chart_anchors are allowed only on P2 translate fill.
 * Write-plan empty anchors are expected for all pages — do not use that alone.
 */
export function allowEmptyChartAnchorsOnFill(
  pageKey: string,
  plan:
    | { units: readonly { chart_anchors?: readonly string[] | null }[] }
    | null
    | undefined,
): boolean {
  if (pageKey !== "foundation") return false;
  if (!plan?.units?.length) return false;
  return plan.units.every((u) => (u.chart_anchors?.length ?? 0) === 0);
}

/**
 * Pull closed-set structure tokens from judgment prose for body chart_anchors.
 * Qimen terms first (P4 局势), then ten gods / wuxing / phase — no parallel soft-translate vocab.
 */
export function extractChartStructureAnchorsFromProse(
  text: string,
  max = 3,
): string[] {
  const t = text.trim();
  if (!t || max < 1) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const s = raw.trim();
    if (!s || seen.has(s) || out.length >= max) return;
    seen.add(s);
    out.push(s);
  };
  // Prefer 奇门局势 tokens so stamp does not fill 3 slots with 壬寅/丙午/火 only.
  for (const q of extractQimenStructureAnchorsFromProse(t, max)) push(q);
  for (const g of t.match(GANZHI_PILLAR_GLOBAL) ?? []) push(g);
  for (const tg of CLOSED_TEN_GODS) {
    if (t.includes(tg)) push(tg);
  }
  for (const el of WUXING_ELEMENTS) {
    if (
      t.includes(`用神${el}`) ||
      t.includes(`忌神${el}`) ||
      t.includes(`喜神${el}`) ||
      t.includes(`${el}旺`) ||
      t.includes(`${el}弱`)
    ) {
      push(el);
    }
  }
  for (const lab of CHART_PHASE_LABELS) {
    if (t.includes(lab)) push(lab);
  }
  return out;
}

/** Vernacular (plain-fallback value) → preferred raw term (audit layer). */
const VERNACULAR_TO_RAW: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [raw, vern] of Object.entries(PLAIN_FALLBACK_BODY_SINGLES)) {
    if (vern && !m.has(vern)) m.set(vern, raw);
  }
  for (const [raw, vern] of Object.entries(PLAIN_FALLBACK_COMPOUNDS)) {
    if (vern && !m.has(vern)) m.set(vern, raw);
  }
  for (const [brand, vern] of Object.entries(SOFT_GLOSS_TO_VERNACULAR)) {
    if (vern && !m.has(vern)) m.set(vern, brand);
  }
  return m;
})();

/**
 * chart_anchors = internal audit raw layer. Drop plain-fallback / soft-gloss
 * vernacular duplicates; reverse-map lone vernacular to raw when possible.
 */
export function hygienizeChartAnchorsRawLayer(
  anchors: readonly string[],
): { anchors: string[]; notes: string[]; stripped: number } {
  const notes: string[] = [];
  let stripped = 0;
  const rawSet = new Set<string>();
  const pendingVern: string[] = [];

  for (const a of anchors) {
    const s = String(a ?? "").trim();
    if (!s) continue;
    const asRaw = VERNACULAR_TO_RAW.get(s);
    if (asRaw) {
      pendingVern.push(s);
      continue;
    }
    // Soft brand as anchor → drop (not structure audit token)
    if (SOFT_GLOSS_TO_VERNACULAR[s]) {
      notes.push(`p4_anchor_vernacular_stripped:${s.slice(0, 24)}`);
      stripped += 1;
      continue;
    }
    rawSet.add(s);
  }

  for (const vern of pendingVern) {
    const raw = VERNACULAR_TO_RAW.get(vern)!;
    const already =
      [...rawSet].some((r) => r.includes(raw) || raw.includes(r)) ||
      rawSet.has(raw);
    if (already) {
      notes.push(`p4_anchor_vernacular_stripped:${vern.slice(0, 24)}`);
      stripped += 1;
      continue;
    }
    // Lone vernacular → promote to raw so dim keeps an anchor
    rawSet.add(raw);
    notes.push(`p4_anchor_vernacular_to_raw:${vern.slice(0, 16)}->${raw}`);
    stripped += 1;
  }

  return { anchors: [...rawSet], notes, stripped };
}

function judgmentBlobForStamp(u: DeepEvidenceUnit): string {
  return [u.unit_claim, u.calc_cite, u.evidence].filter(Boolean).join(" ");
}

function ensureAnchorsOnObject(
  o: Record<string, unknown>,
  path: string,
  unit: DeepEvidenceUnit | undefined,
  notes: string[],
): void {
  const raw = o.chart_anchors ?? o.anchors;
  const existing = Array.isArray(raw)
    ? raw.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (!unit) return;
  const judgment = judgmentBlobForStamp(unit);
  const qimenFromJudgment = extractQimenStructureAnchorsFromProse(judgment, 3);
  // Fill often invents bazi-only anchors while judgment has 值使/客克主 —
  // enrich so 局势维 retains 奇门承重 (spec: 删奇门锚须垮).
  if (existing.length > 0) {
    if (
      qimenFromJudgment.length > 0 &&
      !anchorsIncludeQimenStructure(existing)
    ) {
      const merged = [...qimenFromJudgment, ...existing].filter(
        (a, i, arr) => arr.indexOf(a) === i,
      );
      o.chart_anchors = merged.slice(0, 3);
      notes.push(`enriched_chart_anchors_with_qimen:${path}`);
    }
    return;
  }
  const stamped = extractChartStructureAnchorsFromProse(judgment, 3);
  if (stamped.length === 0) return;
  o.chart_anchors = stamped;
  notes.push(`stamped_chart_anchors_from_judgment:${path}`);
}

/**
 * Deterministic fill: copy structure tokens from deep-plan judgment into empty
 * body chart_anchors (P3+). Foundation keeps empty (plain translate).
 */
export function stampPageChartAnchorsFromDeepPlan(
  pageKey: string,
  page: Record<string, unknown>,
  plan: DeepEvidencePlan | null | undefined,
): string[] {
  const notes: string[] = [];
  if (!plan?.units?.length) return notes;
  if (pageKey === "foundation" || pageKey === "direct_answer") return notes;

  const byPath = new Map(plan.units.map((u) => [u.path, u]));
  const unitAt = (path: string, fallbackIdx: number): DeepEvidenceUnit | undefined =>
    byPath.get(path) ?? plan.units[fallbackIdx];

  switch (pageKey) {
    case "science_action": {
      for (const role of ["primary_toolkit", "backup_toolkit"] as const) {
        const tk = page[role];
        if (!tk || typeof tk !== "object") continue;
        const angles = Array.isArray((tk as Record<string, unknown>).angles)
          ? ((tk as Record<string, unknown>).angles as unknown[])
          : [];
        angles.forEach((a, i) => {
          if (!a || typeof a !== "object") return;
          const path = `${role}.angles[${i}]`;
          ensureAnchorsOnObject(
            a as Record<string, unknown>,
            path,
            unitAt(path, role === "primary_toolkit" ? i : i + 3),
            notes,
          );
        });
      }
      break;
    }
    case "metaphysics_action": {
      const dims = Array.isArray(page.dimensions) ? page.dimensions : [];
      dims.forEach((d, i) => {
        if (!d || typeof d !== "object") return;
        const path = `dimensions[${i}]`;
        ensureAnchorsOnObject(
          d as Record<string, unknown>,
          path,
          unitAt(path, i),
          notes,
        );
      });
      break;
    }
    case "risk_guard": {
      const bags: Array<[string, unknown]> = [
        ["red_lights", page.red_lights],
        ["traps", page.traps],
        ["protection_rules", page.protection_rules],
      ];
      let idx = 0;
      for (const [name, list] of bags) {
        if (!Array.isArray(list)) continue;
        list.forEach((item, i) => {
          if (!item || typeof item !== "object") return;
          const path = `${name}[${i}]`;
          ensureAnchorsOnObject(
            item as Record<string, unknown>,
            path,
            unitAt(path, idx),
            notes,
          );
          idx += 1;
        });
      }
      if (page.switch_to_backup && typeof page.switch_to_backup === "object") {
        ensureAnchorsOnObject(
          page.switch_to_backup as Record<string, unknown>,
          "switch_to_backup",
          unitAt("switch_to_backup", idx),
          notes,
        );
      }
      break;
    }
    case "signals_close": {
      const idAnch = page.identity_shift_anchors;
      if (Array.isArray(idAnch) && idAnch.length === 0) {
        const u = unitAt("identity_shift", 0);
        const stamped = u
          ? extractChartStructureAnchorsFromProse(judgmentBlobForStamp(u), 3)
          : [];
        if (stamped.length) {
          page.identity_shift_anchors = stamped;
          notes.push("stamped_chart_anchors_from_judgment:identity_shift");
        }
      }
      const tonAnch = page.tonight_anchors;
      if (Array.isArray(tonAnch) && tonAnch.length === 0) {
        const u = unitAt("tonight", 1) ?? plan.units[1];
        const stamped = u
          ? extractChartStructureAnchorsFromProse(judgmentBlobForStamp(u), 3)
          : [];
        if (stamped.length) {
          page.tonight_anchors = stamped;
          notes.push("stamped_chart_anchors_from_judgment:tonight");
        }
      }
      const day7 = Array.isArray(page.day7_micro_actions)
        ? page.day7_micro_actions
        : [];
      day7.forEach((item, i) => {
        if (!item || typeof item !== "object") return;
        const path = `day7_micro_actions[${i}]`;
        ensureAnchorsOnObject(
          item as Record<string, unknown>,
          path,
          unitAt(path, i + 2),
          notes,
        );
      });
      break;
    }
    default:
      break;
  }
  return notes;
}

/** 从已 sanitize 的 page 对象抽取内容单元锚。 */
export function collectPageAnchorUnits(
  pageKey: string,
  page: Record<string, unknown>,
): AnchorUnitSample[] {
  const out: AnchorUnitSample[] = [];
  const push = (path: string, raw: unknown) => {
    const anchors = Array.isArray(raw)
      ? raw.map((x) => String(x).trim()).filter(Boolean)
      : [];
    out.push({ path, anchors });
  };

  switch (pageKey) {
    case "direct_answer": {
      for (const role of ["primary", "backup"] as const) {
        const t = page[role];
        const o = t && typeof t === "object" ? (t as Record<string, unknown>) : {};
        push(role, o.chart_anchors);
      }
      break;
    }
    case "foundation": {
      const cards = Array.isArray(page.why_cards) ? page.why_cards : [];
      cards.forEach((c, i) => {
        const o = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
        push(`why_cards[${i}]`, o.chart_anchors);
      });
      break;
    }
    case "science_action": {
      for (const role of ["primary_toolkit", "backup_toolkit"] as const) {
        const tk = page[role];
        const o = tk && typeof tk === "object" ? (tk as Record<string, unknown>) : {};
        const angles = Array.isArray(o.angles) ? o.angles : [];
        angles.forEach((a, i) => {
          const ao = a && typeof a === "object" ? (a as Record<string, unknown>) : {};
          push(`${role}.angles[${i}]`, ao.chart_anchors);
        });
      }
      break;
    }
    case "metaphysics_action": {
      const dims = Array.isArray(page.dimensions) ? page.dimensions : [];
      dims.forEach((d, i) => {
        const o = d && typeof d === "object" ? (d as Record<string, unknown>) : {};
        push(`dimensions[${i}]`, o.chart_anchors);
      });
      break;
    }
    case "risk_guard": {
      const bags: Array<[string, unknown]> = [
        ["red_lights", page.red_lights],
        ["traps", page.traps],
        ["protection_rules", page.protection_rules],
      ];
      for (const [name, list] of bags) {
        if (!Array.isArray(list)) continue;
        list.forEach((item, i) => {
          const o =
            item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          push(`${name}[${i}]`, o.chart_anchors);
        });
      }
      if (page.switch_to_backup && typeof page.switch_to_backup === "object") {
        push(
          "switch_to_backup",
          (page.switch_to_backup as Record<string, unknown>).chart_anchors,
        );
      }
      break;
    }
    case "signals_close": {
      push("identity_shift", page.identity_shift_anchors);
      push("tonight", page.tonight_anchors);
      const day7 = Array.isArray(page.day7_micro_actions) ? page.day7_micro_actions : [];
      day7.forEach((item, i) => {
        const o =
          item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        push(`day7_micro_actions[${i}]`, o.chart_anchors);
      });
      break;
    }
    default:
      break;
  }
  return out;
}

export function assessUnitAnchorQuality(input: {
  pageKey: string;
  units: readonly AnchorUnitSample[];
  /** 可选：inventory / 题型锚 token 池 */
  inventoryTokens?: readonly string[];
  /** 可选：本报告已出现过的锚（跨页复读检测） */
  priorAnchors?: readonly string[];
  /** Optional: same category sets as write/assign cross-page SSOT */
  categoryTokenSets?: CategoryTokenSets | null;
  /**
   * P2 only: body may keep empty chart_anchors while translating unmarked 批断.
   * Use {@link allowEmptyChartAnchorsOnFill} — never “plan empty ⇒ allow”.
   */
  allowEmptyAnchors?: boolean;
}): AnchorQualityResult {
  const notes: string[] = [];
  const { pageKey, units } = input;

  if (
    pageKey !== "direct_answer" &&
    pageKey !== "foundation" &&
    pageKey !== "science_action" &&
    pageKey !== "metaphysics_action" &&
    pageKey !== "risk_guard" &&
    pageKey !== "signals_close"
  ) {
    return { notes, structuralFail: false };
  }

  if (units.length === 0) {
    return { notes, structuralFail: false };
  }

  const empty = units.filter((u) => u.anchors.length < 1);
  for (const u of empty) {
    notes.push(`unit_missing_chart_anchors:${u.path}`);
  }

  if (empty.length === units.length) {
    if (input.allowEmptyAnchors) {
      notes.push("plain_judgment_empty_chart_anchors");
      return { notes, structuralFail: false };
    }
    return {
      notes,
      structuralFail: true,
      reason: "all_content_units_missing_chart_anchors",
    };
  }

  const inv = (input.inventoryTokens ?? [])
    .map(normalizeToken)
    .filter(Boolean);
  if (inv.length > 0) {
    for (const u of units) {
      if (u.anchors.length < 1) continue;
      const hit = u.anchors.some((a) => {
        const n = normalizeToken(a);
        return inv.some((t) => n.includes(t) || t.includes(n));
      });
      if (!hit) {
        notes.push(`unit_anchors_outside_inventory:${u.path}`);
      }
    }
  }

  const priorList = (input.priorAnchors ?? []).map((x) => x.trim()).filter(Boolean);
  const priorNorm = new Set(priorList.map(normalizeToken).filter(Boolean));
  if (priorNorm.size > 0) {
    for (const u of units) {
      if (u.anchors.length < 1) continue;
      const allPrior = u.anchors.every((a) => priorNorm.has(normalizeToken(a)));
      if (allPrior) {
        notes.push(`unit_anchors_cross_page_echo:${u.path}`);
        console.info(
          `[anchor-quality] cross-page echo on ${pageKey}/${u.path}: ${u.anchors.join("、")}`,
        );
      }
    }
    const pagePrimaries = units
      .map((u) => u.anchors[0]?.trim() ?? "")
      .filter(Boolean);
    const cross = assessCrossPagePrimaryAnchorReuse({
      page_primaries: pagePrimaries,
      prior_chart_anchors: priorList,
      category_token_sets: input.categoryTokenSets,
    });
    notes.push(...cross.notes);
    if (!cross.ok) {
      return {
        notes,
        structuralFail: true,
        reason: "cross_page_primary_anchor_reuse",
      };
    }
  }

  return { notes, structuralFail: false };
}
