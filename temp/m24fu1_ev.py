from pathlib import Path
# evidence file from R1
p = Path("docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R1.md")
print(p.exists())
if p.exists():
    print(p.read_text(encoding="utf-8")[:2000])
