/**
 * TopicCalcSupplement — second local calc (topic-timed) field contract.
 *
 * Docs: `.cursor/docs/pivot-TopicCalcSupplement-字段草案与缺口表.md`
 *
 * Authority split (locked):
 * - This pack = raw cycles / relations / elemental stances / neutral rhythm *signals*.
 * - Thesis `cycle_rhythm` = sole authority for 该冲该守 (push/hold/retreat prose).
 * - Topic convergence must NOT treat supplement signals as a competing rhythm verdict.
 */

import type { QuestionCategory } from "@/lib/poju/agent-state";
import type { TopicTypedField } from "@/lib/calculations/topic-typed-fields";

/** Palace tags used by relation-engine category filters. */
export type TopicCalcPalace =
  | "self"
  | "spouse"
  | "career"
  | "result"
  | "root"
  | "other";

export type TopicCalcRelationKind =
  | "chong"
  | "xing"
  | "hai"
  | "he"
  | "banhe"
  | "sanhe"
  | "tiangan_he"
  | "ten_god_tension"
  | "other";

/**
 * Elemental stance of a luck pillar vs 用神 (table lookup).
 * NOT a 该冲该守 verdict — do not map support→push / drain→hold in consumers.
 */
export type YongShenElementStance =
  | "support"
  | "drain"
  | "control"
  | "neutral"
  | "unclear";

export type TopicCalcCyclePillar = {
  ganzhi: string;
  stem: string;
  branch: string;
  /** Ten god relative to day master; empty if unknown. */
  ten_god: string;
  start_age?: number;
  end_age?: number;
  index?: number;
};

export type TopicCalcRelationHit = {
  id: string;
  kind: TopicCalcRelationKind;
  source:
    | "dayun_x_natal"
    | "liunian_x_natal"
    | "liuyue_x_natal"
    | "liunian_x_dayun"
    | "ten_god_tension"
    | "other";
  positions: string[];
  /** Machine short line — factual, not user-facing body. */
  summary_zh: string;
};

/**
 * Neutral rhythm *signal* for thesis `cycle_rhythm` to cite.
 * Forbidden: push | hold | retreat | 宜冲 | 宜守 as a packaged verdict.
 */
export type TopicCalcRhythmSignal = {
  id: string;
  kind: TopicCalcRelationKind;
  layers: Array<"natal" | "dayun" | "liunian" | "liuyue">;
  involved_ten_gods: string[];
  /** e.g. "流年午与日支子相冲" — describe the hit, do not prescribe action. */
  summary_zh: string;
};

export type TopicCalcYongShenActivation = {
  yong: string;
  xi: string[];
  ji: string[];
  /** Elemental table vs current dayun stem — not 攻守文案. */
  dayun_element_stance: YongShenElementStance;
  /** Elemental table vs current liunian stem. */
  liunian_element_stance: YongShenElementStance;
  /** True when dayun vs liunian elemental stances disagree (support vs drain/control). */
  element_stances_conflict: boolean;
};

export type TopicCalcTopicSlice = {
  primary_palaces: TopicCalcPalace[];
  focus_ten_gods: string[];
  natal_fields: TopicTypedField[];
  relation_focus_ids: string[];
  /** Sort only — must not mutate factual fields elsewhere. */
  priority_weights: Record<string, number>;
};

export type TopicCalcAbsentNote = {
  key: string;
  summary_zh: string;
};

export type TopicCalcThesisFeedHooks = {
  current_liunian: boolean;
  dayun_liunian_stack: boolean;
  liuyue_slice: boolean;
  yongshen_element_stance: boolean;
  /** Neutral 冲合/刑害 signals for cycle_rhythm — not a push/hold field. */
  cycle_tension_signals: boolean;
};

export type TopicCalcSupplementMeta = {
  version: 1;
  structured_fingerprint: string;
  question_category: QuestionCategory;
  as_of: string;
  engine_versions: {
    relation_engine: string;
    liunian: string;
    topic_typed: string;
    yongshen_heuristic?: string;
  };
};

/**
 * Second local calc output. No near_term_bias / push-hold-retreat field by design (方案B).
 */
export type TopicCalcSupplement = {
  meta: TopicCalcSupplementMeta;
  cycles: {
    current_dayun: TopicCalcCyclePillar | null;
    current_liunian: TopicCalcCyclePillar | null;
    current_liuyue: TopicCalcCyclePillar | null;
    dayun_index: number | null;
  };
  cycle_relations: TopicCalcRelationHit[];
  yongshen_activation: TopicCalcYongShenActivation | null;
  topic_slice: TopicCalcTopicSlice;
  /** Neutral signals only — sole 该冲该守 authority is thesis cycle_rhythm. */
  rhythm_signals: TopicCalcRhythmSignal[];
  absent_notes: TopicCalcAbsentNote[];
  thesis_feed_hooks: TopicCalcThesisFeedHooks;
};

/** Default palace focus by question category (rule table — testable). */
export const TOPIC_CALC_DEFAULT_PALACES: Readonly<
  Record<Exclude<QuestionCategory, null>, readonly TopicCalcPalace[]>
> = {
  career: ["career", "result", "self"],
  relationship: ["spouse", "self"],
  wealth: ["career", "self"],
  health: ["self"],
  family: ["root", "spouse"],
  decision: ["self"],
  interpersonal: ["self", "spouse"],
  other: ["self"],
};

/** Default ten-god focus labels by category (rule table — testable). */
export const TOPIC_CALC_DEFAULT_TEN_GODS: Readonly<
  Record<Exclude<QuestionCategory, null>, readonly string[]>
> = {
  career: ["正官", "七杀", "正印", "偏印", "食神", "伤官"],
  relationship: ["正财", "偏财", "正官", "七杀"],
  wealth: ["正财", "偏财", "食神", "伤官"],
  health: [],
  family: ["正印", "偏印", "比肩", "劫财"],
  decision: ["正官", "七杀", "正财", "偏财", "正印", "偏印"],
  interpersonal: ["比肩", "劫财", "正官", "七杀"],
  other: [],
};

/** Consumer policy constants — keep in sync with docs. */
export const TOPIC_CALC_AUTHORITY = {
  /** Forbidden packaged verdicts on this pack. */
  forbidden_rhythm_verdicts: ["push", "hold", "retreat", "宜冲", "宜守", "near_term_bias"] as const,
  /** Who may conclude 该冲该守. */
  rhythm_verdict_owner: "thesis.cycle_rhythm" as const,
  /** Topic convergence may read these for grounding, not as alternate verdicts. */
  topic_convergence_may_read: [
    "cycles",
    "cycle_relations",
    "yongshen_activation",
    "rhythm_signals",
    "topic_slice",
    "absent_notes",
  ] as const,
} as const;
