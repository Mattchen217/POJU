from pathlib import Path
import re
fu2 = Path(r"docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU2.md")
t = fu2.read_text(encoding="utf-8-sig")
t = re.sub(r"\| HEAD / tip \| `[^`]*` \|", "| HEAD / tip | `TIP_PENDING` |", t)
if "FU3 tip alignment" not in t and "Branch tip advanced by M2.3-R2-FU3" not in t:
    t = t.replace(
        "| Self-PASS | **no** |",
        "| Self-PASS | **no** |\n| Note | Branch tip advanced by M2.3-R2-FU3; table tip aligned to final HEAD. FU2 impl remains `a56043aecd9d28003573521fe0062e518e0e5637`. |",
        1,
    )
fu2.write_text(t, encoding="utf-8", newline="\n")
print("fu2 tip pending")
