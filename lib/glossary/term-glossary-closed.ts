/**
 * Closed-set glossary entries (A1–A7) — one independent row per engine-computed term.
 */

import type { GlossaryConcept, Locale } from "@/lib/glossary/term-glossary";

type SoftGloss = { soft: Record<Locale, string>; gloss: Record<Locale, string> };

function sg(
  en: string,
  zh: string,
  es: string,
  fr: string,
  de: string,
  glossEn: string,
  glossZh: string,
  glossEs: string,
  glossFr: string,
  glossDe: string,
): SoftGloss {
  return {
    soft: { en, zh, es, fr, de },
    gloss: { en: glossEn, zh: glossZh, es: glossEs, fr: glossFr, de: glossDe },
  };
}

function ce(id: string, forbidden: string[], soft: SoftGloss, extraForbidden: string[] = []): GlossaryConcept {
  return {
    id,
    surface: "replace",
    forbidden_variants: [...new Set([id, ...forbidden, ...extraForbidden])],
    ...soft,
  };
}

const SHEN_SHA: GlossaryConcept[] = [
  ce("天乙贵人", ["Noble Person", "Benefactor", "Gui Ren", "天乙"], sg(
    "key supporter", "关键支持者", "aliado clave", "soutien clé", "Schlüsselunterstützer",
    "People and openings that show up when you need a hand — mentors, introductions, timely help.",
    "需要援手时会出现的人与机会——引路人、转介绍、及时帮助。",
    "Personas y oportunidades que aparecen cuando necesitas ayuda.",
    "Des personnes et des ouvertures qui apparaissent quand vous avez besoin d'aide.",
    "Menschen und Gelegenheiten, die auftauchen, wenn du Hilfe brauchst.",
  )),
  ce("禄神", ["Lu Shen", "Prosperity Star"], sg(
    "prosperity anchor", "禄位根基", "ancla de prosperidad", "ancre de prospérité", "Wohlstandsanker",
    "A steady baseline of material ease — income rhythm, resources that feel enough when honored.",
    "稳定的物质底气——收入节奏、被善待时就觉得够用的资源。",
    "Una base estable de bienestar material.",
    "Une base stable de confort matériel.",
    "Eine stabile Basis materiellen Wohlbefindens.",
  )),
  ce("飞刃", ["Fei Ren", "Blade Star", "Flying Blade"], sg(
    "double-edged drive", "双刃驱动力", "impulso de filo doble", "pulsion à double tranchant", "zweischneidiger Drang",
    "Sharp decisive force — cuts clutter and guards boundaries when channeled; reckless when unchecked.",
    "锐利决断之力——用得好能砍掉废物、守住边界；失控则伤人伤己。",
    "Fuerza afilada y decisiva que elimina lo superfluo si se canaliza.",
    "Une force tranchante qui élimine le superflu si elle est canalisée.",
    "Scharfe Entschlossenheit, die Ballast abträgt, wenn sie kanalisiert wird.",
  ), ["羊刃", "Yang Ren"]),
  ce("羊刃", ["Yang Ren", "Blade Star", "Flying Blade", "Fei Ren"], sg(
    "double-edged drive", "双刃驱动力", "impulso de filo doble", "pulsion à double tranchant", "zweischneidiger Drang",
    "Sharp decisive force — cuts clutter and guards boundaries when channeled; reckless when unchecked.",
    "锐利决断之力——用得好能砍掉废物、守住边界；失控则伤人伤己。",
    "Fuerza afilada y decisiva que elimina lo superfluo si se canaliza.",
    "Une force tranchante qui élimine le superflu si elle est canalisée.",
    "Scharfe Entschlossenheit, die Ballast abträgt, wenn sie kanalisiert wird.",
  ), ["飞刃"]),
  ce("文昌", ["Wen Chang", "Literary Star"], sg(
    "learning spark", "学习才气", "chispa de aprendizaje", "étincelle d'apprentissage", "Lernfunken",
    "Ease with words, study, and clear thinking — good for writing, exams, and structured learning.",
    "文字、学习与清晰思考较顺手——利于写作、考试、系统学习。",
    "Facilidad con palabras, estudio y pensamiento claro.",
    "Facilité avec les mots, l'étude et la clarté d'esprit.",
    "Leichtigkeit mit Worten, Lernen und klarem Denken.",
  )),
  ce("桃花", ["Peach Blossom", "Tao Hua", "Romance Star"], sg(
    "social magnetism", "社交魅力", "magnetismo social", "magnétisme social", "soziale Ausstrahlung",
    "Charisma and warmth in connection — people notice you, conversations flow easier.",
    "连接里的魅力与温度——更容易被看见、对话更顺。",
    "Carisma y calidez en las conexiones.",
    "Charisme et chaleur dans les relations.",
    "Charisma und Wärme in Verbindungen.",
  )),
  ce("驿马", ["Yi Ma", "Traveling Star", "Horse Star"], sg(
    "mobility pulse", "变动脉动", "pulso de movilidad", "pulsion de mobilité", "Mobilitätspuls",
    "Restless forward motion — travel, job changes, or shaking up a stuck routine.",
    "向前的躁动——出行、换岗、或打破僵住的习惯。",
    "Impulso hacia el movimiento y el cambio de escenario.",
    "Élan vers le mouvement et le changement de cadre.",
    "Drang nach Bewegung und Szenenwechsel.",
  )),
  ce("华盖", ["Hua Gai", "Canopy Star"], sg(
    "creative solitude", "独处创造型", "soledad creativa", "solitude créative", "kreative Zurückgezogenheit",
    "Pull toward deep solo focus — rich for ideas, easy to over-isolate.",
    "偏向深度独处——利于创见，也易过度封闭。",
    "Tendencia al enfoque solitario profundo.",
    "Tendance au focus solitaire profond.",
    "Neigung zu tiefem Solo-Fokus.",
  )),
  ce("孤辰", ["Gu Chen", "Lonely Star"], sg(
    "solo rhythm", "独行节奏", "ritmo solitario", "rythme solitaire", "Solorythmus",
    "Doing things your own way on your own timeline — independence that can feel lonely if unbalanced.",
    "按自己的节奏行事——独立感强，失衡时易显孤单。",
    "Hacer las cosas a tu manera y en tu tiempo.",
    "Agir à votre rythme et à votre manière.",
    "Dinge auf eigene Weise und im eigenen Tempo tun.",
  )),
  ce("寡宿", ["Gua Su", "Widow Star"], sg(
    "independent streak", "独立倾向", "racha independiente", "trait d'indépendance", "unabhängige Note",
    "Self-reliance and emotional self-containment — strong boundaries, less need for constant company.",
    "自立与情感自持——边界清楚，不太依赖随时有人陪着。",
    "Autosuficiencia y contención emocional.",
    "Autosuffisance et contenance émotionnelle.",
    "Selbstständigkeit und emotionale Selbstbeherrschung.",
  )),
  ce("将星", ["General Star", "Jiang Xing"], sg(
    "leadership pulse", "统摄力", "pulso de liderazgo", "pulsion de leadership", "Führungspuls",
    "Organizing and holding the center when stakes are real — others look to you to set direction.",
    "在 stakes 真实时统摄中心——他人会向你找方向。",
    "Capacidad de organizar y sostener el centro.",
    "Capacité à organiser et tenir le centre.",
    "Fähigkeit, Mitte zu halten und zu ordnen.",
  )),
  ce("劫煞", ["Robbery Sha", "Jie Sha"], sg(
    "sudden friction", "突发阻力", "fricción súbita", "friction soudaine", "plötzliche Reibung",
    "External jolts and contested resources — plan buffers, don't react on impulse.",
    "外部突发与资源争夺——留缓冲，别冲动反应。",
    "Sacudidas externas y recursos disputados.",
    "Secousses externes et ressources disputées.",
    "Externe Stöße und umkämpfte Ressourcen.",
  )),
  ce("亡神", ["Lost Spirit", "Wang Shen"], sg(
    "inner drift", "内耗漂移", "deriva interior", "dérive intérieure", "innere Drift",
    "Mind loops and over-calculation — clarity needs a concrete next step, not more scenarios.",
    "思虑打圈、过度推演——要具体下一步，不是更多剧本。",
    "Bucles mentales y sobre-cálculo.",
    "Boucles mentales et sur-calcul.",
    "Gedankenschleifen und Über-Kalkulation.",
  )),
  ce("灾煞", ["Disaster Sha", "Zai Sha"], sg(
    "stress spike", "压力尖峰", "pico de estrés", "pic de stress", "Stressspitze",
    "Periods when small errors compound — slow down checks on money, health routines, and commitments.",
    "小错易叠加的时段——钱、作息、承诺都要放慢核对。",
    "Periodos en que los errores se acumulan.",
    "Périodes où les erreurs s'accumulent.",
    "Phasen, in denen Fehler sich stapeln.",
  )),
  ce("国印", ["State Seal", "Guo Yin"], sg(
    "institutional trust", "制度信用", "confianza institucional", "confiance institutionnelle", "institutionelles Vertrauen",
    "Fit with formal roles, credentials, and steady authority — build reputation through reliability.",
    "适配正式角色、资质与稳态权威——靠可靠度攒声望。",
    "Encaje con roles formales y credenciales.",
    "Alignement avec rôles formels et crédits.",
    "Passung zu formalen Rollen und Credentials.",
  )),
  ce("金舆", ["Golden Carriage", "Jin Yu"], sg(
    "comfort buffer", "舒适缓冲", "colchón de confort", "coussin de confort", "Komfortpuffer",
    "Material ease and mobility support — invest in tools and environments that reduce friction.",
    "物质便利与移动支持——投在减摩擦的工具与环境。",
    "Facilidad material y apoyo a la movilidad.",
    "Aisance matérielle et soutien à la mobilité.",
    "Materielle Leichtigkeit und Mobilität.",
  )),
  ce("天德", ["Heaven Virtue", "Tian De"], sg(
    "grace window", "德性窗口", "ventana de gracia", "fenêtre de grâce", "Gnadenfenster",
    "Moments when goodwill and repair come easier — use them to mend, not to push luck.",
    " goodwill 与修复较易的窗口——用来修补，不是用来赌运。",
    "Momentos en que reparar es más fácil.",
    "Moments où réparer est plus facile.",
    "Momente, in denen Reparatur leichter fällt.",
  )),
  ce("月德", ["Moon Virtue", "Yue De"], sg(
    "soft landing", "柔和着陆", "aterrizaje suave", "atterrissage doux", "weiche Landung",
    "Gentler emotional climate — good for reconciliation and patient progress.",
    "情绪气候较柔——利于和解与耐心推进。",
    "Clima emocional más suave.",
    "Climat émotionnel plus doux.",
    "Sanfteres emotionales Klima.",
  )),
  ce("福星贵人", ["Fortune Star", "Fu Xing"], sg(
    "lucky helper", "福星助力", "ayuda afortunada", "aide fortunée", "Glückshelfer",
    "Small blessings and helpful coincidences when you stay open and generous.",
    "保持开放与慷慨时的小确幸与巧遇助力。",
    "Pequeñas bendiciones y coincidencias útiles.",
    "Petites grâces et coïncidences utiles.",
    "Kleine Segnungen und hilfreiche Zufälle.",
  )),
  ce("太极贵人", ["Tai Ji Noble", "Tai Ji Gui Ren"], sg(
    "depth mentor", "深缘引路人", "mentor profundo", "mentor profond", "Tiefen-Mentor",
    "Attraction to teachers and traditions that ask you to integrate opposites.",
    "易被要求整合对立面的师承与传统吸引。",
    "Atracción por maestros que integran opuestos.",
    "Attraction pour des maîtres qui intègrent les opposés.",
    "Anziehung zu Lehrern, die Gegensätze integrieren.",
  )),
  ce("天医", ["Heaven Doctor", "Tian Yi"], sg(
    "recovery instinct", "恢复本能", "instinto de recuperación", "instinct de récupération", "Erholungsinstinkt",
    "Natural pull toward rest, routine, and body-aware adjustments when overloaded.",
    "过载时自然倾向休息、节律与身体觉察的调整。",
    "Tendencia natural al descanso y ajustes corporales.",
    "Tendance naturelle au repos et aux ajustements corporels.",
    "Natürliche Neigung zu Ruhe und Körperbewusstsein.",
  )),
  ce("学堂", ["Study Hall", "Xue Tang"], sg(
    "learning seat", "学习位", "asiento de aprendizaje", "siège d'apprentissage", "Lernplatz",
    "Strong appetite for structured study and skill-building when honored.",
    "被善待时有强结构化学习与技能建构欲。",
    "Apetito por estudio estructurado.",
    "Appétit pour l'étude structurée.",
    "Appetit für strukturiertes Lernen.",
  )),
  ce("词馆", ["Literary Hall", "Ci Guan"], sg(
    "articulation seat", "表达位", "asiento de articulación", "siège d'articulation", "Ausdrucksplatz",
    "Voice and wording land with authority when you practice and publish small pieces.",
    "练习与小输出时，表达与措辞更有分量。",
    "La voz gana autoridad con práctica.",
    "La voix gagne en autorité avec la pratique.",
    "Stimme gewinnt Autorität durch Übung.",
  )),
  ce("红鸾", ["Red Luan", "Hong Luan"], sg(
    "bond spark", "情缘火花", "chispa de vínculo", "étincelle de lien", "Bindungsfunke",
    "Warmth and attraction in connection — channel into clear communication, not fantasy.",
    "连接里的温度与吸引——导向清晰沟通，而非幻想。",
    "Calidez y atracción en el vínculo.",
    "Chaleur et attraction dans le lien.",
    "Wärme und Anziehung in Verbindung.",
  )),
  ce("天喜", ["Heaven Joy", "Tian Xi"], sg(
    "celebration breeze", "喜庆风", "brisa de celebración", "brise de célébration", "Feierbrise",
    "Light social openings and reasons to gather — accept invitations that feel grounded.",
    "轻社交开口与相聚理由——接受感觉踏实的邀请。",
    "Aperturas sociales ligeras.",
    "Ouvertures sociales légères.",
    "Leichte soziale Öffnungen.",
  )),
];

const TEN_GODS: GlossaryConcept[] = [
  ce("比肩", ["Companion Star", "Peer Star"], sg("peer mirror", "同气并肩", "espejo de pares", "miroir des pairs", "Peer-Spiegel", "Same-wavelength energy with equals.", "同频能量——与同类并肩。", "Energía con iguales.", "Énergie avec ses pairs.", "Gleichwellige Energie.")),
  ce("劫财", ["Rob Wealth", "Jie Cai"], sg("shared stakes", "分担拉扯", "intereses compartidos", "enjeux partagés", "geteilte Einsätze", "Resources tangled with others.", "与他人的资源缠在一起。", "Recursos enredados.", "Ressources entremêlées.", "Verflochtene Ressourcen.")),
  ce("食神", ["Eating God", "Shi Shen"], sg("expressive ease", "表达从容", "expresión fluida", "expression fluide", "ausdrucksvolle Leichtigkeit", "Natural creativity when relaxed.", "放松时创造力自然流动。", "Creatividad natural.", "Créativité naturelle.", "Natürliche Kreativität.")),
  ce("伤官", ["Hurting Officer", "Shang Guan"], sg("sharp expression", "锋芒表达", "expresión afilada", "expression incisive", "scharfer Ausdruck", "Bold non-conformist voice.", "大胆、不随大流的发声。", "Voz audaz.", "Voix audacieuse.", "Kühne Stimme.")),
  ce("偏财", ["Indirect Wealth", "Pian Cai"], sg("flexible gain", "灵活进账", "ganancia flexible", "gain flexible", "flexibler Zugewinn", "Side income and quick turns.", "副业与机会财。", "Ingresos laterales.", "Revenus annexes.", "Nebeneinkünfte.")),
  ce("正财", ["Direct Wealth", "Zheng Cai"], sg("steady income", "稳定进账", "ingreso estable", "revenu stable", "stabiles Einkommen", "Earned reliable money rhythm.", "劳动换来的稳定钱流。", "Ingreso estable.", "Revenu stable.", "Stabiles Einkommen.")),
  ce("七杀", ["Seven Killings", "Qi Sha"], sg("external pressure", "外部压力", "presión externa", "pression externe", "äußerer Druck", "High-stakes push from outside.", "来自外部的高压。", "Presión externa.", "Pression externe.", "Druck von außen.")),
  ce("正官", ["Direct Officer", "Zheng Guan"], sg("order and duty", "秩序与责任", "orden y deber", "ordre et devoir", "Ordnung und Pflicht", "Rules, roles, accountability.", "规则、角色与责任。", "Reglas y roles.", "Règles et rôles.", "Regeln und Rollen.")),
  ce("偏印", ["Indirect Resource", "Pian Yin"], sg("sideways learning", "旁路学习", "aprendizaje lateral", "apprentissage latéral", "seitliches Lernen", "Unusual mentors and niche knowledge.", "非常规导师与小众知识。", "Aprendizaje lateral.", "Apprentissage latéral.", "Seitliches Lernen.")),
  ce("正印", ["Direct Resource", "Zheng Yin"], sg("steady support", "稳定支持力", "apoyo estable", "soutien stable", "beständige Stütze", "Structured care and learning.", "有结构的照护与学习。", "Apoyo estructurado.", "Soutien structuré.", "Strukturierte Stütze.")),
];

const LIFE_STAGE_ROWS: Array<
  [string, string, string, string, string, string, string, string, string, string, string]
> = [
  ["长生", "fresh start", "新生起步", "nuevo comienzo", "Neuanfang", "nouveau départ", "Like a seed breaking soil — new phase, fragile but full of potential.", "如种子破土——新阶段，潜力大但脆弱。", "Como una semilla rompiendo tierra — fase nueva, frágil pero con potencial.", "Wie ein Keimling — neue Phase, empfindlich, aber voll Potenzial.", "Comme une graine qui perce — phase nouvelle, fragile mais pleine de potentiel."],
  ["沐浴", "reset phase", "洗礼调整", "fase de reinicio", "Reset-Phase", "phase de reset", "Like a shower after a long trip — shedding, sensitive.", "如长途后洗澡——脱旧感，敏感。", "Como una ducha tras un viaje largo — soltar, sensible.", "Wie eine Dusche nach langer Reise — Ablegen, sensibel.", "Comme une douche après un long trajet — lâcher prise, sensible."],
  ["冠带", "stepping up", "整装上岗", "asumir el rol", "in die Rolle treten", "prendre le rôle", "Like getting your first uniform — stepping into a role.", "如第一次穿上制服——进入角色。", "Como tu primer uniforme — entrar en un rol.", "Wie die erste Uniform — in eine Rolle eintreten.", "Comme le premier uniforme — entrer dans un rôle."],
  ["临官", "in charge", "当家掌权", "al mando", "verantwortlich", "aux commandes", "Like running your own shift — others rely on you.", "如自己带班——他人会依赖你。", "Como llevar tu propio turno — otros dependen de ti.", "Wie die eigene Schicht führen — andere verlassen sich auf dich.", "Comme gérer votre propre vacation — les autres comptent sur vous."],
  ["帝旺", "peak strength", "巅峰状态", "pico de fuerza", "Peakkraft", "force de pic", "Like mid-season form — energy high, don't burn out.", "如赛季中段状态——能量高，别透支。", "Como forma a mitad de temporada — energía alta, no te quemes.", "Wie Hochform in der Saisonmitte — viel Energie, nicht ausbrennen.", "Comme la forme en mi-saison — énergie haute, ne vous épuisez pas."],
  ["衰", "easing off", "退潮放缓", "aflojando", "nachlassen", "ralentir", "Like after the holiday rush — pace must soften.", "如旺季过后——节奏要放缓。", "Como después de la temporada alta — el ritmo debe suavizarse.", "Wie nach dem Feiertagsrummel — Tempo drosseln.", "Comme après la ruée des fêtes — le rythme doit adoucir."],
  ["病", "running low", "精力下滑", "energía baja", "Energie niedrig", "énergie basse", "Like a phone at 15% — conserve, avoid heavy loads.", "如手机剩15%——省电、别扛重。", "Como un móvil al 15% — conserva, evita cargas pesadas.", "Wie ein Akku bei 15% — schonen, schwere Lasten meiden.", "Comme un téléphone à 15% — économisez, évitez les lourdes charges."],
  ["死", "closed chapter", "收束阶段", "capítulo cerrado", "abgeschlossenes Kapitel", "chapitre clos", "Like closing for renovation — endings make space.", "如关店装修——结束为腾出空间。", "Como cerrar por reforma — los finales abren espacio.", "Wie schließen für Renovation — Enden schaffen Raum.", "Comme fermer pour rénovation — les fins font de la place."],
  ["墓", "storage mode", "库存沉淀", "modo almacén", "Speichermodus", "mode stockage", "Like winter inventory — hold and review.", "如冬藏——盘点、别强推。", "Como inventario de invierno — guarda y revisa.", "Wie Winterinventar — halten und prüfen.", "Comme un inventaire d'hiver — tenir et revoir."],
  ["绝", "bare minimum", "极简归零", "mínimo esencial", "Minimum", "minimum vital", "Like an empty shelf — strip to essentials.", "如空架——只留必要。", "Como un estante vacío — quédate con lo esencial.", "Wie ein leeres Regal — auf Wesentliches reduzieren.", "Comme une étagère vide — aller à l'essentiel."],
  ["胎", "gestation", "孕育酝酿", "gestación", "Keimen", "gestation", "Like an idea in a notebook — forming quietly.", "如笔记本里的点子——悄悄成形。", "Como una idea en un cuaderno — formándose en silencio.", "Wie eine Idee im Notizbuch — still wachsend.", "Comme une idée dans un carnet — qui se forme en silence."],
  ["养", "nurturing", "滋养培育", "nutrición", "Nähren", "nourrir", "Like watering seedlings — small care feeds the next rise.", "如浇苗——小照料换下一波生长。", "Como regar plantones — el pequeño cuidado alimenta el siguiente crecimiento.", "Wie Setzlinge gießen — kleine Pflege nährt den nächsten Aufstieg.", "Comme arroser des semis — un petit soin nourrit la prochaine poussée."],
];

const LIFE_STAGES: GlossaryConcept[] = LIFE_STAGE_ROWS.map(
  ([han, en, zh, es, de, fr, glossEn, glossZh, glossEs, glossDe, glossFr]) =>
    // Row order after zh soft: es, de, fr soft, then glossEn/Zh/Es/De/Fr.
    ce(han, [], sg(en, zh, es, fr, de, glossEn, glossZh, glossEs, glossFr, glossDe)),
);

function stemEntry(
  stem: string,
  en: string,
  zh: string,
  es: string,
  de: string,
  fr: string,
  glossEn: string,
  glossZh: string,
  glossEs: string,
  glossDe: string,
  glossFr: string,
): GlossaryConcept {
  return ce(stem, [stem], sg(en, zh, es, fr, de, glossEn, glossZh, glossEs, glossFr, glossDe));
}

const STEMS: GlossaryConcept[] = [
  stemEntry("甲", "Jia wood", "甲木启发", "madera Jia", "Jia-Holz", "bois Jia", "Yang Wood — initiating, upward.", "阳木——启动向上。", "Madera yang — inicio ascendente.", "Yang-Holz — startet aufwärts.", "Bois yang — élan vers le haut."),
  stemEntry("乙", "Yi wood", "乙木柔韧", "madera Yi", "Yi-Holz", "bois Yi", "Yin Wood — flexible growth.", "阴木——柔韧生长。", "Madera yin — crecimiento flexible.", "Yin-Holz — flexibles Wachstum.", "Bois yin — croissance souple."),
  stemEntry("丙", "Bing fire", "丙火外显", "fuego Bing", "Bing-Feuer", "feu Bing", "Yang Fire — visible heat.", "阳火——外显热度。", "Fuego yang — calor visible.", "Yang-Feuer — sichtbare Hitze.", "Feu yang — chaleur visible."),
  stemEntry("丁", "Ding fire", "丁火内焰", "fuego Ding", "Ding-Feuer", "feu Ding", "Yin Fire — steady inner flame.", "阴火——稳定内焰。", "Fuego yin — llama interior estable.", "Yin-Feuer — stetige innere Flamme.", "Feu yin — flamme intérieure stable."),
  stemEntry("戊", "Wu earth", "戊土厚载", "tierra Wu", "Wu-Erde", "terre Wu", "Yang Earth — mountain, structure.", "阳土——山、结构。", "Tierra yang — montaña, estructura.", "Yang-Erde — Berg, Struktur.", "Terre yang — montagne, structure."),
  stemEntry("己", "Ji earth", "己土滋养", "tierra Ji", "Ji-Erde", "terre Ji", "Yin Earth — soil, nurture.", "阴土——土壤、滋养。", "Tierra yin — suelo, nutrición.", "Yin-Erde — Boden, Nährung.", "Terre yin — sol, nutrition."),
  stemEntry("庚", "Geng metal", "庚金锋利", "metal Geng", "Geng-Metall", "métal Geng", "Yang Metal — blade, standards.", "阳金——刀锋、标准。", "Metal yang — filo, estándares.", "Yang-Metall — Klinge, Maßstäbe.", "Métal yang — lame, standards."),
  stemEntry("辛", "Xin metal", "辛金精炼", "metal Xin", "Xin-Metall", "métal Xin", "Yin Metal — jewel, refinement.", "阴金——珠宝、精炼。", "Metal yin — joya, refinamiento.", "Yin-Metall — Juwel, Verfeinerung.", "Métal yin — joyau, raffinement."),
  stemEntry("壬", "Ren water", "壬水奔流", "agua Ren", "Ren-Wasser", "eau Ren", "Yang Water — river flow.", "阳水——江河流动。", "Agua yang — flujo de río.", "Yang-Wasser — Flusslauf.", "Eau yang — flux de rivière."),
  stemEntry("癸", "Gui water", "癸水静深", "agua Gui", "Gui-Wasser", "eau Gui", "Yin Water — rain, quiet depth.", "阴水——雨、静深。", "Agua yin — lluvia, profundidad quieta.", "Yin-Wasser — Regen, stille Tiefe.", "Eau yin — pluie, profondeur calme."),
];

function branchEntry(
  branch: string,
  en: string,
  zh: string,
  es: string,
  de: string,
  fr: string,
  glossEn: string,
  glossZh: string,
  glossEs: string,
  glossDe: string,
  glossFr: string,
): GlossaryConcept {
  return ce(branch, [branch], sg(en, zh, es, fr, de, glossEn, glossZh, glossEs, glossFr, glossDe));
}

const BRANCHES: GlossaryConcept[] = [
  branchEntry("子", "Zi water", "子水位", "rama Zi", "Zi-Zweig", "branche Zi", "Midnight water — cycle start.", "子夜水——周期始。", "Agua de medianoche — inicio de ciclo.", "Mitternachtswasser — Zyklusbeginn.", "Eau de minuit — début de cycle."),
  branchEntry("丑", "Chou earth", "丑土积", "rama Chou", "Chou-Zweig", "branche Chou", "Stored earth — slow build.", "藏土——慢积。", "Tierra almacenada — construcción lenta.", "Gespeicherte Erde — langsamer Aufbau.", "Terre stockée — construction lente."),
  branchEntry("寅", "Yin wood", "寅木起", "rama Yin", "Yin-Zweig", "branche Yin", "Spring wood — bold start.", "春木——勇起。", "Madera de primavera — inicio audaz.", "Frühlingsholz — mutiger Start.", "Bois de printemps — départ audacieux."),
  branchEntry("卯", "Mao wood", "卯木开", "rama Mao", "Mao-Zweig", "branche Mao", "Soft wood — social spring.", "柔木——社交春。", "Madera suave — primavera social.", "Weiches Holz — sozialer Frühling.", "Bois souple — printemps social."),
  branchEntry("辰", "Chen earth", "辰土转", "rama Chen", "Chen-Zweig", "branche Chen", "Damp earth — transition.", "湿土——过渡。", "Tierra húmeda — transición.", "Feuchte Erde — Übergang.", "Terre humide — transition."),
  branchEntry("巳", "Si fire", "巳火藏", "rama Si", "Si-Zweig", "branche Si", "Hidden fire — strategy.", "藏火——谋略。", "Fuego oculto — estrategia.", "Verborgenes Feuer — Strategie.", "Feu caché — stratégie."),
  branchEntry("午", "Wu fire", "午火峰", "rama Wu", "Wu-Zweig", "branche Wu", "Noon fire — peak visibility.", "午火——可见之巅。", "Fuego del mediodía — máxima visibilidad.", "Mittagsfeuer — höchste Sichtbarkeit.", "Feu de midi — visibilité maximale."),
  branchEntry("未", "Wei earth", "未土收", "rama Wei", "Wei-Zweig", "branche Wei", "Summer earth — harvest prep.", "夏土——收前准备。", "Tierra de verano — prep. de cosecha.", "Sommererde — Erntevorbereitung.", "Terre d'été — préparation de récolte."),
  branchEntry("申", "Shen metal", "申金变", "rama Shen", "Shen-Zweig", "branche Shen", "Metal shift — agile change.", "金气转——灵动变。", "Cambio metálico — cambio ágil.", "Metallwechsel — agiler Wandel.", "Virage métal — changement agile."),
  branchEntry("酉", "You metal", "酉金序", "rama You", "You-Zweig", "branche You", "Pure metal — order.", "纯金——秩序。", "Metal puro — orden.", "Reines Metall — Ordnung.", "Métal pur — ordre."),
  branchEntry("戌", "Xu earth", "戌土守", "rama Xu", "Xu-Zweig", "branche Xu", "Dry earth — guard.", "燥土——守。", "Tierra seca — custodia.", "Trockene Erde — Wache.", "Terre sèche — garde."),
  branchEntry("亥", "Hai water", "亥水休", "rama Hai", "Hai-Zweig", "branche Hai", "Winter water — rest before renewal.", "冬水——更新前休。", "Agua de invierno — descanso antes de renovar.", "Winterwasser — Ruhe vor Erneuerung.", "Eau d'hiver — repos avant renouveau."),
];

const STRUCTURAL: GlossaryConcept[] = [
  ce("日主", ["Day Master", "day master"], sg("core nature", "核心特质", "naturaleza esencial", "nature profonde", "Urnatur", "Central signature of your profile.", "能量画像的中枢特质。", "Firma central.", "Signature centrale.", "Zentrale Signatur.")),
  ce("用神", ["Yong Shen", "Useful God", "yong shen"], sg("key balancing element", "关键平衡能量", "energía clave", "énergie clé", "Schlüsselenergie", "What restores balance when over-extended.", "过度消耗时靠它回血。", "Equilibrio.", "Équilibre.", "Ausgleich.")),
  ce("喜神", ["Xi Shen", "Favorable God"], sg("beneficial quality", "有利特质", "cualidad beneficiosa", "qualité bénéfique", "vorteilhafte Eigenschaft", "Supportive constructive momentum.", "带来建设性推力的支持。", "Apoyo.", "Soutien.", "Stütze.")),
  ce("忌神", ["Ji Shen", "Unfavorable Element", "仇神"], sg("quality to watch", "需留意的特质", "cualidad a vigilar", "qualité à surveiller", "zu beachtende Eigenschaft", "Over-emphasized trait when excessive.", "过载时易出问题的特质。", "Exceso.", "Excès.", "Übermaß.")),
  ce("身强", ["Strong Self", "身旺"], sg("deep fuel reserves", "燃料底盘充沛", "reservas profundas", "réserves profondes", "tiefe Reserven", "Deep inner reserves — can carry load.", "内在底气足——能扛事。", "Reservas profundas.", "Réserves profondes.", "Tiefe Reserven.")),
  ce("身弱", ["Weak Self"], sg("fuel runs short easily", "燃料容易跟不上", "combustible corto", "carburant limité", "Treibstoff knapper", "Energy depletes faster — pace and allies matter.", "能量消耗快——靠节奏与盟友。", "Ritmo clave.", "Rythme clé.", "Tempo zählt.")),
  ce("平衡", ["Balanced", "中和"], sg("balanced baseline", "平衡型", "equilibrio", "équilibre", "Balance", "Neither extreme — adapt by context.", "非极端——随境调整。", "Adaptación.", "Adaptation.", "Anpassung.")),
  ce("格局", ["Ge Ju", "Geju"], sg("personality pattern", "性格模式", "patrón", "profil", "Muster", "Overarching cognitive blueprint style.", "整体认知蓝图风格。", "Estilo cognitivo.", "Style cognitif.", "Kognitiver Stil.")),
  ce("大运", ["Da Yun", "Luck Pillar", "Major Luck"], sg("current phase climate", "当前阶段气候", "clima de fase", "climat de phase", "Phasenklima", "Longer chapter you are moving through.", "正在经历的较长章节。", "Capítulo largo.", "Chapitre long.", "Langes Kapitel.")),
  ce("流年", ["Liu Nian", "Fleeting Year"], sg("current temporal efficacy", "当前时空效能", "eficacia temporal", "efficacité temporelle", "Zeiteffizienz", "Annual window on your life phase.", "叠在大运上的年度窗口。", "Ventana anual.", "Fenêtre annuelle.", "Jahresfenster.")),
  ce("八字", ["Bazi", "BaZi", "Four Pillars"], sg("personality profile", "性格画像", "perfil", "profil", "Profil", "Behavioral map from birth alignment.", "出生时空的行为地图。", "Mapa conductual.", "Cartographie.", "Verhaltensmodell.")),
  ce("四柱", ["Four Pillars"], sg("personality structure", "性格结构", "estructura", "structure", "Struktur", "Four layers of life conditioning.", "四层生命条件交织。", "Cuatro capas.", "Quatre couches.", "Vier Ebenen.")),
  ce("命盘", ["natal chart", "birth chart", "命局"], sg("personality profile", "性格画像", "perfil", "profil", "Profil", "Full matrix of trait interactions.", "特质相互作用的全景矩阵。", "Matriz completa.", "Matrice complète.", "Vollständige Matrix.")),
  ce("天干", ["Heavenly Stem", "heavenly stem"], sg("active trait layer", "显性特质层", "capa activa", "couche active", "aktive Schicht", "Conscious visible layer.", "向外展现的层面。", "Capa visible.", "Couche visible.", "Sichtbare Ebene.")),
  ce("地支", ["Earthly Branch", "earthly branch"], sg("inner trait layer", "隐性特质层", "capa interior", "couche intérieure", "innere Schicht", "Subconscious foundation.", "深层动机与驱动。", "Capa interior.", "Couche intérieure.", "Innere Ebene.")),
  ce("藏干", ["Hidden Stem", "hidden stem"], sg("inner support stem", "藏干支持", "tallo oculto", "tige cachée", "verborgener Stamm", "Hidden stems inside a branch.", "藏在地支里的辅助天干。", "Tallo oculto.", "Tige cachée.", "Verborgener Stamm.")),
  ce("配偶宫", ["marriage palace", "spouse palace", "夫妻宫"], sg("partner-role pattern", "伴侣角色模式", "patrón de pareja", "modèle partenaire", "Partnermuster", "Baseline for intimate partnership.", "亲密关系的心理基准。", "Base de pareja.", "Base partenaire.", "Partnerschaftsbasis.")),
];

const MATCH_RELATIONS: GlossaryConcept[] = [
  ce("六合", ["Liu He", "Six Harmonies"], sg("natural affinity", "自然契合", "afinidad", "affinité", "Affinität", "Deep resonance — trust comes easier.", "深层共振——信任更容易。", "Resonancia.", "Résonance.", "Resonanz.")),
  ce("六冲", ["Liu Chong", "Six Clashes", "Chong"], sg("direct clash", "正面冲撞", "choque", "choc", "Zusammenstoß", "Head-on friction in timing or style.", "正面摩擦——需经营。", "Fricción frontal.", "Friction frontale.", "Frontale Reibung.")),
  ce("三刑", ["San Xing", "Punishment", "Xing"], sg("tension triangle", "三角张力", "tensión", "tension", "Spannung", "Three-way psychological friction.", "三方心理摩擦。", "Fricción triple.", "Friction triple.", "Dreifachreibung.")),
  ce("六害", ["Liu Hai", "Harm", "Hai"], sg("subtle friction", "暗耗摩擦", "fricción sutil", "friction subtile", "subtile Reibung", "Slow drain between two people.", "两人之间慢耗。", "Desgaste lento.", "Usure lente.", "Langsamer Verschleiß.")),
  ce("三合", ["San He", "Three Harmonies"], sg("triple alliance", "三合联盟", "alianza", "alliance", "Bündnis", "Three branches forming combined momentum.", "三支合力成势。", "Alianza triple.", "Alliance triple.", "Dreierbündnis.")),
];

export const CLOSED_SET_GLOSSARY_ENTRIES: GlossaryConcept[] = [
  ...SHEN_SHA,
  ...TEN_GODS,
  ...LIFE_STAGES,
  ...STEMS,
  ...BRANCHES,
  ...STRUCTURAL,
  ...MATCH_RELATIONS,
];

export const SUPERSEDED_GLOSSARY_IDS = new Set([
  "十神", "正财偏财", "正官偏官", "正印偏印", "比肩劫财", "神煞", "贵人",
  "大运流年", "害冲", "刑", "合冲刑害", "配偶星", "宜婚不宜婚", "干支名", "柱",
]);
