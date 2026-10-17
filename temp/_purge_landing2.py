# -*- coding: utf-8 -*-
"""Safe purge of old multi-SKU / prices from public/v2-landing.html."""
import re
from pathlib import Path

path = Path(r"public/v2-landing.html")
text = path.read_text(encoding="utf-8")
orig_len = len(text)

def delete_element_by_id(html, elem_id):
    pat = re.compile(
        r'<(?P<tag>section|main|div|article)\b[^>]*\bid=["\']' + re.escape(elem_id) + r'["\'][^>]*>',
        re.I,
    )
    m = pat.search(html)
    if not m:
        print(f"WARN: id={elem_id} not found")
        return html
    tag = m.group("tag").lower()
    start = m.start()
    i = m.end()
    depth = 1
    open_re = re.compile(rf'<{tag}\b', re.I)
    close_re = re.compile(rf'</{tag}\s*>', re.I)
    while i < len(html) and depth > 0:
        mo = open_re.search(html, i)
        mc = close_re.search(html, i)
        if mc is None:
            print(f"WARN: no close for {elem_id}")
            return html
        if mo and mo.start() < mc.start():
            depth += 1
            i = mo.end()
        else:
            depth -= 1
            i = mc.end()
            if depth == 0:
                while i < len(html) and html[i] in "\r\n":
                    i += 1
                print(f"DEL #{elem_id}")
                return html[:start] + html[i:]
    return html

def delete_section_containing(html, needle, label):
    pos = html.find(needle)
    if pos < 0:
        print(f"WARN: needle for {label} not found")
        return html
    # walk back to nearest <section
    start = html.rfind("<section", 0, pos)
    if start < 0:
        print(f"WARN: section open for {label} not found")
        return html
    i = start + len("<section")
    # find end of opening tag then depth-walk
    gt = html.find(">", i)
    if gt < 0:
        return html
    i = gt + 1
    depth = 1
    open_re = re.compile(r'<section\b', re.I)
    close_re = re.compile(r'</section\s*>', re.I)
    while i < len(html) and depth > 0:
        mo = open_re.search(html, i)
        mc = close_re.search(html, i)
        if mc is None:
            print(f"WARN: no close for {label}")
            return html
        if mo and mo.start() < mc.start():
            depth += 1
            i = mo.end()
        else:
            depth -= 1
            i = mc.end()
            if depth == 0:
                while i < len(html) and html[i] in "\r\n":
                    i += 1
                print(f"DEL {label}")
                return html[:start] + html[i:]
    return html

def delete_script_containing(html, needle, label):
    pos = html.find(needle)
    if pos < 0:
        print(f"WARN: {label} needle not found")
        return html
    start = html.rfind("<script", 0, pos)
    if start < 0:
        return html
    end = html.find("</script>", pos)
    if end < 0:
        return html
    end += len("</script>")
    while end < len(html) and html[end] in "\r\n":
        end += 1
    print(f"DEL {label}")
    return html[:start] + html[end:]

# 1) Delete known multi-SKU blocks by id
for eid in ["v2-hero", "v2-scenarios", "v2-product-preview", "v2-engines", "v2-pricing"]:
    text = delete_element_by_id(text, eid)

# 2) Multi-gateway CTA (exact needle, walk to its own section)
text = delete_section_containing(text, "Four gateways to cognitive velocity", "multi-gateway CTA")

# 3) Hero constellation script
text = delete_script_containing(text, "v2-hero-constellation", "hero constellation script")

# 4) Trust paragraph ($29.99 Monthly Pass) — keep surrounding card
new_trust = (
    "No deceptive dark patterns. Billing is explicit pay-per-use only "
    "($19.99 per PASS; $59.99 / 5 PASS pack). Zero hidden checkouts, absolute single-click cancellation anytime."
)
m = re.search(r'No deceptive dark patterns\.[\s\S]*?single-click cancellation anytime\.', text)
if m:
    text = text[:m.start()] + new_trust + text[m.end():]
    print("REWRITE trust paragraph")
else:
    print("WARN: trust paragraph not found")

# 5) Nav product SKUs -> Open App
nav_products = re.search(
    r'(<div class="hidden md:flex items-center gap-6 lg:gap-8">)\s*'
    r'(?:<a class="text-base font-medium[^>]*>[\s\S]*?</a>\s*){2,6}'
    r'(</div>)',
    text,
)
if nav_products:
    replacement = (
        nav_products.group(1) + "\n"
        + '<a class="text-base font-medium tracking-wide text-slate-100 hover:text-primary transition-colors" '
        + 'href="/app" target="_top">Open App</a>\n'
        + nav_products.group(2)
    )
    text = text[:nav_products.start()] + replacement + text[nav_products.end():]
    print("REWRITE nav -> Open App")
else:
    print("WARN: nav block not found")

# 6) Footer product links
text2, nsub = re.subn(
    r'<li><a class="text-sm text-slate-500 transition-colors hover:text-primary" href="/app\?tab=(?:atmos|poju|match|syncro)[^"]*"[^>]*>[\s\S]*?</a></li>\s*',
    "",
    text,
)
if nsub:
    text = text2
    print(f"REWRITE footer removed {nsub} product lis")
    if "Open Eastern OS" not in text:
        # Insert into Engines column: look for heading then empty-ish ul
        m = re.search(r'(<h4[^>]*>\s*Engines\s*</h4>\s*<ul[^>]*>)', text, re.I)
        if not m:
            m = re.search(r'(<footer[\s\S]{0,2000}?<ul[^>]*>)', text)
        if m:
            insert_at = m.end()
            text = (
                text[:insert_at]
                + '\n<li><a class="text-sm text-slate-500 transition-colors hover:text-primary" href="/app" target="_top">Open Eastern OS</a></li>\n'
                + text[insert_at:]
            )
            print("INSERT footer Open Eastern OS")
else:
    print("WARN: footer product links not found")

# 7) Remove ENGINE_COPY + applyEngineCopy
m = re.search(r'\nconst ENGINE_COPY = \{[\s\S]*?\n\};\s*\n', text)
if m:
    text = text[:m.start()] + "\n" + text[m.end():]
    print("DEL ENGINE_COPY")
m = re.search(r'\n\s*function applyEngineCopy\(locale\) \{\s*[\s\S]*?\n\s*\}\s*\n', text)
if m:
    text = text[:m.start()] + "\n" + text[m.end():]
    print("DEL applyEngineCopy")
text2, n = re.subn(r'\s*applyEngineCopy\([^)]*\);', '', text)
if n:
    text = text2
    print(f"DEL applyEngineCopy calls: {n}")

# 8) Neutralize dead copy binds
text = text.replace(
    "            const enginesSection = ENGINES_SECTION_COPY[currentLocale] || ENGINES_SECTION_COPY.en;\n"
    "            const enginesTitle = document.getElementById('v2-engines-title');\n"
    "            const enginesSubtitle = document.getElementById('v2-engines-subtitle');\n"
    "            if (enginesTitle) enginesTitle.innerHTML = enginesSection.title;\n"
    "            if (enginesSubtitle) enginesSubtitle.textContent = enginesSection.subtitle;\n",
    "            /* engines section purged */\n",
)
text = text.replace(
    "            const scenarios = SCENARIOS_COPY[currentLocale] || SCENARIOS_COPY.en;\n"
    "            const scenariosHeader = document.getElementById('v2-scenarios-header');\n"
    "            if (scenariosHeader) scenariosHeader.textContent = scenarios.header;\n"
    "            document.querySelectorAll('[data-scenario]').forEach((el) => {\n"
    "              const key = el.getAttribute('data-scenario');\n"
    "              if (key && scenarios[key]) el.textContent = scenarios[key];\n"
    "            });\n",
    "            /* scenarios section purged */\n",
)
text = text.replace(
    "            const hero = HERO_COPY[currentLocale] || HERO_COPY.en;\n"
    "            const titleEl = document.getElementById('v2-hero-title');\n"
    "            const subtitleEl = document.getElementById('v2-hero-subtitle');\n"
    "            if (titleEl) titleEl.innerHTML = hero.title;\n"
    "            if (subtitleEl) subtitleEl.textContent = hero.subtitle;\n",
    "            /* old v2-hero purged */\n",
)

if "HERO_COPY" in text and "const HERO_COPY" not in text:
    stub = "\n            const HERO_COPY = { en: { install: {} }, zh: { install: {} }, es: { install: {} }, fr: { install: {} } };\n"
    m = re.search(r'\n\s*const pack = \(?HERO_COPY', text)
    if m:
        text = text[:m.start()] + stub + text[m.start():]
        print("STUB HERO_COPY")

# 9) PASS_UNIT
text2, n = re.subn(r'const PASS_UNIT = 9\.99;', 'const PASS_UNIT = 19.99;', text)
if n:
    text = text2
    print("REWRITE PASS_UNIT -> 19.99")

# 10) Pricing i18n string rewrites
replacements = [
    ('"Works across all 5 products (Atmos / Pivot / Match / Syncro / Glyph)"',
     '"Works across Eastern OS (single PASS unlock)"'),
    ('"Válido para los 5 productos (Atmos / Pivot / Match / Syncro / Glyph)"',
     '"Válido en Eastern OS (un PASS desbloquea)"'),
    ('"Valable sur les 5 produits (Atmos / Pivot / Match / Syncro / Glyph)"',
     '"Valable sur Eastern OS (un PASS débloque)"'),
    ('"全站所有功能通用（Atmos / Pivot / Match / Syncro / Glyph）"',
     '"全站功能通用（Eastern OS · 单 PASS 解锁）"'),
    ('"Best Value · As low as $3.99 / Pass"',
     '"Best Value · Pack $59.99 / 5 PASS"'),
    ('"Mejor precio · Desde $3.99 / Pass"',
     '"Mejor precio · Pack $59.99 / 5 PASS"'),
    ('"Meilleur rapport qualité-prix · Dès $3.99 / Pass"',
     '"Meilleur rapport qualité-prix · Pack $59.99 / 5 PASS"'),
    ('"极致性价比 · 单 Pass 低至 $3.99"',
     '"极致性价比 · 套装 $59.99 / 5 PASS"'),
    ('"Limited-time bonus: +5 Passes (20 Passes total — only $2.99 / Pass)"',
     '"Pack option: $59.99 / 5 PASS"'),
    ('"Bono por tiempo limitado: +5 Passes (20 Passes en total — solo $2.99 / Pass)"',
     '"Opción pack: $59.99 / 5 PASS"'),
    ('"Bonus à durée limitée : +5 Passes (20 Passes au total — seulement $2.99 / Pass)"',
     '"Option pack : $59.99 / 5 PASS"'),
    ('"限时加送 +5 Passes（共 20 个 Passes，仅 $2.99 / Pass）"',
     '"套装选项：$59.99 / 5 PASS"'),
    ('"Central management with monthly Pass refresh"',
     '"Central management with PASS balance"'),
]
for old, new in replacements:
    c = text.count(old)
    if c:
        text = text.replace(old, new)
        print(f"REWRITE x{c}: {old[:40]}...")
    else:
        print(f"MISS: {old[:50]}")

# 11) Sweep remaining forbidden patterns (careful with 99.99%)
for pat, repl in [
    (r"Atmos\s*/\s*Pivot\s*/\s*Match\s*/\s*Syncro\s*/\s*Glyph", "Eastern OS"),
    (r"all 5 products", "Eastern OS"),
    (r"los 5 productos", "Eastern OS"),
    (r"les 5 produits", "Eastern OS"),
    (r"Five</span>\s*Specialized\s*<span class=\"gold-gradient\">Engines</span>", "Eastern OS"),
    (r"Five Specialized Engines", "Eastern OS"),
    (r"Five Engines", "Eastern OS"),
    (r"Monthly Pass", "PASS"),
    (r"monthly Pass", "PASS"),
]:
    text2, n = re.subn(pat, repl, text)
    if n:
        text = text2
        print(f"SWEEP {pat} x{n}")

# Bad dollar prices except inside 99.99%
for bad in ["$4.99", "$9.99", "$29.99", "$3.99", "$2.99"]:
    out = []
    i = 0
    while True:
        j = text.find(bad, i)
        if j < 0:
            out.append(text[i:])
            break
        ctx = text[max(0, j - 25): j + len(bad) + 25]
        if re.search(r'99\.99%\s*Uptime', ctx) or text[max(0,j-3):j] == "99.":
            out.append(text[i:j+len(bad)])
            i = j + len(bad)
            continue
        print(f"SWEEP price {bad} at {j}")
        out.append(text[i:j])
        out.append("$19.99")
        i = j + len(bad)
    text = "".join(out)

# 12) Remove Atmos-specific engine JS helpers
m = re.search(r'\(function syncAtmosCopyToSquare\(\) \{[\s\S]*?\}\)\(\);\s*', text)
if m:
    text = text[:m.start()] + text[m.end():]
    print("DEL syncAtmosCopyToSquare")
m = re.search(r'\(function loadAtmosCardSpline\(\) \{[\s\S]*?\}\)\(\);\s*', text)
if m:
    text = text[:m.start()] + text[m.end():]
    print("DEL loadAtmosCardSpline")
text = text.replace("Atmos-style CTAs", "primary CTAs")

# Integrity
assert 'id="eos-landing-v2-top"' in text
assert "Unstick it" in text
assert "破开它" in text
assert "$19.99" in text and "$59.99" in text
assert 'id="v2-lang-switcher"' in text
assert "Log in" in text or "login" in text.lower()
# Must keep method / faq chrome
assert 'id="v2-faq"' in text or 'v2-faq' in text
assert 'id="v2-built-heading"' in text or "data-built" in text

checks = {
    "$4.99": text.count("$4.99"),
    "$9.99": text.count("$9.99"),
    "$29.99": text.count("$29.99"),
    "$3.99": text.count("$3.99"),
    "$2.99": text.count("$2.99"),
    "Five Specialized": text.count("Five Specialized"),
    "Five Engines": text.count("Five Engines"),
    "Monthly Pass": text.count("Monthly Pass"),
    "all 5 products": text.count("all 5 products"),
    "Five</span> Specialized": text.count("Five</span> Specialized"),
}
print("\n=== FINAL GREPS ===")
for k,v in checks.items():
    print(f"{k!r}: {v}")

for c in ["tab=atmos", "tab=match", "tab=syncro", "tab=glyph", "tab=poju",
          "Begin Atmos", "Go to Syncro", "Go to Glyph", "Go to Match",
          "Decode Glyph", "Activate Syncro", "Initialize Match",
          '"MATCH"', '"SYNCRO"', '"GLYPH"', "ENGINE_COPY",
          "id=\"v2-engines\"", "id=\"v2-pricing\"", "id=\"v2-hero\""]:
    cnt = text.count(c)
    if cnt:
        print(f"LEFT {c!r}: {cnt}")

path.write_text(text, encoding="utf-8", newline="\n")
print(f"WROTE {len(orig_len) if False else orig_len} -> {len(text)}")
print("OK")
