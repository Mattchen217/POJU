/**
 * Collecting-phase DC turn orchestration for `handleUserMessage`.
 *
 * M1: delegates to runAdaptiveQuestionTurn so the production order is:
 *   Answer Interpretation → DC Update → Understanding → Question Plan
 *   → authorized question (drives assistant), not post-hoc whole-statement dump.
 *
 * Adoption rule unchanged: caller Session takes new DC only when C1 committed
 * (or idempotent_skip). Planning failure keeps committed DC.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import type {
  AdaptiveQuestionPlan,
  AnswerEvent,
  UnderstandingState,
} from "@/lib/poju/decision-intake/types";

export type CollectingDcTurnOutcome =
  /** DC committed by C1 (or prior commit via idempotent_skip) and adopted. */
  | "dc_committed"
  /** Collecting mapper skipped this turn (no draft DC, empty / duplicate turn…). */
  | "not_applied"
  /** C1 rolled back; caller Session returned unchanged, no planning. */
  | "persist_failed"
  /** DC mapper / persist threw; caller Session returned unchanged, no planning. */
  | "persist_threw";

export type CollectingDcTurnResult = {
  session: POJUSessionState;
  outcome: CollectingDcTurnOutcome;
  /** True when a next-ask plan (or readiness stop) was written onto `session`. */
  ask_planned: boolean;
  /** Persist error, mapper skip reason, or `idempotent_skip`. */
  persist_error?: string;
  /** Set when next-ask planning threw (DC stays as adopted). */
  ask_error?: string;
  /** M1: authorized question text that MUST drive the assistant turn. */
  authorized_question?: string | null;
  plan?: AdaptiveQuestionPlan | null;
  understanding?: UnderstandingState | null;
  answer_event?: AnswerEvent | null;
};

/**
 * Production collecting turn — M1 adaptive loop.
 * `init_only` builds Blueprint + first question without interpreting an answer.
 */
export async function runCollectingDcTurn(
  session: POJUSessionState,
  input: {
    statement: string;
    source_turn_id: string;
    now: string;
    init_only?: boolean;
  },
): Promise<CollectingDcTurnResult> {
  const { runAdaptiveQuestionTurn } = await import(
    "@/lib/poju/decision-intake/adaptive-turn"
  );
  const turn = await runAdaptiveQuestionTurn({
    session,
    statement: input.statement,
    source_turn_id: input.source_turn_id,
    now: input.now,
    init_only: input.init_only,
  });

  const common = {
    authorized_question: turn.authorized_question,
    plan: turn.plan,
    understanding: turn.understanding,
    answer_event: turn.answer_event,
    ask_error: turn.ask_error,
  };

  if (turn.outcome === "dc_persist_failed") {
    return {
      session,
      outcome: "persist_failed",
      ask_planned: false,
      persist_error: turn.persist_error,
      ...common,
      authorized_question: null,
      plan: null,
      understanding: null,
    };
  }
  if (turn.outcome === "dc_persist_threw") {
    return {
      session,
      outcome: "persist_threw",
      ask_planned: false,
      persist_error: turn.persist_error,
      ...common,
      authorized_question: null,
      plan: null,
      understanding: null,
    };
  }
  if (turn.outcome === "not_applicable_phase") {
    return {
      session: turn.session,
      outcome: "not_applied",
      ask_planned: false,
      persist_error: turn.persist_error,
      ...common,
    };
  }
  if (turn.outcome === "idempotent_replay") {
    return {
      session: turn.session,
      outcome: "not_applied",
      ask_planned: Boolean(turn.plan) || (turn.understanding != null && !turn.ask_error),
      persist_error: turn.persist_error ?? "turn_already_mapped",
      ...common,
    };
  }

  // planned | ready_no_question
  const skipWrite =
    turn.persist_error === "off_topic" ||
    turn.persist_error === "invalid_input" ||
    turn.persist_error === "no_writes" ||
    turn.persist_error === "empty_statement";

  return {
    session: turn.session,
    outcome: skipWrite && !input.init_only ? "not_applied" : "dc_committed",
    // Ask failure (ask_error) must not count as planned — S8-H3.
    ask_planned:
      Boolean(turn.plan) ||
      (turn.outcome === "ready_no_question" && !turn.ask_error),
    persist_error: turn.persist_error,
    ...common,
  };
}
