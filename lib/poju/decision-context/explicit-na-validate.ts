/**
 * Fail-closed ExplicitNaEvidence validation (R6 Final Binding §1 / §3).
 * Structural + E1 gates; catalog condition catalogs wired later with Phase 2 seeds.
 */

import type {
  ConfirmationEvent,
} from "./confirmation-event";
import type {
  Constraint,
  ExplicitNaEvidence,
  RealityFact,
} from "./types";

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
};

export type NaValidationResult =
  | { ok: true; evidence: ExplicitNaEvidence }
  | { ok: false; reason_code: string };

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

/**
 * Validate a candidate ExplicitNaEvidence record before persist / Gate effect.
 * Does not authorize via model semantics.
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
    if (evidence.evidence_type === "system_na_marker") {
      const b = evidence.system_basis;
      if (b.kind !== "empty_dir_source_absence") {
        return { ok: false, reason_code: "ddr03_basis_kind" };
      }
      if (b.ddr_id !== "DDR-03-CHART-APPENDIX") {
        return { ok: false, reason_code: "ddr03_basis_ddr" };
      }
      if (b.source_state !== "source_absent_not_supplied") {
        return { ok: false, reason_code: "ddr03_basis_state" };
      }
    }
  }

  if (evidence.target === "dir" && evidence.evidence_type === "system_na_marker") {
    const b = evidence.system_basis;
    if (b.kind === "empty_dir_source_absence") {
      return { ok: false, reason_code: "empty_dir_basis_not_for_dir_target" };
    }
    if (b.kind === "catalog_na_condition_met" && b.target_dir_id !== evidence.dir_id) {
      return { ok: false, reason_code: "catalog_basis_dir_mismatch" };
    }
  }

  if (evidence.evidence_type === "user_explicit_na") {
    return validateUserSource(evidence, ctx);
  }

  // system_na_marker structural OK above; catalog re-eval wired with Phase 2 seeds later
  return { ok: true, evidence };
}

/** Filter to live Gate-affecting DIR markers only. */
export function liveDirNaEvidence(
  all: ExplicitNaEvidence[] | undefined,
): ExplicitNaEvidence[] {
  return (all ?? []).filter(
    (e) => !e.revoked && e.written_by === "code" && e.target === "dir",
  );
}
