from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
out = []
# find hero in translations - look for v2-hero-trust / hero title patterns
for key in ["v2-hero-trust", "v2-hero-title", "v2-hero-subtitle", "heroTrust", "hero.title", "unstick"]:
    out.append(f"=== {key} count={t.count(key)}")
# extract en/zh hero objects
for m in re.finditer(r"(?:trust|title|subtitle|ctaStart|eyebrow|badge):\s*'[^']*'", t):
    s = m.group(0)
    if any(x in s.lower() for x in ["decision", "unstick", "eastern", "start", "卡住", "提醒", "对话", "walk", "path", "alone", "opinion"]):
        out.append(s)
# broader: find blocks near hero-trust apply
idx = t.find("v2-hero-trust")
while idx != -1 and idx < len(t):
    # skip first HTML occurrence
    chunk = t[idx:idx+400]
    if "getElementById" in chunk or "textContent" in chunk or "innerHTML" in chunk:
        out.append("APPLY:\n" + chunk)
        break
    idx = t.find("v2-hero-trust", idx+1)
# dump locale hero sections by searching unique strings
for m in re.finditer(r"That decision won't leave you alone\.|你被|马上开始|A multi-turn|Eastern OS", t):
    start = max(0, m.start()-80)
    out.append(repr(t[start:m.start()+120]))
Path("temp/_hero_i18n.txt").write_text("\n".join(out), encoding="utf-8")
print("lines", len(out))
