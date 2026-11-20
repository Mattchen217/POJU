from pathlib import Path
p = Path("lib/poju/types.ts")
text = p.read_text(encoding="utf-8")
anchor = '''  /**
   * M1 — authorized Adaptive Question Plan that drives the next sent question.
   */
  adaptive_ask_plan?: import("./decision-intake/types").AdaptiveQuestionPlan | null;
'''
insert = anchor + '''  /**
   * M2.4-R2-FU2 — scheduling state for an extracted answer that could not bind
   * to an authorized role. Not a second Decision Context or fact source.
   */
  pending_answer_resolution?: import("./decision-intake/types").PendingAnswerResolution | null;
'''
if anchor not in text:
    raise SystemExit("adaptive_ask_plan block not found")
if "pending_answer_resolution" in text:
    raise SystemExit("already present")
text = text.replace(anchor, insert, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("POJUSessionState field added")
