from pathlib import Path
path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")
orig = text

# 1) Hero section padding
old_hero = '<main id="v2-hero" class="relative pt-28 pb-10 md:pt-32 md:pb-12 overflow-hidden animate-fade-in-up">'
new_hero = '<main id="v2-hero" class="relative pt-20 pb-12 md:pt-24 md:pb-14 lg:pt-28 lg:pb-16 overflow-hidden animate-fade-in-up">'
if old_hero not in text:
    raise SystemExit("hero tag not found")
text = text.replace(old_hero, new_hero, 1)

# 2) H1 classes -> rely on CSS clamp; keep display/weight
old_h1 = '<h1 id="v2-hero-title" class="font-display text-4xl font-bold leading-[1.18] tracking-tight sm:text-5xl md:text-6xl lg:text-[3.75rem]">'
new_h1 = '<h1 id="v2-hero-title" class="font-display font-bold tracking-tight v2-hero-title-type">'
if old_h1 not in text:
    raise SystemExit("h1 tag not found")
text = text.replace(old_h1, new_h1, 1)

# 3) Subtitle classes
old_sub = '<p id="v2-hero-subtitle" class="mt-7 text-base leading-relaxed text-slate-400 sm:text-lg md:text-xl">'
new_sub = '<p id="v2-hero-subtitle" class="mt-7 leading-relaxed text-slate-400 v2-hero-sub-type">'
if old_sub not in text:
    raise SystemExit("subtitle not found")
text = text.replace(old_sub, new_sub, 1)

# 4) CTA letter-spacing on primary class in HTML
old_cta = 'class="v2-hero-cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-12 py-3 font-bold shadow-xl shadow-primary/25"'
new_cta = 'class="v2-hero-cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-12 py-3 font-bold tracking-wide shadow-xl shadow-primary/25"'
if old_cta not in text:
    raise SystemExit("cta class not found")
text = text.replace(old_cta, new_cta, 1)

# 5) Product preview spacing (CTA to frame)
old_prod = '<section id="v2-product-preview" class="pt-12 pb-10 md:pt-16 md:pb-12 relative overflow-hidden animate-fade-in-up bg-transparent"'
new_prod = '<section id="v2-product-preview" class="pt-14 pb-10 md:pt-20 md:pb-14 relative overflow-hidden animate-fade-in-up bg-transparent"'
if old_prod not in text:
    raise SystemExit("product preview not found")
text = text.replace(old_prod, new_prod, 1)

# 6) CSS updates for title/subtitle/ctas/frame height
css_old = """#v2-hero-title {
            max-width: 960px;
            text-wrap: balance;
            line-height: 1.18;
        }
#v2-hero-subtitle {
            max-width: 650px;
            text-wrap: pretty;
            margin-top: 1.75rem; /* 28px — breathing room after taller title */
        }"""
# tolerate encoding of emdash comment variants
import re
pat_title = re.compile(r"#v2-hero-title\s*\{[^}]+\}", re.S)
pat_sub = re.compile(r"#v2-hero-subtitle\s*\{[^}]+\}", re.S)
pat_ctas = re.compile(r"\.v2-hero-ctas\s*\{[^}]+\}", re.S)
pat_screen = re.compile(r"\.v2-product-screen\s*\{[^}]+\}", re.S)
pat_carousel = re.compile(r"\.v2-product-carousel\s*\{[^}]+\}", re.S)

def sub1(pat, repl):
    global text
    m = pat.search(text)
    if not m:
        raise SystemExit(f"missing css {pat.pattern}")
    text = text[:m.start()] + repl + text[m.end():]

sub1(pat_title, """#v2-hero-title {
            max-width: none;
            width: 100%;
            text-wrap: balance;
            line-height: 1.18;
        }
        .v2-hero-title-type {
            font-size: clamp(2.25rem, 4vw, 3.25rem);
        }""")
sub1(pat_sub, """#v2-hero-subtitle {
            max-width: none;
            width: 100%;
            text-wrap: pretty;
            margin-top: 1.75rem;
        }
        .v2-hero-sub-type {
            font-size: clamp(1.05rem, 1.15vw, 1.15rem);
        }""")
sub1(pat_ctas, """.v2-hero-ctas {
            width: 100%;
            max-width: none;
        }""")
sub1(pat_screen, """.v2-product-screen {
            position: relative;
            background: #05070a;
            padding: 3px;
            min-height: clamp(22rem, 48vw, 34rem);
        }""")
sub1(pat_carousel, """.v2-product-carousel {
            position: relative;
            width: 100%;
            min-height: clamp(20rem, 46vw, 32rem);
            overflow: hidden;
            border-radius: 0.5rem;
            background: #05070a;
        }""")

# ensure active carousel img fills taller stage
# add after carousel img rule once
img_rule = """.v2-product-carousel img.is-active {
            opacity: 1;
            position: relative;
            z-index: 1;
            width: 100%;
            min-height: inherit;
            object-fit: cover;
            object-position: top center;
        }"""
# replace first is-active block only if not already patched
old_active = """.v2-product-carousel img.is-active {
            opacity: 1;
            position: relative;
            z-index: 1;
        }"""
if "min-height: inherit" not in text:
    if old_active not in text:
        raise SystemExit("is-active rule not found")
    text = text.replace(old_active, img_rule, 1)

if text == orig:
    raise SystemExit("no changes")
path.write_text(text, encoding="utf-8")
print("patched ok")
