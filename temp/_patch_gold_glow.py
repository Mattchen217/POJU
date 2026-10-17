from pathlib import Path
import re

path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
orig = t

# existing product-frame gold glow
m = re.search(r"\.v2-product-frame\s*\{[^}]+\}", t, re.S)
print("frame css:", m.group(0) if m else "MISSING")

# apply gold glow to carousel wrapper panel inside glass (not whole strip)
# Prefer .v2-glass-strip__panel as the gold frame around carousel
panel_css = """.v2-glass-strip__panel {
            background: transparent;
            border: 1px solid rgba(212, 175, 55, 0.28);
            border-radius: 1rem;
            box-shadow:
              0 0 0 1px rgba(212, 175, 55, 0.12),
              0 0 36px rgba(212, 175, 55, 0.28),
              0 0 72px rgba(212, 175, 55, 0.16),
              0 28px 56px rgba(0, 0, 0, 0.55);
        }"""

m2 = re.search(r"\.v2-glass-strip__panel\s*\{[^}]+\}", t)
if not m2:
    raise SystemExit("panel css missing")
print("panel before:", m2.group(0))
t = t[: m2.start()] + panel_css + t[m2.end() :]

# ensure carousel corners sit inside glow
# optional: add overflow hidden already on panel class in HTML

if t == orig:
    raise SystemExit("no change")
path.write_text(t, encoding="utf-8")
print("gold glow on panel ok; unpushed")
