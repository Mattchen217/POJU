from pathlib import Path
lines=Path("lib/poju/decision-intake/apply-answer-to-dc.ts").read_text(encoding="utf-8").splitlines()
print("\n".join(f"{i}:{lines[i-1]}" for i in range(330, 480)))
