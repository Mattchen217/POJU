# -*- coding: utf-8 -*-
"""Safe purge v3: never delete via CSS-colliding needles."""
import re
from pathlib import Path
from collections import Counter

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
                print(f"DEL #{elem_id} ({start}:{i})")
                return html[:start] + html[i:]
    return html

def delete_section_containing(html, needle, label):
    pos = html.find(needle)
    if pos < 0:
        print(f"WARN: {label} needle missing")
        return html
    start = html.rfind("<section", 0, pos)
    if start < 0:
        print(f"WARN: {label} section open missing")
        return html
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
                print(f"DEL {label} ({start}:{i})")
                return html[:start] + html[i:]
    return html

# --- HTML deletions ---
for eid in ["v2-hero", "v2-scenarios", "v2-product-preview", "v2-engines", "v2-pricing"]:
    text = delete_element_by_id(text, eid)

text = delete_section_containing(text, "Four gateways to cognitive velocity", "multi-gateway CTA")

# Constellation script: ONLY the IIFE that getElementByIds the canvas (not CSS)
m = re.search(
    r'<script>\s*\(function\s*\(\)\s*\{\s*const canvas = document\.getElementById\(\'v2-hero-constellation\'\);[\s\S]*?\}\)\(\);\s*</script>\s*',
    text,
)
if m:
    print(f"DEL constellation script ({m.start()}:{m.end()})")
    text = text[:m.start()] + text[m.end():]
else:
    print("WARN: constellation IIFE not found")

# Trust copy
new_trust = (
    "No deceptive dark patterns. Billing is explicit pay-per-use only "
    "($19.99 per PASS; $59.99 / 5 PASS pack). Zero hidden checkouts, absolute single-click cancellation anytime."
)
m = re.search(r'No deceptive dark patterns\.[\s\S]*?single-click cancellation anytime\.', text)
if m:
    text = text[:m.start()] + new_trust + text[m.end():]
    print("REWRITE trust")
else:
    print("WARN: trust missing")

# Nav
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
else:
    print("WARN: nav missing")

# Footer product lis
text2, nsub = re.subn(
    r'<li><a class="text-sm text-slate-500 transition-colors hover:text-primary" href="/app\?tab=(?:atmos|poju|match|syncro)[^"]*"[^>]*>[\s\S]*?</a></li>\s*',
    "",
    text,
)
if nsub:
    text = text2
    print(f"REWRITE footer removed {nsub}")
    m = re.search(r'(<h4[^>]*>\s*Engines\s*</h4>\s*<ul[^>]*>)', text, re.I)
    if m and "Open Eastern OS" not in text:
        text = text[:m.end()] + '\n<li><a class="text-sm text-slate-500 transition-colors hover:text-primary" href="/app" target="_top">Open Eastern OS</a></li>\n' + text[m.end():]
        print("INSERT footer Open Eastern OS")
    elif "Open Eastern OS" not in text:
        # fallback: first ul in footer after product removals
        m = re.search(r'(<footer[\s\S]{0,1500}?<ul[^>]*>)', text)
        if m:
            text = text[:m.end()] + '\n<li><a class="text-sm text-slate-500 transition-colors hover:text-primary" href="/app" target="_top">Open Eastern OS</a></li>\n' + text[m.end():]
            print("INSERT footer Open Eastern OS (fallback)")

# ENGINE_COPY
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

text2, n = re.subn(r'const PASS_UNIT = 9\.99;', 'const PASS_UNIT = 19.99;', text)
if n:
    text = text2
    print("PASS_UNIT -> 19.99")

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
    # Atmos-as-SKU in pricing features
    ('"subtitle": "1 Pass unlocks 1 complete project for any product site-wide (including 30-day full delivery for Atmos). Buy on-demand with zero binding, or choose a subscription pack for better value."',
     '"subtitle": "1 Pass unlocks 1 complete Eastern OS project (conversation → decision report → optional 30-day same-line reminders). Buy on-demand with zero binding."'),
    ('"1 Pass unlocks 1 full project delivery (including Atmos 30-day delivery)"',
     '"1 Pass unlocks 1 full Eastern OS project delivery"'),
    ('"1 个 Pass 即可解锁全站任意产品的 1 次完整项目（包括 Atmos 30天完整交付）。零绑定按需购买，或选择订阅套餐享受更高性价比。"',
     '"1 个 Pass 即可解锁 Eastern OS 1 次完整项目（对话 → 决策报告 → 可选 30 天同线提醒）。零绑定按需购买。"'),
    ('"1 个 Pass 解锁 1 个项目的完整交付（包括 Atmos 30天完整交付）"',
     '"1 个 Pass 解锁 1 次 Eastern OS 完整项目交付"'),
]
for old, new in replacements:
    c = text.count(old)
    if c:
        text = text.replace(old, new)
        print(f"REWRITE x{c}: {old[:42]}...")
    else:
        # try shorter unique substrings for Atmos lines that may wrap differently
        pass

# Broader Atmos product phrasing in PRICING_I18N
for pat, repl in [
    (r'including 30-day full delivery for Atmos', 'Eastern OS full delivery'),
    (r'including Atmos 30-day delivery', 'Eastern OS delivery'),
    (r'incluye 30 días de entrega para Atmos', 'entrega completa Eastern OS'),
    (r'incluye 30 días para Atmos', 'entrega Eastern OS'),
    (r'y compris 30 jours de livraison complète pour Atmos', 'livraison complète Eastern OS'),
    (r'y compris 30 jours pour Atmos', 'livraison Eastern OS'),
    (r'包括 Atmos 30天完整交付', 'Eastern OS 完整交付'),
    (r'（包括 Atmos 30天完整交付）', '（Eastern OS 完整交付）'),
    (r'for Atmos\)', 'for Eastern OS)'),
    (r'para Atmos\)', 'para Eastern OS)'),
    (r'pour Atmos\)', 'pour Eastern OS)'),
    (r'any product site-wide \(including[^)]+\)', 'Eastern OS'),
    (r'cualquier producto de la plataforma \(incluye[^)]+\)', 'Eastern OS'),
    (r"n'importe quel produit du site \(y compris[^)]+\)", 'Eastern OS'),
    (r'全站任意产品的 1 次完整项目（[^）]+）', 'Eastern OS 1 次完整项目'),
]:
    text2, n = re.subn(pat, repl, text)
    if n:
        text = text2
        print(f"SWEEP Atmos phrase x{n}: {pat[:40]}")

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

# Remove dead Atmos helper IIFEs (exact function names)
m = re.search(r'\(function syncAtmosCopyToSquare\(\) \{[\s\S]*?\}\)\(\);\s*', text)
if m:
    text = text[:m.start()] + text[m.end():]
    print("DEL syncAtmosCopyToSquare")
m = re.search(r'\(function loadAtmosCardSpline\(\) \{[\s\S]*?\}\)\(\);\s*', text)
if m:
    text = text[:m.start()] + text[m.end():]
    print("DEL loadAtmosCardSpline")

# Dead comments naming Begin Atmos / ATMOS
text2, n = re.subn(r'// Align ATMOS[^\n]*\n', '', text)
if n:
    text = text2
    print(f"DEL Atmos align comments {n}")
text2, n = re.subn(r'// ATMOS tall card[^\n]*\n', '', text)
if n:
    text = text2
    print(f"DEL Atmos spline comments {n}")

text = text.replace("Atmos-style CTAs", "primary CTAs")

# goLocalizedApp tab=atmos -> /app
text2, n = re.subn(r"goLocalizedApp\('/app\?tab=atmos'\)", "goLocalizedApp('/app')", text)
if n:
    text = text2
    print(f"REWRITE goLocalizedApp tab=atmos x{n}")

# Forbidden dollar amounts (allow only 19.99 and 59.99); keep 99.99% uptime
ALLOWED = {"$19.99", "$59.99"}
for m in list(re.finditer(r'\$\d+\.\d{2}', text)):
    price = m.group(0)
    if price in ALLOWED:
        continue
    # skip 99.99% uptime (no leading $)
    ctx = text[max(0, m.start()-30):m.end()+20]
    if "Uptime" in ctx:
        continue
    # Map packs: 59.90 -> 59.99, others -> rewrite contextually
    if price in ("$59.90",):
        repl = "$59.99"
    elif price in ("$29.90", "$5.98", "$4.27", "$4.99", "$9.99", "$29.99", "$3.99", "$2.99"):
        # leave a marker and fix line-wise below if needed — default 19.99
        repl = "$19.99"
    else:
        repl = "$19.99"
    text = text[:m.start()] + repl + text[m.end():]
    print(f"PRICE {price} -> {repl} ctx={ctx.strip()[:60]!r}")

# Integrity checks
assert text.count("<style") == orig.count("<style"), f"style count changed {orig.count('<style')}->{text.count('<style')}"
assert text.count("</style>") == orig.count("</style>")
assert 'id="eos-landing-v2-top"' in text
assert "Unstick it" in text
assert "破开它" in text
assert "$19.99" in text and "$59.99" in text
assert 'id="v2-lang-switcher"' in text
assert text.count("#eos-landing-v2-top") >= 40, f"eos CSS selectors too few: {text.count('#eos-landing-v2-top')}"
assert 'id="v2-faq"' in text
assert 'id="v2-built-heading"' in text or "data-built" in text
assert 'id="v2-engines"' not in text
assert 'id="v2-pricing"' not in text
assert 'id="v2-hero"' not in text

checks = ["$4.99", "$9.99", "$29.99", "$3.99", "$2.99", "$29.90", "$59.90", "$5.98", "$4.27",
          "Five Specialized", "Five Engines", "Monthly Pass", "all 5 products",
          "Five</span> Specialized", "Begin Atmos", "Go to Syncro", "Go to Glyph",
          "Decode Glyph", "tab=atmos", "tab=syncro", "tab=glyph", "tab=match"]
print("\n=== FINAL ===")
for c in checks:
    print(f"{c!r}: {text.count(c)}")
print("prices:", Counter(re.findall(r'\$\d+\.\d{2}', text)))
print("Atmos count:", text.count("Atmos"))
print("style ok, eos css", text.count("#eos-landing-v2-top"))

path.write_text(text, encoding="utf-8", newline="\n")
print(f"WROTE {len(orig)} -> {len(text)}")
