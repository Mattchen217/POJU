# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")

css_anchor = "        #v2-faq {\n            padding-bottom: var(--eos-section-gap) !important;\n        }"
css_block = """        #v2-faq {
            padding-bottom: var(--eos-section-gap) !important;
        }

        /* Methodology cards: type hierarchy + mid/right art fill (local Design preview) */
        #v2-methodology .v2-method-card-title,
        #v2-methodology h4[data-built] {
            font-size: clamp(1.125rem, 1.05rem + 0.35vw, 1.25rem);
            font-weight: 600;
            line-height: 1.3;
            margin-bottom: 0.75rem;
        }
        #v2-methodology .v2-method-card-body,
        #v2-methodology p[data-built="easternBody"],
        #v2-methodology p[data-built="modernBody"],
        #v2-methodology p[data-built="aiBody"] {
            font-size: clamp(0.9375rem, 0.9rem + 0.25vw, 1rem);
            line-height: 1.65;
        }
        #v2-methodology .v2-method-mid-grid {
            align-items: stretch;
        }
        #v2-methodology .v2-method-mid-grid > .v2-method-card {
            min-height: clamp(17rem, 30vw, 23rem);
        }
        #v2-methodology .v2-method-card-art {
            flex: 1 1 48%;
            min-height: 9.5rem;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-top: 0.5rem;
        }
        #v2-methodology .v2-method-card-art img {
            width: 100%;
            height: 100%;
            max-height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }
        #v2-methodology .v2-method-left-art {
            flex: 1 1 48%;
            min-height: 0;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-top: 0.5rem;
        }
        #v2-methodology .v2-method-left-art img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }"""

if "Methodology cards: type hierarchy" not in text:
    if css_anchor not in text:
        raise SystemExit("CSS anchor missing")
    text = text.replace(css_anchor, css_block, 1)
else:
    print("CSS already present, skipping CSS insert")

old_left = '''<div class="v2-glass-card relative flex min-h-0 flex-1 flex-col bg-slate-900/60 p-6 rounded-2xl backdrop-blur-md border border-white/5 overflow-hidden md:basis-0">
<h4 class="text-lg font-bold mb-3 text-primary shrink-0" data-built="easternTitle">Eastern Frameworks</h4>
<div class="flex min-h-0 flex-1 flex-col">
<p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed basis-1/2 min-h-0 overflow-y-auto" data-built="easternBody">Three thousand years of Eastern decision traditions—time cycles, systemic balance, how people actually choose under pressure. Not mysticism for show: a <span class="gold-gradient">structural</span> lens on forks, timing, and consequence.</p>
<div class="basis-1/2 flex min-h-0 items-center justify-center pt-2">
<img alt="" aria-hidden="true" class="pointer-events-none h-full w-full object-contain object-center" src="/v2/daz.png"/>
</div>
</div>
</div>'''

new_left = '''<div class="v2-glass-card v2-method-card relative flex min-h-0 flex-1 flex-col bg-slate-900/60 p-6 rounded-2xl backdrop-blur-md border border-white/5 overflow-hidden md:basis-0">
<h4 class="v2-method-card-title text-primary shrink-0" data-built="easternTitle">Eastern Frameworks</h4>
<div class="flex min-h-0 flex-1 flex-col gap-2">
<p class="v2-method-card-body text-slate-600 dark:text-slate-300 shrink-0" data-built="easternBody">Three thousand years of Eastern decision traditions—time cycles, systemic balance, how people actually choose under pressure. Not mysticism for show: a <span class="gold-gradient">structural</span> lens on forks, timing, and consequence.</p>
<div class="v2-method-left-art">
<img alt="" aria-hidden="true" class="pointer-events-none" src="/v2/daz.png"/>
</div>
</div>
</div>'''

old_mid = '''<div class="grid grid-cols-1 gap-8 sm:grid-cols-2">
<div class="v2-glass-card relative aspect-square bg-slate-900/60 p-6 pb-16 rounded-2xl backdrop-blur-md border border-white/5 overflow-hidden">
<h4 class="text-lg font-bold mb-4 text-primary" data-built="modernTitle">Modern Research</h4>
<p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed" data-built="modernBody">Cognitive science, decision psychology, and chronobiology as a check—not a costume. We keep what holds as pattern and drop what fails as empty ritual.</p>
<img alt="" aria-hidden="true" class="pointer-events-none absolute bottom-3 right-3 h-20 w-20 object-contain" src="/v2/yhy.png"/>
</div>
<div class="v2-glass-card relative aspect-square bg-slate-900/60 p-6 pb-16 rounded-2xl backdrop-blur-md border border-white/5 overflow-hidden">
<h4 class="text-lg font-bold mb-4 text-primary" data-built="aiTitle">Algorithmic Translation</h4>
<p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed" data-built="aiBody">Structural signals from those models are cross-read with <em>your</em> case through a language engine—into paths, tradeoffs, and a report shaped around <em>this</em> decision—not a one-size fill-in form.</p>
<img alt="" aria-hidden="true" class="pointer-events-none absolute bottom-3 right-3 h-20 w-20 object-contain" src="/v2/shu.png"/>
</div>
</div>'''

new_mid = '''<div class="v2-method-mid-grid grid grid-cols-1 gap-8 sm:grid-cols-2">
<div class="v2-glass-card v2-method-card relative flex min-h-0 flex-col bg-slate-900/60 p-6 rounded-2xl backdrop-blur-md border border-white/5 overflow-hidden">
<h4 class="v2-method-card-title text-primary shrink-0" data-built="modernTitle">Modern Research</h4>
<p class="v2-method-card-body text-slate-600 dark:text-slate-300 shrink-0" data-built="modernBody">Cognitive science, decision psychology, and chronobiology as a check—not a costume. We keep what holds as pattern and drop what fails as empty ritual.</p>
<div class="v2-method-card-art">
<img alt="" aria-hidden="true" class="pointer-events-none" src="/v2/yhy.png"/>
</div>
</div>
<div class="v2-glass-card v2-method-card relative flex min-h-0 flex-col bg-slate-900/60 p-6 rounded-2xl backdrop-blur-md border border-white/5 overflow-hidden">
<h4 class="v2-method-card-title text-primary shrink-0" data-built="aiTitle">Algorithmic Translation</h4>
<p class="v2-method-card-body text-slate-600 dark:text-slate-300 shrink-0" data-built="aiBody">Structural signals from those models are cross-read with <em>your</em> case through a language engine—into paths, tradeoffs, and a report shaped around <em>this</em> decision—not a one-size fill-in form.</p>
<div class="v2-method-card-art">
<img alt="" aria-hidden="true" class="pointer-events-none" src="/v2/shu.png"/>
</div>
</div>
</div>'''

if old_left not in text:
    raise SystemExit("left card block not found exact")
if old_mid not in text:
    raise SystemExit("mid/right card block not found exact")

text = text.replace(old_left, new_left, 1)
text = text.replace(old_mid, new_mid, 1)

path.write_text(text, encoding="utf-8")
print("patched ok")
print("has CSS:", "Methodology cards: type hierarchy" in text)
print("has mid grid:", "v2-method-mid-grid" in text)
print("no aspect-square in method:", "aspect-square bg-slate-900/60 p-6 pb-16" not in text)
print("no h-20 corner art:", 'bottom-3 right-3 h-20 w-20' not in text.split('id="v2-methodology"')[1].split('id="v2-team-section"')[0])
