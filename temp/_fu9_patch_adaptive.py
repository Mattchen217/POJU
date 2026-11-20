from pathlib import Path

p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\adaptive-turn.ts")
text = p.read_text(encoding="utf-8")

old_imp = '''import { activeTargets, answerEventFromModelDraft } from "./answer-interpretation";
'''
new_imp = '''import {
  activeTargets,
  answerEventFromModelDraft,
  extractGroundedProposedDecisionTarget,
} from "./answer-interpretation";
'''
assert old_imp in text
text = text.replace(old_imp, new_imp, 1)

old_ctrl = '''import {
  attachIntakeControlFromEvent,
  buildEnteredBlueprintUpdatePlan,
  buildIntakeControlPlan,
  controlWithPlan,
  isActivePendingIntakeControl,
  isControlClarificationUncertain,
  isIntakeControlPlan,
  nextPendingControlItem,
  parseGoalChangeConfirmation,
  updateControlItemStatus,
  withPendingIntakeControl,
} from "./pending-intake-control";
'''
new_ctrl = '''import {
  attachIntakeControlFromEvent,
  buildEnteredBlueprintUpdatePlan,
  buildIntakeControlPlan,
  controlWithPlan,
  hasResolvedProposedDecisionTarget,
  isActivePendingIntakeControl,
  isControlClarificationUncertain,
  isIntakeControlPlan,
  nextPendingControlItem,
  parseGoalChangeConfirmation,
  updateControlItemStatus,
  withPendingIntakeControl,
} from "./pending-intake-control";
'''
assert old_ctrl in text
text = text.replace(old_ctrl, new_ctrl, 1)

old_hook = '''  interpretAnswerModel?: import("./answer-interpretation-model").AnswerInterpretationModelHook;
};
'''
new_hook = '''  interpretAnswerModel?: import("./answer-interpretation-model").AnswerInterpretationModelHook;
  /**
   * @internal Test-only C1 substitute for intake-control clarification persist.
   * When omitted (production default), persistDcLifecycleChange is used.
   * Must never be set outside tests. Not a production bypass.
   */
  intakeControlPersist?: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
};
'''
assert old_hook in text
text = text.replace(old_hook, new_hook, 1)

helper = '''
async function applyAndPersistIntakeControlAnswer(input: {
  current: POJUSessionState;
  original: POJUSessionState;
  answer_event: AnswerEvent;
  source_turn_id: string;
  now: string;
  persist: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
}): Promise<
  | { ok: true; session: POJUSessionState }
  | {
      ok: false;
      outcome: "dc_persist_failed" | "dc_persist_threw";
      persist_error: string;
    }
> {
  try {
    const applied = await applyAnswerEventToSessionDc(input.current, input.answer_event, {
      now: input.now,
    });
    if (!applied.applied) {
      return { ok: true, session: input.current };
    }
    const key = `dc_collect:${input.current.session_id}:${input.source_turn_id}`;
    const persisted = await input.persist(input.original, applied.session, key);
    if (persisted.error === "idempotent_skip") {
      return { ok: true, session: persisted.session };
    }
    if (!persisted.committed) {
      return {
        ok: false,
        outcome: "dc_persist_failed",
        persist_error: persisted.error ?? "persist_failed",
      };
    }
    return {
      ok: true,
      session: {
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
        pending_intake_control:
          applied.session.pending_intake_control ??
          persisted.session.pending_intake_control,
      },
    };
  } catch (e) {
    return {
      ok: false,
      outcome: "dc_persist_threw",
      persist_error: errorText(e),
    };
  }
}

'''

# Insert helper just before handlePendingIntakeControlTurn
anchor = "async function handlePendingIntakeControlTurn(input: {"
assert anchor in text
text = text.replace(anchor, helper + anchor, 1)

old_goal = '''  if (resolving.kind === "goal_change") {
    const choice = parseGoalChangeConfirmation(input.statement);
'''
new_goal = '''  if (resolving.kind === "goal_change") {
    if (!hasResolvedProposedDecisionTarget(resolving)) {
      if (isControlClarificationUncertain(input.statement)) {
        const prepared = updateControlItemStatus(control, resolving.item_id, "uncertain");
        const withPlan = controlWithPlan(current, prepared, input.now, resolving);
        current = withPendingIntakeControl(current, withPlan);
        return intakeControlOrchestrationResult({
          session: current,
          control: withPlan,
          answer_event: null,
          persist_error: "pending_intake_control_goal_change_target_unresolved",
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
      const extracted = extractGroundedProposedDecisionTarget(
        interpreted.draft,
        input.statement,
      );
      const answer_event = answerEventFromModelDraft({
        session: current,
        statement: input.statement,
        source_turn_id: input.source_turn_id,
        draft: interpreted.draft,
      });
      if (!extracted.proposed_decision_target) {
        const withPlan = controlWithPlan(current, control, input.now, resolving);
        current = withPendingIntakeControl(current, withPlan);
        return intakeControlOrchestrationResult({
          session: current,
          control: withPlan,
          answer_event,
          persist_error: "pending_intake_control_goal_change_target_unresolved",
          outcome: "planned",
        });
      }
      const items = control.items.map((item) =>
        item.item_id === resolving.item_id
          ? {
              ...item,
              proposed_decision_target: extracted.proposed_decision_target,
              status: "pending" as const,
            }
          : item,
      );
      const updated = {
        ...control,
        items,
        clarification_plan: null,
        clarification_plan_id: null,
      };
      const withPlan = controlWithPlan(
        current,
        updated,
        input.now,
        items.find((item) => item.item_id === resolving.item_id) ?? resolving,
      );
      current = withPendingIntakeControl(current, withPlan);
      return intakeControlOrchestrationResult({
        session: current,
        control: withPlan,
        answer_event,
        persist_error: undefined,
        outcome: "planned",
      });
    }
    const choice = parseGoalChangeConfirmation(input.statement);
'''
assert old_goal in text, "goal_change start not found"
text = text.replace(old_goal, new_goal, 1)

old_insight = '''  if (resolving.kind === "insight_mismatch") {
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
'''
new_insight = '''  if (resolving.kind === "insight_mismatch") {
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
    const persistFn = input.test_hooks?.intakeControlPersist ?? persistDcLifecycleChange;
    const persisted = await applyAndPersistIntakeControlAnswer({
      current,
      original: input.original,
      answer_event,
      source_turn_id: input.source_turn_id,
      now: input.now,
      persist: persistFn,
    });
    if (!persisted.ok) {
      return {
        session: input.original,
        outcome: persisted.outcome,
        answer_event,
        understanding: null,
        plan: null,
        authorized_question: null,
        persist_error: persisted.persist_error,
      };
    }
    current = persisted.session;
    const resolution_status =
      answer_event.proposed_writes.length > 0 ? "clarified" : "clarified_without_dc_write";
    const record = {
      original_mismatch_item_id: resolving.item_id,
      original_mismatch_source_turn_id: resolving.source_turn_id,
      clarification_turn_id: input.source_turn_id,
      original_mismatch_text: resolving.text,
      clarification_text: input.statement.slice(0, 2000),
      answer_event_id: answer_event.event_id,
      resolution_status,
    };
    const existingRecords = control.resolution_records ?? [];
    const already = existingRecords.some(
      (row) =>
        row.clarification_turn_id === record.clarification_turn_id &&
        row.original_mismatch_item_id === record.original_mismatch_item_id,
    );
    const resolution_records = already ? existingRecords : [...existingRecords, record];
    const prepared = updateControlItemStatus(control, resolving.item_id, "clarified", {
      last_resolved_turn_id: input.source_turn_id,
      resolution_records,
    });
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
      persist_error: "pending_intake_control_insight_clarified",
    });
  }
'''
assert old_insight in text, "insight_mismatch block not found"
text = text.replace(old_insight, new_insight, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("patched adaptive-turn.ts")