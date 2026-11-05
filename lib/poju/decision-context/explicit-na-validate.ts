/**
 * Fail-closed ExplicitNaEvidence validation (R6 Final Binding §1 / §3 · US §2.7).
 * Surface fields alone never authorize N/A. Catalog / topic / E1 proofs must re-verify.
 */

import type { ConfirmationEvent } from "./confirmation-event";
import type {
  Constraint,
  ExplicitNaEvidence,
  NaSystemBasis,
  RealityFact,
} from "./types";

/** Persisted deterministic evaluation of a DIR catalog na_condition. */
export type CatalogNaConditionEval = {
  condition_eval_id: string;
  target_dir_id: string;
  na_condition_code: string;
  /** Live re-check result — must be true to accept. */
  condition_met: boolean;
  stale?: boolean;
  orphaned?: boolean;
};

/** Topic Applicability catalog rule (Phase 2). */
export type TopicApplicabilityRule = {
  rule_id: string;
  topic_code: string;
  /** Re-run: topic still not applicable for the target DIR. */
  not_applicable_for_dir: boolean;
};

/** DIR catalog slice needed for N/A condition membership. */
export type DirNaCatalogEntry = {
  dir_id: string;
  na_conditions: readonly string[];
};

export type NaValidationContext = {
  realityFacts: RealityFact[];
  constraints: Constraint[];
  /** Persisted E1 events for the session/DC. */
  confirmationEvents: ConfirmationEvent[];
  /** Live CFP state for DDR-03 path; omit if not chart-related. */
  cfpSourceState?:
    | "source_ok"
    | "source_absent_not_supplied"
    | "source_calc_failed"
    | "source_provenance_missing";
  /**
   * DIR catalog na_conditions. Absent/empty for a DIR ⇒ fail-closed
   * (cannot prove na_condition_code membership).
   */
  dirCatalog?: ReadonlyMap<string, DirNaCatalogEntry> | readonly DirNaCatalogEntry[];
  /**
   * Persisted catalog condition evaluations keyed by condition_eval_id.
   * Required to accept catalog_na_condition_met system markers.
   */
  catalogConditionEvals?:
    | ReadonlyMap<string, CatalogNaConditionEval>
    | readonly CatalogNaConditionEval[];
  /**
   * Topic Applicability rules keyed by rule_id.
   * Required to accept topic_not_applicable system markers.
   */
  topicRules?:
    | ReadonlyMap<string, TopicApplicabilityRule>
    | readonly TopicApplicabilityRule[];
};

export type NaValidationResult =
  | { ok: true; evidence: ExplicitNaEvidence }
  | { ok: false; reason_code: string };

function asMap<T extends { [K in Id]: string }, Id extends keyof T>(
  input: ReadonlyMap<string, T> | readonly T[] | undefined,
  idKey: Id,
): Map<string, T> {
  if (!input) return new Map();
  if (input instanceof Map) return new Map(input);
  const m = new Map<string, T>();
  for (const row of input) m.set(row[idKey], row);
  return m;
}

function dirCatalogMap(
  ctx: NaValidationContext,
): Map<string, DirNaCatalogEntry> {
  if (!ctx.dirCatalog) return new Map();
  if (ctx.dirCatalog instanceof Map) return new Map(ctx.dirCatalog);
  const m = new Map<string, DirNaCatalogEntry>();
  for (const row of ctx.dirCatalog) m.set(row.dir_id, row);
  return m;
}

function conditionInDirCatalog(
  ctx: NaValidationContext,
  dirId: string,
  code: string,
): boolean {
  const entry = dirCatalogMap(ctx).get(dirId);
  if (!entry) return false;
  return entry.na_conditions.includes(code);
}

function hasE1ForFact(
  events: ConfirmationEvent[],
  factId: string,
): boolean {
  return events.some(
    (e) =>
      e.target_type === "fact" &&
      e.event_type === "confirm_fact" &&
      e.actor === "user" &&
      e.fact_id === factId,
  );
}

function hasE1ForConstraint(
  events: ConfirmationEvent[],
  constraintId: string,
): boolean {
  return events.some(
    (e) =>
      e.target_type === "constraint" &&
      e.event_type === "confirm_constraint" &&
      e.actor === "user" &&
      e.constraint_id === constraintId,
  );
}

function validateUserSource(
  evidence: ExplicitNaEvidence & { evidence_type: "user_explicit_na" },
  ctx: NaValidationContext,
): NaValidationResult {
  if (evidence.target === "dir") {
    if (!conditionInDirCatalog(ctx, evidence.dir_id, evidence.na_condition_code)) {
      return { ok: false, reason_code: "na_condition_not_in_catalog" };
    }
  }

  const ref = evidence.source_ref;
  if (ref.kind === "reality_fact") {
    const fact = ctx.realityFacts.find((f) => f.fact_id === ref.fact_id);
    if (!fact) return { ok: false, reason_code: "source_missing" };
    if (fact.status !== "confirmed") {
      return { ok: false, reason_code: "source_not_confirmed" };
    }
    if (fact.verification_level === "independently_verified") {
      return { ok: false, reason_code: "independently_verified_not_user_explicit_na" };
    }
    if (fact.verification_level !== "user_asserted") {
      return { ok: false, reason_code: "source_not_user_asserted" };
    }
    if (!fact.user_confirmed) {
      return { ok: false, reason_code: "user_confirmed_false" };
    }
    if (!hasE1ForFact(ctx.confirmationEvents, fact.fact_id)) {
      return { ok: false, reason_code: "e1_missing" };
    }
    if (evidence.target === "dir") {
      if (!(fact.related_dir_ids ?? []).includes(evidence.dir_id)) {
        return { ok: false, reason_code: "source_dir_mismatch" };
      }
    }
    return { ok: true, evidence };
  }

  const constraint = ctx.constraints.find(
    (c) => c.constraint_id === ref.constraint_id,
  );
  if (!constraint) return { ok: false, reason_code: "source_missing" };
  if (constraint.status !== "confirmed") {
    return { ok: false, reason_code: "source_not_confirmed" };
  }
  if (constraint.verification_level !== "user_asserted") {
    return { ok: false, reason_code: "source_not_user_asserted" };
  }
  if (!constraint.user_confirmed) {
    return { ok: false, reason_code: "user_confirmed_false" };
  }
  if (!hasE1ForConstraint(ctx.confirmationEvents, constraint.constraint_id)) {
    return { ok: false, reason_code: "e1_missing" };
  }
  if (evidence.target === "dir") {
    if (!(constraint.related_dir_ids ?? []).includes(evidence.dir_id)) {
      return { ok: false, reason_code: "source_dir_mismatch" };
    }
  }
  return { ok: true, evidence };
}

function validateCatalogNaConditionMet(
  evidence: ExplicitNaEvidence & { target: "dir"; evidence_type: "system_na_marker" },
  basis: Extract<NaSystemBasis, { kind: "catalog_na_condition_met" }>,
  ctx: NaValidationContext,
): NaValidationResult {
  if (basis.target_dir_id !== evidence.dir_id) {
    return { ok: false, reason_code: "catalog_basis_dir_mismatch" };
  }
  if (!conditionInDirCatalog(ctx, evidence.dir_id, evidence.na_condition_code)) {
    return { ok: false, reason_code: "na_condition_not_in_catalog" };
  }
  const evals = asMap(ctx.catalogConditionEvals, "condition_eval_id");
  const row = evals.get(basis.condition_eval_id);
  if (!row) {
    return { ok: false, reason_code: "catalog_eval_missing" };
  }
  if (row.stale || row.orphaned) {
    return { ok: false, reason_code: "catalog_eval_stale_or_orphaned" };
  }
  if (row.target_dir_id !== evidence.dir_id) {
    return { ok: false, reason_code: "catalog_eval_dir_mismatch" };
  }
  if (row.na_condition_code !== evidence.na_condition_code) {
    return { ok: false, reason_code: "catalog_eval_condition_mismatch" };
  }
  if (!row.condition_met) {
    return { ok: false, reason_code: "catalog_condition_not_met" };
  }
  return { ok: true, evidence };
}

function validateTopicNotApplicable(
  evidence: ExplicitNaEvidence & { target: "dir"; evidence_type: "system_na_marker" },
  basis: Extract<NaSystemBasis, { kind: "topic_not_applicable" }>,
  ctx: NaValidationContext,
): NaValidationResult {
  if (!conditionInDirCatalog(ctx, evidence.dir_id, evidence.na_condition_code)) {
    return { ok: false, reason_code: "na_condition_not_in_catalog" };
  }
  const rules = asMap(ctx.topicRules, "rule_id");
  const rule = rules.get(basis.rule_id);
  if (!rule) {
    return { ok: false, reason_code: "topic_rule_missing" };
  }
  if (rule.topic_code !== basis.topic_code) {
    return { ok: false, reason_code: "topic_code_mismatch" };
  }
  if (!rule.not_applicable_for_dir) {
    return { ok: false, reason_code: "topic_still_applicable" };
  }
  return { ok: true, evidence };
}

function validateSystemMarker(
  evidence: ExplicitNaEvidence & { evidence_type: "system_na_marker" },
  ctx: NaValidationContext,
): NaValidationResult {
  const b = evidence.system_basis;

  if (evidence.target === "dir") {
    if (b.kind === "empty_dir_source_absence") {
      return { ok: false, reason_code: "empty_dir_basis_not_for_dir_target" };
    }
    if (b.kind === "catalog_na_condition_met") {
      return validateCatalogNaConditionMet(evidence, b, ctx);
    }
    if (b.kind === "topic_not_applicable") {
      return validateTopicNotApplicable(evidence, b, ctx);
    }
    return { ok: false, reason_code: "system_basis_unproven" };
  }

  // target=ddr — only empty_dir_source_absence on DDR-03 (checked upstream)
  if (b.kind !== "empty_dir_source_absence") {
    return { ok: false, reason_code: "ddr_system_basis_kind" };
  }
  if (b.ddr_id !== "DDR-03-CHART-APPENDIX") {
    return { ok: false, reason_code: "ddr03_basis_ddr" };
  }
  if (b.source_state !== "source_absent_not_supplied") {
    return { ok: false, reason_code: "ddr03_basis_state" };
  }
  if (!b.source_code || !b.eval_id) {
    return { ok: false, reason_code: "ddr03_basis_incomplete" };
  }
  return { ok: true, evidence };
}

/**
 * Validate a candidate ExplicitNaEvidence record before persist / Gate effect.
 * Does not authorize via model semantics or written_by alone.
 */
export function validateExplicitNaEvidence(
  evidence: ExplicitNaEvidence,
  ctx: NaValidationContext,
): NaValidationResult {
  if (evidence.written_by !== "code") {
    return { ok: false, reason_code: "not_code_authored" };
  }
  if (evidence.revoked) {
    return { ok: false, reason_code: "revoked" };
  }

  if (evidence.target === "ddr") {
    if (evidence.ddr_id !== "DDR-03-CHART-APPENDIX") {
      return { ok: false, reason_code: "ddr_not_allowlisted" };
    }
    if (ctx.cfpSourceState === "source_calc_failed") {
      return { ok: false, reason_code: "ddr03_calc_failed_no_na" };
    }
    if (ctx.cfpSourceState === "source_provenance_missing") {
      return { ok: false, reason_code: "ddr03_provenance_missing_no_na" };
    }
    if (ctx.cfpSourceState !== "source_absent_not_supplied") {
      return { ok: false, reason_code: "ddr03_cfp_not_absent" };
    }
  }

  if (evidence.evidence_type === "user_explicit_na") {
    return validateUserSource(evidence, ctx);
  }

  return validateSystemMarker(evidence, ctx);
}

/**
 * Return the first fully-validated live DIR-level N/A marker for dirId.
 * Surface-only markers (revoked/stale/unproven/mismatched) never qualify.
 */
export function findValidatedDirLevelNa(
  dirId: string,
  evidence: ExplicitNaEvidence[] | undefined,
  ctx: NaValidationContext,
): ExplicitNaEvidence | null {
  for (const e of evidence ?? []) {
    if (e.target !== "dir") continue;
    if (e.dir_id !== dirId) continue;
    const result = validateExplicitNaEvidence(e, ctx);
    if (result.ok) return result.evidence;
  }
  return null;
}

/** Filter candidates that pass full validation for Gate / aggregation. */
export function liveValidatedDirNaEvidence(
  all: ExplicitNaEvidence[] | undefined,
  ctx: NaValidationContext,
): ExplicitNaEvidence[] {
  return (all ?? []).filter((e) => {
    if (e.target !== "dir") return false;
    return validateExplicitNaEvidence(e, ctx).ok;
  });
}
