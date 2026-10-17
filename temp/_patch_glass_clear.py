from pathlib import Path
import re

path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
orig = t

m = re.search(r"\.v2-glass-strip\s*\{[^}]+\}", t)
if not m:
    raise SystemExit("glass-strip css missing")
print("before:", m.group(0))
t = t[: m.start()] + """.v2-glass-strip {
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(16, 20, 28, 0.26);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }""" + t[m.end() :]

# lighten panel further so it doesn't read as opaque gray card
m = re.search(r"\.v2-glass-strip__panel\s*\{[^}]+\}", t)
if m:
    print("panel before:", m.group(0))
    t = t[: m.start()] + """.v2-glass-strip__panel {
            background: rgba(16, 20, 28, 0.18);
            border: 1px solid rgba(255, 255, 255, 0.07);
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18);
        }""" + t[m.end() :]

if t == orig:
    raise SystemExit("no change")
path.write_text(t, encoding="utf-8")
print("ok transparent", "rgba(16, 20, 28, 0.26)" in path.read_text(encoding="utf-8"))
