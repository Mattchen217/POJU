from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
out = []
for m in re.finditer(r"['\"][^'\"]*gold-gradient[^'\"]*['\"]", t):
    out.append("STR: " + m.group(0)[:300])
for m in re.finditer(r"v2-engines-title[\s\S]{0,250}", t):
    out.append("REF: " + m.group(0)[:250])
# scenarios apply
for m in re.finditer(r"eos-scenarios-h1[\s\S]{0,300}", t):
    out.append("SC: " + m.group(0)[:300])
# find applyI18n / textContent for h1
for m in re.finditer(r"scenarios[\s\S]{0,80}h1[\s\S]{0,120}", t):
    if "getElementById" in m.group(0) or "textContent" in m.group(0) or "innerHTML" in m.group(0):
        out.append("APPLY: " + m.group(0)[:200])
# dump en/zh h1 lines
for m in re.finditer(r"h1:\s*'[^']+'", t):
    if any(x in m.group(0) for x in ["decision", "Built", "要紧", "Five", "Engine", "模块", "引擎"]):
        out.append("H1LINE: " + m.group(0))
Path("temp/_gold_i18n.txt").write_text("\n".join(out), encoding="utf-8")
print("wrote", len(out), "lines")
