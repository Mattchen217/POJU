from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
text = p.read_text(encoding="utf-8")

old = '''    last.plan_id === plan.plan_id &&
    !isPendingClarificationPlan(plan)
'''
new = '''    last.plan_id === plan.plan_id &&
    !isPendingClarificationPlan(plan) &&
    !isIntakeControlPlan(plan)
'''
assert old in text
text = text.replace(old, new, 1)

old = '''    if (
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
new = '''    if (
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

    const existingControl = current.pending_intake_control;
    if (isActivePendingIntakeControl(existingControl)) {
      return handlePendingIntakeControlTurn({
        current,
        original: input.session,
        statement,
        source_turn_id: input.source_turn_id,
        now: input.now,
        locale: input.locale,
        signal: input.signal,
        buildUnderstanding,
        planFromState,
        test_hooks: input.test_hooks,
      });
    }
    if (
      existingControl &&
      (input.source_turn_id === existingControl.source_turn_id ||
        input.source_turn_id === existingControl.last_resolved_turn_id)
    ) {
      return replayInactiveIntakeControl({
        session: current,
        control: existingControl,
      });
    }
'''
assert old in text
text = text.replace(old, new, 1)
p.write_text(text.replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("entry hooks added")
