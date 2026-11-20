from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
text = p.read_text(encoding="utf-8")
old = '''function liveNonClarificationPlan(
  session: POJUSessionState,
): AdaptiveQuestionPlan | null {
'''
new = r'''function sessionWithIntakeControlPlan(
  session: POJUSessionState,
  control: PendingIntakeControl,
  plan: AdaptiveQuestionPlan,
): POJUSessionState {
  const understanding = session.decision_understanding
    ? {
        ...session.decision_understanding,
        next_question_plan: plan,
      }
    : null;
  const withControl = withPendingIntakeControl(session, control);
  if (!understanding) {
    return { ...withControl, adaptive_ask_plan: plan };
  }
  return withUnderstanding(withControl, understanding, plan, withControl.intake_ask_plan ?? null);
}

function intakeControlOrchestrationResult(input: {
  session: POJUSessionState;
  control: PendingIntakeControl;
  answer_event: AnswerEvent | null;
  persist_error?: string;
  outcome?: AdaptiveTurnResult["outcome"];
}): AdaptiveTurnResult {
  const plan = input.control.clarification_plan;
  const session = plan
    ? sessionWithIntakeControlPlan(input.session, input.control, plan)
    : withPendingIntakeControl(input.session, input.control);
  if (!plan) {
    return {
      session,
      outcome: "planner_blocked",
      answer_event: input.answer_event,
      understanding: session.decision_understanding ?? null,
      plan: null,
      authorized_question: null,
      persist_error: input.persist_error,
      ask_error: "pending_intake_control_plan_failed",
    };
  }
  return {
    session,
    outcome: input.outcome ?? "planned",
    answer_event: input.answer_event,
    understanding: session.decision_understanding ?? null,
    plan,
    authorized_question: plan.question_text,
    persist_error: input.persist_error,
  };
}

function replayInactiveIntakeControl(input: {
  session: POJUSessionState;
  control: PendingIntakeControl;
}): AdaptiveTurnResult {
  const session = withPendingIntakeControl(input.session, input.control);
  if (input.control.entered_controlled_blueprint_update && input.control.clarification_plan) {
    return intakeControlOrchestrationResult({
      session,
      control: input.control,
      answer_event: null,
      persist_error: "pending_intake_control_replay",
      outcome: "idempotent_replay",
    });
  }
  const live =
    liveNonClarificationPlan(session) &&
    !isIntakeControlPlan(liveNonClarificationPlan(session))
      ? liveNonClarificationPlan(session)
      : session.adaptive_ask_plan && !isIntakeControlPlan(session.adaptive_ask_plan)
        ? session.adaptive_ask_plan
        : null;
  return {
    session,
    outcome: "idempotent_replay",
    answer_event: null,
    understanding: session.decision_understanding ?? null,
    plan: live,
    authorized_question: live?.question_text ?? null,
    persist_error: "pending_intake_control_replay",
  };
}

function liveNonClarificationPlan(
  session: POJUSessionState,
): AdaptiveQuestionPlan | null {
'''
assert old in text
text = text.replace(old, new, 1)
p.write_text(text.replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("helpers inserted")
