# -*- coding: utf-8 -*-
from pathlib import Path

path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")

engines_marker = '<section id="v2-engines"'
engines_start = text.index(engines_marker)
engines_end = text.index("</section>", engines_start) + len("</section>")
engines_before = text[engines_start:engines_end]

css_anchor = "        /* FAQ accordion: match site glass cards (rounded-2xl + gold hover) */"
css_insert = """        /* EOS scenarios bento: clone engines tall-card + yellow tagline shell */
        #eos-scenario-forks-card {
            border-color: rgba(212, 175, 55, 0.45) !important;
            box-shadow:
              0 0 24px rgba(212, 175, 55, 0.12),
              0 0 0 1px rgba(212, 175, 55, 0.28);
        }
        #eos-scenario-forks-card .eos-scenario-forks-copy {
            display: flex;
            flex-direction: column;
            min-height: 0;
            flex: 1 1 auto;
        }
        #eos-scenario-forks-card .eos-scenario-forks-deco {
            position: relative;
            width: 100%;
            margin-top: 1rem;
            flex: 1 1 auto;
            min-height: 10rem;
            border-radius: 1rem;
            overflow: hidden;
            background: rgba(0, 0, 0, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.06);
            pointer-events: none;
        }
        #eos-scenario-forks-card .eos-scenario-forks-deco canvas {
            display: block;
            width: 100% !important;
            height: 100% !important;
        }
        @media (min-width: 1024px) {
            #eos-scenario-forks-card .eos-scenario-forks-copy {
                flex: 0 0 auto;
            }
            #eos-scenario-forks-card .eos-scenario-forks-deco {
                flex: 1 1 0;
                min-height: 0;
            }
        }
        .eos-scenario-tagline {
            font-size: 1rem;
            font-weight: 600;
            line-height: 1.45;
            letter-spacing: 0.01em;
            color: #D4AF37;
        }
        @media (min-width: 768px) {
            .eos-scenario-tagline {
                font-size: 1.0625rem;
            }
        }
        #eos-scenarios-cta-bar {
            width: 100%;
            justify-content: center;
        }
        #eos-scenarios-right-col {
            display: flex;
            flex-direction: column;
            gap: 2rem;
            min-height: 0;
        }
        @media (min-width: 1024px) {
            #eos-scenarios-grid {
                align-items: stretch;
            }
            #eos-scenario-forks-card,
            #eos-scenarios-right-col {
                height: 100%;
            }
        }

"""

if "EOS scenarios bento" not in text:
    assert css_anchor in text
    text = text.replace(css_anchor, css_insert + css_anchor, 1)

section_start = text.index('<section id="eos-landing-scenarios"')
section_end = text.index("</section>", section_start) + len("</section>")

new_section = """<section id="eos-landing-scenarios" class="pt-10 pb-20 md:pt-14 relative overflow-hidden animate-fade-in-up" style="animation-delay: 0.38s;" aria-labelledby="eos-scenarios-eyebrow">
<div class="max-w-7xl mx-auto px-6">
<div class="text-center mb-12 md:mb-16">
<p id="eos-scenarios-eyebrow" class="text-center text-base md:text-lg font-mono text-slate-400 uppercase tracking-widest">Built for high-stakes decisions</p>
</div>
<div class="grid grid-cols-1 lg:grid-cols-3 gap-8" id="eos-scenarios-grid">
<div id="eos-scenario-forks-card" class="p-8 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-white/5 v2-glass-card transition-all duration-300 group flex flex-col h-full lg:col-span-1" data-eos-scenario="forks">
<div class="eos-scenario-forks-copy">
<div class="flex justify-between items-center mb-6">
<div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
<svg class="w-7 h-7 text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z"/><path d="M9.5 12h5"/><path d="M12 9.5v5"/></svg>
</div>
<span class="eos-scenario-pass text-lg font-mono font-bold tracking-wider text-slate-500 transition-colors group-hover:text-primary">1 PASS</span>
</div>
<h3 class="text-xl font-bold" data-eos-scenario-title>Life forks</h3>
<p class="eos-scenario-tagline mt-2 mb-3 leading-relaxed" data-eos-scenario-tagline>Big life forks where the cost of waiting is rising.</p>
<p class="text-slate-600 dark:text-slate-400 mb-0 flex-1 min-h-0 overflow-hidden text-sm md:text-base leading-relaxed" data-eos-scenario-desc>Big life forks where the cost of waiting is rising. One focused pass: dialogue → report → 30-day same-line reminders.</p>
</div>
<div class="eos-scenario-forks-deco" id="eos-scenario-forks-deco" aria-hidden="true">
<canvas id="eos-scenario-forks-deco-canvas"></canvas>
</div>
</div>
<div id="eos-scenarios-right-col" class="lg:col-span-2">
<div class="grid grid-cols-1 sm:grid-cols-2 gap-8 flex-1" id="eos-scenarios-right-grid">
<div class="p-8 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-white/5 v2-glass-card transition-all duration-300 group flex flex-col h-full" data-eos-scenario="crossroads">
<div class="flex justify-between items-center mb-6">
<div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
<svg class="w-7 h-7 text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v7l5 3 5-3V4"/><path d="M12 14v6"/><circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none"/></svg>
</div>
<span class="eos-scenario-pass text-lg font-mono font-bold tracking-wider text-slate-500 transition-colors group-hover:text-primary">1 PASS</span>
</div>
<h3 class="text-xl font-bold" data-eos-scenario-title>Major crossroads</h3>
<p class="eos-scenario-tagline mt-2 mb-3 leading-relaxed" data-eos-scenario-tagline>When more than one path looks right—and none feels safe.</p>
<p class="text-slate-600 dark:text-slate-400 mb-0 flex-1 text-sm md:text-base leading-relaxed" data-eos-scenario-desc>When more than one path looks right—and none feels safe—lock what “good” means, then walk out with a main route and a backup.</p>
</div>
<div class="p-8 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-white/5 v2-glass-card transition-all duration-300 group flex flex-col h-full" data-eos-scenario="career">
<div class="flex justify-between items-center mb-6">
<div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
<svg class="w-7 h-7 text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18V6"/><path d="M4 18h16"/><path d="M7 14l4-5 3 3 5-7"/><path d="M16 5h3v3"/></svg>
</div>
<span class="eos-scenario-pass text-lg font-mono font-bold tracking-wider text-slate-500 transition-colors group-hover:text-primary">1 PASS</span>
</div>
<h3 class="text-xl font-bold" data-eos-scenario-title>Career breakthrough</h3>
<p class="eos-scenario-tagline mt-2 mb-3 leading-relaxed" data-eos-scenario-tagline>Offer, stay-or-leave, pivot.</p>
<p class="text-slate-600 dark:text-slate-400 mb-0 flex-1 text-sm md:text-base leading-relaxed" data-eos-scenario-desc>Offer, stay-or-leave, pivot. Pressure-test the move until you can act tonight—not another vague pros/cons list.</p>
</div>
<div class="p-8 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-white/5 v2-glass-card transition-all duration-300 group flex flex-col h-full" data-eos-scenario="relationship">
<div class="flex justify-between items-center mb-6">
<div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
<svg class="w-7 h-7 text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="12" r="3.5"/><circle cx="15" cy="12" r="3.5"/></svg>
</div>
<span class="eos-scenario-pass text-lg font-mono font-bold tracking-wider text-slate-500 transition-colors group-hover:text-primary">1 PASS</span>
</div>
<h3 class="text-xl font-bold" data-eos-scenario-title>Relationship fit</h3>
<p class="eos-scenario-tagline mt-2 mb-3 leading-relaxed" data-eos-scenario-tagline>Partners, family, teams pulling you apart.</p>
<p class="text-slate-600 dark:text-slate-400 mb-0 flex-1 text-sm md:text-base leading-relaxed" data-eos-scenario-desc>Partners, family, teams pulling you apart. See the tension clearly—without outsourcing the final call.</p>
</div>
<div class="p-8 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-white/5 v2-glass-card transition-all duration-300 group flex flex-col h-full" data-eos-scenario="timing">
<div class="flex justify-between items-center mb-6">
<div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
<svg class="w-7 h-7 text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.5"/></svg>
</div>
<span class="eos-scenario-pass text-lg font-mono font-bold tracking-wider text-slate-500 transition-colors group-hover:text-primary">1 PASS</span>
</div>
<h3 class="text-xl font-bold" data-eos-scenario-title>Timing &amp; rhythm</h3>
<p class="eos-scenario-tagline mt-2 mb-3 leading-relaxed" data-eos-scenario-tagline>Push, wait, or watch.</p>
<p class="text-slate-600 dark:text-slate-400 mb-0 flex-1 text-sm md:text-base leading-relaxed" data-eos-scenario-desc>Push, wait, or watch. Leave with a short list tied to <em>this</em> decision, not generic “good timing.”</p>
</div>
</div>
<a href="/app?tab=atmos" target="_top" id="eos-scenarios-cta-bar" class="v2-hero-cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-12 py-3 font-bold shadow-xl shadow-primary/25 shrink-0">
<span data-eos-scenario-cta>Start now</span>
<span class="material-icons-outlined text-xl" aria-hidden="true">arrow_forward</span>
</a>
</div>
</div>
</div>
</section>"""

text = text[:section_start] + new_section + text[section_end:]

i18n_start = text.index("            const EOS_SCENARIOS_COPY = {")
i18n_end = text.index("            };", i18n_start) + len("            };")
new_i18n = """            const EOS_SCENARIOS_COPY = {
              en: {
                eyebrow: 'Built for high-stakes decisions',
                cta: 'Start now',
                items: {
                  crossroads: {
                    title: 'Major crossroads',
                    tagline: 'When more than one path looks right—and none feels safe.',
                    desc: 'When more than one path looks right—and none feels safe—lock what “good” means, then walk out with a main route and a backup.',
                  },
                  career: {
                    title: 'Career breakthrough',
                    tagline: 'Offer, stay-or-leave, pivot.',
                    desc: 'Offer, stay-or-leave, pivot. Pressure-test the move until you can act tonight—not another vague pros/cons list.',
                  },
                  relationship: {
                    title: 'Relationship fit',
                    tagline: 'Partners, family, teams pulling you apart.',
                    desc: 'Partners, family, teams pulling you apart. See the tension clearly—without outsourcing the final call.',
                  },
                  timing: {
                    title: 'Timing & rhythm',
                    tagline: 'Push, wait, or watch.',
                    desc: 'Push, wait, or watch. Leave with a short list tied to this decision, not generic “good timing.”',
                  },
                  forks: {
                    title: 'Life forks',
                    tagline: 'Big life forks where the cost of waiting is rising.',
                    desc: 'Big life forks where the cost of waiting is rising. One focused pass: dialogue → report → 30-day same-line reminders.',
                  },
                },
              },
              zh: {
                eyebrow: '专为高价值与高风险场景打造',
                cta: '马上开始',
                items: {
                  crossroads: {
                    title: '重大抉择',
                    tagline: '几条路都像对、又都不踏实时。',
                    desc: '几条路都像对、又都不踏实时——先钉住「好」长什么样，再带走主路径和一条备用。',
                  },
                  career: {
                    title: '事业破局',
                    tagline: 'offer、留或走、转型。',
                    desc: 'offer、留或走、转型。把这一步压测到今晚能动手——不是再列一张空泛利弊表。',
                  },
                  relationship: {
                    title: '关系契合',
                    tagline: '伴侣、家人、团队把你往两边拉。',
                    desc: '伴侣、家人、团队把你往两边拉。把张力看清——决定仍在你，不外包。',
                  },
                  timing: {
                    title: '时机与节奏',
                    tagline: '该推、该等、还是该盯。',
                    desc: '该推、该等、还是该盯。带走钉在本案上的短清单——不是泛泛「时机好」。',
                  },
                  forks: {
                    title: '人生分叉',
                    tagline: '人生分叉、拖下去成本在涨。',
                    desc: '人生分叉、拖下去成本在涨。一次聚焦：对话 → 决策报告 → 必含 30 天同线提醒。',
                  },
                },
              },
            };"""
text = text[:i18n_start] + new_i18n + text[i18n_end:]

old_apply = """            const eosScenarios = EOS_SCENARIOS_COPY[currentLocale] || EOS_SCENARIOS_COPY.en;
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
            });"""

new_apply = """            const eosScenarios = EOS_SCENARIOS_COPY[currentLocale] || EOS_SCENARIOS_COPY.en;
            const eosEyebrow = document.getElementById('eos-scenarios-eyebrow');
            if (eosEyebrow) eosEyebrow.textContent = eosScenarios.eyebrow;
            document.querySelectorAll('[data-eos-scenario]').forEach((card) => {
              const key = card.getAttribute('data-eos-scenario');
              const item = eosScenarios.items && eosScenarios.items[key];
              if (!item) return;
              const titleEl = card.querySelector('[data-eos-scenario-title]');
              const taglineEl = card.querySelector('[data-eos-scenario-tagline]');
              const descEl = card.querySelector('[data-eos-scenario-desc]');
              if (titleEl) titleEl.textContent = item.title;
              if (taglineEl) taglineEl.textContent = item.tagline || '';
              if (descEl) {
                if (key === 'timing' && currentLocale === 'en') {
                  descEl.innerHTML = 'Push, wait, or watch. Leave with a short list tied to <em>this</em> decision, not generic “good timing.”';
                } else {
                  descEl.textContent = item.desc;
                }
              }
            });
            const eosBarCta = document.querySelector('#eos-scenarios-cta-bar [data-eos-scenario-cta]');
            if (eosBarCta) eosBarCta.textContent = eosScenarios.cta;"""

assert old_apply in text, "apply block not found"
text = text.replace(old_apply, new_apply, 1)

deco_js = """
            // EOS scenarios Life forks deco — reuse Atmos spline asset, decoration only (no interaction)
            (function loadEosScenarioForksDeco() {
              const host = document.getElementById('eos-scenario-forks-deco');
              const canvas = document.getElementById('eos-scenario-forks-deco-canvas');
              if (!host || !canvas || typeof IntersectionObserver === 'undefined') return;
              const ZOOM = 0.42;
              let started = false;
              const start = async () => {
                if (started) return;
                started = true;
                try {
                  const { Application } = await import('https://unpkg.com/@splinetool/runtime@1.9.82/build/runtime.js');
                  const app = new Application(canvas);
                  await app.load('/spline/atmos.splinecode');
                  try { app.setZoom(ZOOM); } catch (_) {}
                  try {
                    const controls = app._controls || app.controls;
                    if (controls && controls.orbitControls && controls.orbitControls.setZoom) {
                      controls.orbitControls.setZoom(ZOOM);
                    }
                  } catch (_) {}
                } catch (err) {
                  console.error('[eos-scenario-forks-deco]', err && err.message ? err.message : err);
                }
              };
              const io = new IntersectionObserver((entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                  io.disconnect();
                  start();
                }
              }, { rootMargin: '120px' });
              io.observe(host);
            })();

"""

if "loadEosScenarioForksDeco" not in text:
    atmos_fn = text.find("(function loadAtmosCardSpline()")
    if atmos_fn == -1:
        raise SystemExit("loadAtmosCardSpline not found")
    text = text[:atmos_fn] + deco_js + text[atmos_fn:]

engines_start2 = text.index(engines_marker)
engines_end2 = text.index("</section>", engines_start2) + len("</section>")
engines_after = text[engines_start2:engines_end2]
assert engines_before == engines_after, "ENGINES SECTION CHANGED — abort"

assert text.count("data-eos-scenario-cta") == 1, text.count("data-eos-scenario-cta")
assert "eos-scenarios-cta-bar" in text
sc = text[text.index("eos-landing-scenarios") : text.index("v2-engines")]
assert "1 PASS" in sc
assert "PASSX1" not in sc
assert "必含 30" in text
assert "ATMOS" not in sc
assert "PIVOT" not in sc
assert "进入" not in sc
assert sc.count("Start now") == 1
assert "场能" not in sc
assert "PASSX1" in engines_after

path.write_text(text, encoding="utf-8")
print("OK patched")
print("1 PASS count", sc.count("1 PASS"))
print("tagline attrs", text.count("data-eos-scenario-tagline"))
