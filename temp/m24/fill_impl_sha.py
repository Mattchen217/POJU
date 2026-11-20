from pathlib import Path
p = Path(r"docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R1.md")
t = p.read_text(encoding="utf-8")
t = t.replace(
    "**Parent (baseline):** `6ceb0d0c69fc8a9054c531f534dd67eef8f492ec`  \n**Status:",
    "**Parent (baseline):** `6ceb0d0c69fc8a9054c531f534dd67eef8f492ec`  \n**Implementation commit:** `738b6d2d6a8258851241469f0c660653e33f52ea`  \n**Status:",
)
p.write_text(t, encoding="utf-8")
print("impl sha recorded in evidence")
