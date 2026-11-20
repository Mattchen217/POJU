from pathlib import Path

p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation.ts")
text = p.read_text(encoding="utf-8")

old_ground = '''export function groundSourceQuote(
  sourceQuote: string,
  statement: string,
): SourceQuoteGroundingResult {
  if (sourceQuote.length > MAX_SOURCE_QUOTE_LENGTH) {
    return { ok: false, reason: "source_quote_too_long" };
  }
  const quote = normalizeAnswerGroundingText(sourceQuote);
  const hay = normalizeAnswerGroundingText(statement);
  if (!quote) return { ok: false, reason: "source_quote_empty" };
  if (!hay.includes(quote)) return { ok: false, reason: "source_quote_not_grounded" };
  return { ok: true };
}
'''
new_ground = '''export function groundSourceQuote(
  sourceQuote: string,
  statement: string,
): SourceQuoteGroundingResult {
  if (sourceQuote.length > MAX_SOURCE_QUOTE_LENGTH) {
    return { ok: false, reason: "source_quote_too_long" };
  }
  const quote = normalizeAnswerGroundingText(sourceQuote);
  const hay = normalizeAnswerGroundingText(statement);
  if (!quote) return { ok: false, reason: "source_quote_empty" };
  if (!hay.includes(quote)) return { ok: false, reason: "source_quote_not_grounded" };
  return { ok: true };
}

/**
 * Canonical user-authored content for a model-derived DC write is source_quote.
 * item.text must be source-equivalent under the same conservative normalization.
 * On success, persist the original unnormalized quote, never a model paraphrase.
 */
export function groundExtractedItem(
  item: { text: string; source_quote: string },
  statement: string,
): SourceQuoteGroundingResult {
  const quoteGrounding = groundSourceQuote(item.source_quote, statement);
  if (!quoteGrounding.ok) return quoteGrounding;
  const normalizedText = normalizeAnswerGroundingText(item.text);
  const normalizedQuote = normalizeAnswerGroundingText(item.source_quote);
  if (!normalizedText || normalizedText !== normalizedQuote) {
    return { ok: false, reason: "extraction_text_not_source_equivalent" };
  }
  return { ok: true };
}

export function persistedSourceStatement(sourceQuote: string): string {
  return sourceQuote.slice(0, 2000);
}

/**
 * For goal_change only: accept the first grounded definition_patch whose
 * text is source-equivalent to its quote, and keep the unnormalized quote
 * as the proposed target. Never use the entire original sentence.
 */
export function extractGroundedProposedDecisionTarget(
  draft: ModelAnswerDraft,
  statement: string,
): {
  proposed_decision_target: string | undefined;
  rejections: SourceQuoteRejection[];
} {
  const rejections: SourceQuoteRejection[] = [];
  let proposed_decision_target: string | undefined;
  for (let extractedIndex = 0; extractedIndex < draft.extracted_items.length; extractedIndex++) {
    const item = draft.extracted_items[extractedIndex]!;
    const grounding = groundExtractedItem(item, statement);
    if (!grounding.ok) {
      rejections.push({
        extracted_index: extractedIndex,
        text: item.text.slice(0, 500),
        source_quote: item.source_quote,
        reason: grounding.reason,
      });
      continue;
    }
    if (item.semantic_kind === "definition_patch" && !proposed_decision_target) {
      proposed_decision_target = persistedSourceStatement(item.source_quote);
    }
  }
  return { proposed_decision_target, rejections };
}
'''
assert old_ground in text, "groundSourceQuote block not found"
text = text.replace(old_ground, new_ground, 1)

# Need SourceQuoteRejection import if only type is imported - already imported as type
# ModelAnswerDraft already imported.

# Update control item construction and early return for goal_change / insight_mismatch
old_control = '''  const controlItems: IntakeControlItem[] = [];
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
'''
new_control = '''  const controlItems: IntakeControlItem[] = [];
  let goalChangeTarget: string | undefined;
  if (cls === "goal_change") {
    const extractedTarget = extractGroundedProposedDecisionTarget(input.draft, statement);
    groundingRejections.push(...extractedTarget.rejections);
    goalChangeTarget = extractedTarget.proposed_decision_target;
    for (const r of extractedTarget.rejections) {
      notes.push(`rejected_${r.reason}`);
    }
    if (!goalChangeTarget) {
      notes.push("goal_change_target_unresolved");
    }
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "goal_change"),
      kind: "goal_change",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      ...(goalChangeTarget ? { proposed_decision_target: goalChangeTarget } : {}),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
    });
  } else if (cls === "insight_mismatch") {
'''
assert old_control in text, "goal_change control construction not found"
text = text.replace(old_control, new_control, 1)

old_early = '''  if (
    cls === "off_topic" ||
    cls === "invalid_input" ||
    cls === "goal_change" ||
    cls === "insight_mismatch"
  ) {
    notes.push(`${cls}_no_dc_write`);
    return eventShell([], cls);
  }
'''
new_early = '''  if (cls === "off_topic" || cls === "invalid_input") {
    notes.push(`${cls}_no_dc_write`);
    return eventShell([], cls);
  }
  if (cls === "goal_change" || cls === "insight_mismatch") {
    // Never write DC from these control-plane classifications.
    // goal_change target extraction already recorded its rejections.
    if (cls === "insight_mismatch") {
      for (let extractedIndex = 0; extractedIndex < input.draft.extracted_items.length; extractedIndex++) {
        const item = input.draft.extracted_items[extractedIndex]!;
        const grounding = groundExtractedItem(item, statement);
        if (!grounding.ok) {
          groundingRejections.push({
            extracted_index: extractedIndex,
            text: item.text.slice(0, 500),
            source_quote: item.source_quote,
            reason: grounding.reason,
          });
          notes.push(`rejected_${grounding.reason}`);
        }
      }
    }
    notes.push(`${cls}_no_dc_write`);
    return eventShell([], cls);
  }
'''
assert old_early in text, "early return block not found"
text = text.replace(old_early, new_early, 1)

# Replace groundSourceQuote usage in the extracted-item loop with groundExtractedItem
# and persist the unnormalized quote.
old_loop = '''    const item = input.draft.extracted_items[extractedIndex]!;
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
'''
new_loop = '''    const item = input.draft.extracted_items[extractedIndex]!;
    const grounding = groundExtractedItem(item, statement);
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
    const persistedText = persistedSourceStatement(item.source_quote);
'''
assert old_loop in text, "extracted item grounding loop not found"
text = text.replace(old_loop, new_loop, 1)

# acceptedItems.push uses item.text.slice(0, 500) - change to persistedText
old_push = '''    acceptedItems.push({
      extracted_index: extractedIndex,
      text: item.text.slice(0, 500),
      semantic_kind: item.semantic_kind,
'''
new_push = '''    acceptedItems.push({
      extracted_index: extractedIndex,
      text: persistedText,
      semantic_kind: item.semantic_kind,
'''
assert old_push in text, "acceptedItems.push text field not found"
text = text.replace(old_push, new_push, 1)

# Also update pushUnresolvedItem calls that still use item.text before acceptance?
# Those happen after grounding success, so text==quote; using persistedText is better
# for unauthorized/unlocated/illegal. I'll replace the post-grounding ones carefully.

# After grounding, there are several `text: item.text` in pushUnresolvedItem in the same loop.
# Safer to leave those as item.text since they're equivalent under the new rule.
# Writes use acceptedItems.text which is now the unnormalized quote. Good.

p.write_text(text, encoding="utf-8", newline="\n")
print("patched answer-interpretation.ts")