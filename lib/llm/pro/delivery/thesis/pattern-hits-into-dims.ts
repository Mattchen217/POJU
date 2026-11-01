/**
 * Absorb on-topic ZFP patternHits into ThesisCalcFeed dimensions (deterministic, no LLM).
 *
 * When ZFP is available and selectOnTopicPatternHits returns ≥1 hit, six-dim
 * classical_basis / conclusion_zh must cite hit name or id (gate: thesis:pattern_hits_uncited).
 * Off-topic / caution_break hits are omitted — never blind-cite the whole pack.
 */

import type { QuestionCategory } from "@/lib/poju/agent-state";
import type {
  ChartThesis,
  ChecklistItemStatus,
  ThesisCalcFeed,
  ThesisDimensionId,
} from "@/lib/llm/pro/delivery/thesis/types";
import { ziweiPatternHitId } from "@/lib/ziwei/soft-zfp-labels";
import type { ZiweiPatternHit } from "@/lib/ziwei/fact-pack";

/** Stable prefix for checklist keys — excluded from assign-menu primaries. */
export const ZFP_PATTERN_HIT_KEY_PREFIX = "zfp_pattern_hit:";

/** Hint prefix on usable_claims_hint / feed.hints. */
export const ZFP_HIT_HINT_PREFIX = "zfp_hit:";

export type PatternHitClass =
  | "ming_geju"
  | "career_guan"
  | "wealth_cai"
  | "interpersonal"
  | "expression"
  | "caution_break";

const CLASS_TO_DIM: Record<Exclude<PatternHitClass, "caution_break">, ThesisDimensionId> = {
  ming_geju: "day_master_strength",
  career_guan: "interpersonal_pattern",
  wealth_cai: "resource_pattern",
  interpersonal: "interpersonal_pattern",
  expression: "expression_creativity",
};

/** Category → allowed hit classes (起步). Unlisted / null → ming_geju only. */
const CATEGORY_ALLOWED: Readonly<Record<string, readonly PatternHitClass[]>> = {
  career: ["ming_geju", "career_guan"],
  wealth: ["ming_geju", "wealth_cai"],
  relationship: ["ming_geju", "interpersonal"],
  interpersonal: ["ming_geju", "interpersonal"],
  family: ["ming_geju", "interpersonal"],
  decision: ["ming_geju", "career_guan"],
  health: ["ming_geju"],
  other: ["ming_geju"],
};

const CAUTION_NAME_RE =
  /忌|羊陀|火铃夹|空劫|廉杀羊|巨火羊|铃昌陀武|马头带箭|化忌/;

const WEALTH_NAME_RE = /化禄入财|禄存|双禄|入财|财帛/;
const CAREER_NAME_RE = /化权入官|入官|官禄|武曲七杀|杀破狼|化权/;
const EXPRESSION_NAME_RE = /化科|昌曲|阳梁昌禄|科权|文昌|文曲/;
const INTERPERSONAL_NAME_RE = /辅弼|魁钺|桃花|红鸾|天喜|夫妻/;
/** Natal structure / classic geju — primary day_master_strength. */
const MING_GEJU_NAME_RE =
  /紫微入命|府相朝垣|日月同宫|紫府同宫|君臣庆会|日月夹命|巨日同宫|明珠出海|石中隐玉|机月同梁|廉贞天相|天同天梁|火贪|铃贪|武贪|三奇加会|天马入命|天马在迁|禄存守命|禄存守身|昌曲坐命|昌曲同会|辅弼同会|魁钺同会|科权双会|辅弼夹命|昌曲夹命|魁钺夹命/;

export function classifyPatternHit(
  hit: Pick<ZiweiPatternHit, "name" | "level">,
): PatternHitClass {
  const name = (hit.name ?? "").trim();
  if (!name) return "caution_break";
  if (hit.level === "caution" || CAUTION_NAME_RE.test(name)) return "caution_break";
  if (WEALTH_NAME_RE.test(name)) return "wealth_cai";
  if (CAREER_NAME_RE.test(name)) return "career_guan";
  if (EXPRESSION_NAME_RE.test(name)) return "expression";
  if (INTERPERSONAL_NAME_RE.test(name)) return "interpersonal";
  if (MING_GEJU_NAME_RE.test(name)) return "ming_geju";
  // Unknown non-caution: treat as natal structure (ming_geju) so excellent/good
  // closed-set hits still surface; gate still requires citation of these when selected.
  if (hit.level === "excellent" || hit.level === "good" || hit.level === "neutral") {
    return "ming_geju";
  }
  return "caution_break";
}

export function patternHitTargetDimension(
  hitClass: PatternHitClass,
): ThesisDimensionId | null {
  if (hitClass === "caution_break") return null;
  return CLASS_TO_DIM[hitClass];
}

export function allowedPatternHitClassesForCategory(
  question_category: QuestionCategory | string | null | undefined,
): readonly PatternHitClass[] {
  const cat = (question_category ?? "").trim() || "other";
  return CATEGORY_ALLOWED[cat] ?? ["ming_geju"];
}

export type ClassifiedPatternHit = ZiweiPatternHit & {
  hit_class: PatternHitClass;
  hit_id: string;
  target_dimension: ThesisDimensionId | null;
};

export function selectOnTopicPatternHits(
  hits: readonly ZiweiPatternHit[] | null | undefined,
  question_category: QuestionCategory | string | null | undefined,
): ClassifiedPatternHit[] {
  if (!hits?.length) return [];
  const allowed = new Set(allowedPatternHitClassesForCategory(question_category));
  const out: ClassifiedPatternHit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const name = (h.name ?? "").trim();
    if (!name) continue;
    const hit_class = classifyPatternHit(h);
    if (hit_class === "caution_break") continue;
    if (!allowed.has(hit_class)) continue;
    const hit_id = ziweiPatternHitId(name);
    if (seen.has(hit_id)) continue;
    seen.add(hit_id);
    out.push({
      ...h,
      name,
      hit_class,
      hit_id,
      target_dimension: patternHitTargetDimension(hit_class),
    });
  }
  return out;
}

function checklistItemForHit(hit: ClassifiedPatternHit): ChecklistItemStatus {
  return {
    key: `${ZFP_PATTERN_HIT_KEY_PREFIX}${hit.hit_id}`,
    present: true,
    summary_zh: `紫微格局命中：${hit.name}（hit:${hit.hit_id}·${hit.level}）`,
  };
}

/**
 * Append on-topic ZFP hits into feed dimension items + hints.
 * Does not rewrite existing bazi checklist items. Call before applyAgendaDepth
 * (via buildChartThesisFromStructured after buildThesisCalcFeed).
 */
export function absorbPatternHitsIntoFeed(
  feed: ThesisCalcFeed,
  hits: readonly ZiweiPatternHit[] | null | undefined,
  question_category: QuestionCategory | string | null | undefined,
): ThesisCalcFeed {
  const onTopic = selectOnTopicPatternHits(hits, question_category);
  if (!onTopic.length) return feed;

  const dimensions = { ...feed.dimensions };
  for (const hit of onTopic) {
    const dimId = hit.target_dimension;
    if (!dimId) continue;
    const prev = dimensions[dimId];
    const key = `${ZFP_PATTERN_HIT_KEY_PREFIX}${hit.hit_id}`;
    if (prev.items.some((it) => it.key === key)) continue;
    const item = checklistItemForHit(hit);
    const hint = `${ZFP_HIT_HINT_PREFIX}${hit.hit_id}`;
    const hints = prev.hints.includes(hint) ? prev.hints : [...prev.hints, hint];
    dimensions[dimId] = {
      ...prev,
      empty: false,
      items: [...prev.items, item],
      hints,
    };
  }
  return { ...feed, dimensions };
}

/** True when thesis classical_basis or conclusion_zh cites hit name or id. */
export function thesisCitesPatternHit(
  thesis: ChartThesis,
  hit: Pick<ZiweiPatternHit, "name"> & { hit_id?: string },
): boolean {
  const name = (hit.name ?? "").trim();
  const id = (hit.hit_id ?? (name ? ziweiPatternHitId(name) : "")).trim();
  if (!name && !id) return false;
  for (const dim of thesis.dimensions ?? []) {
    const conclusion = dim.conclusion_zh ?? "";
    if (name && conclusion.includes(name)) return true;
    if (id && conclusion.includes(id)) return true;
    const basis = dim.classical_basis;
    if (Array.isArray(basis)) {
      for (const it of basis) {
        const summary = it?.summary_zh ?? "";
        const key = it?.key ?? "";
        if (name && (summary.includes(name) || key.includes(name))) return true;
        if (id && (summary.includes(id) || key.includes(id))) return true;
      }
    }
    for (const h of dim.usable_claims_hint ?? []) {
      if (id && h.includes(id)) return true;
      if (name && h.includes(name)) return true;
    }
  }
  return false;
}

/**
 * Gate helper: when on-topic hits ≥1, every absorbed hit must be cited
 * (name or id) in classical_basis / conclusion_zh. No hard-coded case names.
 */
export function evaluateThesisPatternHitsCitationGate(
  thesis: ChartThesis,
  hits: readonly ZiweiPatternHit[] | null | undefined,
  question_category: QuestionCategory | string | null | undefined,
): { passed: boolean; failed_rule?: string; on_topic_n: number; uncited: string[] } {
  const onTopic = selectOnTopicPatternHits(hits, question_category);
  if (onTopic.length === 0) {
    return { passed: true, on_topic_n: 0, uncited: [] };
  }
  const uncited = onTopic
    .filter((h) => !thesisCitesPatternHit(thesis, h))
    .map((h) => h.name);
  if (uncited.length > 0) {
    return {
      passed: false,
      failed_rule: "thesis:pattern_hits_uncited",
      on_topic_n: onTopic.length,
      uncited,
    };
  }
  return { passed: true, on_topic_n: onTopic.length, uncited: [] };
}

export function isZfpPatternHitChecklistKey(key: string | null | undefined): boolean {
  return Boolean(key && key.startsWith(ZFP_PATTERN_HIT_KEY_PREFIX));
}
