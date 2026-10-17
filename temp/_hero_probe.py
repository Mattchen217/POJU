from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# locate hero HTML + i18n keys
out = []
i = t.find('id="v2-hero"')
out.append(t[i:i+2200])
out.append("\n---I18N---\n")
for m in re.finditer(r"hero:\s*\{[\s\S]{0,1200}", t):
    out.append(m.group(0)[:1200])
    out.append("\n----\n")
Path("temp/_hero_v41_probe.txt").write_text("\n".join(out), encoding="utf-8")
print("wrote probe", i)
