from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
for m in re.finditer(r"#v2-hero-title\s*\{[^}]+\}", t):
    print(m.group(0)); print("---")
for m in re.finditer(r"#v2-hero-subtitle\s*\{[^}]+\}", t):
    print(m.group(0)); print("---")
# verify no balance left on hero
print("balance left", "text-wrap: balance" in t)
