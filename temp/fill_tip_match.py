from pathlib import Path
import re
final = Path("temp/newsha.txt").read_text(encoding="ascii").strip()
impl = "a8b115803a55df4a644d8d469cd92b0a73c38b89"
ev = "96221e0b9ebed221509e94faf8eaf29ff91839b4"
fu3 = Path(r"docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU3.md")
t = fu3.read_text(encoding="utf-8-sig")
t = re.sub(r"\| Implementation commit \| `[^`]*` \|", "| Implementation commit | `" + impl + "` |", t)
t = re.sub(r"\| Evidence commit \| `[^`]*` \|", "| Evidence commit | `" + ev + "` |", t)
t = re.sub(r"\| Final branch HEAD / tip \| `[^`]*` \|", "| Final branch HEAD / tip | `" + final + "` |", t)
fu3.write_text(t, encoding="utf-8", newline="\n")
fu2 = Path(r"docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-FIX-R2-FU2.md")
t2 = fu2.read_text(encoding="utf-8-sig")
t2 = re.sub(r"\| HEAD / tip \| `[^`]*` \|", "| HEAD / tip | `" + final + "` |", t2)
fu2.write_text(t2, encoding="utf-8", newline="\n")
print("set tip", final)
