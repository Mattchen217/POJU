/**
 * Scope / Depth / Budget validation — rules engine, not Prompt hope.
 */

import type { DecisionBlueprint, AdaptiveQuestionPlan, SessionBudgetSnapshot } from "./types";

export const DEFAULT_SOFT_BUDGET = 12;
export const DEFAULT_HARD_BUDGET = 15;
export const DEFAULT_DEPTH_CAP = 3;

export type ScopeBudgetVerdict =
  | { ok: true }
  | { ok: false; reason_code: string; detail: string };

export function validateScopeDepthBudget(input: {
  blueprint: DecisionBlueprint;
  plan: Pick<
    AdaptiveQuestionPlan,
    "dir_ids" | "ddr_ids" | "direction_id" | "depth" | "budget_cost" | "gate_class"
  >;
  budget: SessionBudgetSnapshot;
}): ScopeBudgetVerdict {
  const { blueprint, plan, budget } = input;
  if (!plan.ddr_ids.length) {
    return { ok: false, reason_code: "missing_ddr_link", detail: "No DDR association" };
  }
  if (!plan.dir_ids.length && plan.gate_class !== "P0") {
    // source_only P0 may omit dirs; M1 dir_based always needs dirs.
  }
  for (const dirId of plan.dir_ids) {
    if (!blueprint.dir_ids.includes(dirId)) {
      return {
        ok: false,
        reason_code: "dir_out_of_blueprint_scope",
        detail: dirId,
      };
    }
  }
  const direction = blueprint.directions.find(
    (d) => d.direction_id === plan.direction_id,
  );
  if (!direction) {
    return {
      ok: false,
      reason_code: "direction_not_in_blueprint",
      detail: plan.direction_id,
    };
  }
  for (const dirId of plan.dir_ids) {
    if (!direction.dir_ids.includes(dirId)) {
      return {
        ok: false,
        reason_code: "dir_not_in_direction_scope",
        detail: dirId,
      };
    }
  }
  const depthCap =
    direction.depth_soft_cap ?? blueprint.question_budget.depth_per_direction;
  if (plan.depth > depthCap) {
    return {
      ok: false,
      reason_code: "direction_depth_exceeded",
      detail: `${plan.depth}>${depthCap}`,
    };
  }
  for (const dirId of plan.dir_ids) {
    const used = budget.depth_by_dir[dirId] ?? 0;
    if (used >= depthCap) {
      return {
        ok: false,
        reason_code: "dir_depth_exhausted",
        detail: dirId,
      };
    }
  }
  if (plan.budget_cost > budget.remaining_hard_budget) {
    return {
      ok: false,
      reason_code: "hard_budget_insufficient",
      detail: `${plan.budget_cost}>${budget.remaining_hard_budget}`,
    };
  }
  if (budget.session_asked_count >= budget.hard_budget_limit) {
    return {
      ok: false,
      reason_code: "hard_budget_reached",
      detail: String(budget.session_asked_count),
    };
  }
  // P2 must not infinitely consume — require remaining soft headroom if many asks already.
  if (
    plan.gate_class === "P2" &&
    budget.session_asked_count - budget.cycle_base_asked >=
      budget.soft_budget_limit
  ) {
    return {
      ok: false,
      reason_code: "p2_blocked_after_soft_budget",
      detail: "P2 cannot extend past soft budget",
    };
  }
  return { ok: true };
}

/**
 * Refund one actually-sent question whose answer carried no usable
 * information (unknown / declined). Idempotent per plan_id.
 */
export function refundIneffectiveQuestion(
  budget: SessionBudgetSnapshot,
  sent: { plan_id: string; dir_ids: string[]; budget_cost: number },
): SessionBudgetSnapshot {
  const ineffective = budget.ineffective_plan_ids ?? [];
  if (!sent.plan_id || ineffective.includes(sent.plan_id) || sent.budget_cost === 0) return budget;
  const depth_by_dir = { ...budget.depth_by_dir };
  for (const dirId of sent.dir_ids) {
    depth_by_dir[dirId] = Math.max(0, (depth_by_dir[dirId] ?? 0) - 1);
  }
  const session_asked_count = Math.max(0, budget.session_asked_count - sent.budget_cost);
  return {
    ...budget,
    session_asked_count,
    remaining_hard_budget: Math.max(0, budget.hard_budget_limit - session_asked_count),
    depth_by_dir,
    ineffective_plan_ids: [...ineffective, sent.plan_id],
  };
}

export function bumpBudgetAfterAsk(
  budget: SessionBudgetSnapshot,
  plan: AdaptiveQuestionPlan,
): SessionBudgetSnapshot {
  if (plan.budget_cost === 0) return budget;
  const depth_by_dir = { ...budget.depth_by_dir };
  // Answer-resolution clarifications bind what the user already said; they
  // are charged but do not deepen the direction.
  const deepens = !String(plan.scoring_path ?? "").startsWith("pending_answer_resolution");
  for (const dirId of deepens ? plan.dir_ids : []) {
    depth_by_dir[dirId] = (depth_by_dir[dirId] ?? 0) + 1;
  }
  const session_asked_count = budget.session_asked_count + plan.budget_cost;
  return {
    ...budget,
    session_asked_count,
    remaining_hard_budget: Math.max(
      0,
      budget.hard_budget_limit - session_asked_count,
    ),
    depth_by_dir,
  };
}
