print(open("lib/poju/decision-intake/index.ts", encoding="utf-8").read())
print("\n===== evidence fu1 head =====")
import os
p = "docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU1.md"
print("exists", os.path.exists(p), "bytes", os.path.getsize(p) if os.path.exists(p) else 0)
