/**
 * Absorb on-topic ZFP patternHits into ThesisCalcFeed dimensions (deterministic, no LLM).
 *
 * When ZFP is available and selectOnTopicPatternHits returns >=1 hit, six-dim
 * classical_basis / conclusion_zh must cite hit name or id (gate: thesis:pattern_hits_uncited).
 * Off-topic / true caution_break hits are omitted with an auditable reason -- never blind-cite
 * the whole pack, and never silent-drop an on-topic natal/structure hit merely because its
 * detector level is "caution" (e.g. ming_geju-class with breaking modifiers).
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

/** Stable prefix for checklist keys -- excluded from assign-menu primaries. */
export const ZFP_PATTERN_HIT_KEY_PREFIX = "zfp_pattern_hit:";

/** Hint prefix on usable_claims_hint / feed.hints. */
export const ZFP_HIT_HINT_PREFIX = "zfp_hit:";

/** Auditable omit hint prefix (feed dim hints / gate detail). */
export const ZFP_HIT_OMIT_HINT_PREFIX = "zfp_omit:";

export type PatternHitClass =
  | "ming_geju"
  | "career_guan"
  | "wealth_cai"
  | "interpersonal"
  | "expression"
  | "caution_break";

export type PatternHitOmitReason =
  | "caution_break"
  | "off_topic_category"
  | "empty_name"
  | "duplicate_hit_id";

const CLASS_TO_DIM: Record<Exclude<PatternHitClass, "caution_break">, ThesisDimensionId> = {
  ming_geju: "day_master_strength",
  career_guan: "interpersonal_pattern",
  wealth_cai: "resource_pattern",
  interpersonal: "interpersonal_pattern",
  expression: "expression_creativity",
};

/** Category -> allowed hit classes. Unlisted / null -> ming_geju only. */
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

/** True break-pattern names -- not natal geju that merely carry level=caution. */
const CAUTION_NAME_RE =
  /羊陀|火铃夹|空劫夹|空劫|廉杀羊|巨火羊|铃昌陀武|马头带箭|化忌/;

const WEALTH_NAME_RE = /化禄入财|禄存|双禄|入财|财帛/;
const CAREER_NAME_RE = /化权入官|入官|官禄|武曲七杀|杀破狼|化权/;
const EXPRESSION_NAME_RE = /化科|昌曲|阳梁昌禄|科权|文昌|文曲/;
const INTERPERSONAL_NAME_RE = /辅弼|魁钺|桃花|红鸾|天喜|夫妻/;
/**
 * Natal structure / classic geju -> primary day_master_strength.
 * Name-class wins over detector level=caution (breaking modifiers must still enter judgment).
 */
const MING_GEJU_NAME_RE =
  /紫微入命|府相朝垣|日月同宫|紫府同宫|君臣庆会|日月夹命|巨日同宫|明珠出海|石中隐玉|机月同梁|廉贞天相|天同天梁|火贪|铃贪|武贪|三奇加会|天马入命|天马在迁|禄存守命|禄存守身|昌曲坐命|昌曲同会|辅弼同会|魁钺同会|科权双会|辅弼夹命|昌曲夹命|魁钺夹命/;

/**
 * Classify by structural name first. Detector level=caution alone must NOT demote a
 * known ming_geju / wealth / career / ... hit to caution_break (that caused Input-only
 * stickers for ming_geju-class hits). True break names and unknown caution -> caution_break.
 */
export function classifyPatternHit(
  hit: Pick<ZiweiPatternHit, "name" | "level">,
): PatternHitClass {
  const name = (hit.name ?? "").trim();
  if (!name) return "caution_break";
  // Name-class structural buckets before level=caution demotion.
  if (WEALTH_NAME_RE.test(name)) return "wealth_cai";
  if (CAREER_NAME_RE.test(name)) return "career_guan";
  if (EXPRESSION_NAME_RE.test(name)) return "expression";
  if (INTERPERSONAL_NAME_RE.test(name)) return "interpersonal";
  if (MING_GEJU_NAME_RE.test(name)) return "ming_geju";
  // True break names (after structure classes so e.g. 化忌入命 stays caution).
  if (CAUTION_NAME_RE.test(name)) return "caution_break";
  if (hit.level === "caution") return "caution_break";
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

export type OmittedPatternHit = {
  name: string;
  hit_id: string;
  hit_class: PatternHitClass;
  level: ZiweiPatternHit["level"] | string;
  reason: PatternHitOmitReason;
};

export type PatternHitSelection = {
  on_topic: ClassifiedPatternHit[];
  omitted: OmittedPatternHit[];
};

export function selectPatternHitsWithOmits(
  hits: readonly ZiweiPatternHit[] | null | undefined,
  question_category: QuestionCategory | string | null | undefined,
): PatternHitSelection {
  if (!hits?.length) return { on_topic: [], omitted: [] };
  const allowed = new Set(allowedPatternHitClassesForCategory(question_category));
  const on_topic: ClassifiedPatternHit[] = [];
  const omitted: OmittedPatternHit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const name = (h.name ?? "").trim();
    if (!name) {
      omitted.push({
        name: "",
        hit_id: "",
        hit_class: "caution_break",
        level: h.level ?? "neutral",
        reason: "empty_name",
      });
      continue;
    }
    const hit_class = classifyPatternHit(h);
    const hit_id = ziweiPatternHitId(name);
    if (hit_class === "caution_break") {
      omitted.push({
        name,
        hit_id,
        hit_class,
        level: h.level,
        reason: "caution_break",
      });
      continue;
    }
    if (!allowed.has(hit_class)) {
      omitted.push({
        name,
        hit_id,
        hit_class,
        level: h.level,
        reason: "off_topic_category",
      });
      continue;
    }
    if (seen.has(hit_id)) {
      omitted.push({
        name,
        hit_id,
        hit_class,
        level: h.level,
        reason: "duplicate_hit_id",
      });
      continue;
    }
    seen.add(hit_id);
    on_topic.push({
      ...h,
      name,
      hit_class,
      hit_id,
      target_dimension: patternHitTargetDimension(hit_class),
    });
  }
  return { on_topic, omitted };
}

export function selectOnTopicPatternHits(
  hits: readonly ZiweiPatternHit[] | null | undefined,
  question_category: QuestionCategory | string | null | undefined,
): ClassifiedPatternHit[] {
  return selectPatternHitsWithOmits(hits, question_category).on_topic;
}

function checklistItemForHit(hit: ClassifiedPatternHit): ChecklistItemStatus {
  return {
    key: `${ZFP_PATTERN_HIT_KEY_PREFIX}${hit.hit_id}`,
    present: true,
    summary_zh: `紫微格局命中：${hit.name}（hit:${hit.hit_id}·${hit.level}）`,
  };
}

function omitHint(o: OmittedPatternHit): string {
  return `${ZFP_HIT_OMIT_HINT_PREFIX}${o.reason}:${o.hit_id || "empty"}:${o.name || "empty"}`;
}

/**
 * Append on-topic ZFP hits into feed dimension items + hints.
 * Off-topic / caution_break omits leave auditable zfp_omit:* hints on day_master_strength
 * (natal home) so silent drop is impossible to miss in feed inspection.
 * Does not rewrite existing bazi checklist items. Call before applyAgendaDepth
 * (via buildChartThesisFromStructured after buildThesisCalcFeed).
 */
export function absorbPatternHitsIntoFeed(
  feed: ThesisCalcFeed,
  hits: readonly ZiweiPatternHit[] | null | undefined,
  question_category: QuestionCategory | string | null | undefined,
): ThesisCalcFeed {
  const { on_topic, omitted } = selectPatternHitsWithOmits(hits, question_category);
  if (!on_topic.length && !omitted.length) return feed;

  const dimensions = { ...feed.dimensions };
  for (const hit of on_topic) {
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

  if (omitted.length) {
    const home = dimensions.day_master_strength;
    const omitHints = omitted.map(omitHint);
    const hints = [...home.hints];
    for (const h of omitHints) {
      if (!hints.includes(h)) hints.push(h);
    }
    dimensions.day_master_strength = { ...home, hints };
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
 * Gate helper: when on-topic hits >=1, every selected hit must be cited
 * (name or id) in classical_basis / conclusion_zh / usable_claims_hint.
 * Fail-closed for each on-topic hit -- partial cite must not PASS.
 * No hard-coded case / lab names. Omits are returned for audit only.
 */
export function evaluateThesisPatternHitsCitationGate(
  thesis: ChartThesis,
  hits: readonly ZiweiPatternHit[] | null | undefined,
  question_category: QuestionCategory | string | null | undefined,
): {
  passed: boolean;
  failed_rule?: string;
  on_topic_n: number;
  uncited: string[];
  omitted: OmittedPatternHit[];
} {
  const { on_topic, omitted } = selectPatternHitsWithOmits(hits, question_category);
  if (on_topic.length === 0) {
    return { passed: true, on_topic_n: 0, uncited: [], omitted };
  }
  const uncited = on_topic
    .filter((h) => !thesisCitesPatternHit(thesis, h))
    .map((h) => h.name);
  if (uncited.length > 0) {
    return {
      passed: false,
      failed_rule: "thesis:pattern_hits_uncited",
      on_topic_n: on_topic.length,
      uncited,
      omitted,
    };
  }
  return { passed: true, on_topic_n: on_topic.length, uncited: [], omitted };
}

export function isZfpPatternHitChecklistKey(key: string | null | undefined): boolean {
  return Boolean(key && key.startsWith(ZFP_PATTERN_HIT_KEY_PREFIX));
}
