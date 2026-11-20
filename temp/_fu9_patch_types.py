from pathlib import Path

# ----- types.ts (decision-intake) -----
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\types.ts")
text = p.read_text(encoding="utf-8")

old_reason = '''export type SourceQuoteRejectionReason =
  | "source_quote_not_grounded"
  | "source_quote_empty"
  | "source_quote_too_long";
'''
new_reason = '''export type SourceQuoteRejectionReason =
  | "source_quote_not_grounded"
  | "source_quote_empty"
  | "source_quote_too_long"
  | "extraction_text_not_source_equivalent";
'''
assert old_reason in text, "SourceQuoteRejectionReason block not found"
text = text.replace(old_reason, new_reason, 1)

old_pending_tail = '''  /** Follow-up turn that last resolved or confirmed a control item; used for replay. */
  last_resolved_turn_id?: string | null;
};
'''
new_pending_tail = '''  /** Follow-up turn that last resolved or confirmed a control item; used for replay. */
  last_resolved_turn_id?: string | null;
  /**
   * Auditable insight_mismatch clarification resolutions.
   * Scheduling/control metadata only; never a second fact store.
   */
  resolution_records?: IntakeControlResolutionRecord[];
};
'''
assert old_pending_tail in text, "PendingIntakeControl tail not found"
text = text.replace(old_pending_tail, new_pending_tail, 1)

# Insert resolution record types before PendingIntakeControlStatus
anchor = "export type PendingIntakeControlStatus = \"pending\" | \"resolved\";\n"
assert anchor in text, "PendingIntakeControlStatus not found"
insert = '''export type IntakeControlResolutionStatus =
  | "clarified"
  | "clarified_without_dc_write";

/**
 * Structured audit of an insight_mismatch clarification.
 * Not a Decision Context write and not a second fact store.
 */
export type IntakeControlResolutionRecord = {
  original_mismatch_item_id: string;
  original_mismatch_source_turn_id: string;
  clarification_turn_id: string;
  original_mismatch_text: string;
  clarification_text: string;
  answer_event_id: string | null;
  resolution_status: IntakeControlResolutionStatus;
};

'''
text = text.replace(anchor, insert + anchor, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("patched decision-intake/types.ts")

# ----- session types -----
sp = Path(r"D:\POJU\pojulife\lib\poju\types.ts")
st = sp.read_text(encoding="utf-8")
old = '''  pending_intake_control?: import("./decision-intake/types").PendingIntakeControl | null;
'''
new = '''  pending_intake_control?: import("./decision-intake/types").PendingIntakeControl | null;
  /**
   * Most recent AnswerEvent from the production interpretation path.
   * Scheduling/audit metadata for inspectable grounding rejections.
   * Not a second Decision Context or fact store.
   */
  last_answer_event?: import("./decision-intake/types").AnswerEvent | null;
'''
assert old in st, "pending_intake_control field not found in session types"
st = st.replace(old, new, 1)
sp.write_text(st, encoding="utf-8", newline="\n")
print("patched lib/poju/types.ts")