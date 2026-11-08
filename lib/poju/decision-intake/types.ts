/**
 * Decision Intake 2.0 — Mainline M1 types.
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

export type AnswerEvent = {
  event_id: string;
  session_id: string;
  client_turn_id: string;
  raw_text: string;
  classification: AnswerClass;
  targets: { dir_ids: string[]; ddr_ids: string[]; direction_id?: string };
  proposed_writes: ProposedWrite[];
  notes: string[];
  interpreter: "deterministic_m1_v1";
};

export type InvestigationDirection = {
  direction_id: string;
  priority: "P0" | "P1" | "P2";
  label: string;
  dir_ids: string[];
  needed_info: string;
  completion_criteria: string;
  depth_soft_cap: number;
  scope_boundary: string;
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
    turn_id: string;
  } | null;
};

export type AdaptiveTurnResult = {
  session: import("@/lib/poju/types").POJUSessionState;
  outcome:
    | "planned"
    | "ready_no_question"
    | "dc_persist_failed"
    | "dc_persist_threw"
    | "not_applicable_phase"
    | "idempotent_replay";
  answer_event: AnswerEvent | null;
  understanding: UnderstandingState | null;
  plan: AdaptiveQuestionPlan | null;
  authorized_question: string | null;
  persist_error?: string;
  ask_error?: string;
};
