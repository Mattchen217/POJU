/**
 * Decision Context (DC) — Phase 1 core types.
 * SoT: IMPL-DESIGN-STAGE1-3-DC-2026-11-02.md + Eng SoT A+B.
 * Formal decision data lives ONLY here; agent_v2 buffers are not authoritative.
 */

export type DecisionContextStatus = "draft" | "final" | "superseded";

export type FactStatus =
  | "confirmed"
  | "unverified"
  | "unknown"
  | "declined"
  | "not_applicable";

/**
 * Verification levels allowed on RealityFact / Constraint.
 * There is NO `inferred` — model insights must not become RealityFact.
 */
export type VerificationLevel =
  | "user_asserted"
  | "independently_verified"
  | "user_estimate"
  | "none";

export type SourceStage =
  | "opening"
  | "call_a"
  | "call_b"
  | "collecting"
  | "user_supplement"
  | "system";

export type DirCurrentState = "known" | "unknown" | "conflict" | "n_a";

export type DirIdLifecycle = "active" | "superseded_by" | "deprecated";

export type ConflictState = "open" | "clarified" | "unresolved_in_final";

export type HypothesisState =
  | "proposed"
  | "supported"
  | "challenged"
  | "pending_validation"
  | "rejected";

export type ConstraintCategory =
  | "time"
  | "financial"
  | "responsibility"
  | "reversibility"
  | "exit_cost"
  | "unacceptable_outcome";

export type ConstraintRigidity = "hard" | "soft";

export interface Definition {
  concrete_event: string | null;
  stakes: string | null;
  desired_outcome: string | null;
  decision_question: string | null;
  goal_priorities: string[];
  unacceptable_outcomes: string[];
}

export interface RealityFact {
  fact_id: string;
  statement: string;
  status: FactStatus;
  verification_level: VerificationLevel;
  source_stage: SourceStage | string;
  source_turn_id: string | null;
  /**
   * Derived only from an explicit user-confirm event + matching source.
   * NEVER set independently; independently_verified alone must NOT imply true.
   */
  user_confirmed: boolean;
  updated_at?: string;
  /** Optional role tags used by DIR.required_fact_roles aggregation. */
  fact_roles?: string[];
  related_dir_ids?: string[];
}

export interface Constraint {
  constraint_id: string;
  statement: string;
  category: ConstraintCategory;
  status: FactStatus;
  verification_level: VerificationLevel;
  source_stage: SourceStage | string;
  source_turn_id: string | null;
  rigidity: ConstraintRigidity;
  user_confirmed: boolean;
  updated_at?: string;
}

export interface Hypothesis {
  hypothesis_id: string;
  statement: string;
  supporting_evidence: string[];
  counter_evidence: string[];
  validation_need: string | null;
  state: HypothesisState;
  related_dir_ids: string[];
  /** Provenance: Call A job / core generation (idempotency). */
  source_ref?: string | null;
  updated_at?: string;
}

export interface DIR {
  dir_id: string;
  need: string;
  why: string;
  category?: string | null;
  serves_face?: string | null;
  serves_judgment?: string | null;
  required_fact_roles: string[];
  current_state: DirCurrentState;
  partial_satisfaction: boolean;
  agenda_item_ids: string[];
  satisfaction?: string | null;
  /** When true, an unresolved unknown on this DIR may change P5 ranking (stop-criteria). */
  may_affect_p5_ranking?: boolean;
  id_lifecycle: DirIdLifecycle;
  superseded_by_dir_id?: string | null;
}

export interface ConflictSourceRef {
  fact_id: string;
  source_stage: SourceStage | string;
  source_turn_id: string | null;
}

export interface Conflict {
  conflict_id: string;
  fact_ids: string[];
  conflict_field: string;
  statements_snapshot: string[];
  source_refs: ConflictSourceRef[];
  state: ConflictState;
  resolution: string | null;
  /** Required true for clarified; model may not self-clarify. */
  user_confirmation: boolean;
  /**
   * Eng SoT Gate: unresolved conflict that decides whether the preferred path holds
   * → delivery-blocking FAIL. When false, Freeze may keep unresolved_in_final with
   * noted boundary / degraded delivery. Undefined = conservative true (blocks).
   */
  affects_preferred_path?: boolean;
  updated_at?: string;
  supersedes?: string | null;
  related_conflict_ids?: string[];
}

export interface DecisionContext {
  context_id: string;
  /** Monotonic version within same context_id (H1). */
  version: number;
  status: DecisionContextStatus;
  definition: Definition;
  reality_facts: RealityFact[];
  constraints: Constraint[];
  hypotheses: Hypothesis[];
  dirs: DIR[];
  conflicts: Conflict[];
  /** Required when status === final; draft may be empty. */
  content_hash: string | null;
  created_at: string;
  updated_at: string;
  superseded_by?: string | null;
  parent_version?: number | null;
  /** Explicit information boundaries noted for sufficiency / report. */
  information_boundaries?: string[];
  /** Optional degraded delivery flag (C3). */
  delivery_mode?: "normal" | "degraded" | null;
}

/**
 * Product Stage 4 report binding triple.
 * Every Stage 4 report artifact must carry this; pipeline is read-only vs frozen DC.
 */
export interface DecisionContextBinding {
  context_id: string;
  context_version: number;
  context_hash: string;
}

export type FactCombinationInput = Pick<
  RealityFact,
  "status" | "verification_level"
> & {
  /** True only when a concrete user-confirm event exists for this fact. */
  has_user_confirm_event?: boolean;
};