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

/**
 * Immutable record of one user answer as received, bound to the question that
 * was actually sent. The only authority for fact statements derived from it.
 * Append-only on the session (first record per source_turn_id wins).
 */
export type AnswerSourceRecord = {
  source_turn_id: string;
  /** Trimmed user text exactly as received; never model-rewritten. */
  raw_user_statement: string;
  sent_question_id: string;
  sent_question_text: string;
  authorized_dir_ids: string[];
  authorized_ddr_ids: string[];
  authorized_role_codes: string[];
  turn_kind:
    | "ordinary_answer"
    | "pending_clarification"
    | "intake_control_follow_up"
    | "conflict_clarification";
  received_at: string;
  /**
   * Audit of the first successful interpretation of this turn: where each
   * proposed write was located in raw_user_statement and why items were
   * rejected. Metadata only; DC stays the single fact store.
   */
  interpretation?: AnswerInterpretationAudit;
};

export type AnswerInterpretationAudit = {
  classification: AnswerClass;
  interpreter: string;
  model_provider: string | null;
  model: string | null;
  writes: Array<{
    kind: ProposedWriteKind;
    status: ProposedWrite["status"];
    verification_level: ProposedWrite["verification_level"];
    fact_role: string;
    dir_id: string;
    corrects_fact_ids: string[];
    locators: ProposedWriteProvenance[];
  }>;
  rejections: Array<{ extracted_index: number; reason: string; source_quote: string }>;
  unresolved: Array<{ item_id: string; reason: string }>;
  recorded_at: string;
};

/**
 * Audit trail from one persisted write back to the model extraction that
 * proposed it. Offsets locate the quote inside the raw answer; they are
 * never an authorization basis.
 */
export type ProposedWriteProvenance = {
  source_turn_id: string;
  statement_basis: "raw_user_statement";
  extracted_index: number | null;
  extracted_text: string | null;
  source_quote: string | null;
  located_start: number | null;
  located_end: number | null;
  model_source_start: number | null;
  model_source_end: number | null;
};

export type ProposedWrite = {
  kind: ProposedWriteKind;
  /** Raw user statement of the source turn (never model paraphrase). */
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
  provenance?: ProposedWriteProvenance[];
  /** correction only: earlier facts (other turns) this write corrects. */
  corrects_fact_ids?: string[];
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
    /**
     * Verbatim copy of one or more complete sentences / clauses of the
     * current user answer. Required for persistable model extractions.
     * Never a paraphrase, never a cut from inside a clause, and never
     * manufactured by the parser.
     */
    source_quote: string;
    /**
     * Optional candidate location of source_quote in the trimmed user answer
     * (UTF-16 offsets, end exclusive). Locating hint only, never authorization:
     * when present, deterministic code verifies both offsets against the
     * original statement and rejects the item on any mismatch.
     */
    source_start?: number | null;
    source_end?: number | null;
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

export type UnresolvedAnswerItemStatus = "pending";

export type UnresolvedAnswerItem = {
  /**
   * Stable identity for the whole pending lifecycle.
   * Format: `${source_turn_id}#${extracted_index}`. Never text alone.
   */
  item_id: string;
  source_turn_id: string;
  /** Model extraction text (display / clarification prompt only). */
  text: string;
  semantic_kind: "reality_fact" | "constraint" | "definition_patch";
  certainty: "explicit" | "estimated" | "unclear";
  reason: UnresolvedAnswerReason;
  /** Actually-sent question plan_id at the time of rejection; empty if none. */
  sent_question_id: string;
  authorized_role_codes: string[];
  raw_role_code_hint?: string | null;
  /** Raw user statement of source_turn_id; the only statement a bind may persist. */
  source_statement?: string;
  /** Grounded quote inside source_statement (locator only). */
  source_quote?: string | null;
  located_start?: number | null;
  located_end?: number | null;
  /** DIR / DDR authorized by the question sent when the item was produced. */
  authorized_dir_ids?: string[];
  authorized_ddr_ids?: string[];
  status?: UnresolvedAnswerItemStatus;
  /** Unclear clarification replies so far; bounded by the pending policy. */
  attempts?: number;
};

export type SourceQuoteRejectionReason =
  | "source_quote_not_grounded"
  | "source_quote_empty"
  | "source_quote_too_long"
  /** Raw answer exceeds the fact statement limit; nothing from it may persist verbatim. */
  | "source_statement_exceeds_fact_limit"
  /** Historical (FU9/FU10) reasons; kept so stored audit records stay typed. */
  | "extraction_text_not_source_equivalent"
  | "source_quote_not_clause_span"
  | "clause_boundary_undeterminable"
  /** Normalized match starts or ends inside one original character cluster. */
  | "source_quote_unicode_boundary_mismatch"
  | "source_offset_invalid"
  | "source_offset_out_of_range"
  | "source_offset_quote_mismatch";

export type SourceQuoteRejection = {
  extracted_index: number;
  text: string;
  source_quote: string;
  reason: SourceQuoteRejectionReason;
  /** Model-provided candidate offsets, recorded for audit only. */
  source_start?: number | null;
  source_end?: number | null;
};

/**
 * Scheduling signal from a model unresolved_aspects entry.
 * Never a RealityFact, Constraint, or second fact store.
 */
export type UnresolvedModelAspect = {
  aspect_id: string;
  source_turn_id: string;
  text: string;
  sent_question_id: string;
  authorized_role_codes: string[];
  authorized_dir_ids: string[];
};

export type IntakeControlItemKind =
  | "unresolved_aspect"
  | "goal_change"
  | "insight_mismatch";

export type IntakeControlItemStatus =
  | "pending"
  | "clarified"
  | "confirmed"
  | "declined"
  | "uncertain"
  /** Terminal: user stayed uncertain past the attempt bound; never re-asked. */
  | "closed_uncertain"
  /** Terminal: hard question budget reached before this item could be asked. */
  | "closed_budget_exhausted"
  /** Terminal: the item's DIR already used its per-direction depth. */
  | "closed_depth_exhausted";

/**
 * Session scheduling / control metadata only.
 * Never a Decision Context write by itself. A confirmed goal_change is applied
 * only through the formal Blueprint update entry (goal-change-blueprint-update).
 */
export type IntakeControlItem = {
  item_id: string;
  kind: IntakeControlItemKind;
  source_turn_id: string;
  text: string;
  /** User-stated proposed new decision target; goal_change only. */
  proposed_decision_target?: string;
  sent_question_id: string;
  authorized_role_codes: string[];
  authorized_dir_ids: string[];
  status: IntakeControlItemStatus;
  /** Raw user statement of source_turn_id. */
  source_statement?: string;
  /** goal_change: turn + raw statement the candidate target was located in. */
  target_source_turn_id?: string;
  target_source_statement?: string;
  /** Uncertain follow-up replies so far. */
  attempts?: number;
};

/** Append-only audit of one formal Blueprint update. */
export type BlueprintChangeRecord = {
  change_id: string;
  kind: "goal_change";
  from_blueprint_version: number;
  to_blueprint_version: number;
  old_decision_target: string | null;
  new_decision_target: string;
  /** Raw user statement that proposed the change. */
  proposal_statement: string;
  proposal_source_turn_id: string;
  control_item_id: string;
  confirmed_by_turn_id: string;
  confirmation_statement: string;
  changed_at: string;
  dc_version_before: number;
  dc_version_after: number;
  added_dir_ids: string[];
  deprecated_dir_ids: string[];
  reactivated_dir_ids: string[];
  reopened_dir_ids: string[];
  /** Facts answering the old target, now marked not_applicable (never deleted). */
  superseded_fact_ids: string[];
  superseded_fact_prior_states: Array<{
    fact_id: string;
    status: string;
    verification_level: string;
  }>;
  new_decision_question_fact_id: string | null;
  invalidated_understanding_id: string | null;
  invalidated_plan_id: string | null;
};

export type IntakeControlResolutionStatus =
  | "clarified"
  | "clarified_without_dc_write";

/**
 * Structured audit of an insight_mismatch clarification.
 * Not a Decision Context write and not a second fact store.
 */
export type IntakeControlResolutionRecord = {
  original_mismatch_item_id: string;
  original_mismatch_source_turn_id: string;
  clarification_turn_id: string;
  original_mismatch_text: string;
  clarification_text: string;
  answer_event_id: string | null;
  resolution_status: IntakeControlResolutionStatus;
};

export type PendingIntakeControlStatus = "pending" | "resolved";

export type PendingIntakeControl = {
  status: PendingIntakeControlStatus;
  source_turn_id: string;
  original_statement: string;
  original_classification: AnswerClass;
  items: IntakeControlItem[];
  clarification_plan: AdaptiveQuestionPlan | null;
  clarification_plan_id: string | null;
  resolving_item_id: string | null;
  /**
   * Set only after an explicit user confirmation of a proposed goal_change,
   * when the formal Blueprint update entry has been invoked.
   */
  entered_controlled_blueprint_update?: boolean;
  /** Result of the formal Blueprint update for the confirmed goal_change. */
  blueprint_update?: {
    change_id: string;
    from_blueprint_version: number;
    to_blueprint_version: number;
  } | null;
  /** Original decision target retained while a goal change is pending or declined. */
  original_decision_target?: string | null;
  /** Follow-up turn that last resolved or confirmed a control item; used for replay. */
  last_resolved_turn_id?: string | null;
  /** Every source turn contributing items (queue across turns). */
  source_turn_ids?: string[];
  /**
   * Auditable insight_mismatch clarification resolutions.
   * Scheduling/control metadata only; never a second fact store.
   */
  resolution_records?: IntakeControlResolutionRecord[];
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
  /**
   * Structured unresolved model aspects. Scheduling signals only;
   * never left only in notes and never written as facts.
   */
  unresolved_aspects: UnresolvedModelAspect[];
  /** Deterministic source-quote grounding rejections for this turn. */
  grounding_rejections: SourceQuoteRejection[];
  /** Control-plane clarification items captured from this turn. */
  control_items: IntakeControlItem[];
  /** Current writers record the interpreter actually used for this event. */
  interpreter: AnswerInterpreterVersion;
  /** Raw answer record this event was interpreted against. */
  source_record?: AnswerSourceRecord | null;
  /** Provider/model that produced the draft (null for test hooks). */
  model_call?: { provider: string | null; model: string | null } | null;
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
  /**
   * refused = explicit user refusal; unclear_after_retries = attempt bound reached;
   * user_cannot_determine = user chose "cannot determine" for a role already answered by the same turn;
   * budget_exhausted = hard question budget reached before the item could be asked;
   * depth_exhausted = the item's DIR already used its per-direction depth.
   */
  terminal_reason?:
    | "refused"
    | "unclear_after_retries"
    | "user_cannot_determine"
    | "budget_exhausted"
    | "depth_exhausted";
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
  /** Every source turn contributing items (queue across turns). */
  source_turn_ids?: string[];
};

export type SessionBudgetSnapshot = {
  soft_budget_limit: number;
  hard_budget_limit: number;
  session_asked_count: number;
  review_cycle: number;
  cycle_base_asked: number;
  remaining_hard_budget: number;
  depth_by_dir: Record<string, number>;
  /** Sent plans refunded because the answer carried no usable information. */
  ineffective_plan_ids?: string[];
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
  /**
   * DIRs whose required roles all carry a user answer for this goal
   * (asserted, estimated, unknown or declined) but are not yet known.
   * Not "known": they await final confirmation or stay information boundaries.
   */
  answered_pending_confirmation?: {
    items: Array<{
      dir_id: string;
      label: string;
      fact_ids: string[];
      answer_statuses: string[];
      information_boundary: boolean;
    }>;
  };
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
