# Case I full + FU1 Case J + apply-answer skipped reasons + bumpBudget
print("===== apply-answer-to-dc key bits =====")
lines = open("lib/poju/decision-intake/apply-answer-to-dc.ts", encoding="utf-8").read().splitlines()
print("total", len(lines))
for i,l in enumerate(lines,1):
    if any(k in l for k in ["skipped_reason", "turn_already_mapped", "no_writes", "export async function", "export function", "client_turn_id", "idempoten"]):
        print(f"{i:4d}: {l}")
print("\n===== scope-budget bump =====")
lines2 = open("lib/poju/decision-intake/scope-budget.ts", encoding="utf-8").read().splitlines()
for i,l in enumerate(lines2,1):
    if "bumpBudgetAfterAsk" in l or "session_asked_count" in l or "export function" in l:
        print(f"{i:4d}: {l}")
