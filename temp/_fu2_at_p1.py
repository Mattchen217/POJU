from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")

def sub(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f"NOT FOUND: {label}")
    text = text.replace(old, new, 1)
    print("patched", label)

sub(
    'import { answerEventFromModelDraft } from "./answer-interpretation";\n',
    'import { activeTargets, answerEventFromModelDraft } from "./answer-interpretation";\n',
    "import-activeTargets",
)

sub(
    '''import type {
  AdaptiveQuestionPlan,
  AdaptiveTurnResult,
  AnswerEvent,
  NeedItem,
  UnderstandingState,
} from "./types";
''',
    '''import type {
  AdaptiveQuestionPlan,
  AdaptiveTurnResult,
  AnswerEvent,
  NeedItem,
  PendingAnswerResolution,
  UnderstandingState,
} from "./types";
import {
  answerEventFromPendingBind,
  authorizedRoleOptions,
  buildRoleClarificationPlan,
  mergePendingResolution,
  parseClarificationRoleChoice,
  pendingFromAnswerEvent,
  persistKeyForPendingBind,
  roleBindingUnresolvedItems,
  withPendingAnswerResolution,
} from "./pending-answer-resolution";
''',
    "import-pending",
)

# Insert pending handler after withUnderstanding
sub(
    '''function outcomeFromPlanResult(planned: {
  plan: AdaptiveQuestionPlan | null;
  planner_block: { reason_code: string; detail: string } | null;
}): AdaptiveTurnResult["outcome"] {
  if (planned.plan) return "planned";
  if (planned.planner_block) return "planner_blocked";
  return "ready_no_question";
}
''',
    '''function outcomeFromPlanResult(planned: {
  plan: AdaptiveQuestionPlan | null;
  planner_block: { reason_code: string; detail: string } | null;
}): AdaptiveTurnResult["outcome"] {
  if (planned.plan) return "planned";
  if (planned.planner_block) return "planner_blocked";
  return "ready_no_question";
}

function sessionHasWritesFromTurn(session: POJUSessionState, turnId: string): boolean {
  const dc = session.decision_context;
  if (!dc) return false;
  return (
    dc.reality_facts.some((f) => f.source_turn_id === turnId) ||
    dc.constraints.some((c) => c.source_turn_id === turnId)
  );
}

function sessionWithClarificationPlan(
  session: POJUSessionState,
  pending: PendingAnswerResolution,
  plan: AdaptiveQuestionPlan,
): POJUSessionState {
  const understanding = session.decision_understanding
    ? {
        ...session.decision_understanding,
        next_question_plan: plan,
      }
    : null;
  const withPending = withPendingAnswerResolution(session, pending);
  if (!understanding) {
    return { ...withPending, adaptive_ask_plan: plan };
  }
  return withUnderstanding(withPending, understanding, plan, withPending.intake_ask_plan ?? null);
}

function restoreClarificationResult(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  answer_event: AnswerEvent | null;
  persist_error?: string;
  outcome: AdaptiveTurnResult["outcome"];
}): AdaptiveTurnResult {
  const plan = input.pending.clarification_plan;
  const session = plan
    ? sessionWithClarificationPlan(input.session, input.pending, plan)
    : withPendingAnswerResolution(input.session, input.pending);
  return {
    session,
    outcome: input.outcome,
    answer_event: input.answer_event,
    understanding: session.decision_understanding ?? null,
    plan,
    authorized_question: plan?.question_text ?? null,
    persist_error: input.persist_error,
    ask_error: plan
      ? undefined
      : "pending_clarification_plan_failed",
  };
}
''',
    "helpers",
)

p.write_text(text, encoding="utf-8", newline="\n")
print("adaptive-turn imports and helpers written")
