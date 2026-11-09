/**
 * Generate / validate the actual NL question from a selected planning candidate.
 * Plan controls the investigation target; NL may phrase but cannot change DIR/DDR.
 */

/** v1 simplified: template NL from DIR.need/why (not full generative writer). */
export const QUESTION_GENERATION_VERSION = "template_m1_v1_simplified" as const;

import type { DecisionContext, DIR } from "@/lib/poju/decision-context/types";
import type { RankedPlanningCandidate } from "@/lib/poju/decision-context/question-plan-cycle";
import type { DecisionBlueprint, AdaptiveQuestionPlan } from "./types";
import { directionIdForDir } from "./blueprint";
import {
  bumpBudgetAfterAsk,
  validateScopeDepthBudget,
  type ScopeBudgetVerdict,
} from "./scope-budget";
import type { SessionBudgetSnapshot } from "./types";

function questionForDir(dir: DIR, decisionQuestion: string | null): string {
  const base = dir.need?.trim() || dir.dir_id;
  const why = dir.why?.trim();
  const prefix = decisionQuestion
    ? `关于「${decisionQuestion}」——`
    : "";
  if (why) {
    return `${prefix}请具体说明：${base}？（这样我才能判断：${why}）`;
  }
  return `${prefix}请具体说明：${base}？`;
}

export function generateQuestionText(input: {
  dc: DecisionContext;
  blueprint: DecisionBlueprint;
  selected: RankedPlanningCandidate;
}): string {
  const dirId = input.selected.candidate.dir_ids[0];
  const dir = dirId
    ? input.dc.dirs.find((d) => d.dir_id === dirId)
    : undefined;
  const dq =
    input.dc.definition.decision_question ?? input.blueprint.decision_question;
  if (dir) return questionForDir(dir, dq);
  const roles = input.selected.candidate.fact_role_codes.join(", ");
  return `请补充与 ${roles || input.selected.candidate.candidate_id} 相关的关键信息。`;
}

export function buildAdaptiveQuestionPlan(input: {
  dc: DecisionContext;
  blueprint: DecisionBlueprint;
  selected: RankedPlanningCandidate;
  budget: SessionBudgetSnapshot;
  now: string;
  scoring_path: string;
}): { plan: AdaptiveQuestionPlan; validation: ScopeBudgetVerdict } {
  const c = input.selected.candidate;
  const dirId = c.dir_ids[0] ?? "";
  const direction_id = dirId
    ? directionIdForDir(input.blueprint, dirId)
    : c.kind === "source_only"
      ? "DIRN-TOPIC"
      : "DIRN-DEFINITION";
  const direction = input.blueprint.directions.find(
    (d) => d.direction_id === direction_id,
  );
  const depth = (input.budget.depth_by_dir[dirId] ?? 0) + 1;
  const question_text = generateQuestionText({
    dc: input.dc,
    blueprint: input.blueprint,
    selected: input.selected,
  });
  const plan: AdaptiveQuestionPlan = {
    plan_id: `qp_${c.candidate_id}_${input.now}`.slice(0, 120),
    candidate_id: c.candidate_id,
    direction_id,
    ddr_ids: [...c.ddr_ids],
    dir_ids: [...c.dir_ids],
    fact_role_codes: [...c.fact_role_codes],
    missing_info: input.selected.score.gap_type,
    decision_value: c.impact.decision_critical
      ? "decision_critical"
      : c.impact.may_affect_p5_ranking
        ? "may_affect_p5"
        : "supporting",
    ask_now_reason: `gate=${c.impact.gate_class}; gain=${input.selected.score.information_gain_est}; unresolved=${input.selected.score.unresolved_count}`,
    expected_info: dirId
      ? input.dc.dirs.find((d) => d.dir_id === dirId)?.need ?? dirId
      : c.fact_role_codes.join(","),
    depth,
    budget_cost: c.budget_cost,
    remaining_hard_budget: input.budget.remaining_hard_budget,
    gate_class: c.impact.gate_class,
    scope_boundary:
      direction?.scope_boundary ??
      "Only Blueprint DIR/DDR; no model scope expansion",
    rationale: `Selected ${c.candidate_id} via ${input.scoring_path}`,
    question_text,
    built_at: input.now,
    scoring_path: input.scoring_path,
  };
  const validation = validateScopeDepthBudget({
    blueprint: input.blueprint,
    plan,
    budget: input.budget,
  });
  return { plan, validation };
}

/** Reject model phrasing that changes investigation target (DIR/need). */
export function assertQuestionMatchesPlan(
  assistantText: string,
  plan: AdaptiveQuestionPlan,
): { ok: true; text: string } | { ok: false; reason: string; text: string } {
  const text = assistantText.trim();
  if (!text) {
    return { ok: false, reason: "empty_assistant", text: plan.question_text };
  }
  // Authoritative: always use plan.question_text as the sent question.
  // Model may wrap, but M1 fail-closed replaces with plan text when target drifts.
  const dirHit = plan.dir_ids.some((id) => text.includes(id));
  const needHint = plan.expected_info.slice(0, 12);
  const needHit = needHint.length >= 4 && text.includes(needHint);
  const planHit = text.includes(plan.question_text.slice(0, 16));
  if (dirHit || needHit || planHit) {
    // Keep model phrasing only when clearly about same target; still stamp plan text
    // as authoritative for UI/Session equality (M1-15).
    return { ok: true, text: plan.question_text };
  }
  return { ok: false, reason: "target_mismatch", text: plan.question_text };
}

export { bumpBudgetAfterAsk };
