/**
 * Fail-closed ExplicitNaEvidence validation (R6 Final Binding §1 / §3 · US §2.7).
 * user_explicit_na requires ExplicitNaClassification bound to a live UserNaDeclarationAction.
 * E1 ConfirmationEvent never substitutes for N/A declaration.
 */

import type { ConfirmationEvent } from "./confirmation-event";
import {
  checkExpiresAt,
  isAllowedNaControlId,
  parseValidIsoMs,
  sourceRefEquals,
  type UserNaDeclarationAction,
} from "./na-declaration";
import {
  resolveAuthoritativeTopicEval,
  type AuthoritativeTopicEvalRecord,
} from "./topic-eval-authority";
import type {
  Constraint,
  ExplicitNaClassification,
  ExplicitNaEvidence,
  NaSystemBasis,
  RealityFact,
} from "./types";

/** Persisted deterministic evaluation of a DIR catalog na_condition. */
export type CatalogNaConditionEval = {
  condition_eval_id: string;
  target_dir_id: string;
  na_condition_code: string;
  condition_met: boolean;
  stale?: boolean;
  orphaned?: boolean;
};

/**
 * Live Topic Applicability evaluation — status must be explicitly "current".
 * Absence of stale/revoked flags is NOT treated as current.
 */
export type TopicApplicabilityEvaluation = {
  eval_id: string;
  evaluated_at: string;
  /** Only "current" may authorize N/A. */
  status: "current" | "stale" | "superseded" | "revoked";
  not_applicable: boolean;
  expires_at: string | null;
  catalog_version: string;
};

export type TopicApplicabilityRule = {
  rule_id: string;
  topic_code: string;
  target_dir_id: string;
  /** Required current evaluation record — missing ⇒ fail-closed. */
  evaluation: TopicApplicabilityEvaluation;
};

export type DirNaCatalogEntry = {
  dir_id: string;
  na_conditions: readonly string[];
};

export type NaValidationContext = {
  contextId: string;
  /** Current session id — action.session_id must match. */
  sessionId: string;
  realityFacts: RealityFact[];
  constraints: Constraint[];
  confirmationEvents: ConfirmationEvent[];
  explicitNaClassifications: ExplicitNaClassification[];
  /**
   * Persisted user N/A declaration actions (session SoT).
   * Classification.declaration_action_id must resolve here.
   */
  naDeclarationActions: UserNaDeclarationAction[];
  nowIso?: string;
  cfpSourceState?:
    | "source_ok"
    | "source_absent_not_supplied"
    | "source_calc_failed"
    | "source_provenance_missing";
  dirCatalog?: ReadonlyMap<string, DirNaCatalogEntry> | readonly DirNaCatalogEntry[];
  catalogConditionEvals?:
    | ReadonlyMap<string, CatalogNaConditionEval>
    | readonly CatalogNaConditionEval[];
  topicRules?:
    | ReadonlyMap<string, TopicApplicabilityRule>
    | readonly TopicApplicabilityRule[];
  /**
   * Authoritative topic eval rows keyed by eval_id.
   * Embedded evaluation.status alone is never sufficient.
   */
  topicEvalAuthority?:
    | ReadonlyMap<string, AuthoritativeTopicEvalRecord>
    | readonly AuthoritativeTopicEvalRecord[];
  /** Live Topic Applicability catalog version. */
  currentTopicCatalogVersion?: string;
};

export type NaValidationResult =
  | { ok: true; evidence: ExplicitNaEvidence }
  | { ok: false; reason_code: string };

function asMap<T extends { [K in Id]: string }, Id extends keyof T>(
  input: ReadonlyMap<string, T> | readonly T[] | undefined,
  idKey: Id,
): Map<string, T> {
  if (!input) return new Map();
  const m = new Map<string, T>();
  if (Array.isArray(input)) {
    for (const row of input) m.set(row[idKey], row);
    return m;
  }
  input.forEach((v, k) => {
    m.set(String(k), v);
  });
  return m;
}

function dirCatalogMap(
  ctx: NaValidationContext,
): Map<string, DirNaCatalogEntry> {
  if (!ctx.dirCatalog) return new Map();
  const m = new Map<string, DirNaCatalogEntry>();
  if (Array.isArray(ctx.dirCatalog)) {
    for (const row of ctx.dirCatalog) m.set(row.dir_id, row);
    return m;
  }
  ctx.dirCatalog.forEach((v, k) => {
    m.set(String(k), v);
  });
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

function findDeclarationAction(
  ctx: NaValidationContext,
  actionId: string,
): UserNaDeclarationAction | null {
  return (
    ctx.naDeclarationActions.find((a) => a.declaration_action_id === actionId) ??
    null
  );
}

/**
 * Classification is Gate-affecting only when bound to a live, matching
 * UserNaDeclarationAction (not E1, not bare string ids).
 */
export function findMatchingNaClassification(
  evidence: ExplicitNaEvidence & { evidence_type: "user_explicit_na" },
  ctx: NaValidationContext,
): ExplicitNaClassification | null {
  const now = ctx.nowIso ?? new Date().toISOString();
  if (parseValidIsoMs(now) === null) return null;

  const dirId = evidence.target === "dir" ? evidence.dir_id : "";

  for (const row of ctx.explicitNaClassifications) {
    if (row.revoked) continue;
    if (row.written_by !== "code") continue;
    if (row.authority !== "user_declared") continue;
    if (row.context_id !== ctx.contextId) continue;

    const clsExpiry = checkExpiresAt(row.expires_at, now);
    if (clsExpiry === "invalid" || clsExpiry === true) continue;

    if (evidence.target === "dir" && row.dir_id !== dirId) continue;
    if (row.na_condition_code !== evidence.na_condition_code) continue;
    if (!sourceRefEquals(row.source_ref, evidence.source_ref)) continue;
    if (!row.declaration_action_id || !row.declaration_turn_id) continue;

    const action = findDeclarationAction(ctx, row.declaration_action_id);
    if (!action) continue;
    if (action.revoked) continue;
    if (action.actor !== "user") continue;
    if (action.context_id !== ctx.contextId) continue;
    if (action.session_id !== ctx.sessionId) continue;
    if (action.declaration_turn_id !== row.declaration_turn_id) continue;
    // Re-check allowlist at validate time (create-time check is not enough).
    if (!isAllowedNaControlId(action.control_id)) continue;

    const actExpiry = checkExpiresAt(action.expires_at, now);
    if (actExpiry === "invalid" || actExpiry === true) continue;

    // C09e — Classification and Action must share the same expires_at binding
    // (null/null equal; otherwise exact stored ISO string equality). Independent
    // "both not expired" is not sufficient.
    if (row.expires_at !== action.expires_at) continue;

    if (evidence.target === "dir" && action.dir_id !== dirId) continue;
    if (action.na_condition_code !== evidence.na_condition_code) continue;
    if (!sourceRefEquals(action.source_ref, evidence.source_ref)) continue;

    return row;
  }
  return null;
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

  const classification = findMatchingNaClassification(evidence, ctx);
  if (!classification) {
    return { ok: false, reason_code: "explicit_na_classification_missing" };
  }

  // C10a — Evidence ID must bind to the authorizing Action ID.
  const expectedEvidenceId = `na_ev_${classification.declaration_action_id}`;
  if (evidence.evidence_id !== expectedEvidenceId) {
    return { ok: false, reason_code: "evidence_id_action_mismatch" };
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
  if (rule.target_dir_id !== evidence.dir_id) {
    return { ok: false, reason_code: "topic_rule_dir_mismatch" };
  }

  const evaluation = rule.evaluation;
  if (!evaluation) {
    return { ok: false, reason_code: "topic_evaluation_missing" };
  }
  if (!evaluation.eval_id || !evaluation.catalog_version) {
    return { ok: false, reason_code: "topic_evaluation_incomplete" };
  }
  if (parseValidIsoMs(evaluation.evaluated_at) === null) {
    return { ok: false, reason_code: "topic_evaluation_time_invalid" };
  }
  // Embedded status is a hint only — authority lookup is mandatory.
  if (evaluation.status !== "current") {
    return { ok: false, reason_code: `topic_evaluation_${evaluation.status}` };
  }
  if (!evaluation.not_applicable) {
    return { ok: false, reason_code: "topic_still_applicable" };
  }

  const now = ctx.nowIso ?? new Date().toISOString();
  const authority = resolveAuthoritativeTopicEval({
    eval_id: evaluation.eval_id,
    rule_id: basis.rule_id,
    topic_code: basis.topic_code,
    target_dir_id: evidence.dir_id,
    claimed_catalog_version: evaluation.catalog_version,
    current_catalog_version: ctx.currentTopicCatalogVersion ?? "",
    authority: ctx.topicEvalAuthority,
    nowIso: now,
  });
  if (!authority.ok) {
    return { ok: false, reason_code: authority.reason_code };
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

export function liveValidatedDirNaEvidence(
  all: ExplicitNaEvidence[] | undefined,
  ctx: NaValidationContext,
): ExplicitNaEvidence[] {
  return (all ?? []).filter((e) => {
    if (e.target !== "dir") return false;
    return validateExplicitNaEvidence(e, ctx).ok;
  });
}
