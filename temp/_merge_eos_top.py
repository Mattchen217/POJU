from pathlib import Path

cur_path = Path("public/v2-landing.html")
# Re-read fresh from git in case partial write? previous failed so should be clean
cur = cur_path.read_text(encoding="utf-8", errors="replace")
assert "eos-landing-v2-top" not in cur, "already patched?"

css = Path("temp/_eos_css_extract.css").read_text(encoding="utf-8")
block_html = Path("temp/_eos_html_extract.html").read_text(encoding="utf-8")
js = Path("temp/_eos_js_extract.js").read_text(encoding="utf-8")

# 1) CSS: insert before "        #v2-hero {" that follows the reduced-motion price-card block
marker = """            .v2-price-card.is-featured:hover {
                transform: none;
            }
        }
        #v2-hero {"""
idx = cur.find(marker)
if idx < 0:
    raise SystemExit("CSS marker not found")
# insert css between "}\n" and "        #v2-hero"
split_at = idx + len("""            .v2-price-card.is-featured:hover {
                transform: none;
            }
        }
""")
# css already has trailing newline; ensure blank line before #v2-hero
cur = cur[:split_at] + "\n" + css + cur[split_at:]

# 2) HTML
html_anchor = '<div id="v2-page-layer">\n'
idx_h = cur.find(html_anchor)
if idx_h < 0:
    raise SystemExit("HTML anchor not found")
insert_h = idx_h + len(html_anchor)
if not block_html.endswith("\n"):
    block_html += "\n"
cur = cur[:insert_h] + block_html + cur[insert_h:]

# 3) JS before escapeHtml
escape_marker = "            function escapeHtml(value) {"
idx_e = cur.find(escape_marker)
if idx_e < 0:
    raise SystemExit("escapeHtml not found")
js_block = js if js.endswith("\n") else js + "\n"
cur = cur[:idx_e] + js_block + "\n" + cur[idx_e:]

# 4) Call site
call_anchor = "            applyFaqCopy(currentLocale);\n"
idx_c = cur.find(call_anchor)
if idx_c < 0:
    raise SystemExit("applyFaqCopy call not found")
insert_c = idx_c + len(call_anchor)
cur = cur[:insert_c] + "            applyEosLandingV2Copy(currentLocale);\n" + cur[insert_c:]

cur_path.write_text(cur, encoding="utf-8", newline="\n")
print("Wrote bytes", len(cur))

checks = {
    "eos-landing-v2-top count": cur.count("eos-landing-v2-top"),
    "$19.99": cur.count("$19.99"),
    "$59.99": cur.count("$59.99"),
    "id=eos-landing-v2-top": 'id="eos-landing-v2-top"' in cur,
    "v2-nav-install": 'id="v2-nav-install"' in cur,
    "v2-hero-cta-start": 'id="v2-hero-cta-start"' in cur,
    "Start now": "Start now" in cur,
    "EOS_LANDING_V2_COPY": "EOS_LANDING_V2_COPY" in cur,
    "apply call": cur.count("applyEosLandingV2Copy(currentLocale)"),
    "A1 unstick": "unstick it" in cur,
    "Install app": "Install app" in cur,
}
for k, v in checks.items():
    print(f"  {k}: {v}")

hero_start = cur.find('id="v2-hero"')
hero_end = cur.find("</main>", hero_start)
hero = cur[hero_start:hero_end]
print("hero primary CTAs:", hero.count("v2-hero-cta-primary"))
print("hero secondary CTAs:", hero.count("v2-hero-cta-secondary"))
print("hero desktop CTA:", "v2-hero-cta-desktop" in hero)
print("only one <a in hero ctas area:", hero.count("<a "))
