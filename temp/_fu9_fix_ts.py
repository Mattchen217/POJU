from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\adaptive-turn.ts")
text = p.read_text(encoding="utf-8")

old_imp = '''import type {
  AdaptiveQuestionPlan,
  AdaptiveTurnResult,
  AnswerEvent,
  NeedItem,
  PendingAnswerResolution,
  PendingIntakeControl,
  UnderstandingState,
} from "./types";
'''
new_imp = '''import type {
  AdaptiveQuestionPlan,
  AdaptiveTurnResult,
  AnswerEvent,
  IntakeControlResolutionRecord,
  NeedItem,
  PendingAnswerResolution,
  PendingIntakeControl,
  UnderstandingState,
} from "./types";
'''
assert old_imp in text, "type import block not found"
text = text.replace(old_imp, new_imp, 1)

old_rec = '''    const resolution_status =
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
'''
new_rec = '''    const resolution_status: IntakeControlResolutionRecord["resolution_status"] =
      answer_event.proposed_writes.length > 0 ? "clarified" : "clarified_without_dc_write";
    const record: IntakeControlResolutionRecord = {
      original_mismatch_item_id: resolving.item_id,
      original_mismatch_source_turn_id: resolving.source_turn_id,
      clarification_turn_id: input.source_turn_id,
      original_mismatch_text: resolving.text,
      clarification_text: input.statement.slice(0, 2000),
      answer_event_id: answer_event.event_id,
      resolution_status,
    };
'''
assert old_rec in text, "resolution record block not found"
text = text.replace(old_rec, new_rec, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("typed resolution record")