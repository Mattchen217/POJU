from pathlib import Path
p = Path("docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-FIX-R1-FU1.md")
t = p.read_text(encoding="utf-8")
t = t.replace(
  "**Implementation commit:** _(filled after impl commit; not a self-referential tip)_",
  "**Implementation commit:** `5d4d5e0bc00c094bfcebb10001a4bbffe4177c63`",
)
p.write_text(t, encoding="utf-8")
print("filled impl sha")
