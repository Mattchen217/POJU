from pathlib import Path
t = Path("lib/poju/decision-intake/adaptive-turn.ts").read_text(encoding="utf-8")
# print attachAuthorizedAssistantQuestion and nearby
idx = t.find("export function attachAuthorizedAssistantQuestion")
print(t[idx:idx+2500])
print("\n=== fact_role / last_sent elsewhere ===")
for i,line in enumerate(t.splitlines(),1):
    if "last_sent" in line or "fact_role" in line.lower() or "session_asked" in line:
        print(f"{i}:{line}")
