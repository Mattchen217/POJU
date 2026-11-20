from pathlib import Path
lines=Path("lib/poju/decision-intake/answer-interpretation.ts").read_text(encoding="utf-8").splitlines()
print("\n".join(f"{i+1}:{lines[i]}" for i in range(len(lines)-40, len(lines))))
