from pathlib import Path
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
old = 'id="eos-scenarios-h1" class="text-3xl md:text-5xl font-display font-bold mb-4 md:mb-5 leading-tight"'
new = 'id="eos-scenarios-h1" class="text-3xl md:text-5xl font-display font-bold mb-6 leading-tight"'
if old not in t:
    raise SystemExit("h2 class not found")
Path("public/v2-landing.html").write_text(t.replace(old, new, 1), encoding="utf-8")
print("mb aligned to engines")
