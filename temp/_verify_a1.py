import sys, re
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    text = f.read()
    lines = text.splitlines()

# Extract EN/ZH hero from HERO_COPY
for lang in ("en", "zh"):
    print(f"\n===== {lang.upper()} =====")
    # find start of lang block inside HERO_COPY
    # crude: after HERO_COPY, find "en: {" or "zh: {"
m = re.search(r"const HERO_COPY = \{([\s\S]*?)\n            \};\n", text)
assert m, "HERO_COPY not found"
block = m.group(1)
for lang in ("en", "zh"):
    print(f"\n===== {lang.upper()} =====")
    lm = re.search(rf"\n              {lang}: \{{([\s\S]*?)\n              \}},\n              (?:zh|es|fr|install)", "\n" + block + "\n              fr")
    # simpler parse keys
    start = block.find(f"\n              {lang}: {{")
    if start < 0:
        start = block.find(f"{lang}: {{")
    # find next sibling locale
    nxt_candidates = []
    for other in ("en", "zh", "es", "fr"):
        if other == lang: continue
        idx = block.find(f"\n              {other}: {{", start + 5)
        if idx > start: nxt_candidates.append(idx)
    end = min(nxt_candidates) if nxt_candidates else len(block)
    chunk = block[start:end]
    for key in ("eyebrow", "title", "subtitle", "ctaStart", "ctaDesktop", "ctaSecondary"):
        km = re.search(rf"{key}:\s*((?:'[\s\S]*?'|\"[\s\S]*?\"|\n\s*'[\s\S]*?')(?:\s*\+\s*'[\s\S]*?')*),", chunk)
        # multiline title uses next line string
        if key in ("title", "subtitle"):
            km = re.search(rf"{key}:\s*\n\s*('[\s\S]*?'),", chunk)
        else:
            km = re.search(rf"{key}:\s*('(?:\\'|[^'])*'),", chunk)
        if km:
            val = km.group(1)
            print(f"{key}: {val}")
        else:
            print(f"{key}: NOT FOUND")

# Hero region banned terms (HTML hero + HERO_COPY en/zh only)
hero_html = "\n".join(lines[1548:1572])
en_zh = ""
# pull en+zh from HERO_COPY
start_en = text.find("const HERO_COPY")
start_es = text.find("\n              es: {", start_en)
en_zh = text[start_en:start_es]
print("\n===== BANNED CHECK (hero HTML + EN/ZH HERO_COPY) =====")
banned = ["3000", "3,000", "3,000 年", "能量", "场能", "Windows desktop", "Windows 桌面版", "native energy", "energy architecture", "energy matrix"]
region = hero_html + "\n" + en_zh
for b in banned:
    if b in region:
        # allow if only in es/fr - but region is en/zh
        print(f"FAIL: found {b!r}")
    else:
        print(f"ok absent: {b!r}")

# confirm secondary wiring
print("\n===== SECONDARY WIRING =====")
print("scrollIntoView v2-pricing:", "getElementById('v2-pricing')" in text and "scrollIntoView" in text)
print("handleInstallClick still on desktopCta:", "desktopCta.addEventListener('click', function () {\n                void handleInstallClick()" in text)

# HTML slots
print("\n===== HTML SLOTS =====")
for i in range(1551, 1570):
    print(f"{i+1}|{lines[i].rstrip()[:200]}")
