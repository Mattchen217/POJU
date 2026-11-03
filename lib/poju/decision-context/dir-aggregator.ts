/**
 * Multi-Fact aggregation → DIR.current_state.
 * Single Fact only scores contribution; aggregation has highest priority.
 * Agenda covered is irrelevant here.
 */

import type {
  Conflict,
  DIR,
  DirCurrentState,
  RealityFact,
} from "./types";

export interface FactContribution {
  fact_id: string;
  roles_matched: string[];
  contributes: boolean;
}

export interface DirAggregationResult {
  dir_id: string;
  current_state: DirCurrentState;
  partial_satisfaction: boolean;
  contributions: FactContribution[];
  reason: string;
}

function factMatchesRole(fact: RealityFact, role: string): boolean {
  const roles = fact.fact_roles ?? [];
  if (roles.includes(role)) return true;
  // Soft match: role string contained in statement (conservative contribution only).
  if (role.startsWith("agenda:") || role.startsWith("goal:")) {
    return roles.some((r) => r === role) || false;
  }
  return roles.includes(role);
}

function isOpenConflictAffecting(
  conflicts: Conflict[],
  factIds: Set<string>,
): boolean {
  return conflicts.some(
    (c) =>
      (c.state === "open" || c.state === "unresolved_in_final") &&
      c.fact_ids.some((id) => factIds.has(id)),
  );
}

/**
 * Score one Fact's contribution to a DIR (does NOT set DIR.known by itself).
 */
export function scoreFactContribution(
  dir: DIR,
  fact: RealityFact,
): FactContribution {
  const roles_matched = (dir.required_fact_roles ?? []).filter((role) =>
    factMatchesRole(fact, role),
  );
  const linked =
    (fact.related_dir_ids ?? []).includes(dir.dir_id) || roles_matched.length > 0;
  return {
    fact_id: fact.fact_id,
    roles_matched,
    contributes: linked && fact.status !== "declined" && fact.status !== "unknown",
  };
}

/**
 * Aggregate DIR state from required_fact_roles + Facts + Conflicts.
 * Priority rules (Eng SoT §3):
 * - affecting open conflict → conflict
 * - all required roles N/A → n_a
 * - all required roles satisfied by confirmed facts → known
 * - some info but missing confirmed required → unknown + partial_satisfaction
 * - else unknown
 */
export function aggregateDirState(
  dir: DIR,
  facts: RealityFact[],
  conflicts: Conflict[] = [],
): DirAggregationResult {
  const contributions = facts.map((f) => scoreFactContribution(dir, f));
  const contributingFacts = facts.filter((f, i) => contributions[i]?.contributes);
  const contributingIds = new Set(contributingFacts.map((f) => f.fact_id));

  if (isOpenConflictAffecting(conflicts, contributingIds)) {
    return {
      dir_id: dir.dir_id,
      current_state: "conflict",
      partial_satisfaction: contributingFacts.length > 0,
      contributions,
      reason: "open_or_unresolved_conflict_among_contributing_facts",
    };
  }

  const roles = dir.required_fact_roles ?? [];
  if (roles.length === 0) {
    // No roles: known only if at least one confirmed contributing fact explicitly linked.
    const anyConfirmed = contributingFacts.some((f) => f.status === "confirmed");
    if (anyConfirmed) {
      return {
        dir_id: dir.dir_id,
        current_state: "known",
        partial_satisfaction: false,
        contributions,
        reason: "no_roles_but_confirmed_contribution",
      };
    }
    return {
      dir_id: dir.dir_id,
      current_state: "unknown",
      partial_satisfaction: contributingFacts.length > 0,
      contributions,
      reason: "no_roles_and_no_confirmed_contribution",
    };
  }

  type RoleSat = "confirmed" | "partial" | "n_a" | "missing";
  const roleSats: RoleSat[] = roles.map((role) => {
    const matched = facts.filter((f) => factMatchesRole(f, role));
    if (matched.length === 0) return "missing";
    if (matched.every((f) => f.status === "not_applicable")) return "n_a";
    if (matched.some((f) => f.status === "confirmed")) return "confirmed";
    if (
      matched.some(
        (f) => f.status === "unverified" || f.status === "confirmed",
      )
    ) {
      return "partial";
    }
    return "missing";
  });

  if (roleSats.every((s) => s === "n_a")) {
    return {
      dir_id: dir.dir_id,
      current_state: "n_a",
      partial_satisfaction: false,
      contributions,
      reason: "all_required_roles_not_applicable",
    };
  }

  if (roleSats.every((s) => s === "confirmed" || s === "n_a") &&
      roleSats.some((s) => s === "confirmed")) {
    // All necessary non-N/A roles confirmed → known.
    // "部分 N/A，其他必要仍缺失" → unknown (handled by missing below).
    const necessary = roleSats.filter((s) => s !== "n_a");
    if (necessary.every((s) => s === "confirmed")) {
      return {
        dir_id: dir.dir_id,
        current_state: "known",
        partial_satisfaction: false,
        contributions,
        reason: "all_necessary_roles_confirmed",
      };
    }
  }

  if (roleSats.every((s) => s === "confirmed")) {
    return {
      dir_id: dir.dir_id,
      current_state: "known",
      partial_satisfaction: false,
      contributions,
      reason: "all_required_roles_confirmed",
    };
  }

  const hasPartial =
    roleSats.some((s) => s === "confirmed" || s === "partial") ||
    contributingFacts.length > 0;
  const hasMissing = roleSats.some((s) => s === "missing" || s === "partial");

  if (hasPartial && hasMissing) {
    return {
      dir_id: dir.dir_id,
      current_state: "unknown",
      partial_satisfaction: true,
      contributions,
      reason: "partial_information_necessary_role_unconfirmed",
    };
  }

  return {
    dir_id: dir.dir_id,
    current_state: "unknown",
    partial_satisfaction: false,
    contributions,
    reason: "necessary_information_missing",
  };
}

/** Recompute all DIRs; returns new DIR array (immutable). */
export function reaggregateDirs(
  dirs: DIR[],
  facts: RealityFact[],
  conflicts: Conflict[] = [],
): DIR[] {
  return dirs.map((dir) => {
    if (dir.id_lifecycle === "deprecated") return dir;
    const result = aggregateDirState(dir, facts, conflicts);
    return {
      ...dir,
      current_state: result.current_state,
      partial_satisfaction: result.partial_satisfaction,
      satisfaction: result.reason,
    };
  });
}
