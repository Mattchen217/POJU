/**
 * Syncro v5.1 — compass directions ↔ Qimen 九宮 indices + door/star/god score tables.
 * @see docs/Syncro_Calculation_Engine.md Step 2
 */

import type { DirectionId } from "./current-system";

/**
 * 8 方位与奇门 9 宫的对应关系
 * (中宫无方位,不参与外部方向计算)
 *
 * 奇门 九宮[i] 顺序 (飛星序 / 宮位飛星序):
 * 0坎(北) 1坤(西南) 2震(东) 3巽(东南) 4中
 * 5乾(西北) 6兑(西) 7艮(东北) 8离(南)
 */
export interface QimenPalaceInfo {
  palace_index: number;
  palace_name: string;
  bagua: string;
  element: string;
}

export const DIRECTION_TO_QIMEN_PALACE: Record<DirectionId, QimenPalaceInfo> = {
  N: { palace_index: 0, palace_name: "坎一宮", bagua: "坎", element: "水" },
  SW: { palace_index: 1, palace_name: "坤二宮", bagua: "坤", element: "土" },
  E: { palace_index: 2, palace_name: "震三宮", bagua: "震", element: "木" },
  SE: { palace_index: 3, palace_name: "巽四宮", bagua: "巽", element: "木" },
  NW: { palace_index: 5, palace_name: "乾六宮", bagua: "乾", element: "金" },
  W: { palace_index: 6, palace_name: "兌七宮", bagua: "兑", element: "金" },
  NE: { palace_index: 7, palace_name: "艮八宮", bagua: "艮", element: "土" },
  S: { palace_index: 8, palace_name: "離九宮", bagua: "離", element: "火" },
};

export const EIGHT_DOORS_NATURE: Record<
  string,
  {
    type: "good" | "neutral" | "bad";
    score: number;
    meaning_en: string;
    meaning_zh: string;
    suits: string[];
  }
> = {
  開門: {
    type: "good",
    score: 20,
    meaning_en: "Open Gate · Opportunities, new starts",
    meaning_zh: "開門 · 開創、求人、求职、谈判",
    suits: ["启动", "会面", "谈判", "求职"],
  },
  休門: {
    type: "good",
    score: 18,
    meaning_en: "Rest Gate · Stillness, recovery",
    meaning_zh: "休門 · 休养、避祸、隐居",
    suits: ["休息", "内省", "回避"],
  },
  生門: {
    type: "good",
    score: 20,
    meaning_en: "Life Gate · Wealth, growth",
    meaning_zh: "生門 · 求财、置业、投资",
    suits: ["求财", "投资", "置业", "增长"],
  },
  景門: {
    type: "neutral",
    score: 0,
    meaning_en: "Vision Gate · Display, but not closure",
    meaning_zh: "景門 · 求名、争讼、宣传",
    suits: ["展示", "宣传", "争讼"],
  },
  杜門: {
    type: "neutral",
    score: -5,
    meaning_en: "Block Gate · Concealment, secrecy",
    meaning_zh: "杜門 · 藏匿、避祸、保密",
    suits: ["隐藏", "保密"],
  },
  傷門: {
    type: "bad",
    score: -15,
    meaning_en: "Harm Gate · Loss, injury",
    meaning_zh: "傷門 · 受伤、损失、冲突",
    suits: [],
  },
  驚門: {
    type: "bad",
    score: -18,
    meaning_en: "Shock Gate · Surprise, fright",
    meaning_zh: "驚門 · 惊吓、官非、谣言",
    suits: [],
  },
  死門: {
    type: "bad",
    score: -20,
    meaning_en: "Death Gate · Ending, stagnation",
    meaning_zh: "死門 · 终结、停滞、丧事",
    suits: [],
  },
};

export const EIGHT_GODS_NATURE: Record<
  string,
  {
    type: "auspicious" | "neutral" | "inauspicious";
    score: number;
  }
> = {
  值符: { type: "auspicious", score: 15 },
  騰蛇: { type: "inauspicious", score: -10 },
  螣蛇: { type: "inauspicious", score: -10 },
  太陰: { type: "auspicious", score: 10 },
  六合: { type: "auspicious", score: 12 },
  白虎: { type: "inauspicious", score: -15 },
  玄武: { type: "inauspicious", score: -8 },
  九地: { type: "auspicious", score: 8 },
  九天: { type: "auspicious", score: 12 },
};

export const NINE_STARS_NATURE: Record<
  string,
  {
    type: "good" | "neutral" | "bad";
    score: number;
  }
> = {
  天蓬: { type: "bad", score: -12 },
  天任: { type: "good", score: 12 },
  天冲: { type: "neutral", score: 0 },
  天輔: { type: "good", score: 15 },
  天英: { type: "neutral", score: 0 },
  天芮: { type: "bad", score: -10 },
  天柱: { type: "bad", score: -8 },
  天心: { type: "good", score: 12 },
  天禽: { type: "good", score: 10 },
};

export const SAN_QI_LIU_YI_BONUS: Record<string, number> = {
  乙: 15,
  丙: 18,
  丁: 15,
  戊: 0,
  己: -5,
  庚: -8,
  辛: 0,
  壬: 0,
  癸: 0,
};
