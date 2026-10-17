from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# hero padding / ctas margin
for pat in [
    r'id="v2-hero"[^>]*>',
    r'\.v2-hero-ctas[^{]*\{[^}]+\}',
    r'#v2-hero[^{]*\{[^}]+\}',
    r'id="v2-product-preview"[^>]*>',
    r'id="eos-landing-scenarios"[^>]*>',
    r'id="v2-engines"[^>]*>',
    r'id="v2-pricing"[^>]*>',
    r'id="v2-methodology"[^>]*>',
    r'id="v2-faq"[^>]*>',
    r'id="v2-team"[^>]*>',
]:
    m = re.search(pat, t)
    print(pat[:40], "=>", (m.group(0)[:160] if m else "NONE"))
# list all major section opening tags with padding classes
for m in re.finditer(r'<section[^>]*id="([^"]+)"[^>]*>', t):
    print(m.group(1), ":", m.group(0)[:200])
