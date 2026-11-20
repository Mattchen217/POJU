from pathlib import Path
import re
for rel in [
  "lib/poju/decision-intake/question-generation.ts",
  "lib/poju/decision-intake/adaptive-turn.ts",
  "lib/poju/decision-intake/understanding-state.ts",
  "lib/poju/decision-context/question-planning.ts",
]:
    t = Path(rel).read_text(encoding="utf-8")
    print(f"\n===== {rel} =====")
    for i,line in enumerate(t.splitlines(),1):
        if re.search(r"decision_question|更具体|DecisionQuestion|gate_class|P0|selectNext|ranked", line, re.I):
            print(f"{i}|{line[:160]}")
