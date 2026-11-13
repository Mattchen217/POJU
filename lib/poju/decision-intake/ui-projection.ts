/**
 * M1 UI projection — read the same structured Session state the model uses.
 * No re-inference of facts; no progress-from-question-count.
 */

import type { POJUSessionState } from "@/lib/poju/types";

export type AdaptiveQuestionUiProjection = {
  current_question: string | null;
  understanding_summary: string | null;
  understood_labels: string[];
  need_labels: string[];
  personal_pattern_status: string | null;
  readiness_verdict: string | null;
  budget_asked: number | null;
  budget_hard: number | null;
  plan_direction_id: string | null;
  plan_dir_ids: string[];
  investigation_directions: Array<{ direction_id: string; label: string; priority: string; dir_ids: string[] }>;
  dir_states: Array<{ dir_id: string; need: string; state: string; priority: string; may_affect_ranking: boolean }>;
  open_conflicts: Array<{ conflict_id: string; field: string; statements: string[] }>;
  readiness_reasons: string[];
  readiness_can_ask: boolean | null;
  budget_remaining: number | null;
  need_details: Array<{ label: string; priority: string; direction_id: string | null; gap_type: string }>;
  personal_pattern_insights: Array<{ text: string; source: string; related_dir_ids: string[] }>;
};

export function projectAdaptiveQuestionForUi(
  session: POJUSessionState,
): AdaptiveQuestionUiProjection {
  const u = session.decision_understanding;
  const plan = session.adaptive_ask_plan ?? u?.next_question_plan ?? null;
  const dc = session.decision_context;
  const directionByDir = new Map((session.decision_blueprint?.directions ?? []).flatMap((d) =>
    d.dir_ids.map((id) => [id, { priority: d.priority, direction_id: d.direction_id }] as const),
  ));
  return {
    current_question:
      u?.last_sent_question?.question_text ?? plan?.question_text ?? null,
    understanding_summary: u?.current_understanding.summary ?? null,
    understood_labels: (u?.understood.items ?? []).map((i) => i.label),
    need_labels: (u?.need_to_understand.items ?? []).map((i) =>
      i.kind === "dir_based" ? i.missing_content : i.why,
    ),
    personal_pattern_status: u?.personal_pattern_insight.status ?? null,
    readiness_verdict: u?.readiness.verdict ?? null,
    budget_asked: u?.budget.session_asked_count ?? null,
    budget_hard: u?.budget.hard_budget_limit ?? null,
    plan_direction_id: plan?.direction_id ?? null,
    plan_dir_ids: plan?.dir_ids ?? [],
    investigation_directions: (session.decision_blueprint?.directions ?? []).map((d) => ({
      direction_id: d.direction_id, label: d.label, priority: d.priority, dir_ids: d.dir_ids,
    })),
    dir_states: (dc?.dirs ?? []).filter((d) => d.id_lifecycle === "active").map((d) => ({
      dir_id: d.dir_id, need: d.need, state: d.current_state, priority: directionByDir.get(d.dir_id)?.priority ?? "P2",
      may_affect_ranking: d.may_affect_p5_ranking ?? false,
    })),
    open_conflicts: (dc?.conflicts ?? []).filter((c) => c.state !== "clarified").map((c) => ({
      conflict_id: c.conflict_id, field: c.conflict_field, statements: c.statements_snapshot,
    })),
    readiness_reasons: u?.readiness.reasons ?? [],
    readiness_can_ask: u?.readiness.can_ask ?? null,
    budget_remaining: u?.budget.remaining_hard_budget ?? null,
    need_details: (u?.need_to_understand.items ?? []).map((i) => ({
      label: i.kind === "dir_based" ? i.missing_content : i.why,
      priority: i.priority,
      direction_id: i.kind === "dir_based" ? i.direction_id : null,
      gap_type: i.gap_type,
    })),
    personal_pattern_insights: u?.personal_pattern_insight.insights ?? [],
  };
}
