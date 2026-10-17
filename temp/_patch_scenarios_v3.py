# -*- coding: utf-8 -*-
"""Patch public/v2-landing.html for EOS five-scenarios v3 copy."""
from pathlib import Path
import re

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")
orig = text

# --- 1) Hide duplicate strip header (keep icon strip); visible H1 lives above bento ---
# Change #v2-scenarios-header to sr-only so icon strip stays, no conflicting title
old_strip_header = (
    '<p id="v2-scenarios-header" class="text-center text-base md:text-lg font-mono '
    'text-slate-400 uppercase tracking-widest mb-8">DESIGNED FOR HIGH-STAKES SCENARIOS</p>'
)
new_strip_header = (
    '<p id="v2-scenarios-header" class="sr-only">Built for the decisions that actually cost you</p>'
)
assert old_strip_header in text, "strip header not found"
text = text.replace(old_strip_header, new_strip_header, 1)

# --- 2) Replace eos-landing-scenarios header (sr-only eyebrow) with visible H1+L1+L2 ---
old_eyebrow_block = (
    '<div class="sr-only"><p id="eos-scenarios-eyebrow" class="text-center text-base md:text-lg '
    'font-mono text-slate-400 uppercase tracking-widest sr-only">Built for high-stakes decisions</p></div>'
)
new_header_block = '''<div class="text-center mb-10 md:mb-12" id="eos-scenarios-header-block">
<h2 id="eos-scenarios-h1" class="text-3xl md:text-5xl font-display font-bold mb-4 md:mb-5 leading-tight">Built for the decisions that actually cost you</h2>
<p id="eos-scenarios-sub-l1" class="text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-3 leading-relaxed">High-stakes forks—life moves, career, relationships, timing, stay-or-go.</p>
<p id="eos-scenarios-sub-l2" class="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">One focused dialogue. Deep multi-step reasoning. A full breakthrough brief—plus required 30-day same-line reminders.</p>
</div>'''
# Keep eyebrow id for backward compat but unused — actually applyLocale uses eos-scenarios-eyebrow.
# We'll update applyLocale to wire h1/sub-l1/sub-l2 instead.
assert old_eyebrow_block in text, "eyebrow block not found"
text = text.replace(old_eyebrow_block, new_header_block, 1)

# Update aria-labelledby on section
text = text.replace(
    'aria-labelledby="v2-scenarios-header"',
    'aria-labelledby="eos-scenarios-h1"',
    1,
)

# --- 3) Remove all eos-scenario-pass "1 PASS" badges ---
# Pattern: the span with eos-scenario-pass, and simplify the flex header to just icon
pass_span_re = re.compile(
    r'\s*<span class="eos-scenario-pass[^"]*"[^>]*>1 PASS</span>\s*',
)
count_pass = len(pass_span_re.findall(text))
assert count_pass == 5, f"expected 5 PASS badges, found {count_pass}"
text = pass_span_re.sub("\n", text)

# After removing PASS, the header row is still flex justify-between with only icon — OK to leave,
# or we could leave as-is. Optionally change justify-between to just icon-only. Leaving layout.

# --- 4) Update default EN HTML for five cards (tagline + desc) ---
replacements = [
    # forks
    (
        '<p class="eos-scenario-tagline mt-2 mb-3 leading-relaxed" data-eos-scenario-tagline>Big life forks where the cost of waiting is rising.</p>',
        '<p class="eos-scenario-tagline mt-2 mb-3 leading-relaxed" data-eos-scenario-tagline>The cost of waiting is already climbing.</p>',
    ),
    (
        '<p class="text-slate-600 dark:text-slate-400 mb-0 flex-1 min-h-0 overflow-hidden text-sm md:text-base leading-relaxed" data-eos-scenario-desc>Big life forks where the cost of waiting is rising. One focused pass: dialogue → report → 30-day same-line reminders.</p>',
        '<p class="text-slate-600 dark:text-slate-400 mb-0 flex-1 min-h-0 overflow-hidden text-sm md:text-base leading-relaxed" data-eos-scenario-desc>Big life forks don’t get clearer by sleeping on them—they get heavier. Stay or go, restart or hold, the loop burns attention every day you don’t choose. Name the fork. Lock what “good” would look like on the other side. Walk out with a main path and a backup you can actually live with—you keep the final call.</p>',
    ),
]

# Use flexible matching for desc lines that may have special chars
def replace_tag_desc(text, scenario_key, new_tag, new_desc, desc_has_html=False):
    # Find card block by data-eos-scenario="key"
    marker = f'data-eos-scenario="{scenario_key}"'
    idx = text.find(marker)
    assert idx >= 0, f"card {scenario_key} not found"
    # Find tagline within next 1500 chars
    chunk = text[idx:idx+2000]
    m_tag = re.search(r'(<p class="eos-scenario-tagline[^"]*"[^>]*data-eos-scenario-tagline>)(.*?)(</p>)', chunk, re.DOTALL)
    assert m_tag, f"tagline not found for {scenario_key}"
    # Find desc
    m_desc = re.search(r'(<p class="text-slate-600 dark:text-slate-400[^"]*"[^>]*data-eos-scenario-desc>)(.*?)(</p>)', chunk, re.DOTALL)
    assert m_desc, f"desc not found for {scenario_key}"
    # Replace in full text using absolute positions
    # Do desc first (later in chunk) then tagline
    abs_desc_start = idx + m_desc.start()
    abs_desc_end = idx + m_desc.end()
    new_desc_html = m_desc.group(1) + new_desc + m_desc.group(3)
    text = text[:abs_desc_start] + new_desc_html + text[abs_desc_end:]
    # re-find tagline after desc change (indices may shift if lengths differ — safer re-search)
    idx = text.find(marker)
    chunk = text[idx:idx+2000]
    m_tag = re.search(r'(<p class="eos-scenario-tagline[^"]*"[^>]*data-eos-scenario-tagline>)(.*?)(</p>)', chunk, re.DOTALL)
    abs_tag_start = idx + m_tag.start()
    abs_tag_end = idx + m_tag.end()
    new_tag_html = m_tag.group(1) + new_tag + m_tag.group(3)
    text = text[:abs_tag_start] + new_tag_html + text[abs_tag_end:]
    return text

cards = {
    "forks": {
        "tag": "The cost of waiting is already climbing.",
        "desc": "Big life forks don’t get clearer by sleeping on them—they get heavier. Stay or go, restart or hold, the loop burns attention every day you don’t choose. Name the fork. Lock what “good” would look like on the other side. Walk out with a main path and a backup you can actually live with—you keep the final call.",
    },
    "crossroads": {
        "tag": "Every path looks right. None feels safe.",
        "desc": 'You’ve listed pros and cons until the page went blank—and the dilemma still won’t let go. We lock what “good” means <em>for you</em>, pressure-test the options side by side, and leave a clear main route plus one backup. Not more opinions. A path you can walk.',
    },
    "career": {
        "tag": "Offer, stay-or-leave, pivot—tonight needs a call.",
        "desc": 'Career forks punish hesitation and punish reckless jumps. Aim the whole session at <em>this</em> move: what you want, what you’re afraid to lose, and what “good enough to act” looks like. Walk out with a pressure-tested next step—not another vague matrix.',
    },
    "relationship": {
        "tag": "Everyone’s pulling. You’re the one stuck in the middle.",
        "desc": "Partners, family, teams—each side has a story, and none of them is your whole answer. We map the tension without blame or fortune-telling: where you align, where you friction, what you’re actually deciding. See it clearly. Keep the call.",
    },
    "timing": {
        "tag": "Push, wait, or watch—generic “good timing” doesn’t help.",
        "desc": 'Timing only matters when it’s tied to <em>this</em> decision. Sort what to push now, what to park, and what to watch next—then leave with a short list pinned to the case, not a vague sense that “the moment is right.”',
    },
}

for key, vals in cards.items():
    text = replace_tag_desc(text, key, vals["tag"], vals["desc"])

# --- 5) Replace EOS_SCENARIOS_COPY en+zh blocks ---
# Find and replace the whole const EOS_SCENARIOS_COPY = { ... };
eos_start = text.find("const EOS_SCENARIOS_COPY = {")
assert eos_start > 0
# find end: line with `};` that closes it — after zh block
# Use brace counting
i = eos_start + len("const EOS_SCENARIOS_COPY = ")
depth = 0
end = None
for j in range(i, len(text)):
    c = text[j]
    if c == "{":
        depth += 1
    elif c == "}":
        depth -= 1
        if depth == 0:
            # include trailing ;
            end = j + 1
            if end < len(text) and text[end] == ";":
                end += 1
            break
assert end, "could not find end of EOS_SCENARIOS_COPY"

new_eos = r'''const EOS_SCENARIOS_COPY = {
              en: {
                h1: 'Built for the decisions that actually cost you',
                subL1: 'High-stakes forks—life moves, career, relationships, timing, stay-or-go.',
                subL2: 'One focused dialogue. Deep multi-step reasoning. A full breakthrough brief—plus required 30-day same-line reminders.',
                eyebrow: 'Built for the decisions that actually cost you',
                cta: 'Start now',
                items: {
                  crossroads: {
                    title: 'Major crossroads',
                    tagline: 'Every path looks right. None feels safe.',
                    desc: 'You’ve listed pros and cons until the page went blank—and the dilemma still won’t let go. We lock what “good” means for you, pressure-test the options side by side, and leave a clear main route plus one backup. Not more opinions. A path you can walk.',
                    descHtml: 'You’ve listed pros and cons until the page went blank—and the dilemma still won’t let go. We lock what “good” means <em>for you</em>, pressure-test the options side by side, and leave a clear main route plus one backup. Not more opinions. A path you can walk.',
                  },
                  career: {
                    title: 'Career breakthrough',
                    tagline: 'Offer, stay-or-leave, pivot—tonight needs a call.',
                    desc: 'Career forks punish hesitation and punish reckless jumps. Aim the whole session at this move: what you want, what you’re afraid to lose, and what “good enough to act” looks like. Walk out with a pressure-tested next step—not another vague matrix.',
                    descHtml: 'Career forks punish hesitation and punish reckless jumps. Aim the whole session at <em>this</em> move: what you want, what you’re afraid to lose, and what “good enough to act” looks like. Walk out with a pressure-tested next step—not another vague matrix.',
                  },
                  relationship: {
                    title: 'Relationship fit',
                    tagline: 'Everyone’s pulling. You’re the one stuck in the middle.',
                    desc: 'Partners, family, teams—each side has a story, and none of them is your whole answer. We map the tension without blame or fortune-telling: where you align, where you friction, what you’re actually deciding. See it clearly. Keep the call.',
                  },
                  timing: {
                    title: 'Timing & rhythm',
                    tagline: 'Push, wait, or watch—generic “good timing” doesn’t help.',
                    desc: 'Timing only matters when it’s tied to this decision. Sort what to push now, what to park, and what to watch next—then leave with a short list pinned to the case, not a vague sense that “the moment is right.”',
                    descHtml: 'Timing only matters when it’s tied to <em>this</em> decision. Sort what to push now, what to park, and what to watch next—then leave with a short list pinned to the case, not a vague sense that “the moment is right.”',
                  },
                  forks: {
                    title: 'Life forks',
                    tagline: 'The cost of waiting is already climbing.',
                    desc: 'Big life forks don’t get clearer by sleeping on them—they get heavier. Stay or go, restart or hold, the loop burns attention every day you don’t choose. Name the fork. Lock what “good” would look like on the other side. Walk out with a main path and a backup you can actually live with—you keep the final call.',
                  },
                },
              },
              zh: {
                h1: '为真正要紧的决定而建',
                subL1: '高价值、高风险——人生分叉、事业、关系、时机、去留。',
                subL2: '一场聚焦对话，多层深度推理，带走完整破局建议，外加必含的 30 天同线提醒。',
                eyebrow: '为真正要紧的决定而建',
                cta: '马上开始',
                items: {
                  crossroads: {
                    title: '重大抉择',
                    tagline: '几条路都像对，没有一条踏实。',
                    desc: '利弊表列到空白，卡住的那件事还在攥着你。我们帮你钉住「好」对你到底长什么样，把选项并排放上压测，留下清晰主路和一条备用。不是再多一堆意见，是一条能走的路。',
                  },
                  career: {
                    title: '事业破局',
                    tagline: 'offer、留或走、转型——今晚得有个说法。',
                    desc: '事业分叉既罚犹豫，也罚莽撞。整场对准这一步：你想要什么、怕失去什么、「好到能动手」长什么样。带走压测过的下一步——不是再一张空泛矩阵。',
                  },
                  relationship: {
                    title: '关系契合',
                    tagline: '两边都在拉，卡住的是你。',
                    desc: '伴侣、家人、团队——每边都有说法，却没有一边是你完整的答案。我们把张力画清，不甩锅、不算命：哪里合拍、哪里摩擦、你真正在决定什么。看清了，决定仍在你。',
                  },
                  timing: {
                    title: '时机与节奏',
                    tagline: '该推、该等、该盯——泛泛「时机好」没用。',
                    desc: '时机只有钉在本案上才有用。分清现在该推什么、先放什么、接下来盯什么——带走钉在这件事上的短清单，不是空泛觉得「时机到了」。',
                  },
                  forks: {
                    title: '人生分叉',
                    tagline: '拖下去，成本已经在涨。',
                    desc: '人生分叉不会越拖越清楚——只会越拖越重。留或走、重来或再撑，不选的每一天都在烧注意力。把分叉说清楚。钉住「好」在另一边长什么样。带走主路径和一条你真能过的备用——最终决定仍在你。',
                  },
                },
              },
            };'''

text = text[:eos_start] + new_eos + text[end:]

# --- 6) Update SCENARIOS_COPY headers + life_architecture labels ---
# EN header
text = text.replace(
    "header: 'DESIGNED FOR HIGH-STAKES SCENARIOS',",
    "header: 'Built for the decisions that actually cost you',",
    1,
)
# ZH header - replace old
old_zh_header = "header: '专为高价值与高风险场景打造',"
new_zh_header = "header: '为真正要紧的决定而建',"
assert old_zh_header in text, "ZH SCENARIOS header not found"
text = text.replace(old_zh_header, new_zh_header, 1)

# life_architecture EN/ZH
text = text.replace("life_architecture: 'Life Architecture',", "life_architecture: 'Life forks',", 1)
old_zh_life = "life_architecture: '人生与能量',"
new_zh_life = "life_architecture: '人生分叉',"
assert old_zh_life in text, "ZH life_architecture not found"
text = text.replace(old_zh_life, new_zh_life, 1)

# Also update default HTML for life_architecture strip span
text = text.replace(
    '>Life Architecture</span>',
    '>Life forks</span>',
    1,
)

# --- 7) Update applyLocale for eos scenarios header + descHtml ---
old_apply = '''            const eosScenarios = EOS_SCENARIOS_COPY[currentLocale] || EOS_SCENARIOS_COPY.en;
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
            if (eosBarCta) eosBarCta.textContent = eosScenarios.cta;'''

new_apply = '''            const eosScenarios = EOS_SCENARIOS_COPY[currentLocale] || EOS_SCENARIOS_COPY.en;
            const eosH1 = document.getElementById('eos-scenarios-h1');
            const eosSubL1 = document.getElementById('eos-scenarios-sub-l1');
            const eosSubL2 = document.getElementById('eos-scenarios-sub-l2');
            if (eosH1) eosH1.textContent = eosScenarios.h1 || eosScenarios.eyebrow || '';
            if (eosSubL1) eosSubL1.textContent = eosScenarios.subL1 || '';
            if (eosSubL2) eosSubL2.textContent = eosScenarios.subL2 || '';
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
                if (item.descHtml) {
                  descEl.innerHTML = item.descHtml;
                } else {
                  descEl.textContent = item.desc;
                }
              }
            });
            const eosBarCta = document.querySelector('#eos-scenarios-cta-bar [data-eos-scenario-cta]');
            if (eosBarCta) eosBarCta.textContent = eosScenarios.cta;'''

# The curly quotes in old_apply might not match file — extract from file instead
apply_marker = "const eosScenarios = EOS_SCENARIOS_COPY[currentLocale]"
ai = text.find(apply_marker)
assert ai > 0, "apply marker not found"
# find through eosBarCta block
aj = text.find("if (eosBarCta) eosBarCta.textContent = eosScenarios.cta;", ai)
assert aj > 0
aj = text.find("\n", aj)  # end of that line
# also include leading whitespace of first line — find start of line
line_start = text.rfind("\n", 0, ai) + 1
old_chunk = text[line_start:aj]
# Verify key pieces
assert "eos-scenarios-eyebrow" in old_chunk or "eosScenarios.eyebrow" in old_chunk
assert "eosBarCta" in old_chunk

# Build new_apply with same indent (12 spaces for const level based on file)
indent = "            "  # 12 spaces
new_apply_lines = [
    f"{indent}const eosScenarios = EOS_SCENARIOS_COPY[currentLocale] || EOS_SCENARIOS_COPY.en;",
    f"{indent}const eosH1 = document.getElementById('eos-scenarios-h1');",
    f"{indent}const eosSubL1 = document.getElementById('eos-scenarios-sub-l1');",
    f"{indent}const eosSubL2 = document.getElementById('eos-scenarios-sub-l2');",
    f"{indent}if (eosH1) eosH1.textContent = eosScenarios.h1 || eosScenarios.eyebrow || '';",
    f"{indent}if (eosSubL1) eosSubL1.textContent = eosScenarios.subL1 || '';",
    f"{indent}if (eosSubL2) eosSubL2.textContent = eosScenarios.subL2 || '';",
    f"{indent}document.querySelectorAll('[data-eos-scenario]').forEach((card) => {{",
    f"{indent}  const key = card.getAttribute('data-eos-scenario');",
    f"{indent}  const item = eosScenarios.items && eosScenarios.items[key];",
    f"{indent}  if (!item) return;",
    f"{indent}  const titleEl = card.querySelector('[data-eos-scenario-title]');",
    f"{indent}  const taglineEl = card.querySelector('[data-eos-scenario-tagline]');",
    f"{indent}  const descEl = card.querySelector('[data-eos-scenario-desc]');",
    f"{indent}  if (titleEl) titleEl.textContent = item.title;",
    f"{indent}  if (taglineEl) taglineEl.textContent = item.tagline || '';",
    f"{indent}  if (descEl) {{",
    f"{indent}    if (item.descHtml) {{",
    f"{indent}      descEl.innerHTML = item.descHtml;",
    f"{indent}    }} else {{",
    f"{indent}      descEl.textContent = item.desc;",
    f"{indent}    }}",
    f"{indent}  }}",
    f"{indent}}});",
    f"{indent}const eosBarCta = document.querySelector('#eos-scenarios-cta-bar [data-eos-scenario-cta]');",
    f"{indent}if (eosBarCta) eosBarCta.textContent = eosScenarios.cta;",
]
text = text[:line_start] + "\n".join(new_apply_lines) + text[aj:]

# --- Verify ---
assert "eos-scenario-pass" not in text or text.count("eos-scenario-pass") == 0
# engines PASSX1 must remain
assert "PASSX1" in text
assert 'id="v2-engines"' in text
assert "The cost of waiting is already climbing." in text
assert "为真正要紧的决定而建" in text
assert "拖下去，成本已经在涨。" in text
assert "人生分叉" in text
assert "人生与能量" not in text
assert "1 PASS" not in text or text.count('>1 PASS<') == 0
# check no 1 PASS in scenario cards
assert text.count('eos-scenario-pass') == 0
assert ">1 PASS<" not in text
assert "eos-scenarios-h1" in text
assert "eos-scenarios-sub-l1" in text
assert "eos-scenarios-sub-l2" in text
# engines section unchanged length-ish — just ensure still there
assert 'id="v2-engines"' in text

path.write_text(text, encoding="utf-8")
print("OK patched", path)
print("delta bytes", len(text) - len(orig))
# checklist
checks = {
    "no_1_PASS_in_scenarios": ">1 PASS<" not in text and "eos-scenario-pass" not in text,
    "h1_present": "eos-scenarios-h1" in text and "Built for the decisions that actually cost you" in text,
    "sub_l1": "High-stakes forks" in text and "高价值、高风险" in text,
    "sub_l2": "30-day same-line reminders" in text and "30 天同线提醒" in text,
    "forks_hook": "The cost of waiting is already climbing." in text and "拖下去，成本已经在涨。" in text,
    "crossroads_hook": "Every path looks right. None feels safe." in text and "几条路都像对" in text,
    "career_hook": "tonight needs a call" in text and "今晚得有个说法" in text,
    "rel_hook": "stuck in the middle" in text and "卡住的是你" in text,
    "timing_hook": "generic" in text and "泛泛「时机好」没用" in text,
    "life_forks_strip": "life_architecture: 'Life forks'" in text and "life_architecture: '人生分叉'" in text,
    "engines_untouched_marker": 'id="v2-engines"' in text and "PASSX1" in text,
    "cta_bar": 'id="eos-scenarios-cta-bar"' in text and "/app?tab=atmos" in text,
    "bento_shell": 'id="eos-scenario-forks-card"' in text and 'id="eos-scenarios-right-col"' in text,
}
for k, v in checks.items():
    print(f"  {k}: {v}")
assert all(checks.values()), "some checks failed"
print("ALL CHECKS PASSED")
