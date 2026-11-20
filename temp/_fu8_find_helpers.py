from pathlib import Path
lines=Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
# find r1Text and lastUserId, lastAssistant
for i,l in enumerate(lines,1):
    if "r1Text" in l or "function lastUserId" in l or "function lastAssistant" in l:
        print(f"{i}:{l}")
