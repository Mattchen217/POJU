from pathlib import Path

path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")
orig = text

old_css = """        .v2-product-frame {
            position: relative;
            z-index: 1;
            border-color: rgba(212, 175, 55, 0.28) !important;
            box-shadow:
              0 0 0 1px rgba(212, 175, 55, 0.12),
              0 0 36px rgba(212, 175, 55, 0.28),
              0 0 72px rgba(212, 175, 55, 0.16),
              0 28px 56px rgba(0, 0, 0, 0.55);
        }"""

new_css = """        .v2-product-frame {
            position: relative;
            z-index: 1;
            /* Frosted gray glass cut against starfield (was opaque bg-slate-900) */
            background: rgba(16, 20, 28, 0.72);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-color: rgba(212, 175, 55, 0.28) !important;
            box-shadow:
              0 0 0 1px rgba(212, 175, 55, 0.12),
              0 0 36px rgba(212, 175, 55, 0.28),
              0 0 72px rgba(212, 175, 55, 0.16),
              0 28px 56px rgba(0, 0, 0, 0.55);
        }"""

if old_css not in text:
    raise SystemExit("FAIL: .v2-product-frame CSS block not found")
text = text.replace(old_css, new_css, 1)

old_html = 'class="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 v2-product-frame"'
new_html = 'class="group relative w-full overflow-hidden rounded-2xl border border-white/10 v2-product-frame"'
if old_html not in text:
    raise SystemExit("FAIL: product frame HTML class not found")
n = text.count(old_html)
if n != 1:
    raise SystemExit(f"FAIL: expected 1 frame html match, got {n}")
text = text.replace(old_html, new_html, 1)

pp_start = text.find('<section id="v2-product-preview"')
pp_end = text.find("</section>", pp_start) + len("</section>")
pp = text[pp_start:pp_end]
assert 'id="v2-product-carousel"' in pp
assert "Sometimes reading" not in pp
assert "Begin Your Session" not in pp
assert "bg-slate-900" not in pp  # opaque plate removed from frame
assert "rgba(16, 20, 28, 0.72)" in text
assert "v2-product-halo" in pp
assert "<section id=\"v2-engines\"" in text
assert "eos-scenario-forks-card" in text

# Ensure engines section byte-identical to HEAD for this edit scope
# (we only touch product-frame CSS + one class attr)

if text == orig:
    raise SystemExit("FAIL: no changes")

path.write_text(text, encoding="utf-8", newline="\n")
print("OK")
print("glass css present:", "rgba(16, 20, 28, 0.72)" in path.read_text(encoding="utf-8"))
print("frame html no bg-slate-900:", "bg-slate-900 v2-product-frame" not in path.read_text(encoding="utf-8"))
