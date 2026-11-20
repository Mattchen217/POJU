# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\adaptive-turn.ts")
text = p.read_text(encoding="utf-8")

old_imp = '''import {
  answerEventFromPendingBind,
  authorizedRoleOptions,
  buildClarificationPlan,
  continuableUnresolvedItems,
  isRoleBindingReason,
  mergePendingResolution,
  nextResolvingItem,
  normalizePendingItems,
  parseCertaintyChoice,
  parseClarificationRoleChoice,
  parseConstraintConfirmChoice,
  parseDefinitionPatchChoice,
  pendingFromAnswerEvent,
  pendingWithRemainingItems,
  persistKeyForPendingBind,
  rejectPendingItem,
  withPendingAnswerResolution,
  type PendingBindChoice,
} from "./pending-answer-resolution";
'''
new_imp = '''import {
  answerEventFromPendingBind,
  asTerminalRejectedPending,
  authorizedRoleOptions,
  buildClarificationPlan,
  continuableUnresolvedItems,
  isActivePendingAnswerResolution,
  isPendingClarificationPlan,
  isRoleBindingReason,
  mergePendingResolution,
  nextResolvingItem,
  normalizePendingItems,
  parseCertaintyChoice,
  parseClarificationRoleChoice,
  parseConstraintConfirmChoice,
  parseDefinitionPatchChoice,
  pendingFromAnswerEvent,
  pendingWithRemainingItems,
  persistKeyForPendingBind,
  rejectPendingItem,
  withPendingAnswerResolution,
  type PendingBindChoice,
} from "./pending-answer-resolution";
'''
if old_imp not in text:
    raise SystemExit("import block not found")
text = text.replace(old_imp, new_imp, 1)

# Insert helpers after pendingOrchestrationResult function (after its closing brace
# and before the catalog fallback comment).
old_anchor = '''  return restored;
}

/**
 * Deterministic Catalog-scoped fallback for an unfinished Blueprint P0/P1 DIR.
'''
new_anchor = '''  return restored;
}

function liveNonClarificationPlan(
  session: POJUSessionState,
): AdaptiveQuestionPlan | null {
  const last = session.decision_understanding?.last_sent_question ?? null;
  const plan = session.adaptive_ask_plan;
  if (
    plan &&
    last &&
    last.plan_id === plan.plan_id &&
    !isPendingClarificationPlan(plan)
  ) {
    return plan;
  }
  return null;
}

function replayInactivePendingResolution(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
}): AdaptiveTurnResult {
  const terminal = isActivePendingAnswerResolution(input.pending)
    ? input.pending
    : asTerminalRejectedPending(input.pending);
  const session = withPendingAnswerResolution(input.session, terminal);
  const live = liveNonClarificationPlan(session);
  return {
    session,
    outcome: "idempotent_replay",
    answer_event: null,
    understanding: session.decision_understanding ?? null,
    plan: live,
    authorized_question: live?.question_text ?? null,
    persist_error: "pending_answer_resolution_replay",
  };
}

async function continueInvestigationAfterTerminalRefusal(input: {
  current: POJUSessionState;
  pending: PendingAnswerResolution;
  now: string;
  answer_event: AnswerEvent | null;
  buildUnderstanding: (
    args: Parameters<typeof buildUnderstandingState>[0],
  ) => UnderstandingState;
  planFromState: typeof planFromState;
}): Promise<AdaptiveTurnResult> {
  const terminal = asTerminalRejectedPending(input.pending);
  let current = withPendingAnswerResolution(input.current, terminal);
  const bp2 = ensureDecisionBlueprint(current, { now: input.now });
  current = bp2.session;
  current = withPendingAnswerResolution(
    activateNextBlueprintPriorityBand(current, input.now),
    terminal,
  );
  const understanding = input.buildUnderstanding({
    session: current,
    blueprint: current.decision_blueprint!,
    now: input.now,
    last_answer_event_id: input.answer_event?.event_id ?? null,
  });
  const planned = await input.planFromState(current, understanding, input.now);
  const session = withPendingAnswerResolution(planned.session, terminal);
  return {
    session,
    outcome: outcomeFromPlanResult(planned),
    ask_error: planned.planner_block
      ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
      : undefined,
    answer_event: input.answer_event,
    understanding: planned.understanding,
    plan: planned.plan,
    authorized_question: planned.authorized_question,
    persist_error: "pending_answer_resolution_rejected",
  };
}

/**
 * Deterministic Catalog-scoped fallback for an unfinished Blueprint P0/P1 DIR.
'''
if old_anchor not in text:
    raise SystemExit("pendingOrchestrationResult anchor not found")
text = text.replace(old_anchor, new_anchor, 1)

old_gate = '''    const existingPending = current.pending_answer_resolution;
    if (existingPending) {
      return handlePendingAnswerResolutionTurn({
        current,
        original: input.session,
        statement,
        source_turn_id: input.source_turn_id,
        now: input.now,
        buildUnderstanding,
        planFromState,
        persist_error: undefined,
        test_hooks: input.test_hooks,
      });
    }
'''
new_gate = '''    const existingPending = current.pending_answer_resolution;
    if (isActivePendingAnswerResolution(existingPending)) {
      return handlePendingAnswerResolutionTurn({
        current,
        original: input.session,
        statement,
        source_turn_id: input.source_turn_id,
        now: input.now,
        buildUnderstanding,
        planFromState,
        persist_error: undefined,
        test_hooks: input.test_hooks,
      });
    }
    if (
      existingPending &&
      input.source_turn_id === existingPending.source_turn_id
    ) {
      // Terminal or inactive pending: replay the original source turn without
      // restoring a refused clarification or recounting budget.
      return replayInactivePendingResolution({
        session: current,
        pending: existingPending,
      });
    }
'''
if old_gate not in text:
    raise SystemExit("existingPending gate not found")
text = text.replace(old_gate, new_gate, 1)

old_no_resolving = '''  const resolving = nextResolvingItem(pending);
  if (!resolving) {
    // All items refused or already processed — keep pending, never jump.
    return pendingOrchestrationResult({
      session: withPendingAnswerResolution(current, pending),
      pending,
      answer_event: null,
      persist_error:
        pending.status === "rejected"
          ? "pending_answer_resolution_rejected"
          : "pending_answer_resolution_unresolved",
      outcome: "planned",
    });
  }
'''
new_no_resolving = '''  const resolving = nextResolvingItem(pending);
  if (!resolving) {
    if ((pending.rejected_items ?? []).length > 0) {
      return continueInvestigationAfterTerminalRefusal({
        current,
        pending,
        now: input.now,
        answer_event: null,
        buildUnderstanding: input.buildUnderstanding,
        planFromState: input.planFromState,
      });
    }
    const sanitized = asTerminalRejectedPending({
      ...pending,
      rejected_items: pending.rejected_items ?? [],
    });
    return {
      session: withPendingAnswerResolution(current, sanitized),
      outcome: "planner_blocked",
      answer_event: null,
      understanding: current.decision_understanding ?? null,
      plan: null,
      authorized_question: null,
      persist_error: "pending_answer_resolution_unresolved",
      ask_error: "pending_clarification_plan_failed",
    };
  }
'''
if old_no_resolving not in text:
    raise SystemExit("!resolving branch not found")
text = text.replace(old_no_resolving, new_no_resolving, 1)

old_refuse = '''    if (parsed.reason === "refused") {
      const nextPending = rejectPendingItem({
        session: current,
        pending,
        item: resolving,
        rejected_at_turn_id: input.source_turn_id,
        rejected_statement: input.statement,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      return pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event: null,
        persist_error: "pending_answer_resolution_rejected",
        outcome: "planned",
      });
    }
'''
new_refuse = '''    if (parsed.reason === "refused") {
      const nextPending = rejectPendingItem({
        session: current,
        pending,
        item: resolving,
        rejected_at_turn_id: input.source_turn_id,
        rejected_statement: input.statement,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      if (!isActivePendingAnswerResolution(nextPending)) {
        return continueInvestigationAfterTerminalRefusal({
          current,
          pending: nextPending,
          now: input.now,
          answer_event: null,
          buildUnderstanding: input.buildUnderstanding,
          planFromState: input.planFromState,
        });
      }
      return pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event: null,
        persist_error: "pending_answer_resolution_rejected",
        outcome: "planned",
      });
    }
'''
if old_refuse not in text:
    raise SystemExit("refused branch not found")
text = text.replace(old_refuse, new_refuse, 1)

old_last_rejected = '''    if ((pending.rejected_items ?? []).length > 0) {
      const nextPending = pendingWithRemainingItems({
        session: current,
        pending,
        remaining: [],
        rejected_items: pending.rejected_items,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      return pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event,
        persist_error: "pending_answer_resolution_rejected",
        outcome: "planned",
      });
    }
'''
new_last_rejected = '''    if ((pending.rejected_items ?? []).length > 0) {
      const nextPending = pendingWithRemainingItems({
        session: current,
        pending,
        remaining: [],
        rejected_items: pending.rejected_items,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      return continueInvestigationAfterTerminalRefusal({
        current,
        pending: nextPending,
        now: input.now,
        answer_event,
        buildUnderstanding: input.buildUnderstanding,
        planFromState: input.planFromState,
      });
    }
'''
if old_last_rejected not in text:
    raise SystemExit("last-item-with-rejected branch not found")
text = text.replace(old_last_rejected, new_last_rejected, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("adaptive-turn.ts patched", len(text))
