# Session persist / clone / pick
files = [
    "lib/poju/session-manager.ts",
    "lib/poju/session-mutation.ts",
    "lib/poju/agent-state-snapshot.ts",
]
keywords = ["decision_understanding", "adaptive_ask_plan", "JSON.stringify", "JSON.parse", "pick", "allowlist", "whitelist", "cloneSession", "savePOJUSession", "loadPOJUSession", "pending_"]
for path in files:
    lines = open(path, encoding="utf-8").read().splitlines()
    print(f"\n===== {path} ({len(lines)}) =====")
    for i,l in enumerate(lines,1):
        if any(k in l for k in keywords):
            print(f"{i:4d}: {l}")
