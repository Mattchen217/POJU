/**
 * Authoritative closed-set 命理 terminology — derived from calculation engine enums.
 * Term glossary MUST cover exactly these (plus compliance-only entries elsewhere).
 */

import { LIFE_STAGE_HAN } from "@/lib/calculations/chang-sheng";
import type { TenGod } from "@/lib/calendar/data/stems-branches";
import { BRANCHES, STEMS } from "@/lib/calendar/data/stems-branches";
import { forbiddenTokensForNamespace } from "@/lib/glossary/term-forbidden-registry";
import { pojuTermBySlug, type TermLocale } from "@/lib/glossary/pojulife-terms";

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

/**
 * @deprecated Prefer namespace-aware `matchForbidden` / `TERM_FORBIDDEN_REGISTRY`.
 * Legacy global list ≡ bazi slice only. Do NOT apply to qimen (空亡/白虎 are legal there).
 */
export const OUT_OF_SET_FORBIDDEN_HAN = forbiddenTokensForNamespace("bazi");

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
  "地劫": "zw_minor_di_jie",
  "地空": "zw_minor_di_kong",
  "铃星": "zw_minor_ling_xing",
  "擎羊": "zw_minor_qing_yang",
  "天魁": "zw_minor_tian_kui",
  "天马": "zw_minor_tian_ma",
  "天钺": "zw_minor_tian_yue",
  "陀罗": "zw_minor_tuo_luo",
  "病符": "zw_boshi_bing_fu",
  "博士": "zw_boshi_bo_shi",
  "大耗": "zw_boshi_da_hao",
  "飞廉": "zw_boshi_fei_lian",
  "伏兵": "zw_boshi_fu_bing",
  "官府": "zw_boshi_guan_fu",
  "将军": "zw_boshi_jiang_jun",
  "力士": "zw_boshi_li_shi",
  "青龙": "zw_boshi_qing_long",
  "小耗": "zw_boshi_xiao_hao",
  "奏书": "zw_boshi_zou_shu",
  "八座": "zw_adj_ba_zuo",
  "恩光": "zw_adj_en_guang",
  "蜚廉": "zw_adj_fei_lian",
  "封诰": "zw_adj_feng_gao",
  "凤阁": "zw_adj_feng_ge",
  "截路": "zw_adj_jie_lu",
  "解神": "zw_adj_jie_shen",
  "龙池": "zw_adj_long_chi",
  "年解": "zw_adj_nian_jie",
  "破碎": "zw_adj_po_sui",
  "三台": "zw_adj_san_tai",
  "台辅": "zw_adj_tai_fu",
  "天才": "zw_adj_tian_cai",
  "天厨": "zw_adj_tian_chu",
  "天福": "zw_adj_tian_fu",
  "天官": "zw_adj_tian_guan",
  "天贵": "zw_adj_tian_gui",
  "天空": "zw_adj_tian_kong",
  "天哭": "zw_adj_tian_ku",
  "天伤": "zw_adj_tian_shang",
  "天使": "zw_adj_tian_shi",
  "天寿": "zw_adj_tian_shou",
  "天巫": "zw_adj_tian_wu",
  "天刑": "zw_adj_tian_xing",
  "天虚": "zw_adj_tian_xu",
  "天姚": "zw_adj_tian_yao",
  "天月": "zw_adj_tian_yue",
  "咸池": "zw_adj_xian_chi",
  "旬空": "zw_adj_xun_kong",
  "阴煞": "zw_adj_yin_sha",
  "攀鞍": "zw_jiangqian_pan_an",
  "岁驿": "zw_jiangqian_sui_yi",
  "天煞": "zw_jiangqian_tian_sha",
  "息神": "zw_jiangqian_xi_shen",
  "月煞": "zw_jiangqian_yue_sha",
  "指背": "zw_jiangqian_zhi_bei",
  "吊客": "zw_suiqian_diao_ke",
  "官符": "zw_suiqian_guan_fu",
  "贯索": "zw_suiqian_guan_suo",
  "晦气": "zw_suiqian_hui_qi",
  "龙德": "zw_suiqian_long_de",
  "丧门": "zw_suiqian_sang_men",
  "岁建": "zw_suiqian_sui_jian",
  "真太阳时": "tm_true_solar_time_cn",
  "白露": "jq_bailu",
  "处暑": "jq_chushu",
  "春分": "jq_chunfen",
  "大寒": "jq_dahan",
  "大暑": "jq_dashu",
  "大雪": "jq_daxue",
  "冬至": "jq_dongzhi",
  "谷雨": "jq_guyu",
  "寒露": "jq_hanlu",
  "惊蛰": "jq_jingzhe",
  "立春": "jq_lichun",
  "立冬": "jq_lidong",
  "立秋": "jq_liqiu",
  "立夏": "jq_lixia",
  "芒种": "jq_mangzhong",
  "清明": "jq_qingming",
  "秋分": "jq_qiufen",
  "霜降": "jq_shuangjiang",
  "夏至": "jq_xiazhi",
  "小寒": "jq_xiaohan",
  "小满": "jq_xiaoman",
  "小暑": "jq_xiaoshu",
  "小雪": "jq_xiaoxue",
  "雨水": "jq_yushui",
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
    zh: "岁环",
    en: "Transit",
    es: "Tránsito",
    de: "Transit",
    fr: "Transit",
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

/** 十神张力闭集 slug（S5 · 中性软译，禁凶断）。SSOT: pojulife-terms.ts */
export const TEN_GOD_TENSION_MARKER_IDS = ["shangguan_jianguan", "xiaoshen_duoshi"] as const;

function tensionSoftFromSsot(slug: (typeof TEN_GOD_TENSION_MARKER_IDS)[number]): FiveLocaleText {
  const t = pojuTermBySlug(slug);
  if (!t) {
    throw new Error(`TEN_GOD_TENSION_SOFT missing SSOT slug=${slug}`);
  }
  const locales: TermLocale[] = ["zh", "en", "es", "de", "fr"];
  const out = {} as FiveLocaleText;
  for (const loc of locales) {
    out[loc] = (t.definition[loc] || t.term[loc] || "").trim();
  }
  return out;
}

/**
 * Derived from POJU_TERMS definitions — do not parallel-edit.
 * Soft UI short labels live on term.*; this map keeps marker-plain compatibility.
 */
export const TEN_GOD_TENSION_SOFT: Record<
  (typeof TEN_GOD_TENSION_MARKER_IDS)[number],
  FiveLocaleText
> = {
  shangguan_jianguan: tensionSoftFromSsot("shangguan_jianguan"),
  xiaoshen_duoshi: tensionSoftFromSsot("xiaoshen_duoshi"),
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
 * Do not invent a second vernacular soft set outside POJU_TERMS.
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
