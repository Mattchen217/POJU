from pathlib import Path
p = Path("lib/poju/decision-intake/answer-interpretation.ts")
text = p.read_text(encoding="utf-8")

old = '''  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const notes: string[] = [];
  const unresolved: string[] = [...input.draft.unresolved_aspects];
  const unresolvedItems: UnresolvedAnswerItem[] = [];
  const authorizedRoleCodes = targets.fact_role_codes;
  let cls: AnswerClass = input.draft.classification;
  const sentQuestionId =
    input.session.decision_understanding?.last_sent_question?.plan_id ?? "";
'''
new = '''  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const notes: string[] = [];
  const unresolved: string[] = [];
  const unresolvedItems: UnresolvedAnswerItem[] = [];
  const groundingRejections: SourceQuoteRejection[] = [];
  const authorizedRoleCodes = targets.fact_role_codes;
  const authorizedDirIds = [...targets.dir_ids];
  let cls: AnswerClass = input.draft.classification;
  const sentQuestionId =
    input.session.decision_understanding?.last_sent_question?.plan_id ?? "";

  const structuredAspects: UnresolvedModelAspect[] = input.draft.unresolved_aspects
    .map((text, aspectIndex) => ({
      aspect_id: unresolvedAspectId(input.source_turn_id, aspectIndex),
      source_turn_id: input.source_turn_id,
      text: text.slice(0, 200),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending" as const,
    }))
    .filter((aspect) => aspect.text.trim().length > 0)
    .map(({ status: _status, ...aspect }) => aspect);

  const controlItems: IntakeControlItem[] = [];
  if (cls === "goal_change") {
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "goal_change"),
      kind: "goal_change",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      proposed_decision_target: statement.slice(0, 2000),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
    });
  } else if (cls === "insight_mismatch") {
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "insight_mismatch"),
      kind: "insight_mismatch",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
    });
  } else {
    for (const aspect of structuredAspects) {
      controlItems.push({
        item_id: aspect.aspect_id,
        kind: "unresolved_aspect",
        source_turn_id: aspect.source_turn_id,
        text: aspect.text,
        sent_question_id: aspect.sent_question_id,
        authorized_role_codes: [...aspect.authorized_role_codes],
        authorized_dir_ids: [...aspect.authorized_dir_ids],
        status: "pending",
      });
    }
  }
'''
# simplify the aspects mapping - I accidentally added a dummy status. Let me use a clean version.
new = '''  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const notes: string[] = [];
  const unresolved: string[] = [];
  const unresolvedItems: UnresolvedAnswerItem[] = [];
  const groundingRejections: SourceQuoteRejection[] = [];
  const authorizedRoleCodes = targets.fact_role_codes;
  const authorizedDirIds = [...targets.dir_ids];
  let cls: AnswerClass = input.draft.classification;
  const sentQuestionId =
    input.session.decision_understanding?.last_sent_question?.plan_id ?? "";

  const structuredAspects: UnresolvedModelAspect[] = input.draft.unresolved_aspects
    .map((aspectText, aspectIndex) => ({
      aspect_id: unresolvedAspectId(input.source_turn_id, aspectIndex),
      source_turn_id: input.source_turn_id,
      text: aspectText.slice(0, 200),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
    }))
    .filter((aspect) => aspect.text.trim().length > 0);

  const controlItems: IntakeControlItem[] = [];
  if (cls === "goal_change") {
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "goal_change"),
      kind: "goal_change",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      proposed_decision_target: statement.slice(0, 2000),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
    });
  } else if (cls === "insight_mismatch") {
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "insight_mismatch"),
      kind: "insight_mismatch",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
    });
  } else {
    for (const aspect of structuredAspects) {
      controlItems.push({
        item_id: aspect.aspect_id,
        kind: "unresolved_aspect",
        source_turn_id: aspect.source_turn_id,
        text: aspect.text,
        sent_question_id: aspect.sent_question_id,
        authorized_role_codes: [...aspect.authorized_role_codes],
        authorized_dir_ids: [...aspect.authorized_dir_ids],
        status: "pending",
      });
    }
  }
'''
assert old in text, "event start block not found"
text = text.replace(old, new, 1)

old = '''    proposed_writes: writes,
    notes: [
      ...notes,
      ...unresolved.map((u) => `unresolved:${u}`),
    ].slice(0, 40),
    unresolved_items: unresolvedItems,
    interpreter: MODEL_ANSWER_INTERPRETER_VERSION,
  });
'''
new = '''    proposed_writes: writes,
    notes: [
      ...notes,
      ...unresolved.map((u) => `unresolved:${u}`),
      ...groundingRejections.map(
        (r) =>
          `grounding_rejected:${r.reason}:${r.extracted_index}:${r.source_quote.slice(0, 80)}`,
      ),
    ].slice(0, 40),
    unresolved_items: unresolvedItems,
    unresolved_aspects: structuredAspects,
    grounding_rejections: groundingRejections,
    control_items: controlItems,
    interpreter: MODEL_ANSWER_INTERPRETER_VERSION,
  });
'''
assert old in text, "eventShell notes block not found"
text = text.replace(old, new, 1)

old = '''  const acceptedItems: AcceptedItem[] = [];

  for (let extractedIndex = 0; extractedIndex < input.draft.extracted_items.length; extractedIndex++) {
    const item = input.draft.extracted_items[extractedIndex]!;
    // Production authorization uses role_code_hint only. Legacy role_hint is ignored.
    const code = item.role_code_hint ?? null;
'''
new = '''  const acceptedItems: AcceptedItem[] = [];

  for (let extractedIndex = 0; extractedIndex < input.draft.extracted_items.length; extractedIndex++) {
    const item = input.draft.extracted_items[extractedIndex]!;
    const grounding = groundSourceQuote(item.source_quote, statement);
    if (!grounding.ok) {
      groundingRejections.push({
        extracted_index: extractedIndex,
        text: item.text.slice(0, 500),
        source_quote: item.source_quote,
        reason: grounding.reason,
      });
      notes.push(`rejected_${grounding.reason}`);
      // Do not create a ProposedWrite or assign user_asserted / user_estimate.
      continue;
    }
    // Production authorization uses role_code_hint only. Legacy role_hint is ignored.
    const code = item.role_code_hint ?? null;
'''
assert old in text, "accepted items loop not found"
text = text.replace(old, new, 1)

old = '''    proposed_writes,
    notes,
    unresolved_items: [],
    interpreter: ANSWER_INTERPRETATION_VERSION,
  };
'''
new = '''    proposed_writes,
    notes,
    unresolved_items: [],
    unresolved_aspects: [],
    grounding_rejections: [],
    control_items: [],
    interpreter: ANSWER_INTERPRETATION_VERSION,
  };
'''
assert old in text, "interpretUserAnswer event not found"
text = text.replace(old, new, 1)

p.write_text(text.replace("\r\n", "\n"), encoding="utf-8", newline="\n")
print("answerEventFromModelDraft and interpretUserAnswer patched")
