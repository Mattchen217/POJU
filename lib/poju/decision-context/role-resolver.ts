/**
 * Intake 2.0 shared DIR role resolver (R6 + Final Binding Resolution).
 * Question Planning and Intake DIR aggregation MUST import this module only.
 * AND association — no OR fallback with legacy dir-aggregator scoreFactContribution.
 */

import {
  findValidatedDirLevelNa,
  type NaValidationContext,
} from "./explicit-na-validate";
import { isLegalFactCombination } from "./fact-combination";
import { conflictAffectsPreferredPath } from "./stop-criteria";
import type {
  Conflict,
  Constraint,
  DIR,
  ExplicitNaEvidence,
  RealityFact,
} from "./types";

export type RoleEvidenceState =
  | "confirmed"
  | "partial"
  | "n_a"
  | "unresolved"
  | "conflict";

export type RoleResolution = {
  dir_id: string;
  role_code: string;
  state: RoleEvidenceState;
  contributing_fact_ids: string[];
  contributing_constraint_ids: string[];
  na_evidence_ids: string[];
  reason_code: string;
};

export type ResolveDirRoleInput = {
  dir: DIR;
  roleCode: string;
  realityFacts: RealityFact[];
  constraints: Constraint[];
  explicitNaEvidence: ExplicitNaEvidence[];
  conflicts: Conflict[];
  /**
   * Required for N/A to affect resolution. Without proofs, system/user N/A
   * markers fail closed and never derive n_a.
   */
  naValidation: NaValidationContext;
};

const CONSTRAINT_ROLES = new Set(["hard_constraint", "soft_constraint"]);

/** Empty catalog / proofs — fail-closed N/A (tests or callers that omit catalog). */
export function emptyNaValidation(
  overrides: Partial<NaValidationContext> = {},
): NaValidationContext {
  return {
    contextId: overrides.contextId ?? "",
    realityFacts: overrides.realityFacts ?? [],
    constraints: overrides.constraints ?? [],
    confirmationEvents: overrides.confirmationEvents ?? [],
    explicitNaClassifications: overrides.explicitNaClassifications ?? [],
    naDeclarationActions: overrides.naDeclarationActions ?? [],
    nowIso: overrides.nowIso,
    cfpSourceState: overrides.cfpSourceState,
    dirCatalog: overrides.dirCatalog,
    catalogConditionEvals: overrides.catalogConditionEvals,
    topicRules: overrides.topicRules,
  };
}

/** Parse `v1/dir/{dir_id}/role/{role_code}` or bare role_code (DIR implied by caller). */
export function parseFactRoleCode(
  code: string,
): { dir_id: string | null; role_code: string } | null {
  const m = /^v1\/dir\/([^/]+)\/role\/(.+)$/.exec(code);
  if (m) return { dir_id: m[1]!, role_code: m[2]! };
  if (code.length > 0 && !code.includes("/")) {
    return { dir_id: null, role_code: code };
  }
  return null;
}

function factHasRoleTag(fact: RealityFact, roleCode: string, dirId: string): boolean {
  const roles = fact.fact_roles ?? [];
  const namespaced = `v1/dir/${dirId}/role/${roleCode}`;
  return roles.includes(roleCode) || roles.includes(namespaced);
}

function factAssociatedToDir(fact: RealityFact, dirId: string): boolean {
  return (fact.related_dir_ids ?? []).includes(dirId);
}

/**
 * Final Binding §2.1 — association gate then status×VL×user_confirmed contribution.
 * confirmed+user_asserted contributes confirmed only when user_confirmed === true.
 * confirmed+independently_verified contributes confirmed with user_confirmed === false.
 */
function factContribution(
  fact: RealityFact,
  dirId: string,
  roleCode: string,
): "confirmed" | "partial" | null {
  if (!factAssociatedToDir(fact, dirId)) return null;
  if (!factHasRoleTag(fact, roleCode, dirId)) return null;
  if (!isLegalFactCombination(fact.status, fact.verification_level)) return null;

  if (fact.status === "confirmed" && fact.verification_level === "user_asserted") {
    if (fact.user_confirmed !== true) return null;
    return "confirmed";
  }
  if (
    fact.status === "confirmed" &&
    fact.verification_level === "independently_verified"
  ) {
    // Derived contract: independently_verified must keep user_confirmed === false.
    if (fact.user_confirmed !== false) return null;
    return "confirmed";
  }
  if (
    fact.status === "unverified" &&
    (fact.verification_level === "user_asserted" ||
      fact.verification_level === "user_estimate")
  ) {
    return "partial";
  }
  return null;
}

function constraintContribution(
  c: Constraint,
  dirId: string,
  roleCode: string,
): "confirmed" | null {
  if (!CONSTRAINT_ROLES.has(roleCode)) return null;
  if (roleCode === "hard_constraint" && c.rigidity !== "hard") return null;
  if (roleCode === "soft_constraint" && c.rigidity !== "soft") return null;
  if (!(c.related_dir_ids ?? []).includes(dirId)) return null;
  if (c.status !== "confirmed") return null;
  if (!isLegalFactCombination(c.status, c.verification_level)) return null;
  if (c.verification_level === "user_asserted" && c.user_confirmed !== true) {
    return null;
  }
  if (
    c.verification_level === "independently_verified" &&
    c.user_confirmed !== false
  ) {
    return null;
  }
  return "confirmed";
}

function blockingConflictForDir(
  conflicts: Conflict[],
  evidenceFactIds: string[],
): boolean {
  const set = new Set(evidenceFactIds);
  return conflicts.some(
    (c) =>
      (c.state === "open" || c.state === "unresolved_in_final") &&
      conflictAffectsPreferredPath(c) &&
      c.fact_ids.some((id) => set.has(id)),
  );
}

/**
 * Shared role resolver. N/A is DIR-level only and only when fully validated.
 * When DIR has a validated N/A marker, every required role is derived as n_a.
 */
export function resolveDirRoleEvidence(input: ResolveDirRoleInput): RoleResolution {
  const {
    dir,
    roleCode,
    realityFacts,
    constraints,
    explicitNaEvidence,
    conflicts,
    naValidation,
  } = input;
  const dirId = dir.dir_id;

  const associatedFactIds: string[] = [];
  for (const f of realityFacts) {
    if (factAssociatedToDir(f, dirId) && factHasRoleTag(f, roleCode, dirId)) {
      associatedFactIds.push(f.fact_id);
    }
  }

  if (blockingConflictForDir(conflicts, associatedFactIds)) {
    return {
      dir_id: dirId,
      role_code: roleCode,
      state: "conflict",
      contributing_fact_ids: associatedFactIds,
      contributing_constraint_ids: [],
      na_evidence_ids: [],
      reason_code: "blocking_conflict",
    };
  }

  const validationCtx: NaValidationContext = {
    ...naValidation,
    realityFacts:
      naValidation.realityFacts.length > 0
        ? naValidation.realityFacts
        : realityFacts,
    constraints:
      naValidation.constraints.length > 0
        ? naValidation.constraints
        : constraints,
  };

  const dirNa = findValidatedDirLevelNa(
    dirId,
    explicitNaEvidence,
    validationCtx,
  );
  if (dirNa) {
    return {
      dir_id: dirId,
      role_code: roleCode,
      state: "n_a",
      contributing_fact_ids: [],
      contributing_constraint_ids: [],
      na_evidence_ids: [dirNa.evidence_id],
      reason_code: "dir_level_na_derived",
    };
  }

  const confirmedFactIds: string[] = [];
  const partialFactIds: string[] = [];
  for (const f of realityFacts) {
    const c = factContribution(f, dirId, roleCode);
    if (c === "confirmed") confirmedFactIds.push(f.fact_id);
    else if (c === "partial") partialFactIds.push(f.fact_id);
  }

  const confirmedConstraintIds: string[] = [];
  for (const k of constraints) {
    if (constraintContribution(k, dirId, roleCode) === "confirmed") {
      confirmedConstraintIds.push(k.constraint_id);
    }
  }

  if (confirmedFactIds.length > 0 || confirmedConstraintIds.length > 0) {
    return {
      dir_id: dirId,
      role_code: roleCode,
      state: "confirmed",
      contributing_fact_ids: confirmedFactIds,
      contributing_constraint_ids: confirmedConstraintIds,
      na_evidence_ids: [],
      reason_code: "confirmed_evidence",
    };
  }

  if (partialFactIds.length > 0) {
    return {
      dir_id: dirId,
      role_code: roleCode,
      state: "partial",
      contributing_fact_ids: partialFactIds,
      contributing_constraint_ids: [],
      na_evidence_ids: [],
      reason_code: "partial_evidence",
    };
  }

  return {
    dir_id: dirId,
    role_code: roleCode,
    state: "unresolved",
    contributing_fact_ids: [],
    contributing_constraint_ids: [],
    na_evidence_ids: [],
    reason_code: "unresolved",
  };
}

/** Planner: role counts as resolved iff confirmed or derived n_a. */
export function isRoleResolvedForPlanning(state: RoleEvidenceState): boolean {
  return state === "confirmed" || state === "n_a";
}

/**
 * @deprecated Prefer question-planning.computeUnresolvedCount — kept as thin
 * re-export path used by early vertical-slice tests.
 */
export function unresolvedRoleCountForCandidate(args: {
  factRoleCodes: string[];
  dirsById: Map<string, DIR>;
  realityFacts: RealityFact[];
  constraints: Constraint[];
  explicitNaEvidence: ExplicitNaEvidence[];
  conflicts: Conflict[];
  naValidation?: NaValidationContext;
}): number {
  const unique = [...new Set(args.factRoleCodes)];
  const naValidation =
    args.naValidation ??
    emptyNaValidation({
      realityFacts: args.realityFacts,
      constraints: args.constraints,
    });
  let unresolved = 0;
  for (const code of unique) {
    const parsed = parseFactRoleCode(code);
    if (!parsed) {
      unresolved += 1;
      continue;
    }
    const dirId = parsed.dir_id;
    if (!dirId) {
      unresolved += 1;
      continue;
    }
    const dir = args.dirsById.get(dirId);
    if (!dir) {
      unresolved += 1;
      continue;
    }
    const result = resolveDirRoleEvidence({
      dir,
      roleCode: parsed.role_code,
      realityFacts: args.realityFacts,
      constraints: args.constraints,
      explicitNaEvidence: args.explicitNaEvidence,
      conflicts: args.conflicts,
      naValidation,
    });
    if (!isRoleResolvedForPlanning(result.state)) unresolved += 1;
  }
  return unresolved;
}
