from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# find page scroll structure classes near start of body content
for m in re.finditer(r'<div class="([^"]*v2-page[^"]*)"', t):
    print("div", m.group(1)[:180])
# body class
m = re.search(r"<body([^>]*)>", t)
print("body", m.group(1)[:200] if m else None)
# any section with solid bg after hero
for sid in ["v2-product-preview", "eos-landing-scenarios", "v2-engines"]:
    i = t.find(f'id="{sid}"')
    print(sid, t[i:i+180].replace("\n"," "))
