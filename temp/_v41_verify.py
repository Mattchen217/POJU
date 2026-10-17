from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# show hero static
i = t.find('id="v2-hero-trust"')
Path("temp/_hero_v41_verify.txt").write_text(t[i-80:i+900], encoding="utf-8")
# show en/zh from HERO_COPY
m = re.search(r"const HERO_COPY = \{[\s\S]*?\n            \};", t)
block = m.group(0)
en = re.search(r"en: \{[\s\S]*?eyebrow:.*?\n.*?subtitle:\n\s*'[^']*'", block)
zh = re.search(r"zh: \{[\s\S]*?eyebrow:.*?\n.*?subtitle:\n\s*'[^']*'", block)
Path("temp/_hero_v41_en.txt").write_text(en.group(0) if en else "fail", encoding="utf-8")
Path("temp/_hero_v41_zh.txt").write_text(zh.group(0) if zh else "fail", encoding="utf-8")
print("static snippet written")
print("en ok", "Stuck on a decision" in block)
print("zh ok", "你被什么决定卡住了吗" in block)
print("l2 css", ".v2-hero-title-l2" in t)
# reject checks
bad = ["非算命", "fortune", "3000", "三千"]
for b in bad:
    # only in hero area near HERO_COPY en/zh titles
    pass
print("reject non-算命 in en eyebrow/title:", "算命" not in block[block.find("en:"):block.find("zh:")])
