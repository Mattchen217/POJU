from pathlib import Path
import re

path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
orig = t

# 1) glass strip: 20% cover, no blur
t = re.sub(
    r"\.v2-glass-strip\s*\{[^}]+\}",
    """.v2-glass-strip {
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(16, 20, 28, 0.20);
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
        }""",
    t,
    count=1,
)

# 2) panel: fully transparent (border only)
t = re.sub(
    r"\.v2-glass-strip__panel\s*\{[^}]+\}",
    """.v2-glass-strip__panel {
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.06);
            box-shadow: none;
        }""",
    t,
    count=1,
)

# 3) kill opaque #05070a on every carousel rule
count_bg = 0
def fix_carousel_bg(m):
    global count_bg
    block = m.group(0)
    if "background" in block:
        count_bg += 1
        block = re.sub(r"background:\s*#05070a\s*;", "background: transparent;", block)
    return block

t = re.sub(r"\.v2-glass-strip\s+\.v2-product-carousel\s*\{[^}]+\}", fix_carousel_bg, t)
t = re.sub(r"\.v2-product-carousel\s*\{[^}]+\}", fix_carousel_bg, t)

if t == orig:
    raise SystemExit("no changes")
path.write_text(t, encoding="utf-8")

# verify report
t2 = path.read_text(encoding="utf-8")
print("carousel #05070a left:", t2.count("background: #05070a"))
print("transparent carousel mentions:", len(re.findall(r"\.v2-product-carousel[^{]*\{[^}]*background:\s*transparent", t2)))
for pat in [r"\.v2-glass-strip\s*\{[^}]+\}", r"\.v2-glass-strip__panel\s*\{[^}]+\}", r"\.v2-glass-strip\s+\.v2-product-carousel\s*\{[^}]+\}"]:
    m = re.search(pat, t2)
    print(m.group(0) if m else "missing", "\n---")
print("fixed carousel rules:", count_bg)
