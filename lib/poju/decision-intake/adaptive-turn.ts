/**
 * M1 Production Adaptive Question Turn orchestrator.
 *
 * Order (normative):
 *   User Answer → Answer Interpretation → DC Update → Understanding
 *   → Need / Insight → Question Planning → Scope/Depth/Budget Validation
 *   → Generate Next Question → Persist → (Agent returns assistant from plan)
 *
 * Sole production entry used by collecting-dc-turn / handleUserMessage.
 * Answer Interpretation + Question Generation are **v1 simplified** (see those modules).
 * Fresh sessions without draft DC enter via bootstrapFreshSessionMainLoop (M1-R).
 */

import type { POJUSessionState } from "@/lib/poju/types";
import {
  buildIntakeCandidatesFromDc,
  INTAKE_ASK_SCORING_PATH,
  type IntakeAskPlanSnapshot,
} from "@/lib/poju/decision-context/production-intake-ask";
import { planNextAskFromCandidates } from "@/lib/poju/decision-context/question-plan-cycle";
import { snapshotFromDc } from "@/lib/poju/decision-context/question-planning";
import { buildProductionNaValidationContextFromSession } from "@/lib/poju/decision-context/na-validation-from-session";
import { persistDcLifecycleChange } from "@/lib/poju/decision-context/production-dc-lifecycle";
import { interpretUserAnswer } from "./answer-interpretation";
import { applyAnswerEventToSessionDc } from "./apply-answer-to-dc";
import { ensureDecisionBlueprint } from "./blueprint";
import { buildAdaptiveQuestionPlan } from "./question-generation";
import { bumpBudgetAfterAsk } from "./scope-budget";
import { buildUnderstandingState } from "./understanding-state";
import type {
  AdaptiveQuestionPlan,
  AdaptiveTurnResult,
  AnswerEvent,
  UnderstandingState,
} from "./types";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function withUnderstanding(
  session: POJUSessionState,
  understanding: UnderstandingState,
  plan: AdaptiveQuestionPlan | null,
  askSnap: IntakeAskPlanSnapshot | null,
): POJUSessionState {
  return {
    ...session,
    decision_understanding: understanding,
    adaptive_ask_plan: plan,
    intake_ask_plan: askSnap ?? session.intake_ask_plan ?? null,
  };
}

/**
 * Run one adaptive collecting turn.
 * When `statement` is empty and `init_only`, only ensures Blueprint + first plan.
 */
export async function runAdaptiveQuestionTurn(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  /** Skip answer interpretation; plan from current DC (session init / first ask). */
  init_only?: boolean;
}): Promise<AdaptiveTurnResult> {
  let current = input.session;
  const dc0 = current.decision_context;
  if (!dc0 || (dc0.status !== "draft" && dc0.status !== "final")) {
    return {
      session: current,
      outcome: "not_applicable_phase",
      answer_event: null,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error: "no_dc",
    };
  }

  // 1) Blueprint
  const bp = ensureDecisionBlueprint(current, { now: input.now });
  current = bp.session;

  let answer_event: AnswerEvent | null = null;
  let persist_error: string | undefined;

  // 2) Answer Interpretation → DC Update (unless init_only)
  if (!input.init_only) {
    const statement = input.statement.trim();
    if (!statement) {
      return {
        session: current,
        outcome: "not_applicable_phase",
        answer_event: null,
        understanding: null,
        plan: null,
        authorized_question: null,
        persist_error: "empty_statement",
      };
    }
    answer_event = interpretUserAnswer({
      session: current,
      statement,
      source_turn_id: input.source_turn_id,
      now: input.now,
    });

    try {
      const applied = await applyAnswerEventToSessionDc(current, answer_event, {
        now: input.now,
      });
      if (applied.skipped_reason === "turn_already_mapped") {
        // Idempotent replay: rebuild understanding/plan from existing DC, no dup writes.
        const understanding = buildUnderstandingState({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);
        return {
          session: planned.session,
          outcome: "idempotent_replay",
          answer_event,
          understanding: planned.understanding,
          plan: planned.plan,
          authorized_question: planned.authorized_question,
          persist_error: "turn_already_mapped",
        };
      }
      if (!applied.applied) {
        // Off-topic / invalid: still recompute understanding; may keep prior needs.
        const understanding = buildUnderstandingState({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);
        return {
          session: planned.session,
          outcome: planned.plan ? "planned" : "ready_no_question",
          answer_event,
          understanding: planned.understanding,
          plan: planned.plan,
          authorized_question: planned.authorized_question,
          persist_error: applied.skipped_reason,
        };
      }

      // Persist DC via C1
      const key = `dc_collect:${current.session_id}:${input.source_turn_id}`;
      const persisted = await persistDcLifecycleChange(
        input.session,
        applied.session,
        key,
      );
      if (persisted.error === "idempotent_skip") {
        current = persisted.session;
        persist_error = "idempotent_skip";
      } else if (!persisted.committed) {
        return {
          session: input.session,
          outcome: "dc_persist_failed",
          answer_event,
          understanding: null,
          plan: null,
          authorized_question: null,
          persist_error: persisted.error ?? "persist_failed",
        };
      } else {
        // Keep C1 revision mirrors from commit.session — caller/savePOJUSession
        // must not see a stale session_revision after DC write.
        current = {
          ...applied.session,
          ...persisted.session,
          decision_context:
            persisted.session.decision_context ?? applied.session.decision_context,
          decision_context_versions:
            persisted.session.decision_context_versions ??
            applied.session.decision_context_versions,
          decision_context_idempotency_keys:
            persisted.session.decision_context_idempotency_keys ??
            applied.session.decision_context_idempotency_keys,
          control_plane:
            persisted.session.control_plane ?? applied.session.control_plane,
          decision_blueprint: applied.session.decision_blueprint,
          messages: applied.session.messages,
          agent_v2: applied.session.agent_v2,
          session_revision: persisted.session.session_revision,
          dc_write_revision: persisted.session.dc_write_revision,
        };
      }
    } catch (e) {
      return {
        session: input.session,
        outcome: "dc_persist_threw",
        answer_event,
        understanding: null,
        plan: null,
        authorized_question: null,
        persist_error: errorText(e),
      };
    }
  }

  // Ensure blueprint present after persist merge
  const bp2 = ensureDecisionBlueprint(current, { now: input.now });
  current = bp2.session;

  // 3–8) Understanding → Plan → Validate → Generate
  try {
    const understanding0 = buildUnderstandingState({
      session: current,
      blueprint: current.decision_blueprint!,
      now: input.now,
      last_answer_event_id: answer_event?.event_id ?? null,
    });
    const planned = await planFromState(current, understanding0, input.now);
    return {
      session: planned.session,
      outcome: planned.plan ? "planned" : "ready_no_question",
      answer_event,
      understanding: planned.understanding,
      plan: planned.plan,
      authorized_question: planned.authorized_question,
      persist_error,
    };
  } catch (e) {
    return {
      session: current,
      outcome: "ready_no_question",
      answer_event,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error,
      ask_error: errorText(e),
    };
  }
}

async function planFromState(
  session: POJUSessionState,
  understanding: UnderstandingState,
  now: string,
): Promise<{
  session: POJUSessionState;
  understanding: UnderstandingState;
  plan: AdaptiveQuestionPlan | null;
  authorized_question: string | null;
}> {
  const dc = session.decision_context!;
  const blueprint = session.decision_blueprint!;
  let budget = understanding.budget;

  if (!understanding.readiness.can_ask) {
    const u = {
      ...understanding,
      next_question_plan: null,
      last_sent_question: null,
      budget,
    };
    return {
      session: withUnderstanding(session, u, null, session.intake_ask_plan ?? null),
      understanding: u,
      plan: null,
      authorized_question: null,
    };
  }

  const candidates = buildIntakeCandidatesFromDc(dc).map((c) => {
    const dirId = c.dir_ids[0];
    const depth = dirId ? (budget.depth_by_dir[dirId] ?? 0) + 1 : c.depth;
    // Filter completed dirs already handled in builder; enforce depth cap here.
    return { ...c, depth, repetition_count: Math.max(0, depth - 1) };
  }).filter((c) => {
    const dirId = c.dir_ids[0];
    if (!dirId) return true;
    const used = budget.depth_by_dir[dirId] ?? 0;
    return used < blueprint.question_budget.depth_per_direction;
  });

  const naValidation = await buildProductionNaValidationContextFromSession(
    session,
    { nowIso: now },
  );
  const planResult = planNextAskFromCandidates({
    candidates,
    snap: snapshotFromDc(dc),
    naValidation,
    remaining_hard_budget: budget.remaining_hard_budget,
  });

  const askSnap: IntakeAskPlanSnapshot = {
    scored_at: now,
    scoring_path: INTAKE_ASK_SCORING_PATH,
    selected_candidate_id: planResult.selected?.candidate.candidate_id ?? null,
    ranked_candidate_ids: planResult.ranked.map((r) => r.candidate.candidate_id),
    unresolved_counts: Object.fromEntries(
      planResult.ranked.map((r) => [
        r.candidate.candidate_id,
        r.score.unresolved_count,
      ]),
    ),
    gap_types: Object.fromEntries(
      planResult.ranked.map((r) => [r.candidate.candidate_id, r.score.gap_type]),
    ),
  };

  if (!planResult.selected) {
    const u: UnderstandingState = {
      ...understanding,
      next_question_plan: null,
      readiness: {
        ...understanding.readiness,
        verdict:
          budget.remaining_hard_budget <= 0
            ? "hard_budget_exhausted"
            : "ready_for_final_confirm",
        can_ask: false,
        reasons: [
          ...understanding.readiness.reasons,
          "no_selectable_candidate",
        ],
      },
    };
    return {
      session: withUnderstanding(session, u, null, askSnap),
      understanding: u,
      plan: null,
      authorized_question: null,
    };
  }

  const built = buildAdaptiveQuestionPlan({
    dc,
    blueprint,
    selected: planResult.selected,
    budget,
    now,
    scoring_path: `${INTAKE_ASK_SCORING_PATH}→buildAdaptiveQuestionPlan`,
  });

  if (!built.validation.ok) {
    // Try next ranked candidates within budget/scope.
    for (const ranked of planResult.ranked.slice(1)) {
      const alt = buildAdaptiveQuestionPlan({
        dc,
        blueprint,
        selected: ranked,
        budget,
        now,
        scoring_path: `${INTAKE_ASK_SCORING_PATH}→buildAdaptiveQuestionPlan`,
      });
      if (alt.validation.ok) {
        const u: UnderstandingState = {
          ...understanding,
          budget,
          next_question_plan: alt.plan,
          last_sent_question: null,
        };
        return {
          session: withUnderstanding(session, u, alt.plan, askSnap),
          understanding: u,
          plan: alt.plan,
          authorized_question: alt.plan.question_text,
        };
      }
    }
    const u: UnderstandingState = {
      ...understanding,
      next_question_plan: null,
      readiness: {
        verdict: "ready_for_final_confirm",
        can_ask: false,
        reasons: [
          ...understanding.readiness.reasons,
          `scope_budget_reject:${built.validation.reason_code}`,
        ],
      },
    };
    return {
      session: withUnderstanding(session, u, null, askSnap),
      understanding: u,
      plan: null,
      authorized_question: null,
    };
  }

  const u: UnderstandingState = {
    ...understanding,
    budget,
    next_question_plan: built.plan,
    last_sent_question: understanding.last_sent_question,
  };
  return {
    session: withUnderstanding(session, u, built.plan, askSnap),
    understanding: u,
    plan: built.plan,
    authorized_question: built.plan.question_text,
  };
}

/** Mark a plan as actually shown without double-counting (restore same plan_id). */
export function attachAuthorizedAssistantQuestion(
  session: POJUSessionState,
  plan: AdaptiveQuestionPlan,
  turnId: string,
): POJUSessionState {
  const understanding = session.decision_understanding;
  if (!understanding) {
    return {
      ...session,
      adaptive_ask_plan: plan,
    };
  }
  const already =
    understanding.last_sent_question?.plan_id === plan.plan_id;
  const budget = already
    ? understanding.budget
    : bumpBudgetAfterAsk(understanding.budget, plan);
  return {
    ...session,
    adaptive_ask_plan: plan,
    decision_understanding: {
      ...understanding,
      budget,
      next_question_plan: plan,
      last_sent_question: {
        question_text: plan.question_text,
        plan_id: plan.plan_id,
        direction_id: plan.direction_id,
        dir_ids: plan.dir_ids,
        ddr_ids: plan.ddr_ids,
        turn_id: turnId,
      },
    },
  };
}
