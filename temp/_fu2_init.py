from pathlib import Path
lines = Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
for i,l in enumerate(lines,1):
    if "init_only" in l or "attachAuthorizedAssistantQuestion" in l or "runCollectingDcTurn" in l:
        print(f"{i:4d}: {l.encode('ascii','backslashreplace').decode()}")
