from pathlib import Path
import re

path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")
orig = text

# --- Replace product-preview opening section tag with full-bleed glass strip ---
# Find section #v2-product-preview ... through end of section (before #v2-scenarios)
m = re.search(
    r'<section id="v2-product-preview"[\s\S]*?</section>\s*(?=<section id="v2-scenarios")',
    text,
)
if not m:
    raise SystemExit("product-preview section not found")

# Extract carousel inner HTML (imgs + carousel div)
inner = m.group(0)
cm = re.search(
    r'(<div class="v2-product-carousel" id="v2-product-carousel"[\s\S]*?</div>\s*</div>\s*</div>)',
    inner,
)
# Simpler: grab from carousel to end of frame structure
cm2 = re.search(
    r'<div class="v2-product-carousel" id="v2-product-carousel" aria-live="polite">([\s\S]*?)</div>\s*</div>\s*</div>\s*</div>\s*</div>\s*</section>',
    inner,
)
if not cm2:
    # fallback extract imgs
    imgs = re.findall(r'<img[^>]+src="/v2/[^"]+"[^>]*/?>', inner)
    if not imgs:
        raise SystemExit("carousel imgs not found")
    carousel_imgs = "\n".join(imgs)
else:
    carousel_imgs = cm2.group(1).strip()

new_section = f'''<section id="v2-product-preview" class="v2-glass-strip relative overflow-hidden animate-fade-in-up py-10 md:py-14" style="animation-delay: 0.25s;" aria-label="Eastern OS product preview">
<div class="max-w-7xl mx-auto px-6">
<div class="v2-glass-strip__panel overflow-hidden rounded-2xl">
<div class="v2-product-carousel" id="v2-product-carousel" aria-live="polite">
{carousel_imgs}
</div>
</div>
</div>
</section>

'''

text = text[: m.start()] + new_section + text[m.end() :]

# Ensure scenarios icon strip is BELOW glass (already is) and does NOT need to be the glass;
# restore light separator only if missing — keep tip strip as-is without glass competing.

# CSS for glass strip — insert near .v2-product-frame or replace product-frame role
glass_css = """
        /* Full-bleed glass band behind carousel (original icon-strip plate, strengthened) */
        .v2-glass-strip {
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(16, 20, 28, 0.72);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
        }
        .v2-glass-strip__panel {
            background: rgba(10, 14, 22, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
        }
        .v2-glass-strip .v2-product-carousel {
            position: relative;
            width: 100%;
            min-height: clamp(20rem, 46vw, 32rem);
            overflow: hidden;
            border-radius: 0.75rem;
            background: #05070a;
        }
"""

# Insert CSS after .v2-product-frame block if present, else after first <style>
if ".v2-glass-strip {" not in text:
    fm = re.search(r"\.v2-product-frame\s*\{[^}]+\}", text, re.S)
    if fm:
        text = text[: fm.end()] + "\n" + glass_css + text[fm.end() :]
    else:
        sm = re.search(r"<style[^>]*>", text)
        if not sm:
            raise SystemExit("no style tag")
        text = text[: sm.end()] + "\n" + glass_css + text[sm.end() :]

if text == orig:
    raise SystemExit("no changes")
path.write_text(text, encoding="utf-8")
print("patched glass strip ok; carousel imgs bytes", len(carousel_imgs))
