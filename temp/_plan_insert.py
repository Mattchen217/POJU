from pathlib import Path
import re

cur = Path("public/v2-landing.html").read_text(encoding="utf-8", errors="replace")
css = Path("temp/_eos_css_extract.css").read_text(encoding="utf-8")
block_html = Path("temp/_eos_html_extract.html").read_text(encoding="utf-8")
js = Path("temp/_eos_js_extract.js").read_text(encoding="utf-8")

# CSS insertion anchor
anchor_css = """            .v2-price-card.is-featured:hover {
                transform: none;
            }
        }
"""
idx = cur.find(anchor_css)
print("CSS anchor", idx)
if idx < 0:
    # try looser
    for a in [".v2-price-card.is-featured:hover", "transform: none;"]:
        print(a, cur.find(a))

# HTML insertion
html_anchor = '<div id="v2-page-layer">\n'
idx_h = cur.find(html_anchor)
print("HTML anchor", idx_h)
print("next after:", repr(cur[idx_h+len(html_anchor):idx_h+len(html_anchor)+60]))

# JS: find applyTeamCopy / applyFaqCopy call site
for needle in ["applyTeamCopy(currentLocale)", "applyFaqCopy(currentLocale)", "applyEngineCopy(currentLocale)", "function escapeHtml"]:
    print(needle, cur.find(needle))

# Show context around locale apply calls
m = re.search(r"applyEngineCopy\(currentLocale\);.*?applyFaqCopy\(currentLocale\);", cur, re.S)
if m:
    print("apply block:")
    print(m.group(0))

# Show product section from extracted HTML
print("--- product section ---")
pi = block_html.find("productPrice")
print(block_html[pi-300:pi+400] if pi>=0 else "missing")

# Verify hero A1 in current
print("--- hero title snippet ---")
ht = cur.find('id="v2-hero-title"')
print(cur[ht:ht+400])
print("--- hero CTA ---")
hc = cur.find('id="v2-hero-cta-start"')
print(cur[hc:hc+350])
print("--- nav install ---")
ni = cur.find('id="v2-nav-install"')
print(cur[ni:ni+200])
