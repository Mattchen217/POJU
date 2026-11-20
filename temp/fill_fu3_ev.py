from pathlib import Path
import re

impl = "a8b115803a55df4a644d8d469cd92b0a73c38b89"
ev = "96221e0b9ebed221509e94faf8eaf29ff91839b4"
# tip will be set after this commit; for now write placeholders then tip-align

fu3 = Path(r"docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU3.md")
t = fu3.read_text(encoding="utf-8-sig")
t = t.replace("IMPL_SHA_PLACEHOLDER", impl)
t = t.replace("EVIDENCE_SHA_PLACEHOLDER", ev)
t = t.replace("TIP_SHA_PLACEHOLDER", "TIP_PENDING")
# also fix if previous partial fills left wrong values
t = re.sub(r"\| Implementation commit \| `[^`]*` \|", f"| Implementation commit | `{impl}` |", t)
t = re.sub(r"\| Evidence commit \| `[^`]*` \|", f"| Evidence commit | `{ev}` |", t)
t = re.sub(r"\| Final branch HEAD / tip \| `[^`]*` \|", "| Final branch HEAD / tip | `TIP_PENDING` |", t)
fu3.write_text(t, encoding="utf-8", newline="\n")
print(fu3.read_text(encoding="utf-8")[:600])
