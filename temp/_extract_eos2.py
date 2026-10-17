import subprocess
from pathlib import Path

html = subprocess.check_output(
    ["git", "show", "9912f5e8:public/v2-landing.html"],
    text=True,
    encoding="utf-8",
    errors="replace",
)
cur = Path("public/v2-landing.html").read_text(encoding="utf-8", errors="replace")

js_start = html.find("const EOS_LANDING_V2_COPY")
apply_start = html.find("function applyEosLandingV2Copy", js_start)
# end of applyEosLandingV2Copy function
i = apply_start
# find opening brace of function
brace = html.find("{", apply_start)
depth = 0
j = brace
while j < len(html):
    if html[j] == "{":
        depth += 1
    elif html[j] == "}":
        depth -= 1
        if depth == 0:
            apply_end = j + 1
            break
    j += 1
while apply_end < len(html) and html[apply_end] in "\r\n":
    apply_end += 1

js_block = html[js_start:apply_end]
Path("temp/_eos_js_extract.js").write_text(js_block, encoding="utf-8")
print("JS bytes", len(js_block))
print("JS langs:", [x for x in ["en:", "zh:", "es:", "fr:", "ja:", "ko:"] if x in js_block[:500] or js_block.count(x)])
# count locale keys
import re
locales = re.findall(r"^\s{2}(\w{2}):\s*\{", js_block, re.M)
print("locales", locales)
print("productPrice in js", "productPrice" in js_block)
print("19.99 in js", "19.99" in js_block)
print("59.99 in js", "59.99" in js_block)

# call sites in baseline
for m in re.finditer(r"applyEosLandingV2Copy\([^)]*\)", html):
    print("call:", m.group(0), "at", m.start())
    print(html[m.start()-120:m.start()+80])

print("--- current has EOS_LANDING?", "EOS_LANDING_V2_COPY" in cur)
print("--- current has eos-landing-v2-top?", "eos-landing-v2-top" in cur)
print("--- current has applyEos?", "applyEosLandingV2Copy" in cur)
print("--- current has escapeHtml?", "function escapeHtml" in cur)
print("--- current has v2-nav-install?", "v2-nav-install" in cur)
print("--- current has v2-hero-cta-start?", "v2-hero-cta-start" in cur)

# Where to insert CSS in current: look for style end or similar insertion point from baseline context
# In baseline, CSS sits just before </style> or before other rules?
css_start = html.find("        /* Eastern OS landing v2 top block")
print("Baseline chars before CSS comment (prev 200):")
print(repr(html[css_start-200:css_start]))

# HTML insertion: in baseline it's inside v2-page-layer before nav
print("Baseline before HTML block:")
print(repr(html[html.find('<!-- EOS landing v2 top')-150:html.find('<!-- EOS landing v2 top')]))

# Current page structure around v2-page-layer / nav
idx = cur.find('id="v2-page-layer"')
print("current v2-page-layer:", idx)
print(repr(cur[idx:idx+250]))
nav = cur.find('<nav class="fixed top-0')
print("current nav:", nav)
print(repr(cur[nav-100:nav+80]))
