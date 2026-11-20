from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\adaptive-turn.ts")
text = p.read_text(encoding="utf-8")
idx = text.find("async function handlePendingAnswerResolutionTurn")
assert idx != -1
new_fn = r'''async function handlePendingAnswerResolutionTurn(input: {
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
  test_hooks?: AdaptiveTurnTestHooks;
}): Promise<AdaptiveTurnResult> {
  let current = input.current;
  const pendingRaw = current.pending_answer_resolution;
  if (!pendingRaw) {
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

  const pending: PendingAnswerResolution = {
    ...pendingRaw,
    unresolved_items: normalizePendingItems(pendingRaw.unresolved_items),
    rejected_items: pendingRaw.rejected_items ?? [],
    authorized_dir_ids: pendingRaw.authorized_dir_ids ?? [],
    resolving_item_id: pendingRaw.resolving_item_id ?? null,
  };

  // Replay of the original extracted-answer turn: restore the already-sent
  // clarification question. Do not regenerate, recount budget, or rewrite DC.
  if (input.source_turn_id === pending.source_turn_id) {
    return pendingOrchestrationResult({
      session: current,
      pending,
      answer_event: null,
      persist_error: "pending_answer_resolution_replay",
      outcome: "idempotent_replay",
    });
  }

  const resolving = nextResolvingItem(pending);
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

  const parseChoice = ():
    | { ok: true; choice: PendingBindChoice }
    | { ok: false; reason: "unclear" | "refused" | "unauthorized" } => {
    if (isRoleBindingReason(resolving.reason)) {
      const options = authorizedRoleOptions(
        current,
        resolving.authorized_role_codes,
      );
      const parsed = parseClarificationRoleChoice(input.statement, options);
      if (!parsed.ok) return parsed;
      return { ok: true, choice: { type: "role", role_code: parsed.role_code } };
    }
    if (resolving.reason === "unclear_certainty") {
      const parsed = parseCertaintyChoice(input.statement);
      if (!parsed.ok) return parsed;
      return { ok: true, choice: { type: "certainty", certainty: parsed.certainty } };
    }
    if (resolving.reason === "estimated_constraint_not_persistable") {
      const parsed = parseConstraintConfirmChoice(input.statement);
      if (!parsed.ok) return parsed;
      return {
        ok: true,
        choice: {
          type: "constraint_confirm",
          confirmed: parsed.confirmed,
          still_uncertain: parsed.still_uncertain,
        },
      };
    }
    if (resolving.reason === "definition_patch_not_persistable") {
      const parsed = parseDefinitionPatchChoice(input.statement);
      if (!parsed.ok) return parsed;
      return { ok: true, choice: { type: "definition_as_fact" } };
    }
    return { ok: false, reason: "unclear" };
  };

  const parsed = parseChoice();
  if (!parsed.ok) {
    if (parsed.reason === "refused") {
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
    return pendingOrchestrationResult({
      session: current,
      pending,
      answer_event: null,
      persist_error: "pending_answer_resolution_unresolved",
      outcome: "planned",
    });
  }

  if (parsed.choice.type === "role") {
    const authorized = resolving.authorized_role_codes;
    if (!authorized.includes(parsed.choice.role_code)) {
      return pendingOrchestrationResult({
        session: current,
        pending,
        answer_event: null,
        persist_error: "pending_answer_resolution_unauthorized",
        outcome: "planned",
      });
    }
    const targets = activeTargets(current);
    if (
      targets.fact_role_codes.length > 0 &&
      !targets.fact_role_codes.includes(parsed.choice.role_code)
    ) {
      return pendingOrchestrationResult({
        session: current,
        pending,
        answer_event: null,
        persist_error: "pending_answer_resolution_unauthorized",
        outcome: "planned",
      });
    }
    if (targets.auth_error === "missing_authorized_answer_target") {
      return pendingOrchestrationResult({
        session: current,
        pending,
        answer_event: null,
        persist_error: "missing_authorized_answer_target",
        outcome: "planned",
      });
    }
  }

  // Certainty "unclear" after an unclear item is not a legal write — keep pending.
  if (parsed.choice.type === "certainty" && parsed.choice.certainty === "unclear") {
    return pendingOrchestrationResult({
      session: current,
      pending,
      answer_event: null,
      persist_error: "pending_answer_resolution_unresolved",
      outcome: "planned",
    });
  }
  if (
    parsed.choice.type === "constraint_confirm" &&
    !parsed.choice.confirmed
  ) {
    const nextReason = parsed.choice.still_uncertain
      ? "unclear_certainty"
      : "estimated_constraint_not_persistable";
    const updated: typeof pending = {
      ...pending,
      unresolved_items: pending.unresolved_items.map((item) =>
        item.item_id === resolving.item_id
          ? {
              ...item,
              reason: nextReason,
              certainty: parsed.choice.still_uncertain ? "unclear" : "estimated",
            }
          : item,
      ),
    };
    const nextPending = pendingWithRemainingItems({
      session: current,
      pending: updated,
      remaining: updated.unresolved_items,
      rejected_items: updated.rejected_items,
      now: input.now,
    });
    current = withPendingAnswerResolution(current, nextPending);
    return pendingOrchestrationResult({
      session: current,
      pending: nextPending,
      answer_event: null,
      persist_error: "pending_answer_resolution_unresolved",
      outcome: "planned",
    });
  }

  const answer_event = answerEventFromPendingBind({
    session: current,
    pending,
    item: resolving,
    choice: parsed.choice,
  });

  const followUp = continuableUnresolvedItems(answer_event.unresolved_items).map(
    (item) => ({
      ...item,
      item_id: resolving.item_id,
      source_turn_id: pending.source_turn_id,
    }),
  );
  const siblings = pending.unresolved_items.filter(
    (item) => item.item_id !== resolving.item_id,
  );

  if (answer_event.proposed_writes.length === 0) {
    const remaining = followUp.length > 0 ? [...siblings, ...followUp] : pending.unresolved_items;
    const nextPending = pendingWithRemainingItems({
      session: current,
      pending,
      remaining,
      rejected_items: pending.rejected_items,
      now: input.now,
    });
    return pendingOrchestrationResult({
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
      allow_incremental_same_turn: true,
      incremental: {
        pending_source_turn_id: pending.source_turn_id,
        pending_authorized_role_codes: [...resolving.authorized_role_codes],
        pending_authorized_dir_ids:
          pending.authorized_dir_ids.length > 0
            ? [...pending.authorized_dir_ids]
            : [...(current.decision_understanding?.last_sent_question?.dir_ids ?? [])],
        resolving_item_id: resolving.item_id,
      },
    });

    const itemAlreadyWritten = (): boolean => {
      const dc = current.decision_context;
      if (!dc) return false;
      return answer_event.proposed_writes.some((w) => {
        if (w.kind === "reality_fact") {
          return dc.reality_facts.some(
            (f) =>
              f.source_turn_id === pending.source_turn_id &&
              f.statement === w.statement &&
              (f.related_dir_ids ?? []).some((d) => w.related_dir_ids.includes(d)) &&
              (f.fact_roles ?? []).some((r) => w.fact_roles.includes(r)),
          );
        }
        if (w.kind === "constraint") {
          return dc.constraints.some(
            (c) =>
              c.source_turn_id === pending.source_turn_id &&
              c.statement === w.statement &&
              (c.related_dir_ids ?? []).some((d) => w.related_dir_ids.includes(d)),
          );
        }
        return false;
      });
    };

    let persistedOk = false;
    if (applied.skipped_reason === "turn_already_mapped") {
      if (!itemAlreadyWritten()) {
        return pendingOrchestrationResult({
          session: current,
          pending,
          answer_event,
          persist_error: "turn_already_mapped",
          outcome: "planned",
        });
      }
      persistedOk = true;
    } else if (!applied.applied) {
      return pendingOrchestrationResult({
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
        resolving.item_id,
      );
      const persistFn =
        input.test_hooks?.pendingBindPersist ?? persistDcLifecycleChange;
      const persisted = await persistFn(input.original, applied.session, key);
      if (persisted.error === "idempotent_skip") {
        current = persisted.session;
        persistedOk = true;
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
        persistedOk = true;
      }
    }

    if (!persistedOk) {
      return pendingOrchestrationResult({
        session: current,
        pending,
        answer_event,
        persist_error: "pending_answer_resolution_bind_failed",
        outcome: "planned",
      });
    }

    // Only after bind + DC persist success may this item be removed.
    const remaining = siblings;
    if (remaining.length > 0 || (pending.rejected_items ?? []).length > 0 && remaining.length > 0) {
      const nextPending = pendingWithRemainingItems({
        session: current,
        pending,
        remaining,
        rejected_items: pending.rejected_items,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      return pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event,
        persist_error: input.persist_error,
        outcome: "planned",
      });
    }

    if (remaining.length > 0) {
      const nextPending = pendingWithRemainingItems({
        session: current,
        pending,
        remaining,
        rejected_items: pending.rejected_items,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      return pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event,
        persist_error: input.persist_error,
        outcome: "planned",
      });
    }

    if ((pending.rejected_items ?? []).length > 0) {
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
# The redundant remaining.length check is messy. I'll clean it in the source I write.
# Let me simplify the remaining-after-success block in this string... I'll write a cleaner version.

new_fn = new_fn.replace(
'''    const remaining = siblings;
    if (remaining.length > 0 || (pending.rejected_items ?? []).length > 0 && remaining.length > 0) {
      const nextPending = pendingWithRemainingItems({
        session: current,
        pending,
        remaining,
        rejected_items: pending.rejected_items,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      return pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event,
        persist_error: input.persist_error,
        outcome: "planned",
      });
    }

    if (remaining.length > 0) {
      const nextPending = pendingWithRemainingItems({
        session: current,
        pending,
        remaining,
        rejected_items: pending.rejected_items,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      return pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event,
        persist_error: input.persist_error,
        outcome: "planned",
      });
    }
''',
'''    const remaining = siblings;
    if (remaining.length > 0) {
      const nextPending = pendingWithRemainingItems({
        session: current,
        pending,
        remaining,
        rejected_items: pending.rejected_items,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      return pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event,
        persist_error: input.persist_error,
        outcome: "planned",
      });
    }
''')

text = text[:idx] + new_fn.rstrip() + "\n"
p.write_text(text, encoding="utf-8", newline="\n")
print("handlePending replaced, lines", text.count("\\n")+1 if False else text.count("\n")+1)
