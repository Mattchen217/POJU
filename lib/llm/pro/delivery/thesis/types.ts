/** Deterministic chart thesis types (命盘总纲) — no LLM. */

export type ThesisDimensionId =
  | "day_master_strength"
  | "favor_avoid_tuning"
  | "interpersonal_pattern"
  | "cycle_rhythm"
  | "resource_pattern"
  | "expression_creativity";

export type ChecklistItemStatus = {
  key: string;
  present: boolean;
  /** From true calc, or "未见相关特征". */
  summary_zh: string;
};

export type ThesisWuxingRelation = {
  from: string;
  to: string;
  relation: string;
  note: string;
};

export type ThesisDimension = {
  dimension_id: ThesisDimensionId;
  dimension_name_zh: string;
  classical_basis: Record<string, unknown> | ChecklistItemStatus[];
  strength_verdict?: string;
  conclusion_zh: string;
  usable_claims_hint: string[];
  wuxing_relations: ThesisWuxingRelation[];
  depth: "full" | "brief" | "skip";
};

export type ChartThesis = {
  version: 1;
  structured_fingerprint: string;
  dimensions: ThesisDimension[];
  generated_at: string;
  judgment_core_frozen: boolean;
  /**
   * Runtime slice identity — must be part of any cross-job cache key.
   * cycle_rhythm / yong activation depend on as_of; natal-only dims do not.
   */
  as_of_day?: string;
  question_category?: string | null;
};

export type ThesisCalcFeedDimension = {
  empty: boolean;
  items: ChecklistItemStatus[];
  strength_verdict?: string;
  hints: string[];
};

export type ThesisCalcFeed = {
  fingerprint: string;
  dimensions: Record<ThesisDimensionId, ThesisCalcFeedDimension>;
};

export const THESIS_DIMENSION_IDS: readonly ThesisDimensionId[] = [
  "day_master_strength",
  "favor_avoid_tuning",
  "interpersonal_pattern",
  "cycle_rhythm",
  "resource_pattern",
  "expression_creativity",
] as const;

export const THESIS_DIMENSION_NAME_ZH: Readonly<Record<ThesisDimensionId, string>> = {
  day_master_strength: "日主强弱与格局",
  favor_avoid_tuning: "用神喜忌与调候",
  interpersonal_pattern: "十神组合与人际模式",
  cycle_rhythm: "纪元与岁环节奏",
  resource_pattern: "财帛与资源模式",
  expression_creativity: "表达输出与创造力",
};

/** Checklist absent-marker — never invent features to fill a slot. */
export const THESIS_ABSENT_SUMMARY_ZH = "未见相关特征";

export const THESIS_EMPTY_CONCLUSION_ZH = "此维度在本盘特征不明显。";
