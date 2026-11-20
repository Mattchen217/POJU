from pathlib import Path
lines=Path("lib/poju/decision-intake/adaptive-turn.ts").read_text(encoding="utf-8").splitlines()
print("\n".join(f"{i}:{lines[i-1]}" for i in range(738, 850)))
