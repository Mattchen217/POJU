from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
m = re.search(r"#v2-starfield-layer\s*\{[^}]+\}", t)
print("layer css:", m.group(0) if m else "NONE")
m2 = re.search(r"#v2-starfield-layer canvas\s*\{[^}]+\}", t)
print("canvas css:", m2.group(0) if m2 else "NONE")
i = t.find('id="v2-starfield-layer"')
print("html:", t[i-80:i+400])
# parent backgrounds that could cover starfield
for sel in ["v2-page-scroll", "v2-landing-root", "bg-[#05070a]", "background-dark"]:
    print(sel, t.count(sel))
# find wrapper around content
m = re.search(r'<div[^>]*(?:v2-page|landing)[^>]*>', t)
# main content wrapper class
for m in re.finditer(r'<main[^>]*>|<div id="v2-[^"]+"[^>]*class="[^"]*"', t):
    s=m.group(0)
    if "starfield" in s or "page" in s or "scroll" in s or "main" in s.lower():
        print("WR:", s[:200])
# dump first 80 lines of body structure after starfield
idx = t.find('id="v2-starfield-layer"')
Path("temp/_after_sf.txt").write_text(t[idx:idx+1500], encoding="utf-8")
