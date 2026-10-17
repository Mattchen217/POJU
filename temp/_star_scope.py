from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# starfield / constellation scope
for pat in ["constellation", "starfield", "v2-hero-constellation", "canvas", "stars"]:
    print(pat, t.count(pat))
# how canvas is positioned
m = re.search(r"#v2-hero-constellation[^{]*\{[^}]+\}", t)
print("canvas css:", m.group(0) if m else "none")
m2 = re.search(r"\.v2-hero-foreground[^{]*\{[^}]+\}", t)
print("fg:", m2.group(0) if m2 else "none")
# body/main bg
for m in re.finditer(r"(?:body|#v2-landing|main|\.v2-page)[^{]*\{[^}]{0,400}\}", t):
    s = m.group(0)
    if "background" in s or "overflow" in s:
        print("BG:", s[:350])
# section order + starfield parent
i = t.find('id="v2-product-preview"')
print("product section classes:", t[i-20:i+200])
# is canvas only inside hero?
hero = t.find('id="v2-hero"')
canvas = t.find('v2-hero-constellation')
prod = t.find('id="v2-product-preview"')
print("order hero/canvas/prod", hero, canvas, prod)
