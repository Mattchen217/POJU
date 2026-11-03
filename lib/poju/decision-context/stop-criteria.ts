/**
 * Decision sufficiency stop-criteria (replaces old Gate decision power).
 * turn counts / agenda covered / PUSH_GATE are NOT sufficiency.
 */

import type { DecisionContext, DIR } from "./types";

export interface SufficiencyOptions {
  /** Hard-push is urge-only; never alone sufficient (C4 / H3). */
  userHardPush?: boolean;
  /** Critical DIR ids; default = dirs with may_affect_p5_ranking or all dirs. */
  criticalDirIds?: string[];
}

export type SufficiencyVerdict =
  | "sufficient"
  | "continue_collecting"
  | "sufficient_with_boundaries";

export interface DecisionSufficiencyResult {
  verdict: SufficiencyVerdict;
  canStop: boolean;
  reasons: string[];
  blocking_dir_ids: string[];
  open_conflict_ids: string[];
  /** Hard push did not override blocking unknowns that may affect P5. */
  hard_push_ignored_for_sufficiency: boolean;
}

function criticalDirs(dc: DecisionContext, opts: SufficiencyOptions): DIR[] {
  const active = dc.dirs.filter((d) => d.id_lifecycle === "active");
  if (opts.criticalDirIds?.length) {
    const set = new Set(opts.criticalDirIds);
    return active.filter((d) => set.has(d.dir_id));
  }
  const flagged = active.filter((d) => d.may_affect_p5_ranking);
  return flagged.length > 0 ? flagged : active;
}

/**
 * Evaluate whether Collecting may stop on decision-sufficiency grounds.
 * - Hypothesis-only (no Facts) → not sufficient.
 * - Critical DIR unknown that may_affect_p5_ranking → continue (even if hard-push).
 * - Critical DIR conflict / open conflicts affecting judgment → prefer clarify; may still
 *   allow stop only when product path accepts unresolved_in_final at Freeze (not auto-sufficient).
 * - All critical known|n_a → sufficient.
 * - Unknown that does not affect P5 → sufficient_with_boundaries.
 */
export function evaluateDecisionSufficiency(
  dc: DecisionContext,
  opts: SufficiencyOptions = {},
): DecisionSufficiencyResult {
  const reasons: string[] = [];
  const blocking_dir_ids: string[] = [];
  const open_conflict_ids = dc.conflicts
    .filter((c) => c.state === "open")
    .map((c) => c.conflict_id);

  if ((dc.reality_facts?.length ?? 0) === 0 && (dc.hypotheses?.length ?? 0) > 0) {
    reasons.push("hypotheses_without_reality_facts");
    return {
      verdict: "continue_collecting",
      canStop: false,
      reasons,
      blocking_dir_ids: criticalDirs(dc, opts).map((d) => d.dir_id),
      open_conflict_ids,
      hard_push_ignored_for_sufficiency: Boolean(opts.userHardPush),
    };
  }

  if ((dc.reality_facts?.length ?? 0) === 0 && (dc.dirs?.length ?? 0) > 0) {
    reasons.push("dirs_without_reality_facts");
    return {
      verdict: "continue_collecting",
      canStop: false,
      reasons,
      blocking_dir_ids: criticalDirs(dc, opts).map((d) => d.dir_id),
      open_conflict_ids,
      hard_push_ignored_for_sufficiency: Boolean(opts.userHardPush),
    };
  }

  const dirs = criticalDirs(dc, opts);
  let boundaryOnlyUnknown = false;

  for (const dir of dirs) {
    if (dir.current_state === "known" || dir.current_state === "n_a") continue;
    if (dir.current_state === "conflict") {
      blocking_dir_ids.push(dir.dir_id);
      reasons.push(`dir_conflict:${dir.dir_id}`);
      continue;
    }
    // unknown
    if (dir.may_affect_p5_ranking !== false && dir.may_affect_p5_ranking) {
      blocking_dir_ids.push(dir.dir_id);
      reasons.push(`dir_unknown_may_affect_p5:${dir.dir_id}`);
    } else if (dir.may_affect_p5_ranking === false) {
      boundaryOnlyUnknown = true;
      reasons.push(`dir_unknown_boundary_ok:${dir.dir_id}`);
    } else {
      // Default conservative: unknown critical dir blocks.
      blocking_dir_ids.push(dir.dir_id);
      reasons.push(`dir_unknown:${dir.dir_id}`);
    }
  }

  const hard_push_ignored_for_sufficiency =
    Boolean(opts.userHardPush) && blocking_dir_ids.length > 0;
  if (opts.userHardPush && blocking_dir_ids.length > 0) {
    reasons.push("hard_push_does_not_satisfy_critical_unknown_or_conflict");
  }

  if (blocking_dir_ids.length > 0 || open_conflict_ids.length > 0) {
    if (open_conflict_ids.length > 0) {
      reasons.push("open_conflicts_present");
    }
    return {
      verdict: "continue_collecting",
      canStop: false,
      reasons,
      blocking_dir_ids,
      open_conflict_ids,
      hard_push_ignored_for_sufficiency,
    };
  }

  if (boundaryOnlyUnknown || (dc.information_boundaries?.length ?? 0) > 0) {
    reasons.push("sufficient_with_noted_boundaries");
    return {
      verdict: "sufficient_with_boundaries",
      canStop: true,
      reasons,
      blocking_dir_ids: [],
      open_conflict_ids: [],
      hard_push_ignored_for_sufficiency: false,
    };
  }

  reasons.push("critical_dirs_known_or_n_a");
  return {
    verdict: "sufficient",
    canStop: true,
    reasons,
    blocking_dir_ids: [],
    open_conflict_ids: [],
    hard_push_ignored_for_sufficiency: false,
  };
}
