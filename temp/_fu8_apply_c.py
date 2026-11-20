from pathlib import Path
lines=Path("lib/poju/decision-intake/apply-answer-to-dc.ts").read_text(encoding="utf-8").splitlines()
for i,l in enumerate(lines,1):
    if "constraint" in l.lower() and ("fact_role" in l or "related_dir" in l or "kind ===" in l or "hard_constraint" in l or "function" in l):
        print(f"{i}:{l}")
