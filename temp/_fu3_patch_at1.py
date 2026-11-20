from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\adaptive-turn.ts")
text = p.read_text(encoding="utf-8")

old_imp = '''import {
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
'''
new_imp = '''import {
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
assert old_imp in text, "imports not found"
text = text.replace(old_imp, new_imp)

old_hooks = '''  conflictClarifyPersist?: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
'''
new_hooks = '''  conflictClarifyPersist?: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
  /**
   * @internal Test-only C1 substitute for pending-bind persist.
   * When omitted (production default), persistDcLifecycleChange is used.
   * Must never be set outside tests.
   */
  pendingBindPersist?: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
'''
assert old_hooks in text, "hooks not found"
text = text.replace(old_hooks, new_hooks)

# restoreClarificationResult: upgrade ask_error already present. Add helper after it.
old_restore_end = '''    ask_error: plan
      ? undefined
      : "pending_clarification_plan_failed",
  };
}
'''
new_restore_end = '''    ask_error: plan
      ? undefined
      : "pending_clarification_plan_failed",
  };
}

function pendingOrchestrationResult(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  answer_event: AnswerEvent | null;
  persist_error?: string;
  outcome?: AdaptiveTurnResult["outcome"];
}): AdaptiveTurnResult {
  const restored = restoreClarificationResult({
    session: input.session,
    pending: input.pending,
    answer_event: input.answer_event,
    persist_error: input.persist_error,
    outcome: input.outcome ?? "planned",
  });
  if (!restored.plan) {
    return {
      ...restored,
      outcome: "planner_blocked",
      ask_error: restored.ask_error ?? "pending_clarification_plan_failed",
      authorized_question: null,
    };
  }
  return restored;
}
'''
assert old_restore_end in text, "restoreClarificationResult end not found"
text = text.replace(old_restore_end, new_restore_end)

# existing pending check: any pending object, not only status===pending
old_pend_enter = '''    const existingPending = current.pending_answer_resolution;
    if (existingPending && existingPending.status === "pending") {
      return handlePendingAnswerResolutionTurn({
        current,
        original: input.session,
        statement,
        source_turn_id: input.source_turn_id,
        now: input.now,
        buildUnderstanding,
        planFromState,
        persist_error: undefined,
      });
    }
'''
new_pend_enter = '''    const existingPending = current.pending_answer_resolution;
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
assert old_pend_enter in text, "pending enter not found"
text = text.replace(old_pend_enter, new_pend_enter)

old_role_unres = '''    const roleUnresolved = roleBindingUnresolvedItems(
      answer_event.unresolved_items,
    );
'''
new_role_unres = '''    const pendingUnresolved = continuableUnresolvedItems(
      answer_event.unresolved_items,
    );
'''
assert old_role_unres in text, "roleUnresolved not found"
text = text.replace(old_role_unres, new_role_unres)

# replace roleUnresolved usages in this function
text = text.replace("if (roleUnresolved.length > 0 && applied.skipped_reason !== \"turn_already_mapped\") {",
                    "if (pendingUnresolved.length > 0 && applied.skipped_reason !== \"turn_already_mapped\") {")
text = text.replace("if (roleUnresolved.length > 0) {",
                    "if (pendingUnresolved.length > 0) {")

# fail closed when pending has no plan after finishPendingFromEvent (two sites)
old_no_apply = '''        if (pendingUnresolved.length > 0 && applied.skipped_reason !== "turn_already_mapped") {
          current = finishPendingFromEvent(current, answer_event, statement, input.now);
          return restoreClarificationResult({
            session: current,
            pending: current.pending_answer_resolution!,
            answer_event,
            persist_error: "pending_answer_resolution",
            outcome: "planned",
          });
        }
'''
new_no_apply = '''        if (pendingUnresolved.length > 0 && applied.skipped_reason !== "turn_already_mapped") {
          current = finishPendingFromEvent(current, answer_event, statement, input.now);
          return pendingOrchestrationResult({
            session: current,
            pending: current.pending_answer_resolution!,
            answer_event,
            persist_error: "pending_answer_resolution",
            outcome: "planned",
          });
        }
'''
assert old_no_apply in text, "no-apply pending branch not found"
text = text.replace(old_no_apply, new_no_apply)

old_after_persist = '''      if (pendingUnresolved.length > 0) {
        current = finishPendingFromEvent(current, answer_event, statement, input.now);
        return restoreClarificationResult({
          session: current,
          pending: current.pending_answer_resolution!,
          answer_event,
          persist_error,
          outcome: "planned",
        });
      }
'''
new_after_persist = '''      if (pendingUnresolved.length > 0) {
        current = finishPendingFromEvent(current, answer_event, statement, input.now);
        return pendingOrchestrationResult({
          session: current,
          pending: current.pending_answer_resolution!,
          answer_event,
          persist_error,
          outcome: "planned",
        });
      }
'''
assert old_after_persist in text, "after-persist pending branch not found"
text = text.replace(old_after_persist, new_after_persist)

# finishPendingFromEvent: keep using pendingFromAnswerEvent + buildClarificationPlan
old_finish = '''  const merged = mergePendingResolution(existing, incoming);
  const plan =
    merged.clarification_plan ??
    buildRoleClarificationPlan({ session, pending: merged, now });
  const pending: PendingAnswerResolution = plan
    ? { ...merged, clarification_plan: plan, clarification_plan_id: plan.plan_id }
    : merged;
  return withPendingAnswerResolution(session, pending);
}
'''
new_finish = '''  const merged = mergePendingResolution(existing, incoming);
  const resolving = nextResolvingItem(merged);
  const plan =
    (merged.clarification_plan &&
    resolving &&
    merged.clarification_plan_id &&
    merged.resolving_item_id === resolving.item_id
      ? merged.clarification_plan
      : null) ??
    buildClarificationPlan({ session, pending: merged, now, item: resolving });
  const pending: PendingAnswerResolution = plan
    ? {
        ...merged,
        clarification_plan: plan,
        clarification_plan_id: plan.plan_id,
        resolving_item_id: resolving?.item_id ?? merged.resolving_item_id,
      }
    : merged;
  return withPendingAnswerResolution(session, pending);
}
'''
assert old_finish in text, "finishPendingFromEvent tail not found"
text = text.replace(old_finish, new_finish)

p.write_text(text, encoding="utf-8", newline="\n")
print("adaptive-turn.ts partial patch ok")
