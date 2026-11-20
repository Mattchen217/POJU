from pathlib import Path
t = Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8")
lines = t.splitlines()
# print from Case A helpers / fixtures near 840 to end
print("\n".join(f"{i+1}|{lines[i]}" for i in range(820, min(1346, len(lines)))))
