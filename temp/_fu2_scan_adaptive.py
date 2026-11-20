# Find key functions and structure of adaptive-turn.ts
lines = open("lib/poju/decision-intake/adaptive-turn.ts", encoding="utf-8").read().splitlines()
print("total", len(lines))
# print function/export signatures and important comments
for i,l in enumerate(lines,1):
    s=l.strip()
    if (
        s.startswith("export ") or s.startswith("function ") or s.startswith("async function")
        or s.startswith("/**") or s.startswith("* M2") or "answerEventFromModelDraft" in l
        or "applyAnswerEventToSessionDc" in l or "planFromState" in l
        or "pending" in l.lower() or "last_sent" in l or "session_asked" in l
        or "budget" in l.lower() and ("++" in l or "asked" in l or "increment" in l or "deduct" in l)
    ):
        print(f"{i:4d}: {l}")
