from pathlib import Path
import re
path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
print("product-screen in html class:", 'v2-product-screen' in t)
print("as class attr:", 'class="v2-product-screen' in t or "v2-product-screen " in t)
# still clear CSS so dead rules don't haunt
t2 = re.sub(
    r"(\.v2-product-screen\s*\{[^}]*?)background:\s*#05070a\s*;",
    r"\1background: transparent;",
    t,
    count=1,
)
path.write_text(t2, encoding="utf-8")
# list all carousel/glass computed-relevant rules once
t = path.read_text(encoding="utf-8")
for pat in [
    r"\.v2-glass-strip\s*\{[^}]+\}",
    r"\.v2-glass-strip__panel\s*\{[^}]+\}",
    r"\.v2-glass-strip\s+\.v2-product-carousel\s*\{[^}]+\}",
    r"\.v2-product-carousel\s*\{[^}]+\}",
    r"\.v2-product-screen\s*\{[^}]+\}",
]:
    ms = list(re.finditer(pat, t))
    print(f"\n## {pat} ({len(ms)})")
    for m in ms:
        print(m.group(0))
