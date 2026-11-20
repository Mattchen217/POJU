from pathlib import Path
lines=Path("lib/poju/decision-intake/adaptive-turn.ts").read_text(encoding="utf-8").splitlines()
print("\n".join(f"{i+1:4d}|{lines[i]}" for i in range(1189, 1265)))
