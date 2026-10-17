# -*- coding: utf-8 -*-
import re, sys
from pathlib import Path
from collections import Counter
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

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
                while i < len(html) and html[i] in "\r\n":
                    i += 1
                print(f"DEL #{elem_id}")
                return html[:start] + html[i:]
    return html

def delete_section_containing(html, needle, label):
    pos = html.find(needle)
    if pos < 0:
        print(f"WARN: {label} missing")
        return html
    start = html.rfind("<section", 0, pos)
    gt = html.find(">", start)
    i = gt + 1
    depth = 1
    open_re = re.compile(r'<section\b', re.I)
    close_re = re.compile(r'</section\s*>', re.I)
    while i < len(html) and depth > 0:
        mo = open_re.search(html, i)
        mc = close_re.search(html, i)
        if mc is None:
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

for eid in ["v2-hero", "v2-scenarios", "v2-product-preview", "v2-engines", "v2-pricing"]:
    text = delete_element_by_id(text, eid)
text = delete_section_containing(text, "Four gateways to cognitive velocity", "multi-gateway CTA")

m = re.search(
    r'<script>\s*\(function\s*\(\)\s*\{\s*const canvas = document\.getElementById\(\'v2-hero-constellation\'\);[\s\S]*?\}\)\(\);\s*</script>\s*',
    text,
)
if m:
    text = text[:m.start()] + text[m.end():]
    print("DEL constellation IIFE")
else:
    print("WARN: constellation IIFE missing")

new_trust = (
    "No deceptive dark patterns. Billing is explicit pay-per-use only "
    "($19.99 per PASS; $59.99 / 5 PASS pack). Zero hidden checkouts, absolute single-click cancellation anytime."
)
m = re.search(r'No deceptive dark patterns\.[\s\S]*?single-click cancellation anytime\.', text)
if m:
    text = text[:m.start()] + new_trust + text[m.end():]
    print("REWRITE trust")

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
    print("REWRITE nav")

text2, nsub = re.subn(
    r'<li><a class="text-sm text-slate-500 transition-colors hover:text-primary" href="/app\?tab=(?:atmos|poju|match|syncro)[^"]*"[^>]*>[\s\S]*?</a></li>\s*',
    "",
    text,
)
if nsub:
    text = text2
    print(f"REWRITE footer x{nsub}")
    if "Open Eastern OS" not in text:
        m = re.search(r'(<footer[\s\S]{0,1500}?<ul[^>]*>)', text)
        if m:
            text = text[:m.end()] + '\n<li><a class="text-sm text-slate-500 transition-colors hover:text-primary" href="/app" target="_top">Open Eastern OS</a></li>\n' + text[m.end():]
            print("INSERT footer link")

m = re.search(r'\nconst ENGINE_COPY = \{[\s\S]*?\n\};\s*\n', text)
if m:
    text = text[:m.start()] + "\n" + text[m.end():]
    print("DEL ENGINE_COPY")
m = re.search(r'\n\s*function applyEngineCopy\(locale\) \{\s*[\s\S]*?\n\s*\}\s*\n', text)
if m:
    text = text[:m.start()] + "\n" + text[m.end():]
    print("DEL applyEngineCopy")
text, n = re.subn(r'\s*applyEngineCopy\([^)]*\);', '', text)
if n:
    print(f"DEL applyEngineCopy calls {n}")

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

text, n = re.subn(r'const PASS_UNIT = 9\.99;', 'const PASS_UNIT = 19.99;', text)
if n:
    print("PASS_UNIT -> 19.99")

# Exact string rewrites
pairs = [
    ('"Works across all 5 products (Atmos / Pivot / Match / Syncro / Glyph)"',
     '"Works across Eastern OS (single PASS unlock)"'),
    ('"Válido para los 5 productos (Atmos / Pivot / Match / Syncro / Glyph)"',
     '"Válido en Eastern OS (un PASS desbloquea)"'),
    ('"Valable sur les 5 produits (Atmos / Pivot / Match / Syncro / Glyph)"',
     '"Valable sur Eastern OS (un PASS débloque)"'),
    ('"全站所有功能通用（Atmos / Pivot / Match / Syncro / Glyph）"',
     '"全站功能通用（Eastern OS · 单 PASS 解锁）"'),
    ('"Best Value · As low as $3.99 / Pass"', '"Best Value · Pack $59.99 / 5 PASS"'),
    ('"Mejor precio · Desde $3.99 / Pass"', '"Mejor precio · Pack $59.99 / 5 PASS"'),
    ('"Meilleur rapport qualité-prix · Dès $3.99 / Pass"', '"Meilleur rapport qualité-prix · Pack $59.99 / 5 PASS"'),
    ('"极致性价比 · 单 Pass 低至 $3.99"', '"极致性价比 · 套装 $59.99 / 5 PASS"'),
    ('"Limited-time bonus: +5 Passes (20 Passes total — only $2.99 / Pass)"', '"Pack option: $59.99 / 5 PASS"'),
    ('"Bono por tiempo limitado: +5 Passes (20 Passes en total — solo $2.99 / Pass)"', '"Opción pack: $59.99 / 5 PASS"'),
    ('"Bonus à durée limitée : +5 Passes (20 Passes au total — seulement $2.99 / Pass)"', '"Option pack : $59.99 / 5 PASS"'),
    ('"限时加送 +5 Passes（共 20 个 Passes，仅 $2.99 / Pass）"', '"套装选项：$59.99 / 5 PASS"'),
    ('"Central management with monthly Pass refresh"', '"Central management with PASS balance"'),
    ('"1 Pass unlocks 1 full project delivery (including Atmos 30-day delivery)"',
     '"1 Pass unlocks 1 full Eastern OS project delivery"'),
    ('"1 个 Pass 解锁 1 个项目的完整交付（包括 Atmos 30天完整交付）"',
     '"1 个 Pass 解锁 1 次 Eastern OS 完整项目交付"'),
    ('"Most Popular · As low as $5.98 / Pass"', '"Most Popular · $19.99 / PASS"'),
    ('"Más popular · Desde $5.98 / Pass"', '"Más popular · $19.99 / PASS"'),
    ('"Le plus populaire · Dès $5.98 / Pass"', '"Le plus populaire · $19.99 / PASS"'),
    ('"最受欢迎 · 单 Pass 低至 $5.98"', '"最受欢迎 · $19.99 / PASS"'),
    ('"price": "$29.90"', '"price": "$19.99"'),
    ('"price": "$59.90"', '"price": "$59.99"'),
]
for old, new in pairs:
    c = text.count(old)
    if c:
        text = text.replace(old, new)
        print(f"REWRITE x{c}: {old[:48]}")

# Regex sweeps for Atmos / multi-SKU / leftover prices in pricing copy
sweeps = [
    (r'including 30-day full delivery for Atmos', 'Eastern OS full delivery'),
    (r'including Atmos 30-day delivery', 'Eastern OS delivery'),
    (r'incluye 30 días de entrega para Atmos', 'entrega completa Eastern OS'),
    (r'incluye 30 días para Atmos', 'entrega Eastern OS'),
    (r'y compris 30 jours de livraison complète pour Atmos', 'livraison complète Eastern OS'),
    (r'y compris 30 jours pour Atmos', 'livraison Eastern OS'),
    (r'包括 Atmos 30天完整交付', 'Eastern OS 完整交付'),
    (r'（包括 Atmos 30天完整交付）', '（Eastern OS 完整交付）'),
    (r'Atmos\s*/\s*Pivot\s*/\s*Match\s*/\s*Syncro\s*/\s*Glyph', 'Eastern OS'),
    (r'all 5 products', 'Eastern OS'),
    (r'los 5 productos', 'Eastern OS'),
    (r'les 5 produits', 'Eastern OS'),
    (r'Five</span>\s*Specialized\s*<span class="gold-gradient">Engines</span>', 'Eastern OS'),
    (r'Five Specialized Engines', 'Eastern OS'),
    (r'Five Engines', 'Eastern OS'),
    (r'Monthly Pass', 'PASS'),
    (r'monthly Pass', 'PASS'),
    (r'\$5\.98', '$19.99'),
    (r'\$4\.27', '$19.99'),
    (r'\$29\.90', '$19.99'),
    (r'\$59\.90', '$59.99'),
    (r'\$4\.99', '$19.99'),
    (r'\$3\.99', '$19.99'),
    (r'\$2\.99', '$19.99'),
    (r'\$9\.99', '$19.99'),
    (r'\$29\.99', '$19.99'),
]
for pat, repl in sweeps:
    text2, n = re.subn(pat, repl, text)
    if n:
        text = text2
        print(f"SWEEP {pat} x{n}")

# Subtitle lines still mentioning Atmos as product - generic replace remaining "Atmos" in PRICING_I18N region only
# Safer: replace remaining multi-product Atmos mentions
text2, n = re.subn(r'\bAtmos\b', 'Eastern OS', text)
if n:
    text = text2
    print(f"SWEEP word Atmos x{n}")

# Remove dead helpers/comments
for pat, label in [
    (r'\(function syncAtmosCopyToSquare\(\) \{[\s\S]*?\}\)\(\);\s*', 'syncAtmos'),
    (r'\(function loadAtmosCardSpline\(\) \{[\s\S]*?\}\)\(\);\s*', 'loadAtmosSpline'),
    (r'// Align ATMOS[^\n]*\n', 'align comment'),
    (r'// ATMOS tall card[^\n]*\n', 'spline comment'),
]:
    text2, n = re.subn(pat, '', text)
    if n:
        text = text2
        print(f"DEL {label} x{n}")

text = text.replace("Atmos-style CTAs", "primary CTAs")
text, n = re.subn(r"goLocalizedApp\('/app\?tab=atmos'\)", "goLocalizedApp('/app')", text)
if n:
    print(f"REWRITE goLocalizedApp x{n}")

# Integrity
assert text.count("<style") == orig.count("<style")
assert text.count("</style>") == orig.count("</style>")
assert 'id="eos-landing-v2-top"' in text
assert "Unstick it" in text
assert "破开它" in text
assert text.count("#eos-landing-v2-top") >= 40
assert 'id="v2-faq"' in text
assert 'id="v2-engines"' not in text
assert 'id="v2-pricing"' not in text
assert 'id="v2-hero"' not in text

# Ensure no forbidden prices remain (99.99% uptime has no $)
prices = Counter(re.findall(r'\$\d+\.\d{2}', text))
print("prices:", prices)
for p, c in prices.items():
    assert p in {"$19.99", "$59.99"}, f"forbidden price left: {p} x{c}"

checks = ["$4.99", "$9.99", "$29.99", "Five Specialized", "Five Engines", "Monthly Pass",
          "all 5 products", "Five</span> Specialized", "Begin Atmos", "Syncro", "Glyph",
          "tab=atmos", "tab=syncro", "tab=glyph", "tab=match", "MATCH", "SYNCRO", "GLYPH"]
print("\n=== FINAL ===")
for c in checks:
    print(f"{c!r}: {text.count(c)}")
print("Atmos", text.count("Atmos"), "Pivot", text.count("Pivot"), "Match", text.count("Match"))

path.write_text(text, encoding="utf-8", newline="\n")
print(f"WROTE {len(orig)} -> {len(text)}")
print("OK")
