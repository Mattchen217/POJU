/**
 * Authoritative closed-set 命理 terminology — derived from calculation engine enums.
 * Term glossary MUST cover exactly these (plus compliance-only entries elsewhere).
 */

import { LIFE_STAGE_HAN } from "@/lib/calculations/chang-sheng";
import type { TenGod } from "@/lib/match/data/stems-branches";
import { BRANCHES, STEMS } from "@/lib/match/data/stems-branches";

/** A1 — engine-computed 神煞 (bazi-shensha-local). */
export const CLOSED_SHEN_SHA = [
  "天乙贵人",
  "禄神",
  "飞刃",
  "文昌",
  "桃花",
  "驿马",
  "华盖",
  "孤辰",
  "寡宿",
  "将星",
  "劫煞",
  "亡神",
  "灾煞",
  "国印",
  "金舆",
  "天德",
  "月德",
  "福星贵人",
  "太极贵人",
  "天医",
  "学堂",
  "词馆",
  "红鸾",
  "天喜",
] as const;

export type ClosedShenSha = (typeof CLOSED_SHEN_SHA)[number];

/** A2 — exactly 10 ten gods. */
export const CLOSED_TEN_GODS: readonly TenGod[] = [
  "比肩",
  "劫财",
  "食神",
  "伤官",
  "偏财",
  "正财",
  "七杀",
  "正官",
  "偏印",
  "正印",
];

/** A3 — exactly 12 life stages. */
export const CLOSED_LIFE_STAGES = LIFE_STAGE_HAN;

/** A4 — stems & branches. */
export const CLOSED_HEAVENLY_STEMS = Object.keys(STEMS) as (keyof typeof STEMS)[];
export const CLOSED_EARTHLY_BRANCHES = Object.keys(BRANCHES) as (keyof typeof BRANCHES)[];

/** A5 — wuxing / yinyang (surface=allow in glossary). */
export const CLOSED_WUXING = ["木", "火", "土", "金", "水"] as const;
export const CLOSED_YINYANG = ["阴", "阳"] as const;

/** Slug for each wuxing element (marker / pojulife-terms). */
export const WUXING_SLUG = {
  木: "wood",
  火: "fire",
  土: "earth",
  金: "metal",
  水: "water",
} as const;

/** Slug for yin/yang polarity. */
export const YINYANG_SLUG = { 阳: "yang", 阴: "yin" } as const;

/** Allow-surface concept slugs (not engine-computed pillars). */
export const ALLOW_CONCEPT_SLUG = {
  五行: "wuxing",
  阴阳: "yin_yang",
  易经: "i_ching",
  气: "qi",
  道: "tao",
} as const;

/**
 * Relation slugs — aligned with RELATION_MARKER_PREFIXES (engine fact source).
 * 六合/三合 use liuhe/sanhe (no underscore), not liu_he/san_he.
 */
export const RELATION_SLUG = {
  冲: "chong",
  刑: "xing",
  害: "hai",
  六合: "liuhe",
  半合: "banhe",
  三合: "sanhe",
  天干合: "stemhe",
} as const;

/** A6 — structural concepts from build-profile-structured / yongshen. */
export const CLOSED_STRUCTURAL = [
  "日主",
  "用神",
  "喜神",
  "忌神",
  "身强",
  "身弱",
  "平衡",
  "格局",
  "大运",
  "流年",
  "八字",
  "四柱",
  "命盘",
  "天干",
  "地支",
  "藏干",
  "配偶宫",
] as const;

/** A7 — Match branch relations only. */
export const CLOSED_MATCH_RELATIONS = [
  "六合",
  "六冲",
  "三刑",
  "六害",
  "三合",
] as const;

/** Every closed-set han id that MUST have an independent glossary row (replace surface). */
export const CLOSED_SET_REPLACE_IDS: readonly string[] = [
  ...CLOSED_SHEN_SHA,
  "羊刃", // alias for 飞刃 in output
  ...CLOSED_TEN_GODS,
  ...CLOSED_LIFE_STAGES,
  ...CLOSED_HEAVENLY_STEMS,
  ...CLOSED_EARTHLY_BRANCHES,
  ...CLOSED_STRUCTURAL,
  ...CLOSED_MATCH_RELATIONS,
];

/** allow-surface ids (not marked, kept as energy language). */
export const CLOSED_SET_ALLOW_IDS: readonly string[] = [...CLOSED_WUXING, "五行", "易经", "阴阳", "气", "道"];

/** Terms the engine NEVER computes — or computes but are redline (恐吓/宿命), never feed. */
export const OUT_OF_SET_FORBIDDEN_HAN = [
  "空亡",
  "魁罡",
  "十恶大败",
  "孤鸾",
  "孤鸾煞",
  "阴阳差错",
  "阴差阳错",
  "元辰",
  "六秀日",
  "大耗",
  "小耗",
  "五鬼",
  "丧门",
  "吊客",
  "白虎",
  "天狗",
  "血刃",
  "流霞",
  "隔角",
  // 引擎会算、但属恐吓/宿命，不喂真算（用户红线）
  "勾绞煞",
  "童子煞",
  "地网",
  "天罗",
  "八专日",
  "十灵日",
  "九丑日",
  // 天厨 已移除 —— 现为合法术语 ss_tianchu
] as const;

export const OUT_OF_SET_FORBIDDEN_EN = [
  "Void",
  "Empty Void",
  "General Star",
  "Peach Blossom Luck",
  "Red Phoenix",
  "Heavenly Joy",
] as const;

/** Stable slug for each closed-set han id (marker `t:` id). */
export const CLOSED_SET_SLUG: Record<string, string> = {
  天乙贵人: "tian_yi_gui_ren",
  禄神: "lu_shen",
  飞刃: "fei_ren",
  羊刃: "fei_ren",
  文昌: "wen_chang",
  桃花: "tao_hua",
  驿马: "yi_ma",
  华盖: "hua_gai",
  孤辰: "gu_chen",
  寡宿: "gua_su",
  将星: "jiang_xing",
  劫煞: "jie_sha",
  亡神: "wang_shen",
  灾煞: "zai_sha",
  国印: "guo_yin",
  金舆: "jin_yu",
  天德: "tian_de",
  月德: "yue_de",
  福星贵人: "fu_xing_gui_ren",
  太极贵人: "tai_ji_gui_ren",
  天医: "tian_yi_star",
  学堂: "xue_tang",
  词馆: "ci_guan",
  红鸾: "hong_luan",
  天喜: "tian_xi",
  比肩: "bi_jian",
  劫财: "jie_cai",
  食神: "shi_shen",
  伤官: "shang_guan",
  偏财: "pian_cai",
  正财: "zheng_cai",
  七杀: "qi_sha",
  正官: "zheng_guan",
  偏印: "pian_yin",
  正印: "zheng_yin",
  长生: "life_changsheng",
  沐浴: "life_muyu",
  冠带: "life_guandai",
  临官: "life_linguan",
  帝旺: "life_diwang",
  衰: "life_shuai",
  病: "life_bing",
  死: "life_si",
  墓: "life_mu",
  绝: "life_jue",
  胎: "life_tai",
  养: "life_yang",
  甲: "stem_jia",
  乙: "stem_yi",
  丙: "stem_bing",
  丁: "stem_ding",
  戊: "stem_wu",
  己: "stem_ji",
  庚: "stem_geng",
  辛: "stem_xin",
  壬: "stem_ren",
  癸: "stem_gui",
  子: "branch_zi",
  丑: "branch_chou",
  寅: "branch_yin",
  卯: "branch_mao",
  辰: "branch_chen",
  巳: "branch_si",
  午: "branch_wu",
  未: "branch_wei",
  申: "branch_shen",
  酉: "branch_you",
  戌: "branch_xu",
  亥: "branch_hai",
  日主: "day_master",
  用神: "yong_shen",
  喜神: "favorable_element",
  忌神: "unfavorable_element",
  身强: "strong_self",
  身弱: "weak_self",
  平衡: "balanced_self",
  格局: "pattern",
  大运: "decade",
  流年: "year",
  八字: "bazi",
  四柱: "four_pillars",
  命盘: "natal_profile",
  天干: "heavenly_stem",
  地支: "earthly_branch",
  藏干: "hidden_stem",
  配偶宫: "spouse_palace",
  六合: "liuhe",
  六冲: "liu_chong",
  三刑: "san_xing",
  六害: "liu_hai",
  三合: "sanhe",
  占卜: "hr_divination",
  命运: "hr_fate",
  宿命: "hr_destiny",
  吉凶: "hr_auspicious",
  星象: "hr_astral",
};

/** Stripe / payment-processor high-risk han — UI auto-mark only (Block 62 Part 3). */
export const HIGH_RISK_COMPLIANCE_HAN = ["占卜", "命运", "宿命", "吉凶", "星象"] as const;

export type HighRiskComplianceHan = (typeof HIGH_RISK_COMPLIANCE_HAN)[number];

/** Soft + fixed gloss in all 5 product locales (zh/en/es/de/fr). */
export type FiveLocaleSoftGloss = {
  slug: string;
  soft: { zh: string; en: string; es: string; de: string; fr: string };
  gloss: { zh: string; en: string; es: string; de: string; fr: string };
};

export const HIGH_RISK_SOFT_LABEL: Record<HighRiskComplianceHan, FiveLocaleSoftGloss> = {
  占卜: {
    slug: "hr_divination",
    soft: {
      zh: "情境推演",
      en: "situational read",
      es: "lectura situacional",
      de: "situative Lesart",
      fr: "lecture situationnelle",
    },
    gloss: {
      zh: "从结构与选项看处境，不是占卦断吉凶。",
      en: "Reading structure and options—not fortune-telling.",
      es: "Leer estructura y opciones—no adivinación.",
      de: "Struktur und Optionen lesen—kein Wahrsagen.",
      fr: "Lire structure et options—pas de divination.",
    },
  },
  命运: {
    slug: "hr_fate",
    soft: {
      zh: "人生轨迹",
      en: "life trajectory",
      es: "trayectoria de vida",
      de: "Lebensverlauf",
      fr: "trajectoire de vie",
    },
    gloss: {
      zh: "长期走向与选择叠加出的路径，不是铁定结局。",
      en: "A path shaped by choices—not a fixed outcome.",
      es: "Un camino moldeado por elecciones—no un final fijo.",
      de: "Ein Pfad aus Wahlen—kein festes Ende.",
      fr: "Un chemin façonné par des choix—pas une issue figée.",
    },
  },
  宿命: {
    slug: "hr_destiny",
    soft: {
      zh: "人生轨迹",
      en: "life trajectory",
      es: "trayectoria de vida",
      de: "Lebensverlauf",
      fr: "trajectoire de vie",
    },
    gloss: {
      zh: "可被选择与行动重塑的长期方向。",
      en: "Long-range direction you can still steer.",
      es: "Dirección de largo plazo que aún puedes guiar.",
      de: "Langfristige Richtung, die du noch steuern kannst.",
      fr: "Direction de long terme que vous pouvez encore orienter.",
    },
  },
  吉凶: {
    slug: "hr_auspicious",
    soft: {
      zh: "倾向窗口",
      en: "tendency window",
      es: "ventana de tendencia",
      de: "Tendenzfenster",
      fr: "fenêtre de tendance",
    },
    gloss: {
      zh: "阶段性有利/需留意的倾向，不是吉凶断语。",
      en: "Phase tendencies—not lucky/unlucky verdicts.",
      es: "Tendencias de fase—no veredictos de suerte.",
      de: "Phasentendenzen—keine Glücks-/Unglücksurteile.",
      fr: "Tendances de phase—pas de verdicts de chance.",
    },
  },
  星象: {
    slug: "hr_astral",
    soft: {
      zh: "能量节律",
      en: "energy rhythm",
      es: "ritmo energético",
      de: "Energierhythmus",
      fr: "rythme énergétique",
    },
    gloss: {
      zh: "周期性的能量起伏背景，不是占星预言。",
      en: "Cyclic energy backdrop—not horoscope prophecy.",
      es: "Fondo de energía cíclica—no profecía astral.",
      de: "Zyklischer Energiehintergrund—keine Horoskop-Prophezeiung.",
      fr: "Fond énergétique cyclique—pas de prophétie astrale.",
    },
  },
};

/** Bare stem-branch pairs (60 甲子) — never show ganzhi in user-visible copy. */
export const BARE_GANZHI_MARKER = {
  slug: "bare_ganzhi",
  soft: {
    zh: "当前时空效能",
    en: "current temporal efficacy",
    es: "eficacia temporal actual",
    de: "aktuelle Zeiteffizienz",
    fr: "efficacité temporelle actuelle",
  },
  gloss: {
    zh: "你此刻所处的时间气候——它像天气一样影响你的状态与外部压力，但不预测具体事件。",
    en: "The temporal climate you're in—it shapes mood and external pressure like weather, without predicting specific events.",
    es: "El clima temporal en el que estás—moldea ánimo y presión externa como el clima, sin predecir eventos.",
    de: "Das Zeitklima, in dem du bist—formt Stimmung und äußeren Druck wie Wetter, ohne Ereignisse vorherzusagen.",
    fr: "Le climat temporel dans lequel vous êtes—il façonne humeur et pression externe comme la météo, sans prédire d'événements.",
  },
} as const;

const YANG_HEAVENLY_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);
const YANG_EARTHLY_BRANCHES = new Set(["子", "寅", "辰", "午", "申", "戌"]);

/** Valid 六十甲子 pair (same yin/yang parity on stem + branch). */
export function isValidSexagenaryGanzhi(ganzhi: string): boolean {
  if (ganzhi.length !== 2) return false;
  const stem = ganzhi.charAt(0);
  const branch = ganzhi.charAt(1);
  if (!(stem in STEMS) || !(branch in BRANCHES)) return false;
  const stemYang = YANG_HEAVENLY_STEMS.has(stem);
  const branchYang = YANG_EARTHLY_BRANCHES.has(branch);
  return stemYang === branchYang;
}

/** All 60 sexagenary pillar labels — for coverage tests / auto-mark validation. */
export const SEXAGENARY_GANZHI: readonly string[] = (() => {
  const stems = Object.keys(STEMS);
  const branches = Object.keys(BRANCHES);
  const out: string[] = [];
  for (let i = 0; i < 60; i++) {
    out.push(`${stems[i % 10]!}${branches[i % 12]!}`);
  }
  return out;
})();

/** relation-engine RelationLabel.id prefixes (dynamic per chart, e.g. chong_午_子). */
export const RELATION_MARKER_PREFIXES = [
  "chong",
  "xing",
  "hai",
  "liuhe",
  "banhe",
  "sanhe",
  "stemhe",
] as const;

export type RelationMarkerPrefix = (typeof RELATION_MARKER_PREFIXES)[number];

type FiveLocaleText = { zh: string; en: string; es: string; de: string; fr: string };

/** Soft-label guidance per relation kind (marker visible / plain fallback). */
export const RELATION_KIND_SOFT: Record<RelationMarkerPrefix, FiveLocaleText> = {
  chong: {
    zh: "两股力的正面顶撞",
    en: "head-on friction between two forces",
    es: "fricción frontal entre dos fuerzas",
    de: "frontale Reibung zwischen zwei Kräften",
    fr: "friction frontale entre deux forces",
  },
  xing: {
    zh: "关系里的拉扯张力",
    en: "pull-and-push tension in the pattern",
    es: "tensión de tira y afloja en el patrón",
    de: "Hin-und-Her-Spannung im Muster",
    fr: "tension de va-et-vient dans le schéma",
  },
  hai: {
    zh: "暗处的消耗摩擦",
    en: "slow drain between two pulls",
    es: "desgaste lento entre dos tirones",
    de: "langsamer Verschleiß zwischen zwei Zügen",
    fr: "usure lente entre deux tiraillements",
  },
  liuhe: {
    zh: "自然的契合引力",
    en: "natural affinity pulling together",
    es: "afinidad natural que une",
    de: "natürliche Anziehung, die zusammenführt",
    fr: "affinité naturelle qui rapproche",
  },
  banhe: {
    zh: "部分合力成势",
    en: "partial alliance building momentum",
    es: "alianza parcial que toma impulso",
    de: "teilweise Allianz mit Aufbau von Momentum",
    fr: "alliance partielle qui prend de l'élan",
  },
  sanhe: {
    zh: "三方合力成局",
    en: "triple-branch combined momentum",
    es: "impulso combinado de tres ramas",
    de: "kombiniertes Momentum dreier Zweige",
    fr: "élan combiné de trois branches",
  },
  stemhe: {
    zh: "天干层面的相合牵引",
    en: "stem-level mutual pull",
    es: "atracción mutua a nivel de tallos",
    de: "gegenseitiger Zug auf Stamm-Ebene",
    fr: "attraction mutuelle au niveau des tiges",
  },
};

/** 十神张力闭集 slug（S5 · 中性软译，禁凶断）。 */
export const TEN_GOD_TENSION_MARKER_IDS = ["shangguan_jianguan", "xiaoshen_duoshi"] as const;

export const TEN_GOD_TENSION_SOFT: Record<
  (typeof TEN_GOD_TENSION_MARKER_IDS)[number],
  FiveLocaleText
> = {
  shangguan_jianguan: {
    zh: "外部约束下的对抗张力",
    en: "tension between expression and external norms",
    es: "tensión entre expresión y normas externas",
    de: "Spannung zwischen Ausdruck und äußeren Normen",
    fr: "tension entre expression et normes externes",
  },
  xiaoshen_duoshi: {
    zh: "内省本能对表达的挤占张力",
    en: "inner pressure crowding out expression",
    es: "presión interior que ahoga la expresión",
    de: "innerer Druck, der Ausdruck verdrängt",
    fr: "pression intérieure qui étouffe l'expression",
  },
};

/** Generic relation surface terms — forbidden when chart has zero computed relations. */
export const RELATION_SURFACE_TERMS_ZH = [
  "刑冲合害",
  "相冲",
  "相刑",
  "相害",
  "半合",
  "三合",
  "六合",
  "天干合",
  "五合",
  "六冲",
  "三刑",
  "六害",
  "三合局",
  "半合局",
  "伤官见官",
  "枭神夺食",
] as const;

export function relationKindFromMarkerId(id: string): RelationMarkerPrefix | null {
  const parts = id.split("_");
  const base = parts[0];
  if ((RELATION_MARKER_PREFIXES as readonly string[]).includes(base)) {
    return base as RelationMarkerPrefix;
  }
  if (base === "liunian" && parts[1] && (RELATION_MARKER_PREFIXES as readonly string[]).includes(parts[1])) {
    return parts[1] as RelationMarkerPrefix;
  }
  if (base === "cross" && parts[1] && (RELATION_MARKER_PREFIXES as readonly string[]).includes(parts[1])) {
    return parts[1] as RelationMarkerPrefix;
  }
  return null;
}

export function isTenGodTensionMarkerId(id: string): boolean {
  return (TEN_GOD_TENSION_MARKER_IDS as readonly string[]).includes(id);
}

export function isRelationMarkerId(id: string): boolean {
  if (isTenGodTensionMarkerId(id)) return true;
  return relationKindFromMarkerId(id) !== null;
}

export function relationPolarityToken(id: string): "green" | "red" | "gold" | null {
  if (isTenGodTensionMarkerId(id)) return "red";
  const kind = relationKindFromMarkerId(id);
  if (!kind) return null;
  if (kind === "chong" || kind === "xing" || kind === "hai") return "red";
  if (kind === "liuhe" || kind === "banhe" || kind === "sanhe") return "green";
  return "gold";
}

/**
 * keep_cn façade softs — MUST match POJU_TERMS.term for the same slug.
 * softLabel() already prefers SSOT; this map is for keep-cn-brackets / audit mask extras.
 * Do not invent a second vernacular set (e.g. 「当前阶段气候」).
 */
export const KEEP_CN_VISIBLE_SOFT: Record<string, FiveLocaleText> = {
  decade: {
    zh: "纪元",
    en: "Era",
    es: "Era",
    de: "Epoche",
    fr: "Ère",
  },
  year: {
    zh: "岁环",
    en: "Transit",
    es: "Tránsito",
    de: "Transit",
    fr: "Transit",
  },
  day_master: {
    zh: "本元",
    en: "Core",
    es: "Núcleo",
    de: "Kern",
    fr: "Noyau",
  },
  yong_shen: {
    zh: "锚元",
    en: "Anchor",
    es: "Ancla",
    de: "Anker",
    fr: "Ancre",
  },
};

/** Block 59 — visible soft labels never include stem-branch in parentheses; ganzhi stays in structured data only. */
export const KEEP_CN_VISIBLE_NO_GANZHI = true as const;

export const KEEP_CN_SLUGS = new Set([
  "day_master",
  "fei_ren",
  ...CLOSED_HEAVENLY_STEMS.map((s) => CLOSED_SET_SLUG[s]!),
  ...CLOSED_EARTHLY_BRANCHES.map((b) => CLOSED_SET_SLUG[b]!),
]);

export function closedSetSlug(hanId: string): string {
  return CLOSED_SET_SLUG[hanId] ?? hanId.replace(/[^a-zA-Z0-9_]/g, "_");
}

export function isClosedSetMarkerId(id: string): boolean {
  return Object.values(CLOSED_SET_SLUG).includes(id);
}

/** Resolve expected slug for a traditional han id (bazi closed-set + allow concepts). */
export function slugForTraditional(traditional: string): string | undefined {
  if (traditional in CLOSED_SET_SLUG) return CLOSED_SET_SLUG[traditional]!;
  if (traditional in WUXING_SLUG) return WUXING_SLUG[traditional as keyof typeof WUXING_SLUG];
  if (traditional in YINYANG_SLUG) return YINYANG_SLUG[traditional as keyof typeof YINYANG_SLUG];
  if (traditional in ALLOW_CONCEPT_SLUG) {
    return ALLOW_CONCEPT_SLUG[traditional as keyof typeof ALLOW_CONCEPT_SLUG];
  }
  if (traditional in RELATION_SLUG) return RELATION_SLUG[traditional as keyof typeof RELATION_SLUG];
  return undefined;
}
