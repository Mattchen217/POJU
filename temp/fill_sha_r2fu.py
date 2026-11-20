from pathlib import Path
p = Path(r"docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU.md")
t = p.read_text(encoding="utf-8")
t = t.replace("| Parent | `adcda6574f13c505aea3cacf59ce5fd852767e61` |\n| HEAD | (filled after commit) |",
              "| Parent | `adcda6574f13c505aea3cacf59ce5fd852767e61` |\n| Impl | `b7c7b98c989dc7b5240665c92cd7b2345658330b` |\n| HEAD | (filled after evidence commit) |")
p.write_text(t, encoding="utf-8")
print("updated evidence SHAs")
