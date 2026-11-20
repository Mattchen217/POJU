from pathlib import Path
lines=Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
for i,l in enumerate(lines,1):
    if "lastUserId" in l or "lastAssistant" in l:
        if "function" in l or i < 250:
            print(f"{i}:{l}")
