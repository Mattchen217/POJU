from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# engines title gold pattern
for pat in [r'id="v2-engines"[\s\S]{0,2500}', r'v2-engines-title|metallic|gold-text|text-gradient|v2-gold']:
    pass
# find engines H1 markup
m = re.search(r'<section[^>]*id="v2-engines"[\s\S]*?</h[12]>', t)
if m:
    print("=== ENGINES H1 BLOCK ===")
    print(m.group(0)[-800:])
# find scenarios section H1
m2 = re.search(r'<section[^>]*id="eos-landing-scenarios"[\s\S]{0,2000}', t)
if m2:
    print("\n=== SCENARIOS HEAD ===")
    print(m2.group(0)[:1800])
# gold class definitions
for m in re.finditer(r'\.(?:v2-)?(?:gold|metallic|engine)[^{]*\{[^}]+\}', t, re.I):
    print("CSS:", m.group(0)[:300])
# span with gradient near engines
for m in re.finditer(r'<span[^>]*class="[^"]*(?:gold|gradient|metallic|shine)[^"]*"[^>]*>[^<]+</span>', t, re.I):
    print("SPAN:", m.group(0))
