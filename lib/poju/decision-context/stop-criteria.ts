/**
 * Decision sufficiency stop-criteria (replaces old Gate decision power).
 * turn counts / agenda covered / PUSH_GATE are NOT sufficiency.
 *
 * Eng SoT dichotomies:
 * - Unknown NOT affecting P5 ranking — may stop with noted boundary
 * - Unknown that MAY change P5 ranking — continue (not sufficient)
 * - Open Conflict affecting preferred path — hard block (delivery FAIL)
 * - Open Conflict NOT affecting preferred path — do not over-block; Freeze may
 *   mark unresolved_in_final with degraded / boundary
 */

import type { Conflict, DecisionContext, DIR } from "./types";

export interface SufficiencyOptions {
  /** Hard-push is urge-only; never alone sufficient (C4 / H3). */
  userHardPush?: boolean;
  /**
   * Critical DIR ids; default = active DIRs where may_affect_p5_ranking !== false
   * (undefined is treated as may-affect-P5; only explicit false is excluded).
   */
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
  /** Open conflicts that block preferred-path sufficiency (hard FAIL). */
  blocking_conflict_ids: string[];
  /** Open conflicts that do not affect preferred path (boundary / degraded OK). */
  nonblocking_conflict_ids: string[];
  /** Hard push did not override blocking unknowns that may affect P5. */
  hard_push_ignored_for_sufficiency: boolean;
}

/** Conservative: undefined may_affect_p5_ranking → treat as affecting (blocks). */
export function dirUnknownAffectsP5Ranking(dir: DIR): boolean {
  return dir.may_affect_p5_ranking !== false;
}

/** Conservative: undefined affects_preferred_path → treat as affecting (blocks). */
export function conflictAffectsPreferredPath(conflict: Conflict): boolean {
  return conflict.affects_preferred_path !== false;
}

function criticalDirs(dc: DecisionContext, opts: SufficiencyOptions): DIR[] {
  const active = dc.dirs.filter((d) => d.id_lifecycle === "active");
  if (opts.criticalDirIds?.length) {
    const set = new Set(opts.criticalDirIds);
    return active.filter((d) => set.has(d.dir_id));
  }
  // Only explicit false excludes a DIR from P5 blocking checks.
  // Undefined must be treated as may-affect-P5 (consistent with dirUnknownAffectsP5Ranking).
  // Do NOT drop undefined DIRs merely because another DIR is flagged true.
  return active.filter((d) => dirUnknownAffectsP5Ranking(d));
}

function classifyOpenConflicts(dc: DecisionContext): {
  blocking: string[];
  nonblocking: string[];
} {
  const blocking: string[] = [];
  const nonblocking: string[] = [];
  for (const c of dc.conflicts) {
    if (c.state !== "open") continue;
    if (conflictAffectsPreferredPath(c)) {
      blocking.push(c.conflict_id);
    } else {
      nonblocking.push(c.conflict_id);
    }
  }
  return { blocking, nonblocking };
}

/**
 * Evaluate whether Collecting may stop on decision-sufficiency grounds.
 * - Hypothesis-only (no Facts) → not sufficient.
 * - Critical DIR unknown that may_affect_p5_ranking → continue (even if hard-push).
 * - Critical DIR conflict / open conflicts affecting preferred path → hard block.
 * - Open conflicts that do NOT affect preferred path → boundary only (do not over-block).
 * - All critical known|n_a → sufficient.
 * - Unknown that does not affect P5 → sufficient_with_boundaries.
 */
export function evaluateDecisionSufficiency(
  dc: DecisionContext,
  opts: SufficiencyOptions = {},
): DecisionSufficiencyResult {
  const reasons: string[] = [];
  const blocking_dir_ids: string[] = [];
  const { blocking: blocking_conflict_ids, nonblocking: nonblocking_conflict_ids } =
    classifyOpenConflicts(dc);
  const open_conflict_ids = [
    ...blocking_conflict_ids,
    ...nonblocking_conflict_ids,
  ];

  if ((dc.reality_facts?.length ?? 0) === 0 && (dc.hypotheses?.length ?? 0) > 0) {
    reasons.push("hypotheses_without_reality_facts");
    return {
      verdict: "continue_collecting",
      canStop: false,
      reasons,
      blocking_dir_ids: criticalDirs(dc, opts).map((d) => d.dir_id),
      open_conflict_ids,
      blocking_conflict_ids,
      nonblocking_conflict_ids,
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
      blocking_conflict_ids,
      nonblocking_conflict_ids,
      hard_push_ignored_for_sufficiency: Boolean(opts.userHardPush),
    };
  }

  const dirs = criticalDirs(dc, opts);
  let boundaryOnlyUnknown = false;

  for (const dir of dirs) {
    if (dir.current_state === "known" || dir.current_state === "n_a") continue;
    if (dir.current_state === "conflict") {
      // DIR-level conflict: same preferred-path dichotomy via may_affect_p5_ranking.
      if (dirUnknownAffectsP5Ranking(dir)) {
        blocking_dir_ids.push(dir.dir_id);
        reasons.push(`dir_conflict_affects_preferred:${dir.dir_id}`);
      } else {
        boundaryOnlyUnknown = true;
        reasons.push(`dir_conflict_boundary_ok:${dir.dir_id}`);
      }
      continue;
    }
    // unknown — only explicit false is non-blocking; undefined may-affect-P5.
    if (dir.may_affect_p5_ranking === false) {
      boundaryOnlyUnknown = true;
      reasons.push(`dir_unknown_boundary_ok:${dir.dir_id}`);
    } else if (dir.may_affect_p5_ranking === true) {
      blocking_dir_ids.push(dir.dir_id);
      reasons.push(`dir_unknown_may_affect_p5:${dir.dir_id}`);
    } else {
      // Default conservative: unspecified unknown critical dir blocks.
      blocking_dir_ids.push(dir.dir_id);
      reasons.push(`dir_unknown:${dir.dir_id}`);
    }
  }

  // Also note non-critical active unknowns as boundaries (do not block).
  const criticalSet = new Set(dirs.map((d) => d.dir_id));
  for (const dir of dc.dirs) {
    if (dir.id_lifecycle !== "active") continue;
    if (criticalSet.has(dir.dir_id)) continue;
    if (dir.current_state === "unknown" && dir.may_affect_p5_ranking === false) {
      boundaryOnlyUnknown = true;
      reasons.push(`dir_unknown_boundary_ok:${dir.dir_id}`);
    }
  }

  if (nonblocking_conflict_ids.length > 0) {
    boundaryOnlyUnknown = true;
    for (const id of nonblocking_conflict_ids) {
      reasons.push(`open_conflict_boundary_ok:${id}`);
    }
  }

  const hard_push_ignored_for_sufficiency =
    Boolean(opts.userHardPush) &&
    (blocking_dir_ids.length > 0 || blocking_conflict_ids.length > 0);
  if (
    opts.userHardPush &&
    (blocking_dir_ids.length > 0 || blocking_conflict_ids.length > 0)
  ) {
    reasons.push("hard_push_does_not_satisfy_critical_unknown_or_conflict");
  }

  if (blocking_dir_ids.length > 0 || blocking_conflict_ids.length > 0) {
    if (blocking_conflict_ids.length > 0) {
      reasons.push("preferred_path_open_conflicts_present");
    }
    return {
      verdict: "continue_collecting",
      canStop: false,
      reasons,
      blocking_dir_ids,
      open_conflict_ids,
      blocking_conflict_ids,
      nonblocking_conflict_ids,
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
      open_conflict_ids,
      blocking_conflict_ids: [],
      nonblocking_conflict_ids,
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
    blocking_conflict_ids: [],
    nonblocking_conflict_ids: [],
    hard_push_ignored_for_sufficiency: false,
  };
}