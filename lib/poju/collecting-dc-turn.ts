/**
 * Collecting-phase DC turn orchestration for `handleUserMessage`.
 *
 * M1 / M1-R: delegates to adaptive loop so the production order is:
 *   (Fresh session) Bootstrap DC+Blueprint+first plan
 *   OR Answer Interpretation → DC Update → Understanding → Question Plan
 *   → authorized question (drives assistant), not post-hoc whole-statement dump.
 *
 * Adoption rule unchanged: caller Session takes new DC only when C1 committed
 * (or idempotent_skip). Planning failure keeps committed DC.
 *
 * Fail-closed: persist_failed / persist_threw must NOT silently fall back to
 * old free-form Agent questioning (caller must surface an explicit error).
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
  /** Collecting mapper skipped this turn (no draft DC, empty / duplicate turn). */
  | "not_applied"
  /** C1 rolled back; caller Session returned unchanged, no planning. */
  | "persist_failed"
  /** DC mapper / persist threw; caller Session returned unchanged, no planning. */
  | "persist_threw"
  /**
   * Planner could not authorize a Catalog-scoped question while open Blueprint
   * P0/P1 obligations remain and hard budget remains. Nonterminal — do not
   * treat as investigation-complete / final-confirm.
   */
  | "planner_blocked";

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
  /** M1-R: true when this turn created draft DC from a brand-new session. */
  bootstrapped?: boolean;
};

function mapAdaptiveOutcome(turn: {
  session: POJUSessionState;
  outcome: string;
  persist_error?: string;
  ask_error?: string;
  authorized_question: string | null;
  plan: AdaptiveQuestionPlan | null;
  understanding: UnderstandingState | null;
  answer_event: AnswerEvent | null;
  bootstrapped?: boolean;
}, initOnly: boolean): CollectingDcTurnResult {
  const common = {
    authorized_question: turn.authorized_question,
    plan: turn.plan,
    understanding: turn.understanding,
    answer_event: turn.answer_event,
    ask_error: turn.ask_error,
    bootstrapped: turn.bootstrapped,
  };

  if (turn.outcome === "dc_persist_failed") {
    return {
      session: turn.session,
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
      session: turn.session,
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
  // M2.3-R2-FU2: planner_blocked must win over any replay/mapping ambiguity.
  if (turn.outcome === "planner_blocked") {
    return {
      session: turn.session,
      outcome: "planner_blocked",
      ask_planned: false,
      persist_error: turn.persist_error,
      ...common,
      ask_error: turn.ask_error ?? "planner_blocked",
      authorized_question: null,
      plan: null,
    };
  }
  if (turn.outcome === "idempotent_replay") {
    // Do not treat understanding!=null alone as successful question planning.
    // Prefer an actual plan, or an explicit readiness-stop (can_ask=false terminal verdict).
    const readinessStop =
      turn.understanding != null &&
      turn.understanding.readiness.can_ask === false &&
      (turn.understanding.readiness.verdict === "ready_for_final_confirm" ||
        turn.understanding.readiness.verdict === "hard_budget_exhausted");
    return {
      session: turn.session,
      outcome: "not_applied",
      ask_planned: Boolean(turn.plan) || (readinessStop && !turn.ask_error),
      persist_error: turn.persist_error ?? "turn_already_mapped",
      ...common,
    };
  }
  const skipWrite =
    turn.persist_error === "off_topic" ||
    turn.persist_error === "invalid_input" ||
    turn.persist_error === "no_writes" ||
    turn.persist_error === "empty_statement";

  return {
    session: turn.session,
    outcome: skipWrite && !initOnly ? "not_applied" : "dc_committed",
    ask_planned:
      Boolean(turn.plan) ||
      (turn.outcome === "ready_no_question" && !turn.ask_error),
    persist_error: turn.persist_error,
    ...common,
  };
}

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
  return mapAdaptiveOutcome(turn, Boolean(input.init_only));
}

/**
 * M1-R production pre-LLM entry.
 *
 * - No draft DC → fresh-session bootstrap (DC + Blueprint + first adaptive Q).
 * - Draft DC + no last_sent_question yet → init_only first Q (does not treat statement as answer).
 * - Draft DC + prior sent Q → answer interpretation path.
 */
export async function runM1ProductionPreLlmTurn(
  session: POJUSessionState,
  input: {
    statement: string;
    source_turn_id: string;
    now: string;
  },
): Promise<CollectingDcTurnResult> {
  const dc = session.decision_context;
  const hasDraft = dc?.status === "draft" || dc?.status === "final";

  // Brand-new session: no draft DC → bootstrap DC + Blueprint + first adaptive Q.
  // Do not interpret the decision question as an answer to a prior investigate ask.
  if (!hasDraft) {
    const { bootstrapFreshSessionMainLoop } = await import(
      "@/lib/poju/decision-intake/fresh-session-bootstrap"
    );
    const turn = await bootstrapFreshSessionMainLoop({
      session,
      statement: input.statement,
      source_turn_id: input.source_turn_id,
      now: input.now,
    });
    return mapAdaptiveOutcome(turn, true);
  }

  // Draft DC already present (seeded tests, Call B, or prior bootstrap): answer path.
  return runCollectingDcTurn(session, input);
}
