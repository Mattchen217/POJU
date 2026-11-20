# Find handleUserMessage and adaptive/collecting usages in agent.ts
lines = open("lib/poju/agent.ts", encoding="utf-8").read().splitlines()
print("total", len(lines))
for i,l in enumerate(lines,1):
    if any(k in l for k in [
        "runAdaptiveQuestionTurn", "attachAuthorizedAssistantQuestion", "collecting-dc",
        "handleUserMessage", "runCollectingDcTurn", "pending_answer", "interpretAnswer",
        "authorized_question", "__testOnlyM1Hooks", "last_sent_question"
    ]):
        print(f"{i:4d}: {l}")
