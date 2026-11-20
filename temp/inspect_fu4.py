from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
t = p.read_text(encoding="utf-8")
print("buildUnderstandingState count:", t.count("buildUnderstandingState"))
print("ready_no_question count:", t.count('outcome: "ready_no_question"'))
print("file len:", len(t))
