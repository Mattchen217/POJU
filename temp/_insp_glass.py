from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
out = []
for pat in [
    r"\.v2-glass-strip[^{]*\{[^}]+\}",
    r"\.v2-glass-strip__panel[^{]*\{[^}]+\}",
    r"\.v2-glass-strip \.v2-product-carousel[^{]*\{[^}]+\}",
    r"\.v2-product-carousel[^{]*\{[^}]+\}",
    r"\.v2-product-carousel img[^{]*\{[^}]+\}",
    r"\.v2-product-frame[^{]*\{[^}]+\}",
    r"#v2-product-preview[^{]*\{[^}]+\}",
]:
    for m in re.finditer(pat, t, re.S):
        out.append(m.group(0))
        out.append("---")
# any background near product/carousel/glass
for m in re.finditer(r"[^\n]*(?:v2-product|v2-glass|carousel)[^\n]*", t):
    line = m.group(0)
    if "background" in line or "#05070a" in line or "#000" in line:
        out.append("LINE: " + line.strip()[:200])
Path("temp/_glass_layers.txt").write_text("\n".join(out), encoding="utf-8")
print("\n".join(out[:80]))
