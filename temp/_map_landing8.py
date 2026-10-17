import sys,re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
print("ENGINES_SECTION_COPY count", text.count("ENGINES_SECTION_COPY"))
print("HERO_COPY def", bool(re.search(r"const HERO_COPY\s*=", text)))
# find all const X =
for m in re.finditer(r"const ([A-Z][A-Z0-9_]*)\s*=", text):
    line = text[:m.start()].count("\n")+1
    if line > 2600:
        print(f"{line}: const {m.group(1)}")

# Check faq-i18n for forbidden (info only)
import os
faq = r"public/v2/faq-i18n.js"
if os.path.exists(faq):
    with open(faq, "r", encoding="utf-8") as f:
        ft = f.read()
    for p in ["$4.99","$29.99","$9.99","Five Specialized","Glyph","Syncro"]:
        print(f"faq-i18n {p}: {ft.count(p)}")
