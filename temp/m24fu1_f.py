from pathlib import Path
t = Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8")
lines = t.splitlines()
print("\n".join(f"{i+1}|{lines[i]}" for i in range(1040, 1125)))
