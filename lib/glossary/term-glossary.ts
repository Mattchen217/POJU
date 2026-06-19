/**
 * Single source of truth for compliance terminology.
 * @see term-glossary-master（合规主源）.md
 * @see Cursor 指令 - 术语合规引擎 v3.md
 */

export type Locale = "en" | "zh" | "es" | "fr" | "de";
export type Surface = "replace" | "allow" | "delete";

export type GlossaryConcept = {
  id: string;
  surface: Surface;
  forbidden_variants: string[];
  hanzi?: string;
  soft: Record<Locale, string>;
  gloss: Record<Locale, string>;
};

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

const EMPTY_LOCALES: Record<Locale, string> = { en: "", zh: "", es: "", fr: "", de: "" };

export const TERM_GLOSSARY: GlossaryConcept[] = [
  // ── replace: 奇门 / 风水 / core bazi ──
  {
    id: "奇门",
    surface: "replace",
    forbidden_variants: [
      "奇门", "奇门遁甲", "Qimen", "Qi Men Dun Jia", "Dunjia", "遁甲",
      "八门", "九星", "三奇六仪", "飞宫", "局数", "奇门盘",
    ],
    ...sg(
      "Spatiotemporal Vector Engine", "时空向量引擎",
      "Motor de Vectores Espaciotemporales", "Moteur de Vecteurs Spatio-Temporels", "Raum-Zeit-Vektormaschine",
      "An ancient multi-dimensional model mapping how environmental variables, timing, and geographic direction interact. Not a forecast — a decision-support lens that locates the window of least resistance and highest leverage for your current task.",
      "一个将环境变量、时机与方位多维建模的传统决策体系。它不预测宿命，而是帮你为当前任务锁定阻力最小、借力最大的时空窗口。",
      "Un modelo multidimensional ancestral que analiza la interacción entre variables del entorno, sincronía temporal y dirección geográfica. No es un pronóstico, sino una perspectiva de apoyo a la decisión.",
      "Un modèle multidimensionnel ancestral qui cartographie l'interaction entre les variables environnementales, le timing et la direction géographique. Non pas une prédiction, mais un outil d'aide à la décision.",
      "Ein jahrtausendealtes, mehrdimensionales Modell, das das Zusammenspiel von Umweltvariablen, Timing und geografischer Ausrichtung erfasst. Keine Vorhersage – sondern ein Werkzeug zur Entscheidungsunterstützung.",
    ),
  },
  {
    id: "风水",
    surface: "replace",
    forbidden_variants: ["风水", "堪舆", "Feng Shui", "Kan Yu", "峦头", "理气"],
    ...sg(
      "Environmental Resonance Architecture", "环境共振空间学",
      "Arquitectura de Resonancia Ambiental", "Architecture de Résonance Environnementale", "Architektur der Umweltresonanz",
      "The study of how spatial layout, orientation, and environmental flow affect human psychology and decision clarity. It optimizes your surroundings to cut cognitive fatigue and sharpen focus — grounded in environmental psychology, not luck.",
      "研究空间布局、朝向与环境流转如何影响心理与决策清晰度的学科。它优化你身处的环境以降低认知疲劳、提升专注，依据环境心理学，而非运气。",
      "El estudio de cómo la distribución espacial, la orientación y el flujo del entorno afectan la psicología humana y la claridad en las decisiones.",
      "L'étude de l'impact de l'agencement spatial, de l'orientation et des flux environnants sur la psychologie humaine et la clarté décisionnelle.",
      "Die Lehre darüber, wie Raumaufteilung, Ausrichtung und Umgebungsflüsse die menschliche Psychologie und Entscheidungsfindung beeinflussen.",
    ),
  },
  {
    id: "日主",
    surface: "replace",
    forbidden_variants: ["日主", "Day Master", "day master"],
    ...sg(
      "core nature", "核心特质", "naturaleza esencial", "nature profonde", "Urnatur",
      "The central signature of your energy profile — the anchor trait everything else is read against. A lens on temperament.",
      "你能量画像的中枢特质，其余特质都以它为参照，是看性情的视角。",
      "La firma central de tu perfil energético: el rasgo de anclaje con el que se contrasta todo lo demás.",
      "La signature centrale de votre profil énergétique — le trait d'ancrage auquel tout le reste est comparé.",
      "Die zentrale Signatur deines Energieprofils – die Verankerung, an der alles andere gemessen wird.",
    ),
  },
  {
    id: "用神",
    surface: "replace",
    forbidden_variants: ["用神", "Yong Shen", "Useful God", "yong shen"],
    ...sg(
      "key balancing element", "关键平衡能量", "energía de equilibrio clave", "énergie d'équilibre clé", "Schlüsselenergie des Ausgleichs",
      "The quality that brings your profile into balance — what restores you when over-extended. A quality worth cultivating.",
      "让你的画像趋于平衡的能量——过度消耗时靠它回血，是值得养护的倾向。",
      "La cualidad que equilibra tu perfil: aquello que te restaura cuando te excedes.",
      "La qualité qui rétablit l'équilibre de votre profil — ce qui vous régénère en cas de surmenage.",
      "Die Qualität, die dein Profil ins Gleichgewicht bringt – das, was dich bei Überanstrengung regeneriert.",
    ),
  },
  {
    id: "大运",
    surface: "replace",
    forbidden_variants: ["大运", "Da Yun", "Luck Pillar", "Luck Cycle", "Major Luck", "Decade Luck"],
    ...sg(
      "life phase", "人生阶段", "fase vital", "phase de vie", "Lebensphase",
      "The longer chapter of energy you are moving through — a multi-year rhythm that shapes how your traits express over time.",
      "你正在经历的一段较长时序章节——多年节律，影响特质如何随时间展开。",
      "El capítulo energético más largo por el que transitas — un ritmo de varios años.",
      "Le chapitre énergétique plus long que vous traversez — un rythme sur plusieurs années.",
      "Das längere Energiekapitel, das du durchläufst — ein mehrjähriger Rhythmus.",
    ),
  },
  {
    id: "流年",
    surface: "replace",
    forbidden_variants: ["流年", "Liu Nian", "Fleeting Year", "Annual Pillar"],
    ...sg(
      "year's energy", "流年能量", "energía del año", "énergie de l'année", "Jahresenergie",
      "The specific annual window of energy you are navigating right now — a shorter rhythm layered on top of your longer life phase.",
      "你当下正在经历的年度能量窗口——叠在更长人生阶段之上的较短节律。",
      "La ventana anual de energía específica por la que transitas ahora.",
      "La fenêtre énergétique annuelle spécifique que vous traversez en ce moment.",
      "Das spezifische jährliche Energiefenster, das du gerade durchläufst.",
    ),
  },
  {
    id: "大运流年",
    surface: "replace",
    forbidden_variants: [
      "运势", "Fortune", "Luck", "Horoscope trend", "流年大运",
      "life phase theme", "life cycle / life phase", "profile / personality profile",
    ],
    ...sg(
      "life rhythm", "时序周期", "ritmo vital", "rythme temporel", "Zeitrhythmus",
      "The interplay of longer and shorter energy rhythms in your profile — a decision-support lens, not a forecast.",
      "你画像中较长与较短能量节律的交织——决策支持视角，而非预言。",
      "La interacción de ritmos energéticos largos y cortos en tu perfil.",
      "L'interaction des rythmes énergétiques longs et courts dans votre profil.",
      "Das Zusammenspiel längerer und kürzerer Energierhythmen in deinem Profil.",
    ),
  },
  // ── A. 八字 / 排盘 ──
  {
    id: "八字",
    surface: "replace",
    forbidden_variants: ["八字", "Bazi", "BaZi", "Ba Zi", "Four Pillars"],
    ...sg(
      "personality profile", "性格画像", "perfil de personalidad", "profil de personnalité", "Persönlichkeitsprofil",
      "A multi-dimensional behavioral map derived from your initial time-space alignment. It outlines your psychological defaults, core wiring, and cognitive tendencies.",
      "基于你初始时空交点所生成的多维行为地图。它描绘了你的心理默认模式、核心行为逻辑与认知倾向。",
      "Un mapa conductual multidimensional derivado de tu alineación espacio-temporal inicial.",
      "Une cartographie comportementale multidimensionnelle issue de votre alignement spatio-temporel initial.",
      "Ein mehrdimensionales Verhaltensmodell, das aus deiner anfänglichen Raum-Zeit-Ausrichtung abgeleitet wird.",
    ),
  },
  {
    id: "四柱",
    surface: "replace",
    forbidden_variants: ["四柱"],
    ...sg(
      "personality structure", "性格结构", "estructura de la personalidad", "structure de la personnalité", "Persönlichkeitsstruktur",
      "The foundational framework of your psyche, built from four distinct layers of life conditioning (temporal, relational, behavioral, and internal).",
      "你精神世界的底层框架，由四个不同维度的生命条件（时序、关系、行为和内在）交织构建而成。",
      "El marco fundamental de tu psique, construido a partir de cuatro capas distintas de condicionamiento vital.",
      "Le cadre fondateur de votre psyché, construit à partir de quatre couches distinctes de conditionnement de vie.",
      "Das fundamentale Gerüst deiner Psyche, aufgebaut aus vier verschiedenen Ebenen der Lebensprägung.",
    ),
  },
  {
    id: "命盘",
    surface: "replace",
    forbidden_variants: ["命盘", "命局", "natal chart", "birth chart", "in your chart"],
    ...sg(
      "personality profile", "性格画像", "perfil de personalidad", "profil de personnalité", "Persönlichkeitsprofil",
      "The comprehensive visual and analytical matrix that displays how your energy traits interact with each other across different life sectors.",
      "全景式的分析矩阵，直观展示你的各项能量特质在不同生命领域中如何相互作用与交织。",
      "La matriz visual y analítica integral que muestra cómo interactúan tus rasgos energéticos entre sí.",
      "La matrice visuelle et analytique complète qui illustre comment vos traits énergétiques interagissent entre eux.",
      "Die umfassende visuelle und analytische Matrix, die zeigt, wie deine energetischen Eigenschaften miteinander interagieren.",
    ),
  },
  {
    id: "天干",
    surface: "replace",
    forbidden_variants: ["天干", "Heavenly Stem", "heavenly stem"],
    ...sg(
      "core trait", "核心特质", "rasgo principal", "trait principal", "Kerneigenschaft",
      "The conscious, visible layer of your personality. It represents your active expressions, deliberate choices, and the qualities you project outwardly to the world.",
      "你性格中可被显性觉察的层面。它代表了你的主动表达、自觉选择以及你向外界所展现的特质。",
      "La capa consciente y visible de tu personalidad.",
      "La couche consciente et visible de votre personnalité.",
      "Die bewusste, sichtbare Ebene deiner Persönlichkeit.",
    ),
  },
  {
    id: "地支",
    surface: "replace",
    forbidden_variants: ["地支", "Earthly Branch", "earthly branch"],
    ...sg(
      "core trait", "核心特质", "rasgo principal", "trait principal", "Kerneigenschaft",
      "The subconscious, foundational layer of your personality. It governs your deep-seated motivations, emotional reserves, and hidden psychological drivers.",
      "你性格中隐性的底层基础。它决定了你深层的动机、情感储备以及潜意识中的心理驱动力。",
      "La capa subconsciente y fundacional de tu personalidad.",
      "La couche subconsciente et fondamentale de votre personnalité.",
      "Die unterbewusste, fundamentale Ebene deiner Persönlichkeit.",
    ),
  },
  {
    id: "干支名",
    surface: "replace",
    forbidden_variants: ["干支名"],
    ...sg(
      "stem-branch pair", "干支组合", "par tronco-rama", "paire tronc-branche", "Stamm-Zweig-Paar",
      "The specific dynamic quality resulting from the union of active expression and inner motivation during a defined period. It dictates the dominant psychological undertone.",
      "在特定生命周期内，显性表达与内在动机结合后所产生的特定动态。它决定了这一时期占主导地位的心理底色。",
      "La cualidad dinámica específica resultante de la unión entre la expresión activa y la motivación interna durante un periodo definido.",
      "La qualité dynamique spécifique résultant de l'union entre l'expression active et la motivation interne durant une période définie.",
      "Die spezifische dynamische Qualität, die aus der Verbindung von aktivem Ausdruck und innerer Motivation in einem bestimmten Zeitraum entsteht.",
    ),
  },
  {
    id: "柱",
    surface: "replace",
    forbidden_variants: [
      "时柱", "日柱", "月柱", "年柱", "Hour Pillar", "Day Pillar", "Month Pillar", "Year Pillar",
      "hour pillar", "day pillar", "month pillar", "year pillar",
    ],
    ...sg(
      "life phase / profile layer", "人生阶段 / 画像图层",
      "fase de vida / capa del perfil", "phase de vie / couche du profil", "Lebensphase / Profilebene",
      "A specific contextual layer of your psychological map, organizing your traits according to different areas of focus.",
      "你心理地图中特定的情境图层，根据不同的关注领域来组织和划分你的特质。",
      "Una capa contextual específica de tu mapa psicológico.",
      "Une couche contextuelle spécifique de votre carte psychologique.",
      "Eine spezifische kontextuelle Ebene deiner psychologischen Landkarte.",
    ),
  },
  // ── B. 十神 ──
  {
    id: "十神",
    surface: "replace",
    forbidden_variants: ["十神", "Ten Gods"],
    ...sg(
      "relational dynamics", "关系动力", "dinámicas relacionales", "dynamiques relationnelles", "Beziehungsdynamiken",
      "The psychological lenses that govern how you interact with your environment, manage authority, process resources, and connect with other individuals.",
      "决定你如何与环境互动、应对权威、处理资源以及与他人建立连接的心理视角。",
      "Los enfoques psicológicos que rigen cómo interactúas con tu entorno.",
      "Les prismes psychologiques qui régissent votre façon d'interagir avec votre environnement.",
      "Die psychologischen Blickwinkel, die steuern, wie du mit deiner Umwelt interagierst.",
    ),
  },
  {
    id: "七杀",
    surface: "replace",
    forbidden_variants: ["七杀", "Seven Killings"],
    ...sg(
      "external pressure dynamics", "外部压力动力", "dinámica de presión externa", "dynamique de pression externe", "Dynamik des äußeren Drucks",
      "Your behavioral configuration when confronting crisis, high-stakes challenges, or intense external constraints.",
      "你面对危机、高风险挑战或强烈外部束缚时的行为配置。",
      "Tu configuración conductual al enfrentar crisis o desafíos de alto riesgo.",
      "Votre configuration comportementale face aux crises ou aux défis à enjeux élevés.",
      "Deine Verhaltenskonfiguration bei der Bewältigung von Krisen oder großen Herausforderungen.",
    ),
  },
  {
    id: "食神",
    surface: "replace",
    forbidden_variants: ["食神", "Eating God"],
    ...sg(
      "expressive intelligence", "表达型智慧", "inteligencia expresiva", "intelligence expressive", "expressive Intelligenz",
      "The inner urge to create, appreciate, and express ideas in an organic, harmonious, and nourishing manner.",
      "以一种自然、和谐且滋养的方式去创造、欣赏和表达创见。",
      "El impulso interno de crear, apreciar y expresar ideas de manera orgánica y armoniosa.",
      "Le besoin intérieur de créer, d'apprécier et d'exprimer des idées de manière organique et harmonieuse.",
      "Der innere Drang, Ideen auf organische, harmonische und nährende Weise auszudrücken.",
    ),
  },
  {
    id: "伤官",
    surface: "replace",
    forbidden_variants: ["伤官", "Hurting Officer"],
    ...sg(
      "expressive drive", "表达驱动力", "impulso expresivo", "pulsion expressive", "expressiver Drang",
      "A high-intensity creative impulse characterized by non-conformity, sharp critical insight, and a passion for disrupting established structures.",
      "一种高强度的创造性冲动，具有打破常规、敏锐的批判性洞察力以及打破既有结构的激情。",
      "Un impulso creativo de alta intensidad caracterizado por la inconformidad y una aguda visión crítica.",
      "Une impulsion créative de haute intensité caractérisée par le non-conformisme et une vision critique acérée.",
      "Ein hochintensiver kreativer Impuls, geprägt von Nonkonformismus und scharfem kritischen Verstand.",
    ),
  },
  {
    id: "正财偏财",
    surface: "replace",
    forbidden_variants: ["正财", "偏财", "Direct Wealth", "Indirect Wealth"],
    ...sg(
      "resource orientation", "资源取向", "orientación de recursos", "orientation des ressources", "Ressourcenorientierung",
      "Your internal psychology surrounding tangible assets, logistics, and data.",
      "你围绕有形资产、运筹执行和客观数据所产生的内在心理。",
      "Tu psicología interna respecto a los activos tangibles, la logística y los datos.",
      "Votre psychologie interne relative aux actifs tangibles, à la logistique et aux données.",
      "Deine innere Haltung gegenüber materiellen Werten, Logistik und Daten.",
    ),
  },
  {
    id: "正官偏官",
    surface: "replace",
    forbidden_variants: ["正官", "偏官", "Direct Officer", "Indirect Officer"],
    ...sg(
      "structure and authority dynamics", "结构与权威动力",
      "dinámicas de estructura y autoridad", "dynamiques de structure et d'autorité", "Struktur- und Autoritätsdynamiken",
      "How you interact with systematic rules, institutions, and hierarchical order.",
      "你与系统性规则、建制及阶层秩序互动的方式。",
      "Cómo interactúas con las reglas sistemáticas, las instituciones y el orden jerárquico.",
      "Votre façon d'interagir avec les règles régulières, les institutions et l'ordre hiérarchique.",
      "Wie du mit systematischen Regeln, Institutionen und hierarchischer Ordnung interagierst.",
    ),
  },
  {
    id: "正印偏印",
    surface: "replace",
    forbidden_variants: ["正印", "偏印", "Direct Resource", "Indirect Resource"],
    ...sg(
      "support and learning dynamics", "支持与学习动力",
      "dinámicas de apoyo y aprendizaje", "dynamiques de soutien et d'apprentissage", "Unterstützungs- und Lerndynamiken",
      "Your mental mechanisms for processing intake — how you absorb knowledge, receive emotional support, and build intellectual frameworks.",
      "你处理外部输入的精神机制——包括你如何吸收知识、接受情感支持、构建认知框架。",
      "Tus mecanismos mentales para procesar lo que recibes.",
      "Vos mécanismes mentaux pour assimiler les apports externes.",
      "Deine mentalen Mechanismen zur Verarbeitung von Input.",
    ),
  },
  {
    id: "比肩劫财",
    surface: "replace",
    forbidden_variants: ["比肩", "劫财", "Companion", "Rob Wealth"],
    ...sg(
      "peer dynamics", "同侪动力", "dinámicas de pares", "dynamiques de pairs", "Peer-Dynamiken",
      "Your psychological orientation toward equals, competitors, and collaborators.",
      "你面对同等主体、竞争对手以及合作者时的心理取向。",
      "Tu orientación psicológica hacia iguales, competidores y colaboradores.",
      "Votre orientation psychologique envers vos égaux, vos concurrents et vos collaborateurs.",
      "Deine psychologische Haltung gegenüber Gleichgestellten, Konkurrenten und Partnern.",
    ),
  },
  // ── D. 喜忌 ──
  {
    id: "忌神",
    surface: "replace",
    forbidden_variants: ["忌神", "Ji Shen", "Unfavorable Element", "Unfavorable God", "仇神"],
    ...sg(
      "quality to watch", "需留意的特质", "cualidad a vigilar", "qualité à surveiller", "zu beachtende Eigenschaft",
      "An over-emphasized trait or energy within your profile that, when excessive, leads to cognitive distortion, exhaustion, or internal imbalance.",
      "你画像中被过度强调的某种特质或能量。当它过载时，容易导致认知偏差、精力和内在失衡。",
      "Un rasgo o energía sobreenfatizada en tu perfil que, en exceso, puede provocar distorsión cognitiva o agotamiento.",
      "Un trait ou une énergie surreprésentée dans votre profil qui, en excès, conduit à des distorsions cognitives ou à l'épuisement.",
      "Eine überbetonte Eigenschaft oder Energie in deinem Profil, die im Übermaß zu kognitiven Verzerrungen führen kann.",
    ),
  },
  {
    id: "喜神",
    surface: "replace",
    forbidden_variants: ["喜神", "Xi Shen", "Favorable Element", "Favorable God"],
    ...sg(
      "beneficial quality", "有利特质", "cualidad beneficiosa", "qualité bénéfique", "vorteilhafte Eigenschaft",
      "A supportive energy vibration that introduces clarity, ease, and constructive momentum into your current profile structure.",
      "一种能为你的内在结构带来清晰度、舒适感与建设性推进力的核心能量。",
      "Una vibración energética de apoyo que aporta claridad, fluidez y un impulso constructivo.",
      "Une vibration énergétique de soutien qui apporte clarté, aisance et élan constructif.",
      "Eine unterstützende Energieschwingung, die Klarheit, Leichtigkeit und konstruktive Dynamik bringt.",
    ),
  },
  // ── E. 格局 ──
  {
    id: "格局",
    surface: "replace",
    forbidden_variants: ["格局", "Ge Ju", "Geju", "Special Framework"],
    ...sg(
      "personality pattern", "性格模式", "patrón de personalidad", "profil comportemental", "Persönlichkeitsmuster",
      "The overarching architectural style of your cognitive and psychological blueprint.",
      "你整体认知与心理蓝图的底层架构风格。",
      "El estilo arquitectónico general de tu diseño cognitivo y psicológico.",
      "Le style architectural global de votre schéma cognitif et psychologique.",
      "Der übergreifende architektonische Stil deines kognitiven und psychologischen Bauplans.",
    ),
  },
  // ── F. 合婚 / Match ──
  {
    id: "六合",
    surface: "replace",
    forbidden_variants: ["六合", "三合", "Liu He", "San He", "Six Harmonies", "Three Harmonies", "Combined", "合化"],
    ...sg(
      "natural affinity", "自然契合", "afinidad natural", "affinité naturelle", "natürliche Affinität",
      "A deep, systemic resonance between two energy layers. It facilitates seamless communication, mutual trust, and automatic behavioral alignment.",
      "两股能量图层之间深层且系统性的共振。它能带来高度流畅的沟通、天然的信任感，以及无需刻意经营的行为默契。",
      "Una resonancia profunda y sistémica entre dos capas energéticas.",
      "Une résonance profonde et systémique entre deux couches énergétiques.",
      "Eine tiefe, systemische Resonanz zwischen zwei Energieebenen.",
    ),
  },
  {
    id: "刑",
    surface: "replace",
    forbidden_variants: ["刑", "自刑", "三刑", "Xing", "Punishment", "Self-punishment", "punishment star"],
    ...sg(
      "tension", "内在张力", "tensión", "tension", "Spannung",
      "A subtle psychological clash or power dynamic in relationships.",
      "人际关系中微妙的心理碰撞或博弈状态。",
      "Un sutil choque psicológico o dinámica de poder en las relaciones.",
      "Un subtil conflit psychologique ou une dynamique de pouvoir dans les relations.",
      "Ein subtiler psychologischer Konflikt oder eine Machtdynamik in Beziehungen.",
    ),
  },
  {
    id: "害冲",
    surface: "replace",
    forbidden_variants: ["害", "Hai", "冲", "Chong", "相冲", "Clashing", "Harm", "Opposing", "刑冲"],
    ...sg(
      "friction", "能量摩擦", "fricción", "friction", "Reibung",
      "A direct energetic divergence or mismatch in timing, rhythm, or execution styles between two individuals.",
      "两个人之间在节奏、步调或执行风格上的直接分歧与不一致。",
      "Una divergencia energética directa o falta de coincidencia en el ritmo entre dos individuos.",
      "Une divergence énergétique directe ou un décalage de timing entre deux personnes.",
      "Eine direkte energetische Abweichung oder Unstimmigkeit im Timing zwischen zwei Personen.",
    ),
  },
  {
    id: "合冲刑害",
    surface: "replace",
    forbidden_variants: ["合冲刑害", "刑冲破害", "相克"],
    ...sg(
      "energy friction & affinity patterns", "能量摩擦与契合模式",
      "patrones de fricción y afinidad de energía", "modèles de friction et d'affinité énergétique", "Energiereibungs- und Affinitätsmuster",
      "The comprehensive behavioral map tracking how two cognitive profiles lock together.",
      "追踪两个认知画像如何相互锁定的全景行为地图。",
      "El mapa conductual integral que rastrea cómo se acoplan dos perfiles cognitivos.",
      "La cartographie comportementale complète suivant la manière dont deux profils cognitifs s'articulent.",
      "Die umfassende Verhaltenskarte, die zeigt, wie zwei kognitive Profile ineinandergreifen.",
    ),
  },
  {
    id: "配偶星",
    surface: "replace",
    forbidden_variants: ["配偶星", "夫妻宫", "婚姻宫", "spouse star", "marriage palace"],
    ...sg(
      "partner-role pattern", "伴侣角色模式", "patrón del rol de pareja", "modèle de rôle du partenaire", "Partner-Rollenmuster",
      "Your psychological baseline blueprint for intimate projection.",
      "你在亲密关系投射中的心理基准蓝图。",
      "Tu diseño psicológico base para la proyección íntima.",
      "Votre schéma psychologique de référence pour la projection intime.",
      "Dein psychologisches Basismodell für die intime Projektion.",
    ),
  },
  {
    id: "宜婚不宜婚",
    surface: "replace",
    forbidden_variants: ["宜婚", "不宜婚", "八字不合", "克夫", "克妻", "婚姻不顺"],
    ...sg(
      "compatibility fit", "契合度评估", "evaluación de compatibilidad", "évaluation de compatibilité", "Kompatibilitätsbewertung",
      "An assessment of relational alignment, highlighting where two psychological profiles share a natural pace.",
      "对一段两性关系对齐维度的客观评估。",
      "Una evaluación de la alineación relacional entre dos perfiles psicológicos.",
      "Une évaluation de l'alignement relationnel entre deux profils psychologiques.",
      "Eine Bewertung der partnerschaftlichen Ausrichtung zwischen zwei psychologischen Profilen.",
    ),
  },
  // ── G. 神煞 / 民间命理 ──
  {
    id: "神煞",
    surface: "replace",
    forbidden_variants: ["神煞", "Shen Sha", "Gods and Demons", "Auxiliary Stars", "Special Stars"],
    ...sg(
      "external support / social energy", "外部助力 / 社交能量",
      "apoyo externo / energía social", "soutien externe / énergie sociale", "äußere Unterstützung / soziale Energie",
      "Secondary behavioral indicators within your profile that map specific environmental reactions and situational coping styles.",
      "你画像中的次级行为指标。它描绘了特定的环境反馈、局部的社交动力以及面对具体情境时的应对风格。",
      "Indicadores conductuales secundarios en tu perfil.",
      "Indicateurs comportementaux secondaires de votre profil.",
      "Sekundäre Verhaltensindikatoren in deinem Profil.",
    ),
  },
  {
    id: "贵人",
    surface: "replace",
    forbidden_variants: ["贵人", "Noble Person", "Benefactor", "Nobleman luck", "Gui Ren"],
    ...sg(
      "key supporter / external support", "外部助力 / 关键支持者",
      "aliado clave / apoyo externo", "soutien clé / support externe", "Schlüsselunterstützer / äußere Hilfe",
      "A behavioral openness that attracts mentorship, collaborative leverage, and constructive resource alignment from your immediate social network.",
      "一种能从你当前的社交网络中吸引导师指引、协作杠杆与建设性资源对齐的内在开放特质。",
      "Una apertura conductual que atrae mentoría y apalancamiento colaborativo.",
      "Une ouverture comportementale qui attire le mentorat et l'effet de levier collaboratif.",
      "Eine Verhaltsoffenheit, die Mentoring und kollaborative Hebelwirkung anzieht.",
    ),
  },
  {
    id: "小人",
    surface: "replace",
    forbidden_variants: ["小人", "Xiao Ren", "Backstabber", "Secret Enemy", "Malevolent People"],
    ...sg(
      "negative influence", "负面干扰 / 阻力源", "influencia negativa", "influence négative", "negativer Einfluss",
      "Hidden friction or boundary misalignment in interpersonal spaces.",
      "人际交往中隐蔽的摩擦或边界错位。",
      "Fricción oculta o desalineación de límites en los espacios interpersonales.",
      "Friction cachée ou décalage des limites dans les espaces interpersonnels.",
      "Verborgene Reibung oder Fehlausrichtung von Grenzen im zwischenmenschlichen Bereich.",
    ),
  },
  {
    id: "桃花",
    surface: "replace",
    forbidden_variants: ["桃花", "Peach Blossom", "Tao Hua", "咸池", "红艳", "Romance Star"],
    ...sg(
      "interpersonal energy", "情感能量 / 社交磁场", "energía interpersonal", "énergie interpersonnelle", "zwischenmenschliche Energie",
      "A psychological configuration that boosts personal charisma, social attractiveness, and relational receptivity.",
      "一种提升个人魅力、社交吸引力与人际接纳度的心理配置。",
      "Una configuración psicológica que potencia el carisma personal y la atracción social.",
      "Une configuration psychologique qui stimule le charisme personnel et l'attractivité sociale.",
      "Eine psychologische Konfiguration, die das persönliche Charisma und die soziale Attraktivität stärkt.",
    ),
  },
  {
    id: "驿马",
    surface: "replace",
    forbidden_variants: ["驿马", "Yi Ma", "Traveling Star", "Horse Star"],
    ...sg(
      "mobility energy", "变动能量 / 迁移倾向", "energía de movilidad", "énergie de mobilité", "Mobilitätsenergie",
      "An inner psychological drive toward geographical movement, environmental change, or structural transition.",
      "一种向往地理位移、环境更迭或结构性转型的内在心理驱动力。",
      "Un impulso psicológico interno hacia el movimiento geográfico o el cambio de entorno.",
      "Une pulsion psychologique interne vers le déplacement géographique ou le changement d'environnement.",
      "Ein innerer psychologischer Drang nach geografischer Veränderung oder Umgebungswechsel.",
    ),
  },
  // ── H. 占卜 / Glyph ──
  {
    id: "签文",
    surface: "replace",
    forbidden_variants: ["签文", "签", "抽签", "求签", "灵签", "drawing a lot", "Divination Lot", "Fortune Stick"],
    ...sg(
      "archetypal metaphor / this Glyph", "原型隐喻 / 此处 Glyph",
      "metáfora arquetípica / este Glyph", "métaphore archétypale / ce Glyph", "archetypische Metapher / dieses Glyph",
      "A structured textual and symbolic metaphor used to trigger psychological projection.",
      "一种用于触发心理投射的结构化文本与符号隐喻。",
      "Una metáfora textual y simbólica estructurada utilizada para activar la proyección psicológica.",
      "Une métaphore textuelle et symbolique structurée utilisée pour déclencher la projection psychologique.",
      "Eine strukturierte textuelle und symbolische Metapher, die dazu dient, psychologische Projektionen anzustoßen.",
    ),
  },
  {
    id: "占卜",
    surface: "replace",
    forbidden_variants: ["占卜", "Divination", "卜卦", "起卦", "算卦", "Forecasting", "Clairvoyance"],
    ...sg(
      "archetypal reflection", "原型反思", "reflexión arquetípica", "réflexion archétypale", "archetypische Reflexion",
      "A structured meditative methodology designed to access sub-conscious clarity by interpreting archetypal patterns.",
      "一种旨在通过解析原型模式来获取潜意识清晰度的结构化冥想方法。",
      "Una metodología meditativa estructurada diseñada para acceder a la claridad subconsciente.",
      "Une méthodologie méditative structurée conçue pour accéder à la clarté subconsciente.",
      "Eine strukturierte meditative Methodik, die darauf abzielt, Klarheit im Unterbewusstsein zu erlangen.",
    ),
  },
  {
    id: "卦象",
    surface: "replace",
    forbidden_variants: ["卦象", "hexagram", "hexagram casting", "Gua", "I Ching sign"],
    ...sg(
      "situational pattern", "处境意象", "patrón situacional", "schéma situationnel", "situatives Muster",
      "A symbolic layout modeling the internal dynamics and external forces of a specific moment.",
      "一种对特定时刻的内在动力与外部力量进行建模的符号化布局。",
      "Un diseño simbólico que modela las dinámicas internas y las fuerzas externas de un momento específico.",
      "Un agencement symbolique modélisant les dynamiques internes et les forces externes d'un moment précis.",
      "Ein symbolisches Layout, das die innere Dynamik und die äußeren Kräfte eines bestimmten Augenblicks modelliert.",
    ),
  },
  {
    id: "算命",
    surface: "replace",
    forbidden_variants: [
      "算命", "命理", "Fortune-telling", "astrology", "horoscope", "tarot", "psychic", "oracle", "占星", "塔罗", "巫师", "批命",
    ],
    ...sg(
      "analysis / reading", "分析 / 解读", "análisis / lectura", "analyse / lecture", "Analyse / Auswertung",
      "An objective evaluation of baseline psychological and temporal traits using systematic frameworks.",
      "使用系统性框架对基础心理和时序特征进行的客观评估。",
      "Una evaluación objetiva de los rasgos psicológicos y temporales mediante marcos sistemáticos.",
      "Une évaluation objective des traits psychologiques et temporels de base à l'aide de cadres systématiques.",
      "Eine objektive Bewertung psychologischer und zeitlicher Grundeigenschaften mithilfe systematischer Frameworks.",
    ),
  },
  // ── I. 宿命 / 预测 ──
  {
    id: "宿命",
    surface: "replace",
    forbidden_variants: ["宿命", "Fate", "predestined", "meant to be", "fatalism", "hard-coded"],
    ...sg(
      "inherent tendencies", "先天倾向", "tendencias inherentes", "tendances inhérentes", "angeborene Tendenzen",
      "The initial baseline setup of your cognitive and behavioral traits.",
      "你认知与行为特征的初始基准设定。",
      "La configuración base inicial de tus rasgos cognitivos y conductuales.",
      "La configuration de référence initiale de vos traits cognitifs et comportementaux.",
      "Die anfängliche Basiskonfiguration deiner kognitiven und verhaltensbezogenen Eigenschaften.",
    ),
  },
  {
    id: "命运",
    surface: "replace",
    forbidden_variants: ["命运", "Destiny", "Mo Yun", "life path", "predetermined path"],
    ...sg(
      "life direction", "人生方向", "dirección de vida", "trajectoire de vie", "Lebensrichtung",
      "The fluid trajectory shaped by the interplay between your default personality structure and your conscious choices.",
      "由你的默认性格结构与有意识的个人抉择相互作用而形成的流动的生命轨迹。",
      "La trayectoria fluida formada por la interacción entre tu estructura de personalidad y tus elecciones conscientes.",
      "La trajectoire évolutive façonnée par l'interaction entre votre structure de personnalité et vos choix conscients.",
      "Die fließende Lebensbahn, die durch das Zusammenspiel zwischen deiner Persönlichkeitsstruktur und deinen bewussten Entscheidungen entsteht.",
    ),
  },
  {
    id: "预测",
    surface: "replace",
    forbidden_variants: ["预测", "预言", "Prediction", "predict", "forecast", "prophesy", "prophecy"],
    ...sg(
      "insight / assessment", "洞察 / 评估", "perspicacia / evaluación", "analyse / évaluation", "Einblick / Bewertung",
      "A strategic analytical assessment that projects psychological patterns into potential environmental contexts.",
      "一种将心理行为模式投射到潜在环境情境中的策略性分析评估。",
      "Una evaluación analítica y estratégica que proyecta patrones psicológicos en posibles contextos.",
      "Une évaluation analytique stratégique qui projette des schémas psychologiques dans de potentiels contextes.",
      "Eine strategische analytische Bewertung, die psychologische Muster auf potenzielle Umweltkontexte projiziert.",
    ),
  },
  {
    id: "命中注定",
    surface: "replace",
    forbidden_variants: ["命中注定", "注定", "逃不掉", "Written in the stars", "predestined to"],
    ...sg(
      "naturally aligned", "自然契合", "naturalmente alineado", "naturellement aligné", "natürlich ausgerichtet",
      "A state of high-probability psychological alignment, where internal preferences and structural strengths seamlessly lock into specific life paths.",
      "一种高概率的心理契合状态，即你的内在偏好、默认行为和结构性优势与特定的人生路径产生了无缝的契合。",
      "Un estado de alineación psicológica de alta probabilidad.",
      "Un état d'alignement psychologique à haute probabilité.",
      "Ein Zustand hoher psychologischer Übereinstimmung.",
    ),
  },
  {
    id: "业力",
    surface: "replace",
    forbidden_variants: ["Karma", "karmic", "业障", "因果报应", "retribution"],
    ...sg(
      "pattern / behavioral loop", "行为回路 / 认知模式",
      "bucle conductual / patrón", "boucle comportementale / schéma", "Verhaltensschleife / Muster",
      "The deep-seated behavioral loops and path dependencies formed by repetitive cognitive cycles.",
      "由重复的认知循环所形成的深层行为回路与路径依赖。",
      "Los bucles conductuales profundos formados por ciclos cognitivos repetitivos.",
      "Les boucles comportementales profondes formées par des cycles cognitifs répétitifs.",
      "Die tief sitzenden Verhaltensschleifen, die durch sich wiederholende kognitive Zyklen entstehen.",
    ),
  },
  // ── J. 环境心理学降维 ──
  {
    id: "招财_催运",
    surface: "replace",
    forbidden_variants: ["招财", "催运", "财位", "Wealth activation", "Amulet"],
    ...sg(
      "cognitive focus optimization / workspace alignment", "认知专注度优化 / 空间秩序对齐",
      "optimización del enfoque cognitivo / alineación del espacio de trabajo",
      "optimisation de la focalisation cognitive / alignement de l'espace de travail",
      "Optimierung des kognitiven Fokus / Ausrichtung des Arbeitsbereichs",
      "The psychological process of organizing your immediate workspace to minimize sensory distractions.",
      "通过系统整理当下工作空间以减少视觉与感知干扰的心理学过程。",
      "El proceso psicológico de organizar tu espacio de trabajo inmediato para minimizar las distracciones sensoriales.",
      "Le processus psychologique consistant à organiser votre espace de travail immédiat pour minimiser les distractions sensorielles.",
      "Der psychologische Prozess der Organisation des unmittelbaren Arbeitsbereichs, um sensorische Ablenkungen zu minimieren.",
    ),
  },
  {
    id: "避邪_化煞",
    surface: "replace",
    forbidden_variants: ["避邪", "化煞", "挡灾", "ward off disaster"],
    ...sg(
      "stress de-escalation / emotional boundary management", "压力缓冲机制 / 情感边界管理",
      "desescalada del estrés / gestión de límites emocionales",
      "désescalade du stress / gestion des limites émotionnelles",
      "Stressabbau / emotionales Grenzmanagement",
      "An active cognitive alignment designed to establish stable psychological boundaries.",
      "一种旨在建立稳固心理边界的主动认知对齐。",
      "Una alineación cognitiva activa diseñada para establecer límites psicológicos estables.",
      "Un alignement cognitif actif conçu pour établir des limites psychologiques stables.",
      "Eine aktive kognitive Ausrichtung, die darauf abzielt, stabile psychologische Grenzen aufzubauen.",
    ),
  },
  {
    id: "文昌位",
    surface: "replace",
    forbidden_variants: ["文昌位"],
    ...sg(
      "deep-work environmental setting", "深度工作环境设定",
      "configuración de entorno para trabajo profundo",
      "configuration d'environnement pour le travail en profondeur",
      "Umgebungseinstellung für Deep Work",
      "An environmental arrangement that optimizes lighting, ergonomics, and visual fields within a space to induce a flow state.",
      "一种通过优化空间内的光线、人体工学和视野范围来诱发心流状态的环境布置。",
      "Disposición ambiental que optimiza la iluminación, la ergonomía y los campos visuales para inducir un estado de flujo.",
      "Un agencement environnemental qui optimise l'éclairage, l'ergonomie et les champs visuels pour inducer un état de flow.",
      "Eine Raumgestaltung, die Beleuchtung, Ergonomie und Sichtfelder optimiert, um einen Flow-Zustand zu fördern.",
    ),
  },
  {
    id: "吉",
    surface: "replace",
    forbidden_variants: ["吉", "大吉", "auspicious", "上吉", "吉利", "吉运"],
    ...sg(
      "constructive synergy window", "建设性协同窗口",
      "ventana de sinergia constructiva", "fenêtre de synergie constructive", "konstruktives Synergie-Zeitfenster",
      "A behavioral phase or context characterized by minimal internal resistance and optimal resource alignment.",
      "一种表现为内在阻力极低、资源对齐度极佳的行为阶段或情境。",
      "Una fase o contexto conductual caracterizado por una resistencia interna mínima y una alineación óptima de recursos.",
      "Une phase ou un contexte comportemental caractérisé par une résistance interne minimale et un alignement optimal des ressources.",
      "Eine Verhaltensphase, die durch minimalen inneren Widerstand und optimale Ressourcenausrichtung geprägt ist.",
    ),
  },
  {
    id: "凶",
    surface: "replace",
    forbidden_variants: ["凶", "大凶", "ominous", "下凶", "凶运"],
    ...sg(
      "high-friction context / strategic regulatory phase", "高摩擦情境 / 战略审慎调控期",
      "contexto de alta fricción / fase de regulación estratégica",
      "contexte à forte friction / phase de régulation stratégique",
      "hochgradiger Reibungskontext / strategische Regulierungsphase",
      "A temporary state of heightened environmental friction or cognitive stress.",
      "一种由环境摩擦增加或认知压力变高带来的暂时的、阶段性状态。",
      "Un estado temporal de fricción ambiental elevada o estrés cognitivo.",
      "Un état temporaire de friction environnementale accrue ou de stress cognitif.",
      "Ein vorübergehender Zustand erhöhter umweltbedingter Reibung oder kognitiver Belastung.",
    ),
  },
  // ── delete: 神祇 / 崇拜 ──
  {
    id: "宗教神祇实体",
    surface: "delete",
    forbidden_variants: [
      "观音", "菩萨", "佛", "Guan Yin", "Bodhisattva", "Buddha", "deity", "deities", "Temple", "shrine", "寺庙", "庙",
      "观音菩萨", "观世音",
    ],
    soft: EMPTY_LOCALES,
    gloss: EMPTY_LOCALES,
  },
  {
    id: "宗教崇拜行为",
    surface: "delete",
    forbidden_variants: [
      "保佑", "祈福", "求神", "拜佛", "blessing", "prayer", "sacred", "worship", "incense", "altar", "神明", "神灵",
    ],
    soft: EMPTY_LOCALES,
    gloss: EMPTY_LOCALES,
  },
  // ── allow: 五行 / 易经 / 阴阳 / 气 / 道 ──
  {
    id: "五行",
    surface: "allow",
    forbidden_variants: [],
    ...sg(
      "Five Elements", "五行", "Cinco Elementos", "Cinq Éléments", "Fünf Elemente",
      "The five-current energy model — Wood, Fire, Earth, Metal, Water — used like the Western four elements to describe temperament and balance.",
      "五行能量模型（木火土金水），像西方四元素一样描述性情与平衡。",
      "El modelo de energía de cinco corrientes (Madera, Fuego, Tierra, Metal, Agua).",
      "Le modèle énergétique à cinq flux (Bois, Feu, Terre, Métal, Eau).",
      "Das fünfströmige Energiemodell (Holz, Feuer, Erde, Metall, Wasser).",
    ),
  },
  { id: "木", surface: "allow", hanzi: "木", forbidden_variants: [],
    ...sg("Wood", "木", "Madera", "Bois", "Holz",
      "The growth-and-expansion current in the Five Elements model — vision, flexibility, and the drive to develop.",
      "五行模型里的成长与扩张之流——视野、柔韧与向上生长的驱动力。",
      "La corriente de crecimiento y expansión en el modelo de los Cinco Elementos.",
      "Le flux de croissance et d'expansion dans le modèle des Cinq Éléments.",
      "Der Wachstums- und Expansionsstrom im Fünf-Elemente-Modell.") },
  { id: "火", surface: "allow", hanzi: "火", forbidden_variants: [],
    ...sg("Fire", "火", "Fuego", "Feu", "Feuer",
      "The warmth-and-expression current — passion, visibility, and connection.",
      "温暖与表达之流——热情、可见度与连接。",
      "La corriente de calidez y expresión.",
      "Le flux de chaleur et d'expression.",
      "Der Strom von Wärme und Ausdruck.") },
  { id: "土", surface: "allow", hanzi: "土", forbidden_variants: [],
    ...sg("Earth", "土", "Tierra", "Terre", "Erde",
      "The stability-and-nourishment current — grounding, reliability, and care.",
      "稳定与滋养之流——踏实、可靠与照护。",
      "La corriente de estabilidad y nutrición.",
      "Le flux de stabilité et de nourriture.",
      "Der Stabilitäts- und Nährstrom.") },
  { id: "金", surface: "allow", hanzi: "金", forbidden_variants: [],
    ...sg("Metal", "金", "Metal", "Métal", "Metall",
      "The structure-and-clarity current — precision, boundaries, and refinement.",
      "结构与清晰之流——精确、边界与提炼。",
      "La corriente de estructura y claridad.",
      "Le flux de structure et de clarté.",
      "Der Struktur- und Klarheitsstrom.") },
  { id: "水", surface: "allow", hanzi: "水", forbidden_variants: [],
    ...sg("Water", "水", "Agua", "Eau", "Wasser",
      "The depth-and-adaptability current — reflection, wisdom, and flow.",
      "深度与适应之流——沉静、智慧与流动。",
      "La corriente de profundidad y adaptabilidad.",
      "Le flux de profondeur et d'adaptabilité.",
      "Der Tiefen- und Anpassungsstrom.") },
  { id: "易经", surface: "allow", forbidden_variants: [],
    ...sg("I Ching / Book of Changes", "易经", "I Ching", "Yi Jing", "I Ging",
      "A classical philosophy of change and timing — a framework for how situations transform, used here as a lens for reflection.",
      "一套关于变化与时位的古典哲学——讲处境如何流转，此处用作反思的视角。",
      "Una filosofía clásica del cambio y la oportunidad.",
      "Une philosophie classique du changement et du moment opportun.",
      "Eine klassische Philosophie des Wandels und des richtigen Zeitpunkts.") },
  { id: "阴阳", surface: "allow", forbidden_variants: [],
    ...sg("Yin-Yang", "阴阳", "Yin-Yang", "Yin-Yang", "Yin-Yang",
      "The complementary-opposites model — how paired forces balance and convert into each other.",
      "互补对立的模型——成对的力量如何彼此平衡、相互转化。",
      "El modelo de opuestos complementarios.",
      "Le modèle des opposés complémentaires.",
      "Das Modell komplementärer Gegensätze.") },
  { id: "气", surface: "allow", forbidden_variants: [],
    ...sg("Qi", "气", "Qi", "Qi", "Qi",
      "A metaphor for the flow of energy and vitality through a person or a space.",
      "对能量与生命力在人或空间中流动的一种隐喻。",
      "Una metáfora del flujo de energía y vitalidad.",
      "Une métaphore du flux d'énergie et de vitalité.",
      "Eine Metapher für den Fluss von Energie und Vitalität.") },
  { id: "道", surface: "allow", forbidden_variants: [],
    ...sg("Tao", "道", "Tao", "Tao", "Tao",
      "The principle of natural flow — aligning action with circumstance rather than forcing against it.",
      "自然流动的原则——顺势而为，而非逆势强求。",
      "El principio del flujo natural.",
      "Le principe du flux naturel.",
      "Das Prinzip des natürlichen Flusses.") },
];

// ── Derived indexes ──

function isChineseVariant(v: string): boolean {
  return /[\u4e00-\u9fff]/.test(v);
}

function deriveTermMap(locale: Locale): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of TERM_GLOSSARY) {
    const replacement = c.surface === "delete" ? "" : c.soft[locale];
    for (const v of c.forbidden_variants) {
      const isZh = isChineseVariant(v);
      if (locale === "zh" && isZh) map[v] = replacement;
      if (locale !== "zh" && !isZh) map[v] = replacement;
    }
  }
  return map;
}

export const EN_TERM_MAP: Record<string, string> = deriveTermMap("en");
export const ZH_TERM_MAP: Record<string, string> = deriveTermMap("zh");

/** Flat forbidden list for audit (replace + delete variants). */
export const FORBIDDEN_VARIANTS_ALL: string[] = [
  ...new Set(
    TERM_GLOSSARY.filter((c) => c.surface !== "allow")
      .flatMap((c) => c.forbidden_variants)
      .filter(Boolean),
  ),
].sort((a, b) => b.length - a.length);

/** Terms allowed in output — skip audit false positives. */
export const AUDIT_ALLOW_LABELS: Set<string> = new Set(
  TERM_GLOSSARY.filter((c) => c.surface === "allow").flatMap((c) => [
    ...Object.values(c.soft),
    ...(c.hanzi ? [c.hanzi] : []),
  ]),
);

export function softFor(id: string, locale: Locale): string {
  const c = TERM_GLOSSARY.find((x) => x.id === id);
  return c?.soft[locale] ?? "";
}

export function glossFor(softLabel: string, locale: Locale): GlossaryConcept | null {
  const normalized = softLabel.trim();
  return (
    TERM_GLOSSARY.find(
      (c) =>
        c.surface !== "delete" &&
        (c.soft[locale] === normalized ||
          c.soft[locale].split(" / ").some((part) => part.trim() === normalized)),
    ) ?? null
  );
}

export function tippableEntries(locale: Locale): Array<{
  label: string;
  hanzi?: string;
  gloss: string;
}> {
  return TERM_GLOSSARY.filter((c) => c.surface !== "delete" && c.soft[locale])
    .map((c) => ({ label: c.soft[locale], hanzi: c.hanzi, gloss: c.gloss[locale] }))
    .sort((a, b) => b.label.length - a.label.length);
}

export function toGlossaryLocale(locale: string): Locale {
  if (locale.startsWith("zh")) return "zh";
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("fr")) return "fr";
  if (locale.startsWith("de")) return "de";
  return "en";
}
