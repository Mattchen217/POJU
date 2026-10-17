from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
out = []
# hero foreground / title / sub css
for pat in [
    r"\.v2-hero-foreground[^{]*\{[^}]+\}",
    r"\.v2-hero-title-type[^{]*\{[^}]+\}",
    r"\.v2-hero-sub-type[^{]*\{[^}]+\}",
    r"\.v2-hero-ctas[^{]*\{[^}]+\}",
    r"#v2-hero-title[^{]*\{[^}]+\}",
    r"#v2-hero-subtitle[^{]*\{[^}]+\}",
    r"#v2-hero[^{]*\{[^}]+\}",
]:
    for m in re.finditer(pat, t):
        out.append(m.group(0))
        out.append("---")
# hero markup opening
i = t.find('id="v2-hero"')
out.append(t[i:i+900])
# glass strip max-w
i = t.find('id="v2-product-preview"')
out.append("\nGLASS:\n"+t[i:i+350])
Path("temp/_hero_width.txt").write_text("\n".join(out), encoding="utf-8")
print("dumped")
