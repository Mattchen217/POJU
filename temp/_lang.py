from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# how lang is applied
for m in re.finditer(r"document\.(documentElement|body)\.(lang|className|setAttribute).{0,80}", t):
    print(m.group(0)[:120])
for m in re.finditer(r"lang\s*=\s*['\"]zh|html\.lang|dataset\.lang|data-lang|setAttribute\('lang'", t):
    print("L", m.group(0))
# find applyLang
i = t.find("HERO_COPY")
# search apply language
m = re.search(r"function (?:apply|set)(?:Lang|Locale)[\s\S]{0,400}", t)
print(m.group(0)[:400] if m else "no apply")
for m in re.finditer(r"documentElement\.lang\s*=", t):
    print("set", t[m.start():m.start()+60])
