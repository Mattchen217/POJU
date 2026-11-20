from pathlib import Path
t = Path("lib/poju/decision-intake/understanding-state.ts").read_text(encoding="utf-8")
# NeedItem / missing roles
for i,line in enumerate(t.splitlines(),1):
    if any(k in line for k in ["NeedItem", "missing_roles", "gap_type", "required_fact", "fact_role", "need_to_understand"]):
        print(f"{i}|{line}")
