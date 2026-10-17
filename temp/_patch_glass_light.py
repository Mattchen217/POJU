from pathlib import Path
import re

path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
orig = t

# 1) Lighten glass strip
old_glass = """        .v2-glass-strip {
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(16, 20, 28, 0.72);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
        }"""
new_glass = """        .v2-glass-strip {
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(28, 32, 40, 0.48);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
        }"""
if old_glass not in t:
    # try flex match
    m = re.search(r"\.v2-glass-strip\s*\{[^}]+\}", t)
    if not m:
        raise SystemExit("glass-strip css missing")
    print("old css:", repr(m.group(0)[:200]))
    t = t[: m.start()] + """.v2-glass-strip {
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(28, 32, 40, 0.48);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
        }""" + t[m.end() :]
else:
    t = t.replace(old_glass, new_glass, 1)

# also lighten inner panel a bit so it doesn't fight
m = re.search(r"\.v2-glass-strip__panel\s*\{[^}]+\}", t)
if m:
    print("panel before:", m.group(0)[:180])
    t = t[: m.start()] + """.v2-glass-strip__panel {
            background: rgba(18, 22, 30, 0.28);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
        }""" + t[m.end() :]

# 2) Remove #v2-scenarios icon strip section entirely
m = re.search(
    r'\s*<section id="v2-scenarios"[\s\S]*?</section>\s*(?=<section id="eos-landing-scenarios")',
    t,
)
if not m:
    raise SystemExit("v2-scenarios section not found")
print("removing scenarios strip bytes", len(m.group(0)))
t = t[: m.start()] + "\n\n" + t[m.end() :]

# Keep JS that touches v2-scenarios resilient — check apply code
# If it getElementById and null-checks, fine; if not, leave ids elsewhere or soft-guard later

if t == orig:
    raise SystemExit("no changes")
path.write_text(t, encoding="utf-8")
print("local patch ok")
print("glass rgba(28,32,40,.48):", "rgba(28, 32, 40, 0.48)" in path.read_text(encoding="utf-8"))
print("v2-scenarios gone:", 'id="v2-scenarios"' not in path.read_text(encoding="utf-8"))
print("eos-landing-scenarios kept:", 'id="eos-landing-scenarios"' in path.read_text(encoding="utf-8"))
