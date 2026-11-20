from pathlib import Path
p = Path("lib/poju/types.ts")
text = p.read_text(encoding="utf-8")
old = '''  pending_answer_resolution?: import("./decision-intake/types").PendingAnswerResolution | null;
'''
new = '''  pending_answer_resolution?: import("./decision-intake/types").PendingAnswerResolution | null;
  /**
   * M2.4-R2-FU8 — scheduling/control metadata for unresolved model aspects,
   * goal_change confirmation, and insight_mismatch clarification.
   * Not a second Decision Context or fact source. Never auto-mutates Blueprint.
   */
  pending_intake_control?: import("./decision-intake/types").PendingIntakeControl | null;
'''
assert old in text, "session pending field not found"
p.write_text(text.replace(old, new, 1).replace("\r\n", "\n"), encoding="utf-8", newline="\n")
print("lib/poju/types.ts patched")
