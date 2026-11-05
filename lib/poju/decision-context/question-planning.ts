/**
 * Intake 2.0 Question Planning — gain / unresolved_count path (R6 Final Binding §2.5).
 * MUST call resolveDirRoleEvidence; must not reimplement role matching.
 */

import type { NaValidationContext } from "./explicit-na-validate";
import {
  emptyNaValidation,
  isRoleResolvedForPlanning,
  parseFactRoleCode,
  resolveDirRoleEvidence,
  type RoleEvidenceState,
  type RoleResolution,
} from "./role-resolver";
import type {
  Conflict,
  Constraint,
  DecisionContext,
  DIR,
  ExplicitNaEvidence,
  RealityFact,
} from "./types";

export type GapType =
  | "unknown"
  | "partial"
  | "conflict"
  | "declined"
  | "source_pending";

export type CandidateQuestionKind = "dir_based" | "source_only";

/** Minimal CandidateQuestion fields required for gain / unresolved scoring. */
export type PlanningCandidate = {
  candidate_id: string;
  kind: CandidateQuestionKind;
  dir_ids: string[];
  ddr_ids: string[];
  fact_role_codes: string[];
  source_code?: string;
  impact: {
    decision_critical: boolean;
    may_affect_p5_ranking: boolean;
    gate_class: "P0" | "P1" | "P2";
  };
};

export type PlanningDcSnapshot = {
  dirs: DIR[];
  reality_facts: RealityFact[];
  constraints: Constraint[];
  conflicts: Conflict[];
  explicit_na_evidence?: ExplicitNaEvidence[];
};

export type SoftGateSnapshot = {
  verdict: "PASS" | "WARN" | "FAIL";
};

export type CandidateScore = {
  candidate_id: string;
  gap_type: GapType;
  unresolved_count: number;
  role_states: RoleResolution[];
  information_gain_est: number;
  attributable_fail: boolean;
};

function dirsById(dirs: DIR[]): Map<string, DIR> {
  return new Map(dirs.map((d) => [d.dir_id, d]));
}

function resolveNaValidation(
  snap: PlanningDcSnapshot,
  naValidation?: NaValidationContext,
): NaValidationContext {
  if (!naValidation) {
    return emptyNaValidation({
      realityFacts: snap.reality_facts,
      constraints: snap.constraints,
    });
  }
  return {
    ...naValidation,
    realityFacts:
      naValidation.realityFacts.length > 0
        ? naValidation.realityFacts
        : snap.reality_facts,
    constraints:
      naValidation.constraints.length > 0
        ? naValidation.constraints
        : snap.constraints,
  };
}

/**
 * Actual Planner unresolved_count path — calls shared resolveDirRoleEvidence.
 * source_only → 0 (Planning §2.1.2).
 */
export function computeUnresolvedCount(
  candidate: PlanningCandidate,
  snap: PlanningDcSnapshot,
  naValidation?: NaValidationContext,
): { unresolved_count: number; role_states: RoleResolution[] } {
  if (candidate.kind === "source_only") {
    return { unresolved_count: 0, role_states: [] };
  }

  const validation = resolveNaValidation(snap, naValidation);
  const byId = dirsById(snap.dirs);
  const unique = [...new Set(candidate.fact_role_codes)];
  const role_states: RoleResolution[] = [];
  let unresolved = 0;

  for (const code of unique) {
    const parsed = parseFactRoleCode(code);
    if (!parsed?.dir_id) {
      unresolved += 1;
      role_states.push({
        dir_id: parsed?.dir_id ?? "",
        role_code: parsed?.role_code ?? code,
        state: "unresolved",
        contributing_fact_ids: [],
        contributing_constraint_ids: [],
        na_evidence_ids: [],
        reason_code: "unparseable_role_code",
      });
      continue;
    }
    const dir = byId.get(parsed.dir_id);
    if (!dir) {
      unresolved += 1;
      role_states.push({
        dir_id: parsed.dir_id,
        role_code: parsed.role_code,
        state: "unresolved",
        contributing_fact_ids: [],
        contributing_constraint_ids: [],
        na_evidence_ids: [],
        reason_code: "dir_missing",
      });
      continue;
    }
    const result = resolveDirRoleEvidence({
      dir,
      roleCode: parsed.role_code,
      realityFacts: snap.reality_facts,
      constraints: snap.constraints,
      explicitNaEvidence: snap.explicit_na_evidence ?? [],
      conflicts: snap.conflicts,
      naValidation: validation,
    });
    role_states.push(result);
    if (!isRoleResolvedForPlanning(result.state)) unresolved += 1;
  }

  return { unresolved_count: unresolved, role_states };
}

/** Derive gap_type per Planning §2.1.1 using shared role states. */
export function deriveGapType(
  candidate: PlanningCandidate,
  roleStates: RoleResolution[],
  snap: PlanningDcSnapshot,
): GapType {
  if (candidate.kind === "source_only") return "source_pending";

  const byId = dirsById(snap.dirs);
  for (const dirId of candidate.dir_ids) {
    const dir = byId.get(dirId);
    if (dir?.current_state === "conflict") return "conflict";
  }
  if (roleStates.some((r) => r.state === "conflict")) return "conflict";

  const openConflictHits = snap.conflicts.some(
    (c) =>
      (c.state === "open" || c.state === "unresolved_in_final") &&
      candidate.dir_ids.some((dirId) => {
        const linked = snap.reality_facts
          .filter((f) => (f.related_dir_ids ?? []).includes(dirId))
          .map((f) => f.fact_id);
        return c.fact_ids.some((id) => linked.includes(id));
      }),
  );
  if (openConflictHits) return "conflict";

  const allDeclined =
    roleStates.length > 0 &&
    roleStates.every((r) => {
      const facts = snap.reality_facts.filter(
        (f) =>
          (f.related_dir_ids ?? []).includes(r.dir_id) &&
          (f.fact_roles ?? []).includes(r.role_code),
      );
      return facts.length > 0 && facts.every((f) => f.status === "declined");
    });
  if (allDeclined) return "declined";

  const resolved = roleStates.filter((r) => isRoleResolvedForPlanning(r.state));
  const unresolved = roleStates.filter((r) => !isRoleResolvedForPlanning(r.state));
  if (resolved.length >= 1 && unresolved.length >= 1) return "partial";
  return "unknown";
}

/**
 * Soft Gate FAIL attribution (Planning §2.1.3) — P0 DDR incomplete.
 * Caller supplies whether any candidate DDR is a failing P0; this flag is boolean once.
 */
export function attributableFail(
  softGate: SoftGateSnapshot | undefined,
  candidate: PlanningCandidate,
  p0DdrIncomplete: boolean,
): boolean {
  if (!softGate || softGate.verdict !== "FAIL") return false;
  if (!p0DdrIncomplete) return false;
  return candidate.ddr_ids.length > 0;
}

/** information_gain_est — Planning §2.1.4; unresolved_count from shared resolver. */
export function computeInformationGainEst(args: {
  unresolved_count: number;
  gap_type: GapType;
  impact: PlanningCandidate["impact"];
  attributable_fail: boolean;
  kind: CandidateQuestionKind;
  p0SourceNotOk: boolean;
}): number {
  let gain = 0;
  gain += 3 * args.unresolved_count;
  if (args.gap_type === "conflict") gain += 4;
  if (args.gap_type === "partial") gain += 2;
  if (args.impact.decision_critical || args.impact.may_affect_p5_ranking) {
    gain += 5;
  }
  if (args.attributable_fail) gain += 2;
  if (args.kind === "source_only" && args.p0SourceNotOk) gain += 6;
  return gain;
}

/**
 * Score one candidate — the Planner call path that Aggregator consistency
 * tests compare against. Always resolves roles via resolveDirRoleEvidence.
 */
export function scorePlanningCandidate(
  candidate: PlanningCandidate,
  snap: PlanningDcSnapshot,
  options: {
    naValidation?: NaValidationContext;
    softGate?: SoftGateSnapshot;
    p0DdrIncomplete?: boolean;
    p0SourceNotOk?: boolean;
  } = {},
): CandidateScore {
  const { unresolved_count, role_states } = computeUnresolvedCount(
    candidate,
    snap,
    options.naValidation,
  );
  const gap_type = deriveGapType(candidate, role_states, snap);
  const attributable_fail = attributableFail(
    options.softGate,
    candidate,
    options.p0DdrIncomplete === true,
  );
  const information_gain_est = computeInformationGainEst({
    unresolved_count,
    gap_type,
    impact: candidate.impact,
    attributable_fail,
    kind: candidate.kind,
    p0SourceNotOk: options.p0SourceNotOk === true,
  });

  return {
    candidate_id: candidate.candidate_id,
    gap_type,
    unresolved_count,
    role_states,
    information_gain_est,
    attributable_fail,
  };
}

/** Build PlanningDcSnapshot from a DecisionContext. */
export function snapshotFromDc(dc: DecisionContext): PlanningDcSnapshot {
  return {
    dirs: dc.dirs,
    reality_facts: dc.reality_facts,
    constraints: dc.constraints,
    conflicts: dc.conflicts,
    explicit_na_evidence: dc.explicit_na_evidence,
  };
}

/**
 * Compare Planner role states vs Aggregator role_states for the same DIR.
 * Returns mismatched role codes (empty = consistent).
 */
export function plannerAggregatorRoleMismatches(args: {
  dir: DIR;
  plannerRoleStates: RoleResolution[];
  aggregatorRoleStates: Record<string, RoleEvidenceState>;
}): string[] {
  const mismatches: string[] = [];
  for (const role of args.dir.required_fact_roles) {
    const planner = args.plannerRoleStates.find(
      (r) => r.dir_id === args.dir.dir_id && r.role_code === role,
    );
    const agg = args.aggregatorRoleStates[role];
    if (!planner || !agg || planner.state !== agg) {
      mismatches.push(role);
    }
  }
  return mismatches;
}
