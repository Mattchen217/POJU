from pathlib import Path
lines = Path("lib/poju/decision-intake/understanding-state.ts").read_text(encoding="utf-8").splitlines()
for i,l in enumerate(lines,1):
    if "last_sent_question" in l or "export function buildUnderstandingState" in l or "next_question_plan" in l:
        print(f"{i:4d}: {l}")
