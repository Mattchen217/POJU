# -*- coding: utf-8 -*-
"""Patch methodology block EN/ZH (+ es/fr bottom lines) in public/v2-landing.html"""
import json
import re
from pathlib import Path

PATH = Path(r"public/v2-landing.html")
text = PATH.read_text(encoding="utf-8")

G = 'span class="gold-gradient"'

# --- new copy ---
EN = {
    "heading": f'Our <{G}>Methodology</span>. Why it works.',
    "intro": (
        f'About <{G}>three millennia</span> of Eastern decision wisdom—timing, tradeoffs, consequence—'
        "joined to contemporary research and a language engine that turns structure into a multi-turn "
        "decision dialogue you can use."
    ),
    "easternTitle": "Eastern Frameworks",
    "easternBody": (
        "Three thousand years of Eastern decision traditions—time cycles, systemic balance, how people "
        f'actually choose under pressure. Not mysticism for show: a <{G}>structural</span> lens on forks, '
        "timing, and consequence."
    ),
    "modernTitle": "Modern Research",
    "modernBody": (
        "Cognitive science, decision psychology, and chronobiology as a check—not a costume. "
        "We keep what holds as pattern and drop what fails as empty ritual."
    ),
    "aiTitle": "Algorithmic Translation",
    "aiBody": (
        "Structural signals from those models are cross-read with <em>your</em> case through a language "
        "engine—into paths, tradeoffs, and a report shaped around <em>this</em> decision—not a one-size "
        "fill-in form."
    ),
    "summary": (
        f'This is a <{G}>structured decision model</span>—Eastern structure, explicit steps, repeatable method. '
        f'<{G}>Not</span> fortune-telling. <{G}>Not</span> divination. <{G}>Not</span> fate prediction.'
    ),
    "notice": (
        "Built for high-stakes calls you still own. We advise; you decide. "
        "Not medical, legal, or financial advice—and not a promise of any life outcome."
    ),
}

ZH = {
    "heading": f'我们的<{G}>方法论</span>。为什么有效。',
    "intro": (
        f'约 <{G}>三千年</span> 东方决策智慧——时机、取舍、后果——与当代研究、语言引擎结合，'
        "把结构做成你能用的多轮决策对话。"
    ),
    "easternTitle": "东方框架",
    "easternBody": (
        "三千年东方决策传统——时间节律、系统平衡、压力下人如何真正做选择。"
        f'不是摆设式玄学：是对分叉、时机与后果的<{G}>结构</span>视角。'
    ),
    "modernTitle": "现代研究",
    "modernBody": (
        "认知科学、决策心理与时间生物节律作校验——不是贴牌。"
        "站得住的规律留下，站不住的空仪式丢掉。"
    ),
    "aiTitle": "动态转译",  # keep existing title
    "aiBody": (
        f'把模型里的结构信号，与<{G}>你的本案</span>经语言引擎对照——'
        f'收成围绕<{G}>这一次</span>决定的路径、取舍与报告——不是千人一面的填空模板。'
    ),
    "summary": (
        f'这是一套<{G}>结构化决策模型</span>——东方结构、步骤明确、方法可复现。'
        f'<{G}>不是</span>算命。<{G}>不是</span>占卜。<{G}>不是</span>命运预测。'
    ),
    "notice": (
        "为你仍握在手里的高风险决定而建。我们给建议，决定权在你。"
        "非医疗、法律或投资建议——也不承诺任何人生结果。"
    ),
}

# es/fr: only summary + notice (deterministic/fortune-promise lines)
ES_BOTTOM = {
    "summary": (
        f'Este es un <{G}>modelo de decisión estructurado</span>—estructura oriental, pasos explícitos, '
        f'método repetible. <{G}>No</span> es adivinación. <{G}>No</span> es divinación. '
        f'<{G}>No</span> es predicción del destino.'
    ),
    "notice": (
        "Hecho para decisiones de alto riesgo que siguen siendo tuyas. Nosotros aconsejamos; tú decides. "
        "No es consejo médico, legal ni financiero—y no es una promesa de ningún resultado de vida."
    ),
}

FR_BOTTOM = {
    "summary": (
        f'Ceci est un <{G}>modèle de décision structuré</span>—structure orientale, étapes explicites, '
        f'méthode reproductible. <{G}>Pas</span> de voyance. <{G}>Pas</span> de divination. '
        f'<{G}>Pas</span> de prédiction du destin.'
    ),
    "notice": (
        "Conçu pour les décisions à enjeux élevés que vous gardez entre vos mains. Nous conseillons ; vous décidez. "
        "Ce n'est pas un avis médical, juridique ou financier—et ce n'est la promesse d'aucun résultat de vie."
    ),
}

# --- parse & update BUILT_COPY ---
start = text.find("const BUILT_COPY = {")
if start < 0:
    raise SystemExit("BUILT_COPY not found")
brace = text.find("{", start)
depth = 0
end = None
for k in range(brace, len(text)):
    if text[k] == "{":
        depth += 1
    elif text[k] == "}":
        depth -= 1
        if depth == 0:
            end = k + 1
            break
if end is None:
    raise SystemExit("unclosed BUILT_COPY")

obj = json.loads(text[brace:end])

for key, val in EN.items():
    obj["en"][key] = val
for key, val in ZH.items():
    obj["zh"][key] = val
for key, val in ES_BOTTOM.items():
    obj["es"][key] = val
for key, val in FR_BOTTOM.items():
    obj["fr"][key] = val

# Preserve unused closing* keys as-is (already in obj)

new_obj = json.dumps(obj, ensure_ascii=False, indent=2)
# match original style: const BUILT_COPY = {\n...}
replacement = "const BUILT_COPY = " + new_obj
text2 = text[:start] + replacement + text[end:]

# --- applicator: allow HTML bold in all built slots ---
old_apply = (
    "if (key === 'heading') el.innerHTML = pack[key];\n"
    "                else el.textContent = pack[key];"
)
new_apply = "el.innerHTML = pack[key];"
if old_apply not in text2:
    raise SystemExit("apply pattern not found")
text2 = text2.replace(old_apply, new_apply, 1)

# --- update static HTML EN defaults (data-built slots) ---
def replace_data_built(html: str, key: str, new_inner: str) -> str:
    """Replace inner HTML/text of first element with data-built=\"key\"."""
    # Match opening tag with data-built, capture tag name, replace until matching close
    pat = re.compile(
        rf'(<(?P<tag>h2|h4|p|div)([^>]*\sdata-built="{re.escape(key)}"[^>]*)>)(.*?)(</(?P=tag)>)',
        re.S,
    )
    m = pat.search(html)
    if not m:
        raise SystemExit(f"static data-built={key} not found")
    return html[: m.start()] + m.group(1) + new_inner + m.group(5) + html[m.end() :]

# Only patch within the methodology section to avoid stray matches
sec_start = text2.find('id="v2-methodology"')
if sec_start < 0:
    raise SystemExit("v2-methodology section not found")
sec_start = text2.rfind("<section", 0, sec_start)
sec_end = text2.find("<section", sec_start + 1)
section = text2[sec_start:sec_end]

static_map = {
    "heading": EN["heading"],
    "intro": EN["intro"],
    "easternTitle": EN["easternTitle"],
    "easternBody": EN["easternBody"],
    "modernTitle": EN["modernTitle"],
    "modernBody": EN["modernBody"],
    "aiTitle": EN["aiTitle"],
    "aiBody": EN["aiBody"],
    "summary": EN["summary"],
    "notice": EN["notice"],
}
for k, v in static_map.items():
    section = replace_data_built(section, k, v)

text2 = text2[:sec_start] + section + text2[sec_end:]

PATH.write_text(text2, encoding="utf-8")

# --- verify ---
checks = [
    ("structured decision model", True),
    ("结构化决策模型", True),
    ("deterministic forecasting", False),  # should be gone from built notice en
    ("确定性的预测", False),
    ("three millennia", True),
    ("三千年", True),
    ("方法论", True),
]
final = PATH.read_text(encoding="utf-8")
# scope checks to BUILT_COPY
b0 = final.find("const BUILT_COPY = {")
b1 = final.find("const ENGINE_COPY", b0)
built = final[b0:b1]
print("BUILT_COPY slice checks:")
for s, want in checks:
    present = s in built
    ok = present if want else (not present)
    print(("OK" if ok else "FAIL"), repr(s), "present="+str(present))

# ensure no Hero pollution
hero_ban = ["千年", "three millennia", "3000"]
# find hero section roughly
print("applicator now:", "el.innerHTML = pack[key];" in final and old_apply not in final)
print("done")
