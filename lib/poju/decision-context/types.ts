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
  /**
   * Phase 1 §2.5 recommended; required for Intake role resolution (R6).
   * Absent/empty ⇒ Constraint cannot resolve any DIR role.
   */
  related_dir_ids?: string[];
}

/** DIR-level N/A evidence (R6 Final Binding §1 — not role-level). */
export type NaSourceRef =
  | { kind: "reality_fact"; fact_id: string }
  | { kind: "constraint"; constraint_id: string };

export type NaSystemBasis =
  | { kind: "topic_not_applicable"; topic_code: string; rule_id: string }
  | {
      kind: "catalog_na_condition_met";
      target_dir_id: string;
      condition_eval_id: string;
    }
  | {
      kind: "empty_dir_source_absence";
      ddr_id: "DDR-03-CHART-APPENDIX";
      source_code: string;
      source_state: "source_absent_not_supplied";
      eval_id: string;
    };

export type ExplicitNaEvidence =
  | {
      evidence_id: string;
      target: "dir";
      dir_id: string;
      na_condition_code: string;
      evidence_type: "user_explicit_na";
      source_ref: NaSourceRef;
      written_by: "code";
      revoked: boolean;
    }
  | {
      evidence_id: string;
      target: "dir";
      dir_id: string;
      na_condition_code: string;
      evidence_type: "system_na_marker";
      system_basis: NaSystemBasis;
      written_by: "code";
      revoked: boolean;
    }
  | {
      evidence_id: string;
      target: "ddr";
      ddr_id: "DDR-03-CHART-APPENDIX";
      na_condition_code: string;
      evidence_type: "user_explicit_na";
      source_ref: NaSourceRef;
      written_by: "code";
      revoked: boolean;
    }
  | {
      evidence_id: string;
      target: "ddr";
      ddr_id: "DDR-03-CHART-APPENDIX";
      na_condition_code: string;
      evidence_type: "system_na_marker";
      system_basis: NaSystemBasis;
      written_by: "code";
      revoked: boolean;
    };

/**
 * Persisted user-declared N/A intent classification (R6 Final Binding §3 / US §2.7 A3).
 * Distinct from ConfirmationEvent (E1) — E1 alone never proves N/A declaration.
 * Not a new E1/E2 event type. Model / keyword / embedding must never set authority.
 */
export type ExplicitNaClassification = {
  classification_id: string;
  /** Must equal current DC.context_id. */
  context_id: string;
  source_ref: NaSourceRef;
  dir_id: string;
  na_condition_code: string;
  /** Only user_declared is Gate-affecting. */
  authority: "user_declared";
  written_by: "code";
  /** User N/A declaration action id — not confirm_fact / confirm_constraint. */
  declaration_action_id: string;
  declaration_turn_id: string;
  revoked: boolean;
  /** ISO-8601; null = no expiry. Expired at validate time → reject. */
  expires_at: string | null;
  created_at: string;
};

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
  /**
   * Intake 2.0 ExplicitNaEvidence (DIR/DDR-level). Absent on legacy DC → treat as [].
   * Included in content_hash (R6 / C5).
   */
  explicit_na_evidence?: ExplicitNaEvidence[];
  /**
   * Persisted user-declared N/A classifications (not E1). Required proof for
   * user_explicit_na. Included in content_hash.
   */
  explicit_na_classifications?: ExplicitNaClassification[];
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