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
};

export function projectAdaptiveQuestionForUi(
  session: POJUSessionState,
): AdaptiveQuestionUiProjection {
  const u = session.decision_understanding;
  const plan = session.adaptive_ask_plan ?? u?.next_question_plan ?? null;
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
  };
}
