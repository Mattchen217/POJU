/**
 * M2.4-R2 — "answered for intake" coverage of one DIR.
 *
 * A DIR is answered when every required role carries a user answer recorded
 * in this goal's Decision Context (asserted, estimated, unknown or declined).
 * Answered is NOT known: unverified answers still await final confirmation,
 * and unknown / declined answers are information boundaries. It only means
 * the intake loop must not ask the same thing again.
 *
 * Exception: on a DIR that blocks Freeze sufficiency, an estimate can never
 * become known, so a role covered by a single estimated answer stays open for
 * one deeper follow-up (still bound by depth and budget). A second estimate
 * closes it like any answer.
 */

import type { DecisionContext, DIR } from "@/lib/poju/decision-context/types";

const ANSWER_STATUSES = new Set(["unverified", "confirmed", "unknown", "declined"]);

export type DirAnswerCoverage = {
  answered: boolean;
  fact_ids: string[];
  answer_statuses: string[];
  /** Some required role is covered only by unknown / declined answers. */
  information_boundary: boolean;
};

export function dirIntakeAnswerCoverage(
  dc: Pick<DecisionContext, "reality_facts">,
  dir: Pick<DIR, "dir_id" | "required_fact_roles" | "current_state" | "may_affect_p5_ranking">,
): DirAnswerCoverage {
  const required = dir.required_fact_roles ?? [];
  const facts = dc.reality_facts.filter(
    (f) => (f.related_dir_ids ?? []).includes(dir.dir_id) && ANSWER_STATUSES.has(f.status),
  );
  const empty: DirAnswerCoverage = {
    answered: false,
    fact_ids: facts.map((f) => f.fact_id),
    answer_statuses: [...new Set(facts.map((f) => f.status))],
    information_boundary: false,
  };
  if (required.length === 0 || dir.current_state === "conflict") return empty;
  let boundary = false;
  const blocksFreeze = dir.may_affect_p5_ranking !== false;
  for (const role of required) {
    const roleFacts = facts.filter((f) => (f.fact_roles ?? []).includes(role));
    if (roleFacts.length === 0) return empty;
    if (
      blocksFreeze &&
      roleFacts.every((f) => f.status === "unverified" && f.verification_level === "user_estimate") &&
      new Set(roleFacts.map((f) => f.source_turn_id)).size < 2
    ) {
      return empty;
    }
    if (roleFacts.every((f) => f.status === "unknown" || f.status === "declined")) {
      boundary = true;
    }
  }
  return { ...empty, answered: true, information_boundary: boundary };
}

export function isDirAnsweredForIntake(
  dc: Pick<DecisionContext, "reality_facts">,
  dir: Pick<DIR, "dir_id" | "required_fact_roles" | "current_state" | "may_affect_p5_ranking">,
): boolean {
  return dirIntakeAnswerCoverage(dc, dir).answered;
}
