/**
 * Intake 2.0 DIR aggregation via shared role-resolver (R6 Final Binding).
 * Production legacy callers keep using dir-aggregator.ts until migrated.
 */

import {
  findValidDirLevelNa,
  resolveDirRoleEvidence,
  type RoleEvidenceState,
} from "./role-resolver";
import { conflictAffectsPreferredPath } from "./stop-criteria";
import type {
  Conflict,
  Constraint,
  DIR,
  DirCurrentState,
  ExplicitNaEvidence,
  RealityFact,
} from "./types";

export type IntakeAggregationResult = {
  dir_id: string;
  current_state: DirCurrentState;
  partial_satisfaction: boolean;
  role_states: Record<string, RoleEvidenceState>;
  reason: string;
};

function dirHasBlockingConflict(
  dir: DIR,
  facts: RealityFact[],
  conflicts: Conflict[],
): boolean {
  const linkedIds = new Set(
    facts
      .filter((f) => (f.related_dir_ids ?? []).includes(dir.dir_id))
      .map((f) => f.fact_id),
  );
  return conflicts.some(
    (c) =>
      (c.state === "open" || c.state === "unresolved_in_final") &&
      conflictAffectsPreferredPath(c) &&
      c.fact_ids.some((id) => linkedIds.has(id)),
  );
}

/**
 * Aggregate one DIR using Final Binding §2.4:
 * conflict > DIR-level n_a > all roles confirmed → known > else unknown.
 * Partial role support → unknown + partial_satisfaction; no DIR `partial` state.
 */
export function aggregateDirStateIntake(
  dir: DIR,
  facts: RealityFact[],
  conflicts: Conflict[] = [],
  constraints: Constraint[] = [],
  explicitNaEvidence: ExplicitNaEvidence[] = [],
): IntakeAggregationResult {
  const roles = dir.required_fact_roles ?? [];
  const role_states: Record<string, RoleEvidenceState> = {};

  if (dirHasBlockingConflict(dir, facts, conflicts)) {
    return {
      dir_id: dir.dir_id,
      current_state: "conflict",
      partial_satisfaction: false,
      role_states,
      reason: "blocking_conflict",
    };
  }

  const dirNa = findValidDirLevelNa(dir.dir_id, explicitNaEvidence);
  if (dirNa) {
    for (const r of roles) role_states[r] = "n_a";
    return {
      dir_id: dir.dir_id,
      current_state: "n_a",
      partial_satisfaction: false,
      role_states,
      reason: "dir_level_na",
    };
  }

  if (roles.length === 0) {
    // Preserve Phase 1: zero roles not auto n_a.
    return {
      dir_id: dir.dir_id,
      current_state: "unknown",
      partial_satisfaction: false,
      role_states,
      reason: "no_required_roles",
    };
  }

  let anyPartial = false;
  for (const roleCode of roles) {
    const result = resolveDirRoleEvidence({
      dir,
      roleCode,
      realityFacts: facts,
      constraints,
      explicitNaEvidence,
      conflicts,
    });
    role_states[roleCode] = result.state;
    if (result.state === "conflict") {
      return {
        dir_id: dir.dir_id,
        current_state: "conflict",
        partial_satisfaction: false,
        role_states,
        reason: "role_blocking_conflict",
      };
    }
    if (result.state === "partial") anyPartial = true;
  }

  const values = Object.values(role_states);
  if (values.every((s) => s === "confirmed")) {
    return {
      dir_id: dir.dir_id,
      current_state: "known",
      partial_satisfaction: false,
      role_states,
      reason: "all_roles_confirmed",
    };
  }

  return {
    dir_id: dir.dir_id,
    current_state: "unknown",
    partial_satisfaction: anyPartial || values.some((s) => s === "confirmed"),
    role_states,
    reason: "roles_incomplete",
  };
}

export function reaggregateDirsIntake(
  dirs: DIR[],
  facts: RealityFact[],
  conflicts: Conflict[] = [],
  constraints: Constraint[] = [],
  explicitNaEvidence: ExplicitNaEvidence[] = [],
): DIR[] {
  return dirs.map((dir) => {
    if (dir.id_lifecycle === "deprecated") return dir;
    const result = aggregateDirStateIntake(
      dir,
      facts,
      conflicts,
      constraints,
      explicitNaEvidence,
    );
    return {
      ...dir,
      current_state: result.current_state,
      partial_satisfaction: result.partial_satisfaction,
      satisfaction: result.reason,
    };
  });
}
