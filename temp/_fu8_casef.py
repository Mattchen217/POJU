from pathlib import Path
lines=Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
print("\n".join(f"{i}:{lines[i-1]}" for i in range(3320, 3430)))
