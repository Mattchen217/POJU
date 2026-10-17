from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# find all carousel-related CSS
for m in re.finditer(r"[^\n]*v2-product-carousel[^\n]*", t):
    print(m.group(0)[:200])
print("---")
# block
m = re.search(r"\.v2-product-carousel\s*\{[^}]+\}", t, re.S)
print(m.group(0) if m else "no block")
m2 = re.search(r"\.v2-product-carousel img[^}]+\}", t, re.S)
print(m2.group(0) if m2 else "no img")
m3 = re.search(r"\.v2-product-carousel img\.is-active[^}]+\}", t, re.S)
print(m3.group(0) if m3 else "no active")
