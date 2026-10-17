import sys,re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
lines = text.splitlines(True)

# find ENGINES_SECTION_COPY definition
for i,l in enumerate(lines):
    if "ENGINES_SECTION_COPY" in l or "HERO_COPY" in l and "=" in l and "const" in l:
        print(f"{i+1}: {l.strip()[:120]}")

# Find const HERO_COPY and end
for i,l in enumerate(lines):
    if re.search(r"const HERO_COPY\s*=", l):
        print("HERO_COPY at", i+1)
    if re.search(r"const ENGINES_SECTION_COPY\s*=", l):
        print("ENGINES_SECTION_COPY at", i+1)
    if re.search(r"V2_FAQ_I18N\s*=", l):
        print("V2_FAQ_I18N assign", i+1, l.strip()[:100])

# FAQ content with prices?
for i,l in enumerate(lines):
    if any(x in l for x in ["$4.99","$29.99","Glyph","Syncro","Five","4.99","29.99","faq"]):
        if "FAQ" in l or "faq" in l or "$4" in l or "$29" in l:
            print(f"faqish {i+1}: {l.strip()[:130]}")

# where does ENGINE_COPY end?
for i in range(3250, 3300):
    print(f"{i+1}: {lines[i].rstrip()[:120]}")
