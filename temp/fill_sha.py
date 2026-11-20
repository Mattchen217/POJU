from pathlib import Path
import subprocess
sha = subprocess.check_output(["git","rev-parse","HEAD"], text=True).strip()
p = Path(r"docs/eastern-os/decision-intake-2.0/evidence/m2-3-decision-blueprint/CONTRACT-M2-3.md")
t = p.read_text(encoding="utf-8")
import re
t2 = re.sub(r"\| HEAD SHA \| [`a-f0-9_filled after commit]+ \|", f"| HEAD SHA | `{sha}` |", t)
# simpler replace of the known old value
t2 = t.replace("03b4020b70d6aeb3416c625ac07baab3c0947467", sha)
t2 = t2.replace("_(filled after commit)_", sha)
p.write_text(t2, encoding="utf-8")
print("set to", sha)
