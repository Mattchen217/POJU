from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
m = re.search(r"const HERO_COPY = \{[\s\S]*?\n            \};", t)
if not m:
    raise SystemExit("HERO_COPY not found")
block = m.group(0)
# extract en and zh only (before es)
en = re.search(r"en: \{[\s\S]*?\n              \},\n              zh:", block)
zh = re.search(r"zh: \{[\s\S]*?\n              \},\n              es:", block)
Path("temp/_hero_en.txt").write_text(en.group(0) if en else "NO EN", encoding="utf-8")
Path("temp/_hero_zh.txt").write_text(zh.group(0) if zh else "NO ZH", encoding="utf-8")
# title CSS
for mm in re.finditer(r"\.v2-hero-title[^{]*\{[^}]+\}", t):
    print(mm.group(0)[:400])
print("en/zh dumped", len(block))
