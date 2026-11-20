from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
text = p.read_text(encoding="utf-8")
if "async function handlePendingIntakeControlTurn" in text:
    raise SystemExit("already present")

# Hook terminal refusal and pending-bind resume before appending the handler.
old = '''  const planned = await input.planFromState(current, understanding, input.now);
  const session = withPendingAnswerResolution(planned.session, terminal);
  return {
    session,
    outcome: outcomeFromPlanResult(planned),
'''
new = '''  if (isActivePendingIntakeControl(current.pending_intake_control)) {
    const prepared = controlWithPlan(
      current,
      current.pending_intake_control!,
      input.now,
    );
    current = withPendingIntakeControl(current, prepared);
    current = withPendingAnswerResolution(current, terminal);
    return intakeControlOrchestrationResult({
      session: current,
      control: prepared,
      answer_event: input.answer_event,
      persist_error: "pending_answer_resolution_rejected",
      outcome: "planned",
    });
  }
  const planned = await input.planFromState(current, understanding, input.now);
  const session = withPendingAnswerResolution(planned.session, terminal);
  return {
    session,
    outcome: outcomeFromPlanResult(planned),
'''
assert old in text, "terminal refusal planFromState not found"
text = text.replace(old, new, 1)

old = '''    current = withPendingAnswerResolution(current, null);
    const bp2 = ensureDecisionBlueprint(current, { now: input.now });
    current = bp2.session;
    current = activateNextBlueprintPriorityBand(current, input.now);
    const understanding = input.buildUnderstanding({
      session: current,
      blueprint: current.decision_blueprint!,
      now: input.now,
      last_answer_event_id: answer_event.event_id,
    });
    const planned = await input.planFromState(current, understanding, input.now);
'''
new = '''    current = withPendingAnswerResolution(current, null);
    if (isActivePendingIntakeControl(current.pending_intake_control)) {
      const prepared = controlWithPlan(
        current,
        current.pending_intake_control!,
        input.now,
      );
      current = withPendingIntakeControl(current, prepared);
      return intakeControlOrchestrationResult({
        session: current,
        control: prepared,
        answer_event,
        persist_error: input.persist_error,
        outcome: "planned",
      });
    }
    const bp2 = ensureDecisionBlueprint(current, { now: input.now });
    current = bp2.session;
    current = activateNextBlueprintPriorityBand(current, input.now);
    const understanding = input.buildUnderstanding({
      session: current,
      blueprint: current.decision_blueprint!,
      now: input.now,
      last_answer_event_id: answer_event.event_id,
    });
    const planned = await input.planFromState(current, understanding, input.now);
'''
assert old in text, "pending bind resume planFromState not found"
text = text.replace(old, new, 1)

handler = r'''

async function handlePendingIntakeControlTurn(input: {
  current: POJUSessionState;
  original: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  locale?: string;
  signal?: AbortSignal;
  buildUnderstanding: (
    args: Parameters<typeof buildUnderstandingState>[0],
  ) => UnderstandingState;
  planFromState: typeof planFromState;
  test_hooks?: AdaptiveTurnTestHooks;
}): Promise<AdaptiveTurnResult> {
  let current = input.current;
  const controlRaw = current.pending_intake_control;
  if (!controlRaw) {
    return {
      session: current,
      outcome: "not_applicable_phase",
      answer_event: null,
      understanding: current.decision_understanding ?? null,
      plan: null,
      authorized_question: null,
      persist_error: "missing_pending_intake_control",
    };
  }
  let control = controlRaw;

  if (input.source_turn_id === control.source_turn_id) {
    const prepared = controlWithPlan(current, control, input.now);
    current = withPendingIntakeControl(current, prepared);
    return intakeControlOrchestrationResult({
      session: current,
      control: prepared,
      answer_event: null,
      persist_error: "pending_intake_control_replay",
      outcome: "idempotent_replay",
    });
  }

  if (input.source_turn_id === control.last_resolved_turn_id) {
    return replayInactiveIntakeControl({ session: current, control });
  }

  const resolving = nextPendingControlItem(control);
  if (!resolving) {
    if (control.entered_controlled_blueprint_update) {
      const entered =
        control.clarification_plan &&
        String(control.clarification_plan.ask_now_reason ?? "").includes(
          "goal_change_entered",
        )
          ? control.clarification_plan
          : buildEnteredBlueprintUpdatePlan({
              session: current,
              control,
              now: input.now,
            });
      if (!entered) {
        return intakeControlOrchestrationResult({
          session: current,
          control,
          answer_event: null,
          persist_error: "pending_intake_control_entered",
        });
      }
      const prepared: PendingIntakeControl = {
        ...control,
        clarification_plan: entered,
        clarification_plan_id: entered.plan_id,
      };
      current = withPendingIntakeControl(current, prepared);
      return intakeControlOrchestrationResult({
        session: current,
        control: prepared,
        answer_event: null,
        persist_error: "pending_intake_control_entered",
        outcome: "planned",
      });
    }
    return continueOrdinaryAfterIntakeControl({
      current,
      now: input.now,
      answer_event: null,
      buildUnderstanding: input.buildUnderstanding,
      planFromState: input.planFromState,
    });
  }

  if (resolving.kind === "goal_change") {
    const choice = parseGoalChangeConfirmation(input.statement);
    if (choice === "uncertain") {
      const prepared = updateControlItemStatus(control, resolving.item_id, "uncertain");
      const withPlan = controlWithPlan(current, prepared, input.now, resolving);
      current = withPendingIntakeControl(current, withPlan);
      return intakeControlOrchestrationResult({
        session: current,
        control: withPlan,
        answer_event: null,
        persist_error: "pending_intake_control_uncertain",
        outcome: "planned",
      });
    }
    if (choice === "confirm") {
      let prepared = updateControlItemStatus(control, resolving.item_id, "confirmed", {
        entered_controlled_blueprint_update: true,
        last_resolved_turn_id: input.source_turn_id,
      });
      const entered = buildEnteredBlueprintUpdatePlan({
        session: current,
        control: prepared,
        now: input.now,
      });
      prepared = {
        ...prepared,
        status: "resolved",
        clarification_plan: entered,
        clarification_plan_id: entered?.plan_id ?? null,
        resolving_item_id: null,
      };
      current = withPendingIntakeControl(current, prepared);
      // Do not mutate Blueprint or the confirmed DC definition.
      return intakeControlOrchestrationResult({
        session: current,
        control: prepared,
        answer_event: null,
        persist_error: "pending_intake_control_goal_change_entered",
        outcome: "planned",
      });
    }
    // decline: retain original target and resume its investigation.
    const prepared = updateControlItemStatus(control, resolving.item_id, "declined", {
      entered_controlled_blueprint_update: false,
      last_resolved_turn_id: input.source_turn_id,
    });
    current = withPendingIntakeControl(current, prepared);
    return continueOrdinaryAfterIntakeControl({
      current,
      now: input.now,
      answer_event: null,
      buildUnderstanding: input.buildUnderstanding,
      planFromState: input.planFromState,
      persist_error: "pending_intake_control_goal_change_declined",
    });
  }

  if (resolving.kind === "insight_mismatch") {
    if (isControlClarificationUncertain(input.statement)) {
      const prepared = updateControlItemStatus(control, resolving.item_id, "uncertain");
      const withPlan = controlWithPlan(current, prepared, input.now, resolving);
      current = withPendingIntakeControl(current, withPlan);
      return intakeControlOrchestrationResult({
        session: current,
        control: withPlan,
        answer_event: null,
        persist_error: "pending_intake_control_uncertain",
        outcome: "planned",
      });
    }
    const prepared = updateControlItemStatus(control, resolving.item_id, "clarified", {
      last_resolved_turn_id: input.source_turn_id,
    });
    const remaining = nextPendingControlItem(prepared);
    if (remaining) {
      const withPlan = controlWithPlan(current, prepared, input.now, remaining);
      current = withPendingIntakeControl(current, withPlan);
      return intakeControlOrchestrationResult({
        session: current,
        control: withPlan,
        answer_event: null,
        persist_error: undefined,
        outcome: "planned",
      });
    }
    current = withPendingIntakeControl(current, prepared);
    return continueOrdinaryAfterIntakeControl({
      current,
      now: input.now,
      answer_event: null,
      buildUnderstanding: input.buildUnderstanding,
      planFromState: input.planFromState,
      persist_error: "pending_intake_control_insight_clarified",
    });
  }

  // unresolved_aspect follow-up: interpret the clarification under the
  // originally authorized last_sent_question / plan role codes.
  if (isControlClarificationUncertain(input.statement)) {
    const prepared = updateControlItemStatus(control, resolving.item_id, "uncertain");
    const withPlan = controlWithPlan(current, prepared, input.now, resolving);
    current = withPendingIntakeControl(current, withPlan);
    return intakeControlOrchestrationResult({
      session: current,
      control: withPlan,
      answer_event: null,
      persist_error: "pending_intake_control_uncertain",
      outcome: "planned",
    });
  }

  const interpreted = await interpretAnswerWithModel({
    session: current,
    statement: input.statement,
    source_turn_id: input.source_turn_id,
    locale: input.locale,
    signal: input.signal,
    testHook: input.test_hooks?.interpretAnswerModel,
  });
  if (!interpreted.ok) {
    const outcome =
      interpreted.reason === "invalid_schema" || interpreted.reason === "invalid_json"
        ? "answer_interpretation_invalid_schema"
        : "answer_interpretation_failed";
    return {
      session: input.original,
      outcome,
      answer_event: null,
      understanding: null,
      plan: null,
      authorized_question: null,
      ask_error: `${interpreted.reason}:${interpreted.detail}`,
    };
  }
  const answer_event = answerEventFromModelDraft({
    session: current,
    statement: input.statement,
    source_turn_id: input.source_turn_id,
    draft: interpreted.draft,
  });
  // Resolve only the intended aspect. Do not absorb new model aspects into scope.
  let prepared = updateControlItemStatus(control, resolving.item_id, "clarified", {
    last_resolved_turn_id: input.source_turn_id,
  });

  try {
    const applied = await applyAnswerEventToSessionDc(current, answer_event, {
      now: input.now,
    });
    if (applied.applied) {
      const key = `dc_collect:${current.session_id}:${input.source_turn_id}`;
      const persisted = await persistDcLifecycleChange(
        input.original,
        applied.session,
        key,
      );
      if (persisted.error === "idempotent_skip") {
        current = persisted.session;
      } else if (!persisted.committed) {
        return {
          session: input.original,
          outcome: "dc_persist_failed",
          answer_event,
          understanding: null,
          plan: null,
          authorized_question: null,
          persist_error: persisted.error ?? "persist_failed",
        };
      } else {
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
    }
  } catch (e) {
    return {
      session: input.original,
      outcome: "dc_persist_threw",
      answer_event,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error: errorText(e),
    };
  }

  const remaining = nextPendingControlItem(prepared);
  if (remaining) {
    const withPlan = controlWithPlan(current, prepared, input.now, remaining);
    current = withPendingIntakeControl(current, withPlan);
    return intakeControlOrchestrationResult({
      session: current,
      control: withPlan,
      answer_event,
      persist_error: undefined,
      outcome: "planned",
    });
  }
  current = withPendingIntakeControl(current, prepared);
  return continueOrdinaryAfterIntakeControl({
    current,
    now: input.now,
    answer_event,
    buildUnderstanding: input.buildUnderstanding,
    planFromState: input.planFromState,
  });
}

async function continueOrdinaryAfterIntakeControl(input: {
  current: POJUSessionState;
  now: string;
  answer_event: AnswerEvent | null;
  buildUnderstanding: (
    args: Parameters<typeof buildUnderstandingState>[0],
  ) => UnderstandingState;
  planFromState: typeof planFromState;
  persist_error?: string;
}): Promise<AdaptiveTurnResult> {
  let current = input.current;
  const bp2 = ensureDecisionBlueprint(current, { now: input.now });
  current = bp2.session;
  current = activateNextBlueprintPriorityBand(current, input.now);
  const understanding = input.buildUnderstanding({
    session: current,
    blueprint: current.decision_blueprint!,
    now: input.now,
    last_answer_event_id: input.answer_event?.event_id ?? null,
  });
  const planned = await input.planFromState(current, understanding, input.now);
  return {
    session: planned.session,
    outcome: outcomeFromPlanResult(planned),
    ask_error: planned.planner_block
      ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
      : undefined,
    answer_event: input.answer_event,
    understanding: planned.understanding,
    plan: planned.plan,
    authorized_question: planned.authorized_question,
    persist_error: input.persist_error,
  };
}
'''
# append before end if file doesn't end with newline issues
if not text.endswith("\n"):
    text += "\n"
text = text + handler
p.write_text(text.replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("handler appended, file lines", text.count("\n"))
