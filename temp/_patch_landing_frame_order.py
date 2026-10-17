# -*- coding: utf-8 -*-
"""Reorder landing: Hero -> gray frame+carousel -> scenarios strip+bento."""
from pathlib import Path
import hashlib
import re

path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")
orig = text

# Snapshot engines section for untouched check
m_eng = re.search(r'(<section id="v2-engines"[\s\S]*?)(?=\n<section id="|\n<footer|\Z)', text)
engines_before = m_eng.group(1) if m_eng else None
engines_hash_before = hashlib.sha256(engines_before.encode()).hexdigest() if engines_before else None

# Extract #v2-scenarios section
m_sc = re.search(r'\n(<section id="v2-scenarios"[\s\S]*?</section>)\n', text)
if not m_sc:
    raise SystemExit("FAIL: #v2-scenarios not found")
scenarios_strip = m_sc.group(1)
text = text[:m_sc.start()] + "\n" + text[m_sc.end():]

# Soften strip for placement under frame / into scenarios zone:
# keep chrome, drop the light plate that used to interrupt starry hero->frame
scenarios_strip = scenarios_strip.replace(
    'class="py-12 border-y border-slate-200/10 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] animate-fade-in-up" style="animation-delay: 0.2s;"',
    'class="pt-10 pb-4 md:pt-12 md:pb-6 relative overflow-hidden animate-fade-in-up" style="animation-delay: 0.36s;"',
    1,
)

# Find product-preview closing and insert strip after it
m_pp = re.search(r'(<section id="v2-product-preview"[\s\S]*?</section>)\n', text)
if not m_pp:
    raise SystemExit("FAIL: #v2-product-preview not found")

# Ensure product-preview sits directly after hero constellation script (starry continuity)
# Optionally nudge product-preview animation delay earlier now that strip is gone above
pp_block = m_pp.group(1)
pp_block2 = pp_block.replace(
    'style="animation-delay: 0.35s;"',
    'style="animation-delay: 0.25s;"',
    1,
)
# Ensure section has no opaque plate (already none); add transparent hint via class if useful
if "bg-transparent" not in pp_block2.split(">", 1)[0]:
    pp_block2 = pp_block2.replace(
        'class="pt-16 pb-10 md:pt-20 md:pb-12 relative overflow-hidden animate-fade-in-up"',
        'class="pt-12 pb-10 md:pt-16 md:pb-12 relative overflow-hidden animate-fade-in-up bg-transparent"',
        1,
    )

text = text[:m_pp.start()] + pp_block2 + "\n\n" + scenarios_strip + "\n" + text[m_pp.end():]

# Dedupe scenario chrome: hide eos eyebrow visually when strip header is present
# Keep element for i18n + aria; use sr-only so EN/ZH JS still updates it
text2, n = re.subn(
    r'(<p id="eos-scenarios-eyebrow" class=")([^"]*)(")',
    r'\1\2 sr-only\3',
    text,
    count=1,
)
if n != 1:
    raise SystemExit(f"FAIL: eos-scenarios-eyebrow replace count={n}")
text = text2

# Tighten eos-landing-scenarios top padding now that strip sits above it
text2, n = re.subn(
    r'(<section id="eos-landing-scenarios" class=")pt-10 pb-20 md:pt-14',
    r'\1pt-4 pb-20 md:pt-6',
    text,
    count=1,
)
if n != 1:
    raise SystemExit(f"FAIL: eos-landing-scenarios pad replace count={n}")
text = text2

# Also shrink the now-empty eyebrow margin wrapper
text2, n = re.subn(
    r'(<div class="text-center mb-12 md:mb-16">\s*<p id="eos-scenarios-eyebrow"[^>]*>.*?</p>\s*</div>)',
    '<div class="sr-only"><p id="eos-scenarios-eyebrow" class="text-center text-base md:text-lg font-mono text-slate-400 uppercase tracking-widest sr-only">Built for high-stakes decisions</p></div>',
    text,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f"FAIL: eyebrow wrapper replace count={n}")
text = text2

# Verify order of section ids
order = []
for m in re.finditer(r'<section id="([^"]+)"', text):
    order.append(m.group(1))
need = ["v2-hero", "v2-product-preview", "v2-scenarios", "eos-landing-scenarios", "v2-engines"]
# v2-hero is <main> not section
mains = re.findall(r'<(?:main|section) id="([^"]+)"', text)
print("flow ids:", [i for i in mains if i in ("v2-hero", "v2-scenarios", "v2-product-preview", "eos-landing-scenarios", "v2-engines")])
idx = {k: mains.index(k) for k in ("v2-hero", "v2-product-preview", "v2-scenarios", "eos-landing-scenarios", "v2-engines")}
assert idx["v2-hero"] < idx["v2-product-preview"] < idx["v2-scenarios"] < idx["eos-landing-scenarios"] < idx["v2-engines"], idx

# Frame still has carousel only
pp = re.search(r'<section id="v2-product-preview"[\s\S]*?</section>', text).group(0)
assert 'id="v2-product-carousel"' in pp
assert "Sometimes reading" not in pp
assert "Begin Your Session" not in pp
assert "v2-scenarios" not in pp

# Engines untouched
m_eng2 = re.search(r'(<section id="v2-engines"[\s\S]*?)(?=\n<section id="|\n<footer|\Z)', text)
engines_after = m_eng2.group(1) if m_eng2 else None
assert engines_before == engines_after, "ENGINES CHANGED"
print("engines hash OK", engines_hash_before[:12])

# Bento markers preserved
eos = re.search(r'<section id="eos-landing-scenarios"[\s\S]*?</section>', text).group(0)
for marker in ["eos-scenario-forks-card", "eos-scenarios-right-col", "eos-scenarios-cta-bar", "eos-scenario-pass", "data-eos-scenario"]:
    assert marker in eos, marker
assert eos.count("eos-scenario-pass") == 5 or eos.count('1 PASS') == 5 or "1 PASS" in eos

# Carousel assets present
assert "/v2/v2.png" in pp and "/v2/V3.png" in pp and "/v2/v4.png" in pp

if text == orig:
    raise SystemExit("FAIL: no changes")

path.write_text(text, encoding="utf-8", newline="\n")
print("WROTE", path)
print("bytes", len(text.encode("utf-8")))
