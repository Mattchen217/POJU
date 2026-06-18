/**
 * Syncro v5.1 — 5-dimension local score for one direction × hour combination.
 * @see docs/Syncro_Calculation_Engine.md Step 4
 */

import { Lunar } from "lunar-typescript";
import { QimenUtil } from "@/lib/qimen/QimenUtil";
import type { CurrentLevel } from "./current-system";
import {
  DIRECTION_TO_QIMEN_PALACE,
  EIGHT_DOORS_NATURE,
  EIGHT_GODS_NATURE,
  NINE_STARS_NATURE,
  SAN_QI_LIU_YI_BONUS,
} from "./qimen-direction-map";
import {
  getWuXingRelation,
  scoreForYongShen,
  STEM_TO_WUXING,
  type WuXing,
  type WuXingRelation,
} from "./wuxing-utils";
import {
  TASK_TO_QIMEN_FAVORED_DOORS,
  TASK_TO_DIRECTION_BONUS,
  type TaskKeywords,
} from "./task-keyword-extractor";
import type { DirectionId } from "./current-system";
import type { HourPeriod } from "./types";

export interface ScoreFactors {
  qimen_signals: {
    door_score: number;
    god_score: number;
    star_score: number;
    san_qi_bonus: number;
    is_kong_wang: boolean;
    favored_door_match: boolean;
    subtotal: number;
  };
  yong_shen_direction: {
    yong_shen_wuxing: WuXing;
    direction_wuxing: WuXing;
    relation: WuXingRelation;
    subtotal: number;
  };
  hour_yong_shen: {
    hour_stem_wuxing: WuXing;
    relation: WuXingRelation;
    subtotal: number;
  };
  day_master_direction: {
    day_master_wuxing: WuXing;
    direction_wuxing: WuXing;
    relation: WuXingRelation;
    subtotal: number;
  };
  task_direction_match: {
    task_type: string;
    bonus: number;
    subtotal: number;
  };
  xi_ji_adjustment?: {
    direction_bonus: number;
    hour_bonus: number;
    subtotal: number;
  };
  wuxing_balance_adjustment?: {
    subtotal: number;
  };
  total_score: number;
}

export function calculateCombinationScore(input: {
  yongShenWuXing: WuXing;
  dayMasterWuXing: WuXing;
  hourPeriod: HourPeriod;
  direction: DirectionId;
  combinationTime: Date;
  taskKeywords: TaskKeywords;
  xiShenWuXings?: WuXing[];
  jiShenWuXings?: WuXing[];
  wuxingStrength?: Record<string, number>;
}): ScoreFactors {
  const lunar = Lunar.fromDate(input.combinationTime);
  const qimenPan = QimenUtil.create(lunar);

  const palaceInfo = DIRECTION_TO_QIMEN_PALACE[input.direction];
  const cell = qimenPan.九宮[palaceInfo.palace_index];

  const doorInfo = cell.八門 ? EIGHT_DOORS_NATURE[cell.八門] : undefined;
  const doorScore = doorInfo?.score ?? 0;

  const godInfo = cell.八神 ? EIGHT_GODS_NATURE[cell.八神] : undefined;
  const godScore = godInfo?.score ?? 0;

  const starInfo = cell.九星 ? NINE_STARS_NATURE[cell.九星] : undefined;
  const starScore = starInfo?.score ?? 0;

  let sanQiBonus = 0;
  if (cell.天盤干?.length) {
    for (const stem of cell.天盤干) {
      sanQiBonus += SAN_QI_LIU_YI_BONUS[stem] ?? 0;
    }
  }

  const isKongWang = cell.是否空亡 ?? false;
  const kongWangPenalty = isKongWang ? -15 : 0;

  const favoredDoors =
    TASK_TO_QIMEN_FAVORED_DOORS[input.taskKeywords.primary_type] ?? [];
  const favoredDoorMatch = cell.八門
    ? favoredDoors.includes(cell.八門)
    : false;
  const favoredDoorBonus = favoredDoorMatch ? 8 : 0;

  const qimenSubtotal =
    (doorScore +
      godScore +
      starScore +
      sanQiBonus +
      kongWangPenalty +
      favoredDoorBonus) *
    0.3;

  const dirWuXing = palaceInfo.element as WuXing;
  const yongShenRelation = getWuXingRelation(
    input.yongShenWuXing,
    dirWuXing
  );
  const yongShenDirectionScore = scoreForYongShen(yongShenRelation) * 1.5;
  const yongShenSubtotal = yongShenDirectionScore * 0.25 * 3;

  const hourGanZhi = qimenPan.八字[3];
  const hourStem = hourGanZhi[0] ?? "甲";
  const hourStemWuXing = STEM_TO_WUXING[hourStem] ?? "木";
  const hourRelation = getWuXingRelation(
    input.yongShenWuXing,
    hourStemWuXing
  );
  const hourScore = scoreForYongShen(hourRelation);
  const hourSubtotal = hourScore * 0.2 * 3;

  const dayMasterRelation = getWuXingRelation(
    input.dayMasterWuXing,
    dirWuXing
  );
  const dayMasterScore = scoreForDayMaster(dayMasterRelation);
  const dayMasterSubtotal = dayMasterScore * 0.15 * 3;

  const directionBonusMap =
    TASK_TO_DIRECTION_BONUS[input.taskKeywords.primary_type] ?? {};
  const taskDirectionBonus = directionBonusMap[input.direction] ?? 0;
  const taskSubtotal = taskDirectionBonus * 0.1 * 3;

  const { directionBonus, hourBonus } = scoreXiJiAdjustment({
    dirWuXing,
    hourStemWuXing,
    xiShenWuXings: input.xiShenWuXings,
    jiShenWuXings: input.jiShenWuXings,
  });
  const xiJiSubtotal = (directionBonus + hourBonus) * 0.25;

  const wuxingBalanceSubtotal = scoreWuxingBalanceAdjustment({
    dirWuXing,
    wuxingStrength: input.wuxingStrength,
  });

  const totalScore =
    qimenSubtotal +
    yongShenSubtotal +
    hourSubtotal +
    dayMasterSubtotal +
    taskSubtotal +
    xiJiSubtotal +
    wuxingBalanceSubtotal;

  return {
    qimen_signals: {
      door_score: doorScore,
      god_score: godScore,
      star_score: starScore,
      san_qi_bonus: sanQiBonus,
      is_kong_wang: isKongWang,
      favored_door_match: favoredDoorMatch,
      subtotal: qimenSubtotal,
    },
    yong_shen_direction: {
      yong_shen_wuxing: input.yongShenWuXing,
      direction_wuxing: dirWuXing,
      relation: yongShenRelation,
      subtotal: yongShenSubtotal,
    },
    hour_yong_shen: {
      hour_stem_wuxing: hourStemWuXing,
      relation: hourRelation,
      subtotal: hourSubtotal,
    },
    day_master_direction: {
      day_master_wuxing: input.dayMasterWuXing,
      direction_wuxing: dirWuXing,
      relation: dayMasterRelation,
      subtotal: dayMasterSubtotal,
    },
    task_direction_match: {
      task_type: input.taskKeywords.primary_type,
      bonus: taskDirectionBonus,
      subtotal: taskSubtotal,
    },
    xi_ji_adjustment:
      directionBonus !== 0 || hourBonus !== 0
        ? {
            direction_bonus: directionBonus,
            hour_bonus: hourBonus,
            subtotal: xiJiSubtotal,
          }
        : undefined,
    wuxing_balance_adjustment:
      wuxingBalanceSubtotal !== 0
        ? { subtotal: wuxingBalanceSubtotal }
        : undefined,
    total_score: Math.round(totalScore * 100) / 100,
  };
}

function scoreXiJiAdjustment(input: {
  dirWuXing: WuXing;
  hourStemWuXing: WuXing;
  xiShenWuXings?: WuXing[];
  jiShenWuXings?: WuXing[];
}): { directionBonus: number; hourBonus: number } {
  let directionBonus = 0;
  let hourBonus = 0;

  for (const xi of input.xiShenWuXings ?? []) {
    const dirRel = getWuXingRelation(xi, input.dirWuXing);
    if (dirRel === "same" || dirRel === "shengSelf") directionBonus += 4;
    const hourRel = getWuXingRelation(xi, input.hourStemWuXing);
    if (hourRel === "same" || hourRel === "shengSelf") hourBonus += 3;
  }

  for (const ji of input.jiShenWuXings ?? []) {
    const dirRel = getWuXingRelation(ji, input.dirWuXing);
    if (dirRel === "same" || dirRel === "keOther") directionBonus -= 5;
    const hourRel = getWuXingRelation(ji, input.hourStemWuXing);
    if (hourRel === "same" || hourRel === "keOther") hourBonus -= 4;
  }

  return { directionBonus, hourBonus };
}

function scoreWuxingBalanceAdjustment(input: {
  dirWuXing: WuXing;
  wuxingStrength?: Record<string, number>;
}): number {
  const strength = input.wuxingStrength;
  if (!strength) return 0;

  const entries = Object.entries(strength) as Array<[WuXing, number]>;
  if (!entries.length) return 0;

  const avg = entries.reduce((sum, [, v]) => sum + v, 0) / entries.length;
  const weak = entries.filter(([, v]) => v <= avg * 0.85);
  if (!weak.length) return 0;

  let bonus = 0;
  for (const [wx] of weak) {
    if (getWuXingRelation(wx, input.dirWuXing) === "shengOther") {
      bonus += 3;
    }
  }

  return bonus * 0.15;
}

function scoreForDayMaster(relation: WuXingRelation): number {
  switch (relation) {
    case "same":
      return 5;
    case "shengOther":
      return 8;
    case "shengSelf":
      return -3;
    case "keOther":
      return -5;
    case "keSelf":
      return 3;
  }
}

export function scoreToCurrentLevel(score: number): CurrentLevel {
  if (score >= 25) return "open_current";
  if (score >= 8) return "following_current";
  if (score >= -8) return "stillwater";
  if (score >= -25) return "crosscurrent";
  return "undertow";
}
