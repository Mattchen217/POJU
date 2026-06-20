/**
 * Authoritative closed-set 命理 terminology — derived from calculation engine enums.
 * Term glossary MUST cover exactly these (plus compliance-only entries elsewhere).
 */

import { LIFE_STAGE_HAN } from "@/lib/calculations/chang-sheng";
import type { TenGod } from "@/lib/match/data/stems-branches";
import { BRANCHES, STEMS } from "@/lib/match/data/stems-branches";

/** A1 — exactly 9 (bazi-shensha-local + match/data/shensha). 飞刃 = 羊刃. */
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

/** Terms the engine NEVER computes — model must not invent. */
export const OUT_OF_SET_FORBIDDEN_HAN = [
  "空亡",
  "天德",
  "月德",
  "将星",
  "劫煞",
  "亡神",
  "红鸾",
  "天喜",
  "天厨",
  "金舆",
  "学堂",
  "词馆",
  "魁罡",
  "十恶大败",
  "孤鸾",
  "阴阳差错",
  "元辰",
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
  六合: "liu_he",
  六冲: "liu_chong",
  三刑: "san_xing",
  六害: "liu_hai",
  三合: "san_he",
};

export const KEEP_CN_SLUGS = new Set([
  "day_master",
  "decade",
  "year",
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
