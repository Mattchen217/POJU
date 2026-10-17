from pathlib import Path
import re

path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
orig = t

en_plain = "Built for the decisions that actually cost you"
en_gold = 'Built for the <span class="gold-gradient">decisions</span> that actually <span class="gold-gradient">cost</span> you'
zh_plain = "为真正要紧的决定而建"
zh_gold = '为真正<span class="gold-gradient">要紧</span>的<span class="gold-gradient">决定</span>而建'

# Static H2 content
old_h2 = '<h2 id="eos-scenarios-h1" class="text-3xl md:text-5xl font-display font-bold mb-4 md:mb-5 leading-tight">Built for the decisions that actually cost you</h2>'
new_h2 = f'<h2 id="eos-scenarios-h1" class="text-3xl md:text-5xl font-display font-bold mb-4 md:mb-5 leading-tight">{en_gold}</h2>'
if old_h2 not in t:
    raise SystemExit("static h2 not found")
t = t.replace(old_h2, new_h2, 1)

# i18n: only replace h1: '...' lines (not header/eyebrow for sr-only which can stay plain)
# EN h1 in dict
en_h1_old = "h1: 'Built for the decisions that actually cost you'"
en_h1_new = f"h1: '{en_gold}'"
if t.count(en_h1_old) != 1:
    raise SystemExit(f"EN h1 count={t.count(en_h1_old)}")
t = t.replace(en_h1_old, en_h1_new, 1)

zh_h1_old = "h1: '为真正要紧的决定而建'"
zh_h1_new = f"h1: '{zh_gold}'"
if t.count(zh_h1_old) != 1:
    raise SystemExit(f"ZH h1 count={t.count(zh_h1_old)}")
t = t.replace(zh_h1_old, zh_h1_new, 1)

# Switch textContent -> innerHTML for scenarios H1 (match engines)
old_apply = "if (eosH1) eosH1.textContent = eosScenarios.h1 || eosScenarios.eyebrow || '';"
new_apply = "if (eosH1) eosH1.innerHTML = eosScenarios.h1 || eosScenarios.eyebrow || '';"
if old_apply not in t:
    raise SystemExit("apply line not found")
t = t.replace(old_apply, new_apply, 1)

# Align scenarios header block spacing closer to engines (mb-6 on h2 like engines) — Design said same type scale; already text-3xl md:text-5xl. Optional mb tweak: leave.

if t == orig:
    raise SystemExit("no gold changes")
path.write_text(t, encoding="utf-8")
print("gold ok")
print("glass strip present:", "v2-glass-strip" in t)
print("innerHTML:", new_apply in t)
print("en gold in file:", en_gold in t)
print("zh gold in file:", zh_gold in t)
