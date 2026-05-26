/**
 * Syncro v5.1 — Wu Xing relations and stem/branch mappings.
 * @see docs/Syncro_Calculation_Engine.md Step 3
 */

import type { HourPeriod } from "./types";

export type WuXing = "木" | "火" | "土" | "金" | "水";

const SHENG: Record<WuXing, WuXing> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

const KE: Record<WuXing, WuXing> = {
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
};

export type WuXingRelation =
  | "same"
  | "shengSelf"
  | "shengOther"
  | "keSelf"
  | "keOther";

export function getWuXingRelation(a: WuXing, b: WuXing): WuXingRelation {
  if (a === b) return "same";
  if (SHENG[a] === b) return "shengSelf";
  if (SHENG[b] === a) return "shengOther";
  if (KE[a] === b) return "keSelf";
  if (KE[b] === a) return "keOther";
  return "same";
}

export function scoreForYongShen(yongShenRelation: WuXingRelation): number {
  switch (yongShenRelation) {
    case "same":
      return 12;
    case "shengOther":
      return 10;
    case "shengSelf":
      return -3;
    case "keOther":
      return -12;
    case "keSelf":
      return 5;
  }
}

export const STEM_TO_WUXING: Record<string, WuXing> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

export const BRANCH_TO_WUXING: Record<string, WuXing> = {
  寅: "木",
  卯: "木",
  巳: "火",
  午: "火",
  辰: "土",
  戌: "土",
  丑: "土",
  未: "土",
  申: "金",
  酉: "金",
  亥: "水",
  子: "水",
};

export const HOUR_PERIOD_TO_BRANCH: Record<HourPeriod, string> = {
  zi: "子",
  chou: "丑",
  yin: "寅",
  mao: "卯",
  chen: "辰",
  si: "巳",
  wu: "午",
  wei: "未",
  shen: "申",
  you: "酉",
  xu: "戌",
  hai: "亥",
};
