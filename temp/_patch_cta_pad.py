from pathlib import Path
p = Path("public/v2-landing.html")
text = p.read_text(encoding="utf-8")
old_btn = 'id="v2-hero-cta-start" class="v2-hero-cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 font-bold shadow-xl shadow-primary/25"'
new_btn = 'id="v2-hero-cta-start" class="v2-hero-cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-12 py-3 font-bold shadow-xl shadow-primary/25"'
if old_btn not in text:
    raise SystemExit("button class string not found")
text = text.replace(old_btn, new_btn, 1)
old_css = """        .v2-hero-cta-primary {
            flex: 0 0 auto;
            width: auto;
            min-width: 0;
            padding-left: 2rem;
            padding-right: 2rem;"""
new_css = """        .v2-hero-cta-primary {
            flex: 0 0 auto;
            width: auto;
            min-width: 0;
            padding-left: 3rem;
            padding-right: 3rem;"""
if old_css not in text:
    raise SystemExit("primary CSS block not found")
text = text.replace(old_css, new_css, 1)
p.write_text(text, encoding="utf-8")
print("OK")
idx = text.find('id="v2-hero-cta-start"')
print(text[idx:idx+200])
print("---CSS---")
cidx = text.find(".v2-hero-cta-primary {")
print(text[cidx:cidx+180])
