/**
 * Generate / validate the actual NL question from a selected planning candidate.
 * Plan controls the investigation target; NL may phrase but cannot change DIR/DDR.
 * M2.4-R1: generate from unmet fact-role gaps (not fixed DIR.need template).
 */

/** Phase 4: gap-driven NL from unmet roles + DC evidence. */
export const QUESTION_GENERATION_VERSION = "gap_driven_m2_4_r1" as const;

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

function roleCodesToRoles(codes: string[]): string[] {
  return codes
    .map((c) => {
      const m = /\/role\/([^/]+)$/.exec(c);
      return m?.[1] ?? c;
    })
    .filter(Boolean);
}

function factsForDir(dc: DecisionContext, dirId: string) {
  return dc.reality_facts.filter((f) =>
    (f.related_dir_ids ?? []).includes(dirId),
  );
}

function roleAdequatelyAnswered(
  dc: DecisionContext,
  dirId: string,
  role: string,
): boolean {
  const facts = factsForDir(dc, dirId).filter((f) => {
    const roles = f.fact_roles ?? [];
    return roles.includes(role) || roles.length === 0;
  });
  // Adequately answered = has non-unknown/declined evidence for this role.
  return facts.some(
    (f) =>
      f.status !== "unknown" &&
      f.status !== "declined" &&
      (f.fact_roles ?? []).includes(role),
  );
}

function focusForRole(role: string, dir: DIR | undefined): string {
  switch (role) {
    case "option":
      return "有哪些真实可选方案（不要只重复决策目标）";
    case "status_quo":
      return "如果维持现状，实际成本和影响是什么";
    case "hard_constraint":
      return "资金、时间、责任方面有哪些具体硬限制";
    case "risk_tolerance":
    case "risk":
      return "可以接受的最差结果是什么";
    case "timing":
      return "决策期限和不可延迟的时间节点是什么";
    case "responsibility":
      return "这项决策的责任边界和承担方是谁";
    case "decision_question":
      return "请把要做的决策问题说得更具体一点";
    case "stakeholder":
      return "哪些人会受到这个决策的影响，他们的态度如何";
    default:
      return dir?.need?.trim() || `请补充与「${role}」相关的关键信息`;
  }
}

/**
 * Resolve unmet fact roles from the Plan against current DC evidence.
 * V1 covers common roles; other roles come from Catalog required_fact_roles.
 */
function resolveMissingRoleQuestions(input: {
  dc: DecisionContext;
  plan: Pick<AdaptiveQuestionPlan, "dir_ids" | "fact_role_codes" | "missing_info">;
}): {
  role: string;
  question_focus: string;
  known_evidence: string[];
}[] {
  const dirId = input.plan.dir_ids[0];
  const dir = dirId
    ? input.dc.dirs.find((d) => d.dir_id === dirId)
    : undefined;
  const rolesFromPlan = roleCodesToRoles(input.plan.fact_role_codes);
  const roles =
    rolesFromPlan.length > 0
      ? rolesFromPlan
      : dir?.required_fact_roles?.length
        ? [...dir.required_fact_roles]
        : ["situation"];

  const out: {
    role: string;
    question_focus: string;
    known_evidence: string[];
  }[] = [];

  for (const role of roles) {
    if (dirId && roleAdequatelyAnswered(input.dc, dirId, role)) continue;
    const known = dirId
      ? factsForDir(input.dc, dirId)
          .filter((f) => (f.fact_roles ?? []).includes(role))
          .map((f) => f.statement)
      : [];
    out.push({
      role,
      question_focus: focusForRole(role, dir),
      known_evidence: known,
    });
  }
  return out;
}

function normalizeQ(text: string): string {
  return text.toLowerCase().replace(/[\s，,。．.!！？?；;：:、？]/g, "");
}

/** Strip shared decision-question prefix so dedupe compares the ask focus. */
function focusKey(text: string): string {
  const n = normalizeQ(text);
  return n
    .replace(/^关于[^—\-]+[—\-]{1,2}/, "")
    .replace(/^about[^?？]{0,40}/, "");
}

function isSubstantialDuplicate(
  candidate: string,
  prior: string | null | undefined,
): boolean {
  if (!prior) return false;
  const a = focusKey(candidate);
  const b = focusKey(prior);
  if (!a || !b) return false;
  if (a === b) return true;
  const stemLen = 20;
  if (a.length >= stemLen && b.includes(a.slice(0, stemLen))) return true;
  if (b.length >= stemLen && a.includes(b.slice(0, stemLen))) return true;
  return false;
}

function composeQuestion(input: {
  dc: DecisionContext;
  blueprint: DecisionBlueprint;
  dir: DIR | undefined;
  roleFocus: { role: string; question_focus: string; known_evidence: string[] };
  gap_type: string;
  decision_value: string;
  ask_now_reason: string;
  depth: number;
  openConflictHint?: string | null;
}): string {
  const dq =
    input.dc.definition.decision_question ?? input.blueprint.decision_question;
  const prefix = dq ? `关于「${dq}」——` : "";
  const why = input.dir?.why?.trim();
  const knownNote =
    input.roleFocus.known_evidence.length > 0
      ? `（已知：${input.roleFocus.known_evidence[0]!.slice(0, 40)}；请补充尚未说清的部分）`
      : "";
  const conflictNote = input.openConflictHint
    ? `当前记录存在冲突：${input.openConflictHint.slice(0, 60)}。请帮助澄清哪一项属实。`
    : "";
  const depthNote =
    input.depth > 1 ? "请比上一问更具体。" : "";

  if (conflictNote) {
    return `${prefix}${conflictNote}${knownNote}`.slice(0, 500);
  }

  const main = `${prefix}${input.roleFocus.question_focus}？`;
  const supplement = [why ? `这样我才能判断：${why}` : null, depthNote || null]
    .filter(Boolean)
    .join(" ");
  if (supplement) {
    return `${main}${knownNote}（${supplement}）`.slice(0, 500);
  }
  return `${main}${knownNote}`.slice(0, 500);
}

export function generateQuestionText(input: {
  dc: DecisionContext;
  blueprint: DecisionBlueprint;
  selected: RankedPlanningCandidate;
  last_sent_question_text?: string | null;
  /** Historical question texts for the same DIR (optional). */
  prior_dir_questions?: string[];
}): string | null {
  const dirId = input.selected.candidate.dir_ids[0];
  const dir = dirId
    ? input.dc.dirs.find((d) => d.dir_id === dirId)
    : undefined;
  const planLike = {
    dir_ids: [...input.selected.candidate.dir_ids],
    fact_role_codes: [...input.selected.candidate.fact_role_codes],
    missing_info: input.selected.score.gap_type,
  };
  const missing = resolveMissingRoleQuestions({
    dc: input.dc,
    plan: planLike,
  });

  const openConflicts = input.dc.conflicts.filter((c) => c.state === "open");
  const conflictOnDir = dirId
    ? openConflicts.find((c) => {
        const factIds = new Set(c.fact_ids);
        return input.dc.reality_facts.some(
          (f) =>
            factIds.has(f.fact_id) &&
            (f.related_dir_ids ?? []).includes(dirId),
        );
      })
    : undefined;

  // Prefer conflict-resolution ask when open conflict on this DIR.
  if (conflictOnDir && dir) {
    const q = composeQuestion({
      dc: input.dc,
      blueprint: input.blueprint,
      dir,
      roleFocus: {
        role: "conflict_resolve",
        question_focus: "请澄清相互冲突的说法，哪一项是正确的",
        known_evidence: conflictOnDir.statements_snapshot.slice(0, 2),
      },
      gap_type: "conflict",
      decision_value: "decision_critical",
      ask_now_reason: "open_conflict",
      depth: input.selected.candidate.depth,
      openConflictHint: conflictOnDir.statements_snapshot.join(" vs "),
    });
    if (
      !isSubstantialDuplicate(q, input.last_sent_question_text) &&
      !(input.prior_dir_questions ?? []).some((p) => isSubstantialDuplicate(q, p))
    ) {
      return q;
    }
  }

  // Roles may all have some evidence while DIR remains unknown/partial/conflict —
  // still produce a depth follow-up rather than falsely reporting no remaining need.
  const followUps =
    missing.length > 0
      ? missing
      : dir && dir.current_state !== "known" && dir.current_state !== "n_a"
        ? [
            {
              role: input.selected.score.gap_type || "follow_up",
              question_focus:
                input.selected.score.gap_type === "conflict"
                  ? "请澄清相互冲突的说法，哪一项是正确的"
                  : input.selected.score.gap_type === "partial"
                    ? `关于「${dir.need}」，还有哪些关键细节没说清`
                    : focusForRole(
                        (dir.required_fact_roles ?? [])[0] ?? "situation",
                        dir,
                      ),
              known_evidence: factsForDir(input.dc, dir.dir_id)
                .map((f) => f.statement)
                .slice(0, 2),
            },
          ]
        : [];

  if (followUps.length === 0) {
    return null;
  }

  for (const roleFocus of followUps) {
    const q = composeQuestion({
      dc: input.dc,
      blueprint: input.blueprint,
      dir,
      roleFocus,
      gap_type: input.selected.score.gap_type,
      decision_value: input.selected.candidate.impact.decision_critical
        ? "decision_critical"
        : "supporting",
      ask_now_reason: `role=${roleFocus.role}`,
      depth: input.selected.candidate.depth,
    });
    // Dedupe against last sent / same-DIR history / existing fact statements
    if (isSubstantialDuplicate(q, input.last_sent_question_text)) continue;
    if ((input.prior_dir_questions ?? []).some((p) => isSubstantialDuplicate(q, p))) {
      continue;
    }
    // Do not treat existing fact statements as question duplicates — facts are answers, not asks.
    return q;
  }

  // No remaining non-duplicate info need
  return null;
}

export function buildAdaptiveQuestionPlan(input: {
  dc: DecisionContext;
  blueprint: DecisionBlueprint;
  selected: RankedPlanningCandidate;
  budget: SessionBudgetSnapshot;
  now: string;
  scoring_path: string;
  last_sent_question_text?: string | null;
  prior_dir_questions?: string[];
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
    last_sent_question_text: input.last_sent_question_text,
    prior_dir_questions: input.prior_dir_questions,
  });

  if (!question_text) {
    const shell: AdaptiveQuestionPlan = {
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
      question_text: "",
      built_at: input.now,
      scoring_path: input.scoring_path,
    };
    return {
      plan: shell,
      validation: {
        ok: false,
        reason_code: "no_remaining_info_need",
        detail: "generated question rejected as duplicate or no unmet role",
      },
    };
  }

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
  const dirHit = plan.dir_ids.some((id) => text.includes(id));
  const needHint = plan.expected_info.slice(0, 12);
  const needHit = needHint.length >= 4 && text.includes(needHint);
  const planHit = text.includes(plan.question_text.slice(0, 16));
  if (dirHit || needHit || planHit) {
    return { ok: true, text: plan.question_text };
  }
  return { ok: false, reason: "target_mismatch", text: plan.question_text };
}

export { bumpBudgetAfterAsk };
