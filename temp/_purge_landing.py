# -*- coding: utf-8 -*-
"""Purge old multi-SKU / old prices from public/v2-landing.html (source-grep zero)."""
import re
from pathlib import Path

path = Path(r"public/v2-landing.html")
text = path.read_text(encoding="utf-8")
orig = text

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
                if i < len(html) and html[i] == "\n":
                    i += 1
                print(f"DEL #{elem_id} ({tag}) chars {start}-{i}")
                return html[:start] + html[i:]
    return html

for eid in ["v2-hero", "v2-scenarios", "v2-product-preview", "v2-engines", "v2-pricing"]:
    text = delete_element_by_id(text, eid)

m = re.search(
    r'<section\b[^>]*(?:hidden|display:\s*none)[^>]*>[\s\S]*?Four gateways to cognitive velocity[\s\S]*?</section>\s*',
    text,
)
if not m:
    m = re.search(
        r'<section\b[^>]*>[\s\S]*?Four gateways to cognitive velocity[\s\S]*?</section>\s*',
        text,
    )
if m:
    print(f"DEL multi-gateway CTA chars {m.start()}-{m.end()}")
    text = text[:m.start()] + text[m.end():]
else:
    print("WARN: multi-gateway CTA not found")

m = re.search(
    r'<script>\s*\(function\s*\(\)\s*\{\s*const canvas = document\.getElementById\(\'v2-hero-constellation\'\);[\s\S]*?</script>\s*',
    text,
)
if m:
    print(f"DEL hero constellation script chars {m.start()}-{m.end()}")
    text = text[:m.start()] + text[m.end():]
else:
    print("WARN: constellation script not found")

new_trust = (
    "No deceptive dark patterns. Billing is explicit pay-per-use only "
    "($19.99 per PASS; $59.99 / 5 PASS pack). Zero hidden checkouts, absolute single-click cancellation anytime."
)
m = re.search(r'No deceptive dark patterns\.[\s\S]*?single-click cancellation anytime\.', text)
if m and ("$29.99" in m.group(0) or "Monthly Pass" in m.group(0)):
    text = text[:m.start()] + new_trust + text[m.end():]
    print("REWRITE trust paragraph")
else:
    print("WARN: trust paragraph not found")

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
    print("REWRITE nav: product SKUs -> Open App")
else:
    print("WARN: nav product links block not found")

text2, nsub = re.subn(
    r'<li><a class="text-sm text-slate-500 transition-colors hover:text-primary" href="/app\?tab=(?:atmos|poju|match|syncro)[^"]*"[^>]*>[\s\S]*?</a></li>\s*',
    "",
    text,
)
if nsub:
    text = text2
    print(f"REWRITE footer: removed {nsub} product lis")
    # Insert Open Eastern OS into first products-ish empty-ish ul under footer Engines/Products heading if needed
    if "Open Eastern OS" not in text:
        text3, n3 = re.subn(
            r'(<footer[\s\S]{0,2500}?<ul[^>]*>)\s*(</ul>)',
            r'\1\n<li><a class="text-sm text-slate-500 transition-colors hover:text-primary" href="/app" target="_top">Open Eastern OS</a></li>\n\2',
            text,
            count=1,
        )
        if n3:
            text = text3
            print("INSERT footer Open Eastern OS")
else:
    print("WARN: footer product links not found")

for bad in ["Atmos Engine", "Pivot Simulator", "Match Analysis", "Syncro &amp; Glyph", "Syncro & Glyph"]:
    if bad in text:
        text = text.replace(bad, "Eastern OS")
        print(f"REWRITE leftover footer label {bad}")

m = re.search(r'\nconst ENGINE_COPY = \{[\s\S]*?\n\};\s*\n', text)
if m:
    print(f"DEL ENGINE_COPY chars {m.start()}-{m.end()}")
    text = text[:m.start()] + "\n" + text[m.end():]
else:
    print("WARN: ENGINE_COPY not found")

m = re.search(r'\n\s*function applyEngineCopy\(locale\) \{\s*[\s\S]*?\n\s*\}\s*\n', text)
if m:
    print(f"DEL applyEngineCopy chars {m.start()}-{m.end()}")
    text = text[:m.start()] + "\n" + text[m.end():]
else:
    print("WARN: applyEngineCopy not found")

text2, n = re.subn(r'\s*applyEngineCopy\([^)]*\);', '', text)
if n:
    print(f"DEL applyEngineCopy call sites: {n}")
    text = text2

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
    m = re.search(r'(\n\s*)(const pack = HERO_COPY|const pack = \(HERO_COPY)', text)
    if m:
        text = text[:m.start()] + stub + text[m.start():]
        print("STUB HERO_COPY for install modal")

text2, n = re.subn(r'const PASS_UNIT = 9\.99;', 'const PASS_UNIT = 19.99;', text)
if n:
    print(f"REWRITE PASS_UNIT -> 19.99 ({n})")
    text = text2

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
    if old in text:
        text = text.replace(old, new)
        print(f"REWRITE pricing i18n: {old[:48]}...")
    else:
        print(f"INFO miss exact: {old[:56]}")

# Sweep remaining bad prices (skip 99.99% uptime)
for bad_price in ["$3.99", "$2.99", "$4.99", "$9.99", "$29.99"]:
    while True:
        j = text.find(bad_price)
        if j < 0:
            break
        window = text[max(0, j - 20): j + 30]
        if "Uptime" in window or "uptime" in window:
            # skip this occurrence by temporarily masking
            text = text[:j] + "$XX.XX" + text[j + len(bad_price):]
            continue
        repl = "$19.99"
        print(f"SWEEP {bad_price} -> {repl} ctx={window!r}")
        text = text[:j] + repl + text[j + len(bad_price):]
text = text.replace("$XX.XX", "$99.99")  # restore uptime if masked wrong — fix below
# Fix uptime if we mangled: should be 99.99%
text = text.replace("$99.99% Uptime", "99.99% Uptime")
# If we incorrectly replaced inside 99.99, repair
text = re.sub(r'(?<!\d)99\.99% Uptime', '99.99% Uptime', text)

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
        print(f"SWEEP /{pat}/ -> {repl} ({n})")
        text = text2

m = re.search(r'\(function syncAtmosCopyToSquare\(\) \{[\s\S]*?\}\)\(\);\s*', text)
if m:
    print("DEL syncAtmosCopyToSquare")
    text = text[:m.start()] + text[m.end():]

m = re.search(r'\(function loadAtmosCardSpline\(\) \{[\s\S]*?\}\)\(\);\s*', text)
if m:
    print("DEL loadAtmosCardSpline")
    text = text[:m.start()] + text[m.end():]

text = text.replace("Atmos-style CTAs", "primary CTAs")

assert 'id="eos-landing-v2-top"' in text, "eos-landing-v2-top missing!"
assert "Unstick it" in text, "Unstick it missing!"
assert "$19.99" in text and "$59.99" in text, "allowed prices missing!"
if "破开它" not in text:
    print("WARN: 破开它 not in file")

checks = [
    "$4.99", "$9.99", "$29.99", "$3.99", "$2.99",
    "Five Specialized", "Five Engines", "Monthly Pass", "monthly Pass",
    "all 5 products", "Specialized Engines",
]
print("\n=== FINAL GREPS ===")
for c in checks:
    print(f"{c!r}: {text.count(c)}")

for c in ["tab=atmos", "tab=match", "tab=syncro", "tab=glyph", "tab=poju",
          "Begin Atmos", "Go to Syncro", "Go to Glyph", "Go to Match", "Go to Pivot",
          "Decode Glyph", "Activate Syncro", "Initialize Match",
          '"MATCH"', '"SYNCRO"', '"GLYPH"', '"ATMOS"', "Five</span> Specialized"]:
    cnt = text.count(c)
    if cnt:
        print(f"LEFT {c!r}: {cnt}")

path.write_text(text, encoding="utf-8", newline="\n")
print(f"WROTE {path} ({len(orig)} -> {len(text)} chars)")
