/**
 * Build derived Understanding State from DC + Blueprint (not a second fact DB).
 */

import { evaluateDecisionSufficiency } from "@/lib/poju/decision-context/stop-criteria";
import type { POJUSessionState } from "@/lib/poju/types";
import { directionIdForDir } from "./blueprint";
import type {
  AdaptiveQuestionPlan,
  DecisionBlueprint,
  NeedItem,
  PersonalPatternInsightBlock,
  SessionBudgetSnapshot,
  UnderstandingState,
  UnderstoodItem,
} from "./types";

export function defaultBudget(
  session: POJUSessionState,
  blueprint: DecisionBlueprint,
): SessionBudgetSnapshot {
  const prev = session.decision_understanding?.budget;
  const soft = blueprint.question_budget.soft;
  const hard = blueprint.question_budget.hard;
  const session_asked_count = prev?.session_asked_count ?? 0;
  return {
    soft_budget_limit: soft,
    hard_budget_limit: hard,
    session_asked_count,
    review_cycle: prev?.review_cycle ?? 1,
    cycle_base_asked: prev?.cycle_base_asked ?? 0,
    remaining_hard_budget: Math.max(0, hard - session_asked_count),
    depth_by_dir: { ...(prev?.depth_by_dir ?? {}) },
  };
}

export function evaluatePersonalPatternInsight(
  _session: POJUSessionState,
): PersonalPatternInsightBlock {
  // Phase 5 production gate not claimed in M1 — unavailable is correct, never forge.
  return {
    status: "unavailable",
    reason: "phase5_personal_analysis_not_wired_for_m1",
    insights: [],
  };
}

export function buildUnderstandingState(input: {
  session: POJUSessionState;
  blueprint: DecisionBlueprint;
  now?: string;
  last_answer_event_id?: string | null;
  next_question_plan?: AdaptiveQuestionPlan | null;
}): UnderstandingState {
  const dc = input.session.decision_context;
  if (!dc) throw new Error("buildUnderstandingState: missing DC");
  const now = input.now ?? new Date().toISOString();
  const budget = defaultBudget(input.session, input.blueprint);

  const understood: UnderstoodItem[] = [];
  const needs: NeedItem[] = [];

  for (const dir of dc.dirs) {
    if (dir.id_lifecycle !== "active") continue;
    const relatedFacts = dc.reality_facts.filter((f) =>
      (f.related_dir_ids ?? []).includes(dir.dir_id),
    );
    if (dir.current_state === "known" || dir.current_state === "n_a") {
      understood.push({
        dir_id: dir.dir_id,
        label: dir.need,
        fact_ids: relatedFacts.map((f) => f.fact_id),
        status: dir.current_state,
        user_confirmed_any: relatedFacts.some((f) => f.user_confirmed === true),
      });
      continue;
    }
    const direction_id = directionIdForDir(input.blueprint, dir.dir_id);
    const direction = input.blueprint.directions.find(
      (d) => d.direction_id === direction_id,
    );
    const priority = direction?.priority ?? (dir.may_affect_p5_ranking ? "P0" : "P1");
    let gap_type: "unknown" | "partial" | "conflict" | "declined" = "unknown";
    if (dir.current_state === "conflict") gap_type = "conflict";
    else if (
      relatedFacts.length > 0 &&
      relatedFacts.every((f) => f.status === "declined")
    ) {
      gap_type = "declined";
    } else if (dir.partial_satisfaction || relatedFacts.length > 0) {
      gap_type = "partial";
    }
    needs.push({
      kind: "dir_based",
      dir_id: dir.dir_id,
      ddr_ids: [`DDR_FOR_${dir.dir_id}`],
      direction_id,
      priority,
      why: dir.why || "Required for decision judgment",
      missing_content: dir.need,
      may_affect_p5_ranking: dir.may_affect_p5_ranking !== false,
      gap_type,
      must_continue: dir.may_affect_p5_ranking !== false,
    });
  }

  const confirmed = dc.reality_facts.filter((f) => f.status === "confirmed");
  const unconfirmed = dc.reality_facts.filter(
    (f) => f.status === "unverified" || f.status === "unknown" || f.status === "declined",
  );
  // M2.1: critical DIR partial coverage → ready for final confirm (not Freeze yet).
  // Does NOT invent DIR known; Freeze still requires sufficiency after user confirm promotion.
  const criticalActive = dc.dirs.filter(
    (d) => d.id_lifecycle === "active" && d.may_affect_p5_ranking !== false,
  );
  const criticalCovered =
    criticalActive.length > 0 &&
    criticalActive.every(
      (d) =>
        d.current_state === "known" ||
        d.current_state === "n_a" ||
        d.partial_satisfaction === true,
    );
  const hasCollectingEvidence =
    (dc.reality_facts?.length ?? 0) > 0 || (dc.constraints?.length ?? 0) > 0;

  const sufficiency = evaluateDecisionSufficiency(dc);
  const remaining = budget.remaining_hard_budget;
  let readiness_verdict: UnderstandingState["readiness"]["verdict"] = "continue";
  let can_ask = true;
  const reasons = [...sufficiency.reasons];
  if (sufficiency.canStop) {
    readiness_verdict = "ready_for_final_confirm";
    can_ask = false;
    reasons.push("sufficiency_can_stop");
  } else if (remaining <= 0) {
    readiness_verdict = "hard_budget_exhausted";
    can_ask = false;
    reasons.push("hard_budget_exhausted");
  } else if (needs.length === 0) {
    readiness_verdict = "ready_for_final_confirm";
    can_ask = false;
    reasons.push("no_open_needs");
  } else if (criticalCovered && hasCollectingEvidence) {
    readiness_verdict = "ready_for_final_confirm";
    can_ask = false;
    reasons.push("critical_dirs_partial_coverage_ready_for_confirm");
  }

  const dq =
    dc.definition.decision_question ??
    input.blueprint.decision_question ??
    input.session.original_question ??
    null;

  return {
    understanding_id: `u_${dc.context_id}_v${dc.version}`,
    session_id: input.session.session_id,
    context_id: dc.context_id,
    context_version: dc.version,
    blueprint_version: input.blueprint.blueprint_version,
    built_at: now,
    current_understanding: {
      summary: [
        dq ? `Decision: ${dq}` : null,
        confirmed.length ? `Confirmed facts: ${confirmed.length}` : null,
        unconfirmed.length ? `Unconfirmed/open: ${unconfirmed.length}` : null,
        needs.length ? `Open needs: ${needs.length}` : "No open DIR needs",
      ]
        .filter(Boolean)
        .join(" · "),
      decision_question: dq,
      confirmed_briefs: confirmed.map((f) => f.statement).slice(0, 8),
      unconfirmed_briefs: unconfirmed.map((f) => f.statement).slice(0, 8),
      analysis_briefs: dc.hypotheses.map((h) => h.statement).slice(0, 6),
      conflict_briefs: dc.conflicts
        .filter((c) => c.state === "open")
        .map((c) => c.statements_snapshot.join(" vs "))
        .slice(0, 6),
      confidence:
        sufficiency.canStop ? "high" : confirmed.length >= 2 ? "medium" : "low",
    },
    understood: { items: understood },
    need_to_understand: { items: needs },
    personal_pattern_insight: evaluatePersonalPatternInsight(input.session),
    next_question_plan: input.next_question_plan ?? null,
    readiness: {
      verdict: readiness_verdict,
      can_ask,
      reasons,
      sufficiency_verdict: sufficiency.verdict,
    },
    budget,
    last_answer_event_id: input.last_answer_event_id ?? null,
    last_sent_question:
      input.session.decision_understanding?.last_sent_question ?? null,
  };
}
