from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")

def sub(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f"NOT FOUND: {label}")
    text = text.replace(old, new, 1)
    print("patched", label)

# After conflict clarification block, before interpretAnswerWithModel
sub(
    '''    const interpreted = await interpretAnswerWithModel({
''',
    '''    const existingPending = current.pending_answer_resolution;
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

    const interpreted = await interpretAnswerWithModel({
''',
    "pending-gate",
)

# After answerEventFromModelDraft, before try apply
sub(
    '''    answer_event = answerEventFromModelDraft({
      session: current,
      statement,
      source_turn_id: input.source_turn_id,
      draft: interpreted.draft,
    });

    try {
      const applied = await applyAnswerEventToSessionDc(current, answer_event, {
        now: input.now,
      });
''',
    '''    answer_event = answerEventFromModelDraft({
      session: current,
      statement,
      source_turn_id: input.source_turn_id,
      draft: interpreted.draft,
    });
    const roleUnresolved = roleBindingUnresolvedItems(
      answer_event.unresolved_items,
    );

    try {
      const applied = await applyAnswerEventToSessionDc(current, answer_event, {
        now: input.now,
      });
''',
    "capture-role-unresolved",
)

# After no-write planFromState return (applied.applied === false path), intercept role unresolved
# The current block is:
#       if (!applied.applied) {
#         // Off-topic / invalid: still recompute understanding; may keep prior needs.
#         current = activateNextBlueprintPriorityBand(current, input.now);
#         const understanding = buildUnderstanding({...});
#         const planned = await planFromState(...)
#         return { ... planned ... persist_error: applied.skipped_reason };
#       }

sub(
    '''      if (!applied.applied) {
        // Off-topic / invalid: still recompute understanding; may keep prior needs.
        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstanding({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);
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
          persist_error: applied.skipped_reason,
        };
      }
''',
    '''      if (!applied.applied) {
        if (roleUnresolved.length > 0 && applied.skipped_reason !== "turn_already_mapped") {
          current = finishPendingFromEvent(current, answer_event, statement, input.now);
          return restoreClarificationResult({
            session: current,
            pending: current.pending_answer_resolution!,
            answer_event,
            persist_error: "pending_answer_resolution",
            outcome: "planned",
          });
        }
        // Off-topic / invalid / non-role unresolved: still recompute understanding.
        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstanding({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);
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
          persist_error: applied.skipped_reason,
        };
      }
''',
    "no-write-pending-branch",
)

# After successful persist (the else branch that merges current), before closing the try,
# if role unresolved, return clarification instead of falling through to planFromState.
# The try ends at line 487 originally with `} catch`. After persist merge, there's just `}` of try.
# I'll insert before `    } catch (e) {` of the apply try.

sub(
    '''        };
      }
    } catch (e) {
      return {
        session: input.session,
        outcome: "dc_persist_threw",
''',
    '''        };
      }

      if (roleUnresolved.length > 0) {
        current = finishPendingFromEvent(current, answer_event, statement, input.now);
        return restoreClarificationResult({
          session: current,
          pending: current.pending_answer_resolution!,
          answer_event,
          persist_error,
          outcome: "planned",
        });
      }
    } catch (e) {
      return {
        session: input.session,
        outcome: "dc_persist_threw",
''',
    "mixed-success-pending-branch",
)

p.write_text(text, encoding="utf-8", newline="\n")
print("adaptive-turn branches inserted")
