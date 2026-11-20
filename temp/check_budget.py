from pathlib import Path
t = Path(r"lib/poju/decision-intake/blueprint.ts").read_text(encoding="utf-8")
for s in ["SOFT", "HARD", "DEPTH", "depth_per_direction", "depth_soft_cap"]:
    # print nearby lines
    pass
import re
for m in re.finditer(r"const (SOFT|HARD|DEPTH)\s*=\s*[^;]+;", t):
    print(m.group(0))
for m in re.finditer(r"depth_soft_cap:\s*[^,\n]+", t):
    print(m.group(0)[:80])
