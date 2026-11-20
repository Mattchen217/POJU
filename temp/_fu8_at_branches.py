from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
text = p.read_text(encoding="utf-8")

old = '''      if (!applied.applied) {
        if (pendingUnresolved.length > 0 && applied.skipped_reason !== "turn_already_mapped") {
          current = finishPendingFromEvent(current, answer_event, statement, input.now);
          return pendingOrchestrationResult({
            session: current,
            pending: current.pending_answer_resolution!,
            answer_event,
            persist_error: "pending_answer_resolution",
            outcome: "planned",
          });
        }
        // Off-topic / invalid / non-role unresolved: still recompute understanding.
        current = activateNextBlueprintPriorityBand(current, input.now);
'''
new = '''      if (!applied.applied) {
        if (pendingUnresolved.length > 0 && applied.skipped_reason !== "turn_already_mapped") {
          current = finishPendingFromEvent(current, answer_event, statement, input.now);
          current = attachIntakeControlFromEvent(current, answer_event, statement, input.now);
          return pendingOrchestrationResult({
            session: current,
            pending: current.pending_answer_resolution!,
            answer_event,
            persist_error: "pending_answer_resolution",
            outcome: "planned",
          });
        }
        current = attachIntakeControlFromEvent(current, answer_event, statement, input.now);
        if (isActivePendingIntakeControl(current.pending_intake_control)) {
          return intakeControlOrchestrationResult({
            session: current,
            control: current.pending_intake_control!,
            answer_event,
            persist_error: applied.skipped_reason,
            outcome: "planned",
          });
        }
        // Off-topic / invalid / non-role unresolved: still recompute understanding.
        current = activateNextBlueprintPriorityBand(current, input.now);
'''
assert old in text
text = text.replace(old, new, 1)

old = '''      if (pendingUnresolved.length > 0) {
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
new = '''      current = attachIntakeControlFromEvent(current, answer_event, statement, input.now);
      if (pendingUnresolved.length > 0) {
        current = finishPendingFromEvent(current, answer_event, statement, input.now);
        return pendingOrchestrationResult({
          session: current,
          pending: current.pending_answer_resolution!,
          answer_event,
          persist_error,
          outcome: "planned",
        });
      }
      if (isActivePendingIntakeControl(current.pending_intake_control)) {
        return intakeControlOrchestrationResult({
          session: current,
          control: current.pending_intake_control!,
          answer_event,
          persist_error,
          outcome: "planned",
        });
      }
'''
assert old in text, "post-persist pending block not found"
text = text.replace(old, new, 1)
p.write_text(text.replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("post-interpret branches patched")
