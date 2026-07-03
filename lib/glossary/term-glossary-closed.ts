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

const LIFE_STAGE_ROWS: Array<[string, string, string, string, string]> = [
  ["长生", "fresh start", "新生起步", "Like a seed breaking soil — new phase, fragile but full of potential.", "如种子破土——新阶段，潜力大但脆弱。"],
  ["沐浴", "reset phase", "洗礼调整", "Like a shower after a long trip — shedding, sensitive.", "如长途后洗澡——脱旧感，敏感。"],
  ["冠带", "stepping up", "整装上岗", "Like getting your first uniform — stepping into a role.", "如第一次穿上制服——进入角色。"],
  ["临官", "in charge", "当家掌权", "Like running your own shift — others rely on you.", "如自己带班——他人会依赖你。"],
  ["帝旺", "peak strength", "巅峰状态", "Like mid-season form — energy high, don't burn out.", "如赛季中段状态——能量高，别透支。"],
  ["衰", "easing off", "退潮放缓", "Like after the holiday rush — pace must soften.", "如旺季过后——节奏要放缓。"],
  ["病", "running low", "精力下滑", "Like a phone at 15% — conserve, avoid heavy loads.", "如手机剩15%——省电、别扛重。"],
  ["死", "closed chapter", "收束阶段", "Like closing for renovation — endings make space.", "如关店装修——结束为腾出空间。"],
  ["墓", "storage mode", "库存沉淀", "Like winter inventory — hold and review.", "如冬藏——盘点、别强推。"],
  ["绝", "bare minimum", "极简归零", "Like an empty shelf — strip to essentials.", "如空架——只留必要。"],
  ["胎", "gestation", "孕育酝酿", "Like an idea in a notebook — forming quietly.", "如笔记本里的点子——悄悄成形。"],
  ["养", "nurturing", "滋养培育", "Like watering seedlings — small care feeds the next rise.", "如浇苗——小照料换下一波生长。"],
];

const LIFE_STAGES: GlossaryConcept[] = LIFE_STAGE_ROWS.map(([han, en, zh, glossEn, glossZh]) =>
  ce(han, [], sg(en, zh, en, en, en, glossEn, glossZh, glossEn, glossEn, glossEn)),
);

function stemEntry(stem: string, en: string, zh: string, glossEn: string, glossZh: string): GlossaryConcept {
  return ce(stem, [stem], sg(en, zh, en, en, en, glossEn, glossZh, glossEn, glossEn, glossEn));
}

const STEMS: GlossaryConcept[] = [
  stemEntry("甲", "Jia stem", "甲", "Yang Wood — initiating, upward.", "阳木——启动向上。"),
  stemEntry("乙", "Yi stem", "乙", "Yin Wood — flexible growth.", "阴木——柔韧生长。"),
  stemEntry("丙", "Bing stem", "丙", "Yang Fire — visible heat.", "阳火——外显热度。"),
  stemEntry("丁", "Ding stem", "丁", "Yin Fire — steady inner flame.", "阴火——稳定内焰。"),
  stemEntry("戊", "Wu stem", "戊", "Yang Earth — mountain, structure.", "阳土——山、结构。"),
  stemEntry("己", "Ji stem", "己", "Yin Earth — soil, nurture.", "阴土——土壤、滋养。"),
  stemEntry("庚", "Geng stem", "庚", "Yang Metal — blade, standards.", "阳金——刀锋、标准。"),
  stemEntry("辛", "Xin stem", "辛", "Yin Metal — jewel, refinement.", "阴金——珠宝、精炼。"),
  stemEntry("壬", "Ren stem", "壬", "Yang Water — river flow.", "阳水——江河流动。"),
  stemEntry("癸", "Gui stem", "癸", "Yin Water — rain, quiet depth.", "阴水——雨、静深。"),
];

function branchEntry(branch: string, en: string, zh: string, glossEn: string, glossZh: string): GlossaryConcept {
  return ce(branch, [branch], sg(en, zh, en, en, en, glossEn, glossZh, glossEn, glossEn, glossEn));
}

const BRANCHES: GlossaryConcept[] = [
  branchEntry("子", "Zi branch", "子", "Midnight water — cycle start.", "子夜水——周期始。"),
  branchEntry("丑", "Chou branch", "丑", "Stored earth — slow build.", "藏土——慢积。"),
  branchEntry("寅", "Yin branch", "寅", "Spring wood — bold start.", "春木——勇起。"),
  branchEntry("卯", "Mao branch", "卯", "Soft wood — social spring.", "柔木——社交春。"),
  branchEntry("辰", "Chen branch", "辰", "Damp earth — transition.", "湿土——过渡。"),
  branchEntry("巳", "Si branch", "巳", "Hidden fire — strategy.", "藏火——谋略。"),
  branchEntry("午", "Wu branch", "午", "Noon fire — peak visibility.", "午火——可见之巅。"),
  branchEntry("未", "Wei branch", "未", "Summer earth — harvest prep.", "夏土——收前准备。"),
  branchEntry("申", "Shen branch", "申", "Metal shift — agile change.", "金气转——灵动变。"),
  branchEntry("酉", "You branch", "酉", "Pure metal — order.", "纯金——秩序。"),
  branchEntry("戌", "Xu branch", "戌", "Dry earth — guard.", "燥土——守。"),
  branchEntry("亥", "Hai branch", "亥", "Winter water — rest before renewal.", "冬水——renewal前休。"),
];

const STRUCTURAL: GlossaryConcept[] = [
  ce("日主", ["Day Master", "day master"], sg("core nature", "核心特质", "naturaleza esencial", "nature profonde", "Urnatur", "Central signature of your profile.", "能量画像的中枢特质。", "Firma central.", "Signature centrale.", "Zentrale Signatur.")),
  ce("用神", ["Yong Shen", "Useful God", "yong shen"], sg("key balancing element", "关键平衡能量", "energía clave", "énergie clé", "Schlüsselenergie", "What restores balance when over-extended.", "过度消耗时靠它回血。", "Equilibrio.", "Équilibre.", "Ausgleich.")),
  ce("喜神", ["Xi Shen", "Favorable God"], sg("beneficial quality", "有利特质", "cualidad beneficiosa", "qualité bénéfique", "vorteilhafte Eigenschaft", "Supportive constructive momentum.", "带来建设性推力的支持。", "Apoyo.", "Soutien.", "Stütze.")),
  ce("忌神", ["Ji Shen", "Unfavorable Element", "仇神"], sg("quality to watch", "需留意的特质", "cualidad a vigilar", "qualité à surveiller", "zu beachtende Eigenschaft", "Over-emphasized trait when excessive.", "过载时易出问题的特质。", "Exceso.", "Excès.", "Übermaß.")),
  ce("身强", ["Strong Self", "身旺"], sg("strong constitution", "身强型", "constitución fuerte", "constitution forte", "starke Konstitution", "Deep inner reserves — can carry load.", "内在底气足——能扛事。", "Reservas profundas.", "Réserves profondes.", "Tiefe Reserven.")),
  ce("身弱", ["Weak Self"], sg("lighter constitution", "身弱型", "constitución ligera", "constitution légère", "leichtere Konstitution", "Energy depletes faster — pace and allies matter.", "能量消耗快——靠节奏与盟友。", "Ritmo clave.", "Rythme clé.", "Tempo zählt.")),
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
