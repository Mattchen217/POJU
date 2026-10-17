# -*- coding: utf-8 -*-
from pathlib import Path
import re

path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")

assert "eos-landing-scenarios" not in text, "section already present"
assert 'id="v2-hero-cta-start"' in text

# --- HTML section (icons reused from #v2-scenarios strip) ---
section = r'''
<section id="eos-landing-scenarios" class="pt-10 pb-20 md:pt-14 relative overflow-hidden animate-fade-in-up" style="animation-delay: 0.38s;" aria-labelledby="eos-scenarios-eyebrow">
<div class="max-w-7xl mx-auto px-6">
<div class="text-center mb-12 md:mb-16">
<p id="eos-scenarios-eyebrow" class="text-center text-base md:text-lg font-mono text-slate-400 uppercase tracking-widest">Built for high-stakes decisions</p>
</div>
<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6 md:gap-8" id="eos-scenarios-grid">
<a href="/app?tab=atmos" target="_top" class="p-8 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-white/5 v2-glass-card transition-all duration-300 group flex flex-col h-full" data-eos-scenario="crossroads">
<div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
<svg class="w-7 h-7 text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v7l5 3 5-3V4"/><path d="M12 14v6"/><circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none"/></svg>
</div>
<h3 class="text-xl font-bold" data-eos-scenario-title>Major crossroads</h3>
<p class="text-slate-600 dark:text-slate-400 mt-3 mb-6 flex-1 text-sm md:text-base leading-relaxed" data-eos-scenario-desc>When more than one path looks right—and none feels safe—lock what “good” means, then walk out with a main route and a backup.</p>
<span class="text-slate-500 font-semibold flex items-center gap-2 transition-all group-hover:gap-3 group-hover:text-primary mt-auto"><span data-eos-scenario-cta>Start now</span> <span class="material-icons-outlined text-sm">arrow_forward</span></span>
</a>
<a href="/app?tab=atmos" target="_top" class="p-8 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-white/5 v2-glass-card transition-all duration-300 group flex flex-col h-full" data-eos-scenario="career">
<div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
<svg class="w-7 h-7 text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18V6"/><path d="M4 18h16"/><path d="M7 14l4-5 3 3 5-7"/><path d="M16 5h3v3"/></svg>
</div>
<h3 class="text-xl font-bold" data-eos-scenario-title>Career breakthrough</h3>
<p class="text-slate-600 dark:text-slate-400 mt-3 mb-6 flex-1 text-sm md:text-base leading-relaxed" data-eos-scenario-desc>Offer, stay-or-leave, pivot. Pressure-test the move until you can act tonight—not another vague pros/cons list.</p>
<span class="text-slate-500 font-semibold flex items-center gap-2 transition-all group-hover:gap-3 group-hover:text-primary mt-auto"><span data-eos-scenario-cta>Start now</span> <span class="material-icons-outlined text-sm">arrow_forward</span></span>
</a>
<a href="/app?tab=atmos" target="_top" class="p-8 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-white/5 v2-glass-card transition-all duration-300 group flex flex-col h-full" data-eos-scenario="relationship">
<div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
<svg class="w-7 h-7 text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="12" r="3.5"/><circle cx="15" cy="12" r="3.5"/></svg>
</div>
<h3 class="text-xl font-bold" data-eos-scenario-title>Relationship fit</h3>
<p class="text-slate-600 dark:text-slate-400 mt-3 mb-6 flex-1 text-sm md:text-base leading-relaxed" data-eos-scenario-desc>Partners, family, teams pulling you apart. See the tension clearly—without outsourcing the final call.</p>
<span class="text-slate-500 font-semibold flex items-center gap-2 transition-all group-hover:gap-3 group-hover:text-primary mt-auto"><span data-eos-scenario-cta>Start now</span> <span class="material-icons-outlined text-sm">arrow_forward</span></span>
</a>
<a href="/app?tab=atmos" target="_top" class="p-8 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-white/5 v2-glass-card transition-all duration-300 group flex flex-col h-full" data-eos-scenario="timing">
<div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
<svg class="w-7 h-7 text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.5"/></svg>
</div>
<h3 class="text-xl font-bold" data-eos-scenario-title>Timing &amp; rhythm</h3>
<p class="text-slate-600 dark:text-slate-400 mt-3 mb-6 flex-1 text-sm md:text-base leading-relaxed" data-eos-scenario-desc>Push, wait, or watch. Leave with a short list tied to <em>this</em> decision, not generic “good timing.”</p>
<span class="text-slate-500 font-semibold flex items-center gap-2 transition-all group-hover:gap-3 group-hover:text-primary mt-auto"><span data-eos-scenario-cta>Start now</span> <span class="material-icons-outlined text-sm">arrow_forward</span></span>
</a>
<a href="/app?tab=atmos" target="_top" class="p-8 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-white/5 v2-glass-card transition-all duration-300 group flex flex-col h-full" data-eos-scenario="forks">
<div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
<svg class="w-7 h-7 text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z"/><path d="M9.5 12h5"/><path d="M12 9.5v5"/></svg>
</div>
<h3 class="text-xl font-bold" data-eos-scenario-title>Life forks</h3>
<p class="text-slate-600 dark:text-slate-400 mt-3 mb-6 flex-1 text-sm md:text-base leading-relaxed" data-eos-scenario-desc>Big life forks where the cost of waiting is rising. One focused pass: dialogue → report → optional 30-day same-line reminders.</p>
<span class="text-slate-500 font-semibold flex items-center gap-2 transition-all group-hover:gap-3 group-hover:text-primary mt-auto"><span data-eos-scenario-cta>Start now</span> <span class="material-icons-outlined text-sm">arrow_forward</span></span>
</a>
</div>
</div>
</section>
'''

# Insert immediately after #v2-product-preview closing </section>
anchor = 'id="v2-product-preview"'
pos = text.find(anchor)
assert pos > 0
# find the closing </section> for that section (first after preview start)
sec_end = text.find("</section>", pos)
assert sec_end > 0
insert_at = sec_end + len("</section>")
# next should be engines
assert 'id="v2-engines"' in text[insert_at:insert_at+200]
text = text[:insert_at] + "\n" + section + text[insert_at:]

# --- JS copy map after SCENARIOS_COPY ---
copy_js = r'''
            const EOS_SCENARIOS_COPY = {
              en: {
                eyebrow: 'Built for high-stakes decisions',
                cta: 'Start now',
                items: {
                  crossroads: {
                    title: 'Major crossroads',
                    desc: 'When more than one path looks right—and none feels safe—lock what “good” means, then walk out with a main route and a backup.',
                  },
                  career: {
                    title: 'Career breakthrough',
                    desc: 'Offer, stay-or-leave, pivot. Pressure-test the move until you can act tonight—not another vague pros/cons list.',
                  },
                  relationship: {
                    title: 'Relationship fit',
                    desc: 'Partners, family, teams pulling you apart. See the tension clearly—without outsourcing the final call.',
                  },
                  timing: {
                    title: 'Timing & rhythm',
                    desc: 'Push, wait, or watch. Leave with a short list tied to this decision, not generic “good timing.”',
                  },
                  forks: {
                    title: 'Life forks',
                    desc: 'Big life forks where the cost of waiting is rising. One focused pass: dialogue → report → optional 30-day same-line reminders.',
                  },
                },
              },
              zh: {
                eyebrow: '专为高价值与高风险场景打造',
                cta: '马上开始',
                items: {
                  crossroads: {
                    title: '重大抉择',
                    desc: '几条路都像对、又都不踏实时——先钉住「好」长什么样，再带走主路径和一条备用。',
                  },
                  career: {
                    title: '事业破局',
                    desc: 'offer、留或走、转型。把这一步压测到今晚能动手——不是再列一张空泛利弊表。',
                  },
                  relationship: {
                    title: '关系契合',
                    desc: '伴侣、家人、团队把你往两边拉。把张力看清——决定仍在你，不外包。',
                  },
                  timing: {
                    title: '时机与节奏',
                    desc: '该推、该等、还是该盯。带走钉在本案上的短清单——不是泛泛「时机好」。',
                  },
                  forks: {
                    title: '人生分叉',
                    desc: '人生分叉、拖下去成本在涨。一次聚焦：对话 → 决策报告 → 可选 30 天同线提醒。',
                  },
                },
              },
            };

'''

# Insert after SCENARIOS_COPY closing };
# Find SCENARIOS_COPY block end uniquely
marker = "const SCENARIOS_COPY = {"
sp = text.find(marker)
assert sp > 0
# find matching }; after life_architecture fr block — use TEAM_AVATARS as next anchor
team = text.find("const TEAM_AVATARS = [", sp)
assert team > 0
# insert before TEAM_AVATARS
text = text[:team] + copy_js + text[team:]

# --- locale apply after existing scenarios apply ---
apply_js = r'''
            const eosScenarios = EOS_SCENARIOS_COPY[currentLocale] || EOS_SCENARIOS_COPY.en;
            const eosEyebrow = document.getElementById('eos-scenarios-eyebrow');
            if (eosEyebrow) eosEyebrow.textContent = eosScenarios.eyebrow;
            document.querySelectorAll('[data-eos-scenario]').forEach((card) => {
              const key = card.getAttribute('data-eos-scenario');
              const item = eosScenarios.items && eosScenarios.items[key];
              if (!item) return;
              const titleEl = card.querySelector('[data-eos-scenario-title]');
              const descEl = card.querySelector('[data-eos-scenario-desc]');
              const ctaEl = card.querySelector('[data-eos-scenario-cta]');
              if (titleEl) titleEl.textContent = item.title;
              if (descEl) {
                if (key === 'timing' && currentLocale === 'en') {
                  descEl.innerHTML = 'Push, wait, or watch. Leave with a short list tied to <em>this</em> decision, not generic “good timing.”';
                } else {
                  descEl.textContent = item.desc;
                }
              }
              if (ctaEl) ctaEl.textContent = eosScenarios.cta;
            });

'''

apply_anchor = "document.querySelectorAll('[data-scenario]').forEach((el) => {\n              const key = el.getAttribute('data-scenario');\n              if (key && scenarios[key]) el.textContent = scenarios[key];\n            });"
ap = text.find(apply_anchor)
assert ap > 0, "scenarios apply anchor not found"
end_ap = ap + len(apply_anchor)
text = text[:end_ap] + "\n" + apply_js + text[end_ap:]

path.write_text(text, encoding="utf-8", newline="\n")
print("patched ok, bytes", path.stat().st_size)
