from pathlib import Path
path = Path(r"D:/POJU/pojulife/public/v2-landing.html")
text = path.read_text(encoding="utf-8")

old = '''<div class="mt-16 md:mt-20 pt-12 md:pt-16 border-t border-slate-200/50 dark:border-white/10"><div class="text-center mb-10">
<h3 id="eos-how-get-list-h3" class="text-xl md:text-2xl font-display font-bold"><span class="gold-gradient glow-effect inline-block" data-howget="listH3">What you walk away with</span></h3></div>
<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
<div class="p-5 md:p-6 border border-slate-200 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/[0.01] text-center"><span class="inline-flex items-center justify-center w-8 h-8 mb-3 text-primary text-lg" aria-hidden="true">&#10003;</span><p class="text-sm md:text-base text-slate-700 dark:text-slate-200 leading-relaxed" data-howget="item1"><strong>Main path + backup</strong></p></div>
<div class="p-5 md:p-6 border border-slate-200 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/[0.01] text-center"><span class="inline-flex items-center justify-center w-8 h-8 mb-3 text-primary text-lg" aria-hidden="true">&#10003;</span><p class="text-sm md:text-base text-slate-700 dark:text-slate-200 leading-relaxed" data-howget="item2"><strong>Decision report</strong> you can reopen</p></div>
<div class="p-5 md:p-6 border border-slate-200 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/[0.01] text-center"><span class="inline-flex items-center justify-center w-8 h-8 mb-3 text-primary text-lg" aria-hidden="true">&#10003;</span><p class="text-sm md:text-base text-slate-700 dark:text-slate-200 leading-relaxed" data-howget="item3"><strong>30-day daily same-line reminders</strong> provided together</p></div>
</div>
<p id="eos-how-get-close" class="text-center text-sm text-slate-500 dark:text-slate-400 mt-6" data-howget="close">We advise. You decide.</p>
<div class="mt-10 flex justify-center"><a href="/app" target="_top" id="eos-how-get-cta" class="v2-hero-cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 font-bold tracking-wide shadow-xl shadow-primary/25"><span data-howget="cta">Start now</span><span class="material-icons-outlined text-base" aria-hidden="true">arrow_forward</span></a></div></div>'''

new = '''<div class="mt-12 md:mt-16 flex justify-center"><a href="/app" target="_top" id="eos-how-get-cta" class="v2-hero-cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 font-bold tracking-wide shadow-xl shadow-primary/25"><span data-howget="cta">Start now</span><span class="material-icons-outlined text-base" aria-hidden="true">arrow_forward</span></a></div>'''

if old not in text:
    raise SystemExit("exact strip block not found")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")

# verify
sec = text[text.find('id="eos-landing-how-get"'):text.find('id="v2-team-section"')]
assert "listH3" not in sec
assert "eos-how-get-close" not in sec
assert "eos-how-get-cta" in sec
assert "data-howget-stage=\"5\"" in sec
print("removed get strip; CTA kept")
