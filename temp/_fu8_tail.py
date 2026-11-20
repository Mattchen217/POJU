from pathlib import Path
lines=Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
print("total lines", len(lines))
print("----- last 80 -----")
print("\n".join(f"{i+1}:{lines[i]}" for i in range(len(lines)-80, len(lines))))
print("----- first 90 -----")
print("\n".join(f"{i+1}:{lines[i]}" for i in range(0, 90)))
