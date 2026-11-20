from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")
if "function finishPendingFromEvent" in text:
    raise SystemExit("already has finishPendingFromEvent")
if not text.endswith("\n"):
    text += "\n"

text += '''
function finishPendingFromEvent(
  session: POJUSessionState,
  event: AnswerEvent,
  statement: string,
  now: string,
): POJUSessionState {
  const incoming = pendingFromAnswerEvent({
    session,
    event,
    statement,
    now,
  });
  if (!incoming) return session;
  const existing = session.pending_answer_resolution;
  // Same pending task only — never spawn a parallel clarification for a new source.
  if (existing && existing.status === "pending" && existing.source_turn_id !== incoming.source_turn_id) {
    return session;
  }
  const merged = mergePendingResolution(existing, incoming);
  const plan =
    merged.clarification_plan ??
    buildRoleClarificationPlan({ session, pending: merged, now });
  const pending: PendingAnswerResolution = plan
    ? { ...merged, clarification_plan: plan, clarification_plan_id: plan.plan_id }
    : merged;
  return withPendingAnswerResolution(session, pending);
}

async function handlePendingAnswerResolutionTurn(input: {
  current: POJUSessionState;
  original: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  buildUnderstanding: (
    args: Parameters<typeof buildUnderstandingState>[0],
  ) => UnderstandingState;
  planFromState: typeof planFromState;
  persist_error?: string;
}): Promise<AdaptiveTurnResult> {
  let current = input.current;
  const pending = current.pending_answer_resolution;
  if (!pending || pending.status !== "pending") {
    return {
      session: current,
      outcome: "not_applicable_phase",
      answer_event: null,
      understanding: current.decision_understanding ?? null,
      plan: null,
      authorized_question: null,
      persist_error: "missing_pending_answer_resolution",
    };
  }

  // Replay of the original extracted-answer turn: restore the already-sent
  // clarification question. Do not regenerate, recount budget, or rewrite DC.
  if (input.source_turn_id === pending.source_turn_id) {
    return restoreClarificationResult({
      session: current,
      pending,
      answer_event: null,
      persist_error: "pending_answer_resolution_replay",
      outcome: "idempotent_replay",
    });
  }

  const options = authorizedRoleOptions(current, pending.authorized_role_codes);
  const choice = parseClarificationRoleChoice(input.statement, options);
  if (!choice.ok) {
    return restoreClarificationResult({
      session: current,
      pending,
      answer_event: null,
      persist_error: "pending_answer_resolution_unresolved",
      outcome: "planned",
    });
  }

  const targets = activeTargets(current);
  const authorized = pending.authorized_role_codes;
  if (!authorized.includes(choice.role_code)) {
    return restoreClarificationResult({
      session: current,
      pending,
      answer_event: null,
      persist_error: "pending_answer_resolution_unauthorized",
      outcome: "planned",
    });
  }
  // If last_sent still carries authorized codes, they must continue to allow this code.
  if (
    targets.fact_role_codes.length > 0 &&
    !targets.fact_role_codes.includes(choice.role_code)
  ) {
    return restoreClarificationResult({
      session: current,
      pending,
      answer_event: null,
      persist_error: "pending_answer_resolution_unauthorized",
      outcome: "planned",
    });
  }
  if (targets.auth_error === "missing_authorized_answer_target") {
    return restoreClarificationResult({
      session: current,
      pending,
      answer_event: null,
      persist_error: "missing_authorized_answer_target",
      outcome: "planned",
    });
  }

  const bindable =
    pending.unresolved_items.filter((item) =>
      ["unlocated_role_code", "unauthorized_role_code", "illegal_role_code"].includes(
        item.reason,
      ),
    );
  const pendingForBind: PendingAnswerResolution =
    bindable.length <= 1
      ? pending
      : { ...pending, unresolved_items: bindable.slice(0, 1) };

  const answer_event = answerEventFromPendingBind({
    session: current,
    pending: pendingForBind,
    chosen_role_code: choice.role_code,
  });
  const remaining = roleBindingUnresolvedItems(answer_event.unresolved_items);

  if (answer_event.proposed_writes.length === 0) {
    const nextPending: PendingAnswerResolution = remaining.length
      ? { ...pending, unresolved_items: remaining }
      : pending;
    return restoreClarificationResult({
      session: withPendingAnswerResolution(current, nextPending),
      pending: nextPending,
      answer_event,
      persist_error: "pending_answer_resolution_bind_failed",
      outcome: "planned",
    });
  }

  try {
    const applied = await applyAnswerEventToSessionDc(current, answer_event, {
      now: input.now,
    });
    if (applied.skipped_reason === "turn_already_mapped") {
      current = withPendingAnswerResolution(applied.session, null);
    } else if (!applied.applied) {
      return restoreClarificationResult({
        session: current,
        pending,
        answer_event,
        persist_error: applied.skipped_reason,
        outcome: "planned",
      });
    } else {
      const key = persistKeyForPendingBind(
        current.session_id,
        pending.source_turn_id,
        sessionHasWritesFromTurn(current, pending.source_turn_id),
      );
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

    if (remaining.length > 0) {
      const leftover: PendingAnswerResolution = {
        ...pending,
        unresolved_items: remaining,
      };
      const plan =
        leftover.clarification_plan ??
        buildRoleClarificationPlan({ session: current, pending: leftover, now: input.now });
      const nextPending = plan
        ? { ...leftover, clarification_plan: plan, clarification_plan_id: plan.plan_id }
        : leftover;
      current = withPendingAnswerResolution(current, nextPending);
      return restoreClarificationResult({
        session: current,
        pending: nextPending,
        answer_event,
        persist_error: input.persist_error,
        outcome: "planned",
      });
    }

    current = withPendingAnswerResolution(current, null);
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
    return {
      session: planned.session,
      outcome: outcomeFromPlanResult(planned),
      ask_error: planned.planner_block
        ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
        : undefined,
      answer_event,
      understanding: planned.understanding,
      plan: planned.plan,
      authorized_question: planned.authorized_question,
      persist_error: input.persist_error,
    };
  } catch (e) {
    return {
      session: input.original,
      outcome: "dc_persist_threw",
      answer_event,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error: e instanceof Error ? e.message : String(e),
    };
  }
}
'''

p.write_text(text, encoding="utf-8", newline="\n")
print("appended pending handlers, lines", text.count("\n"))
