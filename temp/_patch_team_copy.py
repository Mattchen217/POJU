# -*- coding: utf-8 -*-
"""Patch TEAM_COPY in public/v2-landing.html — Payments harden."""
from pathlib import Path

PATH = Path("public/v2-landing.html")
html = PATH.read_text(encoding="utf-8")
orig = html

# --- Extract TEAM_COPY span for scoped replaces ---
start = html.find("const TEAM_COPY")
if start < 0:
    raise SystemExit("TEAM_COPY not found")
brace = html.find("{", start)
i = brace
depth = 0
while i < len(html):
    if html[i] == "{":
        depth += 1
    elif html[i] == "}":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1
else:
    raise SystemExit("TEAM_COPY brace mismatch")

before = html[:brace]
obj = html[brace:end]
after = html[end:]

def must_replace(text, old, new, label):
    if old not in text:
        raise SystemExit(f"MISSING old string for {label}:\n{old[:120]!r}")
    return text.replace(old, new, 1)

# ========== EN ==========
obj = must_replace(
    obj,
    "From core algorithms to cognitive control: The system design and decision philosophy behind Eastern OS.",
    "From core algorithms to decision framing: the system design and decision philosophy behind Eastern OS.",
    "en.section_subtitle",
)

obj = must_replace(
    obj,
    "When evaluating complex decisions, vague or emotional advice offers no real utility. We engineered the core of Eastern OS with mathematical precision—transforming environmental variables into an objective, deterministic model that delivers trustworthy clarity whenever you face a dilemma.",
    "When evaluating complex decisions, vague or emotional advice offers little real utility. We engineered the core of Eastern OS with careful precision—turning situational factors into a structured decision model that gives clearer reference points whenever you face a dilemma.",
    "en.arthur",
)

# Max EN already Payments tone — leave if identical; verify present
max_en = "At life\u2019s critical intersections—whether navigating career transitions, strategic pivots, or relational synergy—the true challenge is the lack of a systemic picture. We built Eastern OS to deliver a dynamic personal navigation engine, turning raw complexity into structural clarity and grounded confidence."
if max_en not in obj:
    # try straight apostrophe
    max_en_alt = "At life's critical intersections—whether navigating career transitions, strategic pivots, or relational synergy—the true challenge is the lack of a systemic picture. We built Eastern OS to deliver a dynamic personal navigation engine, turning raw complexity into structural clarity and grounded confidence."
    if max_en_alt in obj:
        print("Max EN: already Payments (straight apostrophe)")
    else:
        raise SystemExit("Max EN quote not found as expected")
else:
    print("Max EN: already Payments (curly apostrophe) — leave")

obj = must_replace(
    obj,
    "Missteps rarely come from a lack of capability; they stem from misaligned timing. Eastern OS quantifies subtle environmental cycles into intuitive data insights—helping you calibrate your decision pace so you can seamlessly move with natural momentum.",
    "Missteps rarely come from a lack of capability; they often stem from poorly timed moves. Eastern OS helps you weigh timing, tradeoffs, and consequences as structured inputs—so you can calibrate your decision pace with clearer signals, not guesswork.",
    "en.marcus",
)

obj = must_replace(
    obj,
    "Making major pivots without visibility into risk creates severe resistance. Eastern OS simulates scenario dynamics across different paths, providing actionable playbooks so you can navigate pivotal transitions with complete confidence and strategic clarity.",
    "Making major pivots without visibility into risk creates severe resistance. Eastern OS explores scenario dynamics across different paths and delivers actionable playbooks—so you can navigate pivotal transitions with clearer options and steadier judgment.",
    "en.elena",
)

obj = must_replace(
    obj,
    "When evaluating high-stakes choices, chaotic interfaces only add unnecessary cognitive friction. We sculpted Eastern OS into a serene dark-mode console—stripping away visual clutter and information noise so users can instantly reclaim focus and complete control.",
    "When evaluating high-stakes choices, chaotic interfaces only add unnecessary cognitive friction. We sculpted Eastern OS into a serene dark-mode console—stripping away visual clutter and information noise so users can instantly reclaim focus and a calmer sense of control.",
    "en.maya",
)

# ========== ZH ==========
obj = must_replace(
    obj,
    "从核心算法到认知控制：Eastern OS 的底层设计与决策哲学",
    "从核心算法到决策框架：Eastern OS 的底层设计与决策哲学",
    "zh.section_subtitle",
)

obj = must_replace(
    obj,
    "当你纠结于复杂的抉择时，含糊不清或情绪化的建议毫无帮助。我们以严密的工程精度打造 Eastern OS 的内核，将复杂的环境变数转化为客观确定的计算模型，确保你每次面临难题时都能获得真正值得信赖的参考。",
    "当你纠结于复杂的抉择时，含糊不清或情绪化的建议帮助有限。我们以严密的工程精度打造 Eastern OS 的内核，将情境中的关键因素转化为结构化决策模型，在你面临难题时提供更清晰、可对照的参考。",
    "zh.arthur",
)

obj = must_replace(
    obj,
    "在人生的各个关键节点——无论是战略方向、职业重组还是人际协同，真正的挑战在于缺乏全局视角。我们打造 Eastern OS，正是为了提供一套动态的‘个人决策导航系统’，用严密的结构与清晰度，让每一次重大抉择都有据可依。",
    "在人生的各个关键节点——无论是战略方向、职业重组还是人际协同，真正的挑战在于缺乏全局视角。我们打造 Eastern OS，正是为了提供一套动态的「个人决策导航系统」，用严密的结构与清晰度，让每一次重大抉择都有据可依。",
    "zh.max",
)

obj = must_replace(
    obj,
    "许多挫折并非来自能力不足，而是源于节奏错位。Eastern OS 通过算法将环境的暗涌与周期转化为直观的数据，帮你精准校准行动的节奏与节点，让生活中的‘顺势而为’变得自然而高效。",
    "许多挫折并非来自能力不足，而是源于节奏与时机没对齐。Eastern OS 把时机、取舍与后果收成可对照的结构输入，帮你校准决策节奏与节点——用更清楚的信号，而不是凭感觉硬闯。",
    "zh.marcus",
)

obj = must_replace(
    obj,
    "在看不清前方风险时做出重大改变是极其吃力的。Eastern OS 通过推演不同路径下的局势演变，为你交付具体的行动预案，让你在面对人生重大转折时拥有足够的底气与清晰的选择。",
    "在看不清前方风险时做出重大改变是极其吃力的。Eastern OS 推演不同路径下的局势演变，交付具体的行动预案，让你在重大转折时选项更清楚、判断更稳。",
    "zh.elena",
)
# Maya ZH: keep

# ========== ES (parallel safe wording) ==========
obj = must_replace(
    obj,
    "Desde algoritmos centrales hasta el control cognitivo: El diseño del sistema y la filosofía de decisión tras Eastern OS.",
    "Desde algoritmos centrales hasta el encuadre de decisiones: El diseño del sistema y la filosofía de decisión tras Eastern OS.",
    "es.section_subtitle",
)

obj = must_replace(
    obj,
    "Al evaluar decisiones complejas, los consejos vagos o emocionales no aportan valor real. Diseñamos el núcleo de Eastern OS con precisión matemática, transformando las variables del entorno en un modelo objetivo y determinista que ofrece claridad confiable cada vez que enfrenta un dilema.",
    "Al evaluar decisiones complejas, los consejos vagos o emocionales aportan poca utilidad real. Diseñamos el núcleo de Eastern OS con precisión cuidadosa, convirtiendo los factores situacionales en un modelo de decisión estructurado que ofrece puntos de referencia más claros cada vez que enfrenta un dilema.",
    "es.arthur",
)

obj = must_replace(
    obj,
    "Los tropiezos rara vez provienen de una falta de capacidad; se deben a un ritmo desalineado. Eastern OS cuantifica los ciclos del entorno en análisis de datos intuitivos, ayudándole a calibrar el ritmo de sus decisiones para avanzar de manera fluida y natural.",
    "Los tropiezos rara vez provienen de una falta de capacidad; a menudo se deben a movimientos mal sincronizados. Eastern OS le ayuda a sopesar el timing, las contraprestaciones y las consecuencias como entradas estructuradas, para calibrar el ritmo de sus decisiones con señales más claras, no a ciegas.",
    "es.marcus",
)

obj = must_replace(
    obj,
    "Realizar giros importantes sin visibilidad del riesgo genera una gran resistencia. Eastern OS simula la dinámica de escenarios en diferentes trayectorias, ofreciendo guías de acción concretas para que pueda afrontar las transiciones clave con total confianza y claridad estratégica.",
    "Realizar giros importantes sin visibilidad del riesgo genera una gran resistencia. Eastern OS explora la dinámica de escenarios en diferentes trayectorias y entrega guías de acción concretas, para que pueda afrontar las transiciones clave con opciones más claras y un juicio más firme.",
    "es.elena",
)

obj = must_replace(
    obj,
    "Al evaluar elecciones de alto impacto, las interfaces caóticas solo añaden fricción cognitiva innecesaria. Diseñamos Eastern OS como una consola serena en modo oscuro, eliminando el ruido visual y la redundancia de información para que pueda recuperar al instante el enfoque y el control total.",
    "Al evaluar elecciones de alto impacto, las interfaces caóticas solo añaden fricción cognitiva innecesaria. Diseñamos Eastern OS como una consola serena en modo oscuro, eliminando el ruido visual y la redundancia de información para que pueda recuperar al instante el enfoque y una sensación más serena de control.",
    "es.maya",
)

# ========== FR (parallel safe wording) ==========
obj = must_replace(
    obj,
    "Des algorithmes clés au contrôle cognitif : La conception système et la philosophie de décision derrière Eastern OS.",
    "Des algorithmes clés au cadrage décisionnel : La conception système et la philosophie de décision derrière Eastern OS.",
    "fr.section_subtitle",
)

obj = must_replace(
    obj,
    "Face à des décisions complexes, les conseils flous ou émotionnels n'apportent aucune utilité réelle. Nous avons conçu le cœur d'Eastern OS avec une précision mathématique, transformant les variables environnementales en un modèle objectif et déterministe qui offre une clarté fiable lors de chaque dilemme.",
    "Face à des décisions complexes, les conseils flous ou émotionnels n'offrent que peu d'utilité réelle. Nous avons conçu le cœur d'Eastern OS avec une précision soignée, transformant les facteurs situationnels en un modèle de décision structuré qui offre des points de référence plus clairs face à chaque dilemme.",
    "fr.arthur",
)

obj = must_replace(
    obj,
    "Les faux pas proviennent rarement d'un manque de capacités ; ils découlent d'un mauvais timing. Eastern OS quantifie les cycles environnementaux en données intuitives, vous aidant à calibrer le rythme de vos décisions pour avancer naturellement avec dynamisme.",
    "Les faux pas proviennent rarement d'un manque de capacités ; ils découlent souvent de mouvements mal cadencés. Eastern OS vous aide à peser le timing, les arbitrages et les conséquences comme des entrées structurées—pour calibrer le rythme de vos décisions avec des signaux plus clairs, pas à l'aveugle.",
    "fr.marcus",
)

obj = must_replace(
    obj,
    "Effectuer des changements majeurs sans visibilité sur les risques crée une forte résistance. Eastern OS simule les dynamiques de scénarios sur différents parcours, vous fournissant des plans d\\'action concrets pour aborder les transitions clés en toute confiance et avec une clarté stratégique.",
    "Effectuer des changements majeurs sans visibilité sur les risques crée une forte résistance. Eastern OS explore les dynamiques de scénarios sur différents parcours et fournit des plans d\\'action concrets—pour aborder les transitions clés avec des options plus claires et un jugement plus assuré.",
    "fr.elena",
)

obj = must_replace(
    obj,
    "Lors de choix décisifs, les interfaces chaotiques ne font qu\\'ajouter une friction cognitive inutile. Nous avons façonné Eastern OS comme une console épurée en mode sombre, éliminant le bruit visuel et le surplus d\\'informations pour que vous puissiez instantanément retrouver votre concentration et un contrôle total.",
    "Lors de choix décisifs, les interfaces chaotiques ne font qu\\'ajouter une friction cognitive inutile. Nous avons façonné Eastern OS comme une console épurée en mode sombre, éliminant le bruit visuel et le surplus d\\'informations pour que vous puissiez instantanément retrouver votre concentration et un sentiment plus serein de maîtrise.",
    "fr.maya",
)

html = before + obj + after

# ========== Static HTML default for #v2-team-subtitle ==========
old_sub_html = "From core algorithms to cognitive control: The system design and decision philosophy behind Eastern OS."
new_sub_html = "From core algorithms to decision framing: the system design and decision philosophy behind Eastern OS."
if old_sub_html not in html:
    raise SystemExit("HTML v2-team-subtitle default not found")
# replace remaining occurrences outside already-patched TEAM_COPY (subtitle in TEAM_COPY already new)
count = html.count(old_sub_html)
html = html.replace(old_sub_html, new_sub_html)
print(f"HTML subtitle defaults replaced: {count}")

# Title should already be correct — verify no cognitive control in title id block
if "cognitive control" in html[html.find('id="v2-team-title"'):html.find('id="v2-team-title"')+500]:
    print("WARN: cognitive control still near v2-team-title")

PATH.write_text(html, encoding="utf-8", newline="\n")
print("Wrote", PATH)
print("Bytes delta", len(html.encode("utf-8")) - len(orig.encode("utf-8")))

# Verify forbidden in TEAM_COPY only
# re-extract
brace2 = html.find("{", html.find("const TEAM_COPY"))
i = brace2
depth = 0
while i < len(html):
    if html[i] == "{":
        depth += 1
    elif html[i] == "}":
        depth -= 1
        if depth == 0:
            end2 = i + 1
            break
    i += 1
team_obj = html[brace2:end2]
forbidden = [
    "deterministic",
    "客观确定",
    "确保你每次",
    "environmental cycles",
    "暗涌与周期",
    "顺势而为",
    "complete confidence",
    "cognitive control",
    "认知控制",
    "determinista",
    "déterministe",
    "confianza completa",
    "ciclos ambientales",
    "cycles environnementaux",
    "control cognitivo",
    "contrôle cognitif",
]
print("--- forbidden check in TEAM_COPY ---")
ok = True
for f in forbidden:
    if f in team_obj:
        print("STILL PRESENT:", f)
        ok = False
if ok:
    print("OK: none of forbidden strings remain in TEAM_COPY")

# also check HTML subtitle
import re
m = re.search(r'id="v2-team-subtitle"[^>]*>(.*?)</', html, re.S)
print("HTML subtitle now:", (m.group(1).strip() if m else "?"))
