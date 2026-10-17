from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# page root bg
for m in re.finditer(r"\.(?:v2-landing|v2-root|v2-page|dark)[^{]*\{[^}]{0,500}\}", t):
    s=m.group(0)
    if "background" in s or "#050" in s:
        print(s[:400]); print("---")
# html/body dark class bg from tailwind?
for m in re.finditer(r'class="[^"]*bg-slate-950[^"]*"', t):
    print("el", m.group(0)[:120])
for m in re.finditer(r'class="[^"]*#05070a[^"]*"', t):
    print("hex class", m.group(0)[:80])
# find #05070a usages
for m in re.finditer(r".{0,60}#05070a.{0,60}", t):
    print("050:", m.group(0).replace("\n"," ")[:140])
# constellation resize - does it grow beyond hero?
i = t.find("v2-hero-constellation")
# JS that sizes canvas
m = re.search(r"function resize[\s\S]{0,400}|getElementById\('v2-hero'\)[\s\S]{0,600}", t)
# dump constellation IIFE start
m = re.search(r"\(function \(\) \{\s*const canvas = document.getElementById\('v2-hero-constellation'\)[\s\S]{0,800}", t)
Path("temp/_constellation.txt").write_text(m.group(0) if m else "no", encoding="utf-8")
print("constellation snippet written")
# look for starfield extension comment from 3abbb85a era
for m in re.finditer(r".{0,40}starfield.{0,80}", t, re.I):
    print("sf:", m.group(0).replace("\n"," ")[:120])
