# -*- coding: utf-8 -*-
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
print("必含:", text.count("必含"))
print("外加:", text.count("外加"))
print("required 30:", text.lower().count("required 30"))
print("provided together:", text.count("provided together"))
print("同步提供:", text.count("同步提供"))
print()
ids = re.findall(r"<section[^>]*\bid=[\"']([^\"']+)[\"']", text, re.I)
print("section ids:", ids)
for needle in ["id=\"v2-methodology\"", "id=\"v2-pricing\"", "id=\"v2-team\"", "eos-section-gap", "Technical Spec", "BUILT_COPY", "applyLocale", "SCENARIOS_COPY", "id=\"v2-guarantees\""]:
    print(f"find {needle}:", text.find(needle))
# print neighbors around methodology end / pricing start
m = re.search(r'id=["\']v2-methodology["\']', text)
p = re.search(r'id=["\']v2-pricing["\']', text)
t = re.search(r'id=["\']v2-team["\']', text)
print("methodology match:", m.start() if m else None)
print("pricing match:", p.start() if p else None)
print("team match:", t.start() if t else None)
