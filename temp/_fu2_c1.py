lines = open("lib/poju/decision-context/production-dc-lifecycle.ts", encoding="utf-8").read().splitlines()
print("total", len(lines))
for i,l in enumerate(lines,1):
    if any(k in l for k in ["idempotent", "persistDcLifecycleChange", "idempotency_key", "export async function persist"]):
        print(f"{i:4d}: {l}")
