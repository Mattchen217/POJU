/**
 * Decision Intake 2.0 — Mainline M1 types.
 * M2.4-R1: Phase 4 answer interpretation + gap-driven ask (contracts preserved).
 * Understanding State is a derived view (NOT a second fact SoT).
 * Blueprint seeds investigation; live DIR state lives only on DC.dirs.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";

export type AnswerClass =
  | "clear_answer"
  | "partial_answer"
  | "vague_answer"
  | "unknown"
  | "declined"
  | "correction"
  | "supplement"
  | "contradiction"
  | "goal_change"
  | "insight_mismatch"
  | "off_topic"
  | "invalid_input"
  | "estimate";

export type ProposedWriteKind =
  | "reality_fact"
  | "constraint"
  | "definition_patch"
  | "conflict"
  | "none";

export type ProposedWrite = {
  kind: ProposedWriteKind;
  statement: string;
  status: "unverified" | "unknown" | "declined" | "confirmed";
  verification_level: "user_asserted" | "user_estimate" | "none";
  fact_roles: string[];
  related_dir_ids: string[];
  constraint_category?:
    | "time"
    | "financial"
    | "responsibility"
    | "reversibility"
    | "exit_cost"
    | "unacceptable_outcome";
  rigidity?: "hard" | "soft";
};

export type AnswerInterpreterVersion =
  | "deterministic_m1_v1"
  | "deterministic_m2_4_r1"
  | "model_m2_4_r2";

export type ModelAnswerDraft = {
  classification:
    | "clear_answer"
    | "partial_answer"
    | "vague_answer"
    | "unknown"
    | "declined"
    | "correction"
    | "supplement"
    | "contradiction"
    | "goal_change"
    | "insight_mismatch"
    | "off_topic"
    | "invalid_input"
    | "estimate";
  extracted_items: Array<{
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    /** Legacy role-name hint; kept for historical drafts only. Not an authorization basis. */
    role_hint: string | null;
    /**
     * Full authorized role code `v1/dir/{dir_id}/role/{role}`.
     * Optional on historical drafts / test fixtures; missing is treated as null.
     * Production model output should always include this field (string or null).
     */
    role_code_hint?: string | null;
    certainty: "explicit" | "estimated" | "unclear";
  }>;
  unresolved_aspects: string[];
  explanation: string;
};

export type UnresolvedAnswerReason =
  | "unlocated_role_code"
  | "unauthorized_role_code"
  | "illegal_role_code"
  | "unclear_certainty"
  | "estimated_constraint_not_persistable"
  | "definition_patch_not_persistable"
  | "missing_authorized_answer_target"
  | "missing_authorized_fact_roles";

export type UnresolvedAnswerItem = {
  /**
   * Stable identity for the whole pending lifecycle.
   * Format: `${source_turn_id}#${extracted_index}`. Never text alone.
   */
  item_id: string;
  source_turn_id: string;
  text: string;
  semantic_kind: "reality_fact" | "constraint" | "definition_patch";
  certainty: "explicit" | "estimated" | "unclear";
  reason: UnresolvedAnswerReason;
  /** Actually-sent question plan_id at the time of rejection; empty if none. */
  sent_question_id: string;
  authorized_role_codes: string[];
  raw_role_code_hint?: string | null;
};

export type AnswerEvent = {
  event_id: string;
  session_id: string;
  client_turn_id: string;
  raw_text: string;
  classification: AnswerClass;
  targets: { dir_ids: string[]; ddr_ids: string[]; direction_id?: string };
  proposed_writes: ProposedWrite[];
  notes: string[];
  /** Structured unresolved items; never enter proposed_writes. */
  unresolved_items: UnresolvedAnswerItem[];
  /** Current writers record the interpreter actually used for this event. */
  interpreter: AnswerInterpreterVersion;
};

export type InvestigationDirection = {
  direction_id: string;
  priority: "P0" | "P1" | "P2";
  label: string;
  dir_ids: string[];
  /** Catalog DDR ids linked to this direction (many DDR per DIR allowed). */
  ddr_ids?: string[];
  needed_info: string;
  completion_criteria: string;
  depth_soft_cap: number;
  scope_boundary: string;
  dependencies?: string[];
};

export type DecisionBlueprint = {
  blueprint_id: string;
  blueprint_version: number;
  ddr_version: string;
  dir_catalog_version: string;
  session_id: string;
  context_id: string;
  decision_question: string | null;
  definition_snapshot: DecisionContext["definition"];
  directions: InvestigationDirection[];
  dir_ids: string[];
  /** Selected Catalog DDR ids for this Blueprint scope. */
  ddr_ids?: string[];
  topic_tags?: string[];
  page_07_emit?: boolean;
  /** catalog = question-specific Catalog scope; starter_fallback = controlled fallback only. */
  scope_source?: "catalog" | "starter_fallback";
  /**
   * First-wave DC seed DIRs (P0 DDR required + topic pack).
   * Distinct from dir_ids (complete Blueprint scope) and from AQE scheduling.
   */
  initial_seed_dir_ids?: string[];
  scope_locked: boolean;
  question_budget: { soft: number; hard: number; depth_per_direction: number };
  created_at: string;
  updated_at: string;
};

export type UnderstoodItem = {
  dir_id: string;
  label: string;
  fact_ids: string[];
  status: "known" | "n_a";
  user_confirmed_any: boolean;
};

export type NeedItem =
  | {
      kind: "dir_based";
      dir_id: string;
      ddr_ids: string[];
      direction_id: string;
      priority: "P0" | "P1" | "P2";
      why: string;
      missing_content: string;
      may_affect_p5_ranking: boolean;
      gap_type: "unknown" | "partial" | "conflict" | "declined";
      must_continue: boolean;
    }
  | {
      kind: "source_only";
      ddr_id: string;
      source_code: string;
      source_state: "missing" | "pending" | "calc_failed" | "not_ok";
      priority: "P0" | "P1" | "P2";
      why: string;
      may_affect_p5_ranking: boolean;
      gap_type: "source_pending";
      user_askable: boolean;
      must_continue: boolean;
    };

export type PersonalPatternInsightBlock = {
  status: "unavailable" | "none" | "available";
  reason?: string;
  insights: Array<{ text: string; source: string; related_dir_ids: string[] }>;
};

export type ConflictClarificationTarget = {
  conflict_id: string;
  fact_ids: string[];
};

export type AdaptiveQuestionPlan = {
  plan_id: string;
  candidate_id: string;
  direction_id: string;
  ddr_ids: string[];
  dir_ids: string[];
  fact_role_codes: string[];
  missing_info: string;
  decision_value: string;
  ask_now_reason: string;
  expected_info: string;
  depth: number;
  budget_cost: number;
  remaining_hard_budget: number;
  gate_class: "P0" | "P1" | "P2";
  scope_boundary: string;
  rationale: string;
  question_text: string;
  built_at: string;
  scoring_path: string;
  /** Exact Conflict addressed by this plan, if any. Scheduling metadata only. */
  conflict_clarification?: ConflictClarificationTarget | null;
};

export type PendingAnswerResolutionStatus = "pending" | "rejected";
/** "pending" is the active clarification task (unresolved_items nonempty).
 *  "rejected" is the terminal audit record after every remaining item was
 *  explicitly refused. It must not keep a resendable clarification_plan,
 *  is not an unanswered ordinary clarification task, and is not a DC fact.
 */

/**
 * Auditable refusal of one pending item. Not a known fact and not a DC write.
 */
export type PendingRejectedItem = {
  item_id: string;
  source_turn_id: string;
  text: string;
  semantic_kind: "reality_fact" | "constraint" | "definition_patch";
  certainty: "explicit" | "estimated" | "unclear";
  reason: UnresolvedAnswerReason;
  rejected_at_turn_id: string;
  rejected_statement: string;
};

/**
 * Scheduling state only — never a second Decision Context or fact source.
 * Unresolved items here must not be written as RealityFacts or Constraints
 * until they pass complete role-code / certainty authorization and a legal
 * DC writer path.
 */
export type PendingAnswerResolution = {
  status: PendingAnswerResolutionStatus;
  source_turn_id: string;
  original_statement: string;
  original_classification: AnswerClass;
  unresolved_items: UnresolvedAnswerItem[];
  rejected_items: PendingRejectedItem[];
  authorized_role_codes: string[];
  /** DIR ids authorized by the originally sent question; never widened. */
  authorized_dir_ids: string[];
  sent_question_id: string;
  clarification_plan: AdaptiveQuestionPlan | null;
  clarification_plan_id: string | null;
  /** The single item this pending clarification is currently resolving. */
  resolving_item_id: string | null;
};

export type SessionBudgetSnapshot = {
  soft_budget_limit: number;
  hard_budget_limit: number;
  session_asked_count: number;
  review_cycle: number;
  cycle_base_asked: number;
  remaining_hard_budget: number;
  depth_by_dir: Record<string, number>;
};

export type ReadinessSnapshot = {
  verdict: "continue" | "ready_for_final_confirm" | "hard_budget_exhausted";
  can_ask: boolean;
  reasons: string[];
  sufficiency_verdict?: string;
};

export type UnderstandingState = {
  understanding_id: string;
  session_id: string;
  context_id: string;
  context_version: number;
  blueprint_version: number;
  built_at: string;
  current_understanding: {
    summary: string;
    decision_question: string | null;
    confirmed_briefs: string[];
    unconfirmed_briefs: string[];
    analysis_briefs: string[];
    conflict_briefs: string[];
    confidence: "low" | "medium" | "high";
  };
  understood: { items: UnderstoodItem[] };
  need_to_understand: { items: NeedItem[] };
  personal_pattern_insight: PersonalPatternInsightBlock;
  next_question_plan: AdaptiveQuestionPlan | null;
  readiness: ReadinessSnapshot;
  budget: SessionBudgetSnapshot;
  last_answer_event_id: string | null;
  last_sent_question: {
    question_text: string;
    plan_id: string;
    direction_id: string;
    dir_ids: string[];
    ddr_ids: string[];
    /** Roles authorized by the actually-sent Plan; optional on historical sessions. */
    fact_role_codes?: string[];
    turn_id: string;
    /** Exact Conflict addressed by this actually-sent question. */
    conflict_clarification?: ConflictClarificationTarget | null;
  } | null;
};

export type AdaptiveTurnResult = {
  session: import("@/lib/poju/types").POJUSessionState;
  outcome:
    | "planned"
    | "ready_no_question"
    | "planner_blocked"
    | "dc_persist_failed"
    | "dc_persist_threw"
    | "answer_interpretation_failed"
    | "answer_interpretation_invalid_schema"
    | "not_applicable_phase"
    | "idempotent_replay";
  answer_event: AnswerEvent | null;
  understanding: UnderstandingState | null;
  plan: AdaptiveQuestionPlan | null;
  authorized_question: string | null;
  persist_error?: string;
  ask_error?: string;
};
