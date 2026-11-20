lines = open("lib/poju/agent.ts", encoding="utf-8").read().splitlines()
# search workingSession, m1CollectingTurn.session assignments
for i,l in enumerate(lines,1):
    if "workingSession" in l or "sessionForLlm" in l or "m1CollectingTurn.session" in l or "pending_answer" in l:
        print(f"{i:4d}: {l}")
