/**
 * Syncro v5.1 — 96-combination matrix (local levels + qimen snapshots for LLM).
 * @see docs/Syncro_Calculation_Engine.md Step 5
 * @see docs/Syncro_TrueSolarTime_Final.md Step 4 (true solar time)
 */

import { Lunar } from "lunar-typescript";
import { calculateTrueSolarTime, getZonedCalendarParts, zonedLocalToUtc } from "./true-solar-time";
import { QimenUtil } from "@/lib/qimen/QimenUtil";
import {
  calculateCombinationScore,
  scoreToCurrentLevel,
  type ScoreFactors,
} from "./calculate-score";
import { extractTaskKeywords } from "./task-keyword-extractor";
import { STEM_TO_WUXING, type WuXing } from "./wuxing-utils";
import { DIRECTION_TO_QIMEN_PALACE } from "./qimen-direction-map";
import { DIRECTIONS, type CurrentLevel, type DirectionId } from "./current-system";
import { matrixKey, type HourPeriod } from "./types";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import type { UserProfile } from "@/lib/profile/types";

export interface MatrixCell {
  hour_period: HourPeriod;
  direction_id: DirectionId;
  hour_start_iso: string;
  hour_end_iso: string;
  current_level: CurrentLevel;
  _internal: {
    total_score: number;
    key_factors: string[];
    qimen_data: {
      door: string;
      god: string;
      star: string;
      is_kong_wang: boolean;
    };
  };
  short_advice: string;
  detailed_advice: string;
  rationale: string;
}

export interface SyncroMatrixMetadata {
  localTime: string;
  trueSolarTime: string;
  diffMinutes: number;
  longitudeDiffMinutes: number;
  eqOfTimeMinutes: number;
  longitude: number;
  latitude: number;
}

export interface SyncroMatrixProfile {
  base_analysis?: {
    structured?: ProfileStructured;
    content?: {
      bazi?: { day_master?: string };
      yong_shen?: { primary_element?: string };
      [key: string]: unknown;
    };
  };
  user_profile?: UserProfile | null;
}

const HOUR_PERIOD_ORDER: HourPeriod[] = [
  "zi",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
];

const PERIOD_BASE_HOUR = [-1, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21] as const;

const WUXING_VALUES: WuXing[] = ["木", "火", "土", "金", "水"];

export function calculateSyncroMatrix(input: {
  profile: SyncroMatrixProfile;
  taskDescription: string;
  startTime: Date;
  userTimezone: string;
  userLongitude: number;
  userLatitude: number;
}): { matrix: Record<string, MatrixCell>; metadata: SyncroMatrixMetadata } {
  const tstResult = calculateTrueSolarTime({
    localTime: input.startTime,
    longitude: input.userLongitude,
    timezone: input.userTimezone,
  });

  console.log("[syncro] Local time:", input.startTime.toISOString());
  console.log("[syncro] True solar time:", tstResult.trueSolarTime.toISOString());
  console.log("[syncro] Diff (mins):", tstResult.diffMinutes);
  console.log("[syncro] Longitude diff:", tstResult.longitudeDiffMinutes);
  console.log("[syncro] Equation of time:", tstResult.eqOfTimeMinutes);

  const yongShenWuXing = extractYongShenWuXing(input.profile);
  const dayMasterWuXing = extractDayMasterWuXing(input.profile);
  const taskKeywords = extractTaskKeywords(input.taskDescription);
  const hourPeriods = generateNext12HourPeriods(
    tstResult.trueSolarTime,
    input.userTimezone,
  );

  const matrix: Record<string, MatrixCell> = {};
  const directionIds = Object.keys(DIRECTIONS) as DirectionId[];

  for (const period of hourPeriods) {
    for (const direction of directionIds) {
      const factors = calculateCombinationScore({
        yongShenWuXing,
        dayMasterWuXing,
        hourPeriod: period.id,
        direction,
        combinationTime: period.start,
        taskKeywords,
      });

      const level = scoreToCurrentLevel(factors.total_score);
      const keyFactors = extractKeyFactors(factors);
      const qimenData = getQimenCellSnapshot(period.start, direction);

      const key = matrixKey(period.id, direction);
      matrix[key] = {
        hour_period: period.id,
        direction_id: direction,
        hour_start_iso: period.start.toISOString(),
        hour_end_iso: period.end.toISOString(),
        current_level: level,
        _internal: {
          total_score: factors.total_score,
          key_factors: keyFactors,
          qimen_data: qimenData,
        },
        short_advice: "",
        detailed_advice: "",
        rationale: "",
      };
    }
  }

  return {
    matrix,
    metadata: {
      localTime: input.startTime.toISOString(),
      trueSolarTime: tstResult.trueSolarTime.toISOString(),
      diffMinutes: tstResult.diffMinutes,
      longitudeDiffMinutes: tstResult.longitudeDiffMinutes,
      eqOfTimeMinutes: tstResult.eqOfTimeMinutes,
      longitude: input.userLongitude,
      latitude: input.userLatitude,
    },
  };
}

function getQimenCellSnapshot(
  combinationTime: Date,
  direction: DirectionId
): MatrixCell["_internal"]["qimen_data"] {
  const lunar = Lunar.fromDate(combinationTime);
  const qimenPan = QimenUtil.create(lunar);
  const palace = DIRECTION_TO_QIMEN_PALACE[direction];
  const cell = qimenPan.九宮[palace.palace_index];

  return {
    door: cell.八門 ?? "",
    god: cell.八神 ?? "",
    star: cell.九星 ?? "",
    is_kong_wang: cell.是否空亡 ?? false,
  };
}

function extractKeyFactors(factors: ScoreFactors): string[] {
  const items: Array<{ name: string; score: number }> = [
    { name: "qimen", score: Math.abs(factors.qimen_signals.subtotal) },
    {
      name: "yong_shen_direction",
      score: Math.abs(factors.yong_shen_direction.subtotal),
    },
    { name: "hour_yong_shen", score: Math.abs(factors.hour_yong_shen.subtotal) },
    {
      name: "day_master_direction",
      score: Math.abs(factors.day_master_direction.subtotal),
    },
    {
      name: "task_direction",
      score: Math.abs(factors.task_direction_match.subtotal),
    },
  ];

  items.sort((a, b) => b.score - a.score);
  return items.slice(0, 3).map((i) => i.name);
}

function extractYongShenWuXing(profile: SyncroMatrixProfile): WuXing {
  const structuredYs = profile.base_analysis?.structured?.yong_shen;
  if (structuredYs) {
    if (STEM_TO_WUXING[structuredYs]) return STEM_TO_WUXING[structuredYs];
    if (WUXING_VALUES.includes(structuredYs as WuXing)) return structuredYs as WuXing;
  }

  const userYs = (profile.user_profile as { yong_shen?: { primary?: string } } | null)
    ?.yong_shen?.primary;
  const ys =
    profile.base_analysis?.content?.yong_shen?.primary_element ?? userYs ?? "木";

  if (STEM_TO_WUXING[ys]) return STEM_TO_WUXING[ys];
  if (WUXING_VALUES.includes(ys as WuXing)) return ys as WuXing;
  return "木";
}

function extractDayMasterWuXing(profile: SyncroMatrixProfile): WuXing {
  const structuredDm = profile.base_analysis?.structured?.day_master;
  if (structuredDm && STEM_TO_WUXING[structuredDm]) {
    return STEM_TO_WUXING[structuredDm];
  }

  const userDm = (profile.user_profile as { bazi?: { day_master?: string } } | null)
    ?.bazi?.day_master;
  const dm = profile.base_analysis?.content?.bazi?.day_master ?? userDm ?? "甲";

  return STEM_TO_WUXING[dm] ?? "木";
}

function getClockHour(date: Date, userTimezone: string): number {
  if (!userTimezone || userTimezone === "UTC") {
    return date.getUTCHours();
  }
  try {
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: userTimezone,
      hour: "numeric",
      hour12: false,
    }).format(date);
    return parseInt(hour, 10);
  } catch {
    return date.getHours();
  }
}

function hourToPeriodIndex(hour: number): number {
  if (hour >= 23 || hour < 1) return 0;
  if (hour < 3) return 1;
  if (hour < 5) return 2;
  if (hour < 7) return 3;
  if (hour < 9) return 4;
  if (hour < 11) return 5;
  if (hour < 13) return 6;
  if (hour < 15) return 7;
  if (hour < 17) return 8;
  if (hour < 19) return 9;
  if (hour < 21) return 10;
  return 11;
}

export function generateNext12HourPeriods(
  startTime: Date,
  userTimezone = "UTC",
): Array<{ id: HourPeriod; start: Date; end: Date }> {
  const currentHour = getClockHour(startTime, userTimezone);
  const currentIdx = hourToPeriodIndex(currentHour);
  const baseHour = PERIOD_BASE_HOUR[currentIdx];

  let { year, month, day } = getZonedCalendarParts(startTime, userTimezone);
  let startHour = baseHour === -1 ? 23 : baseHour;

  if (baseHour === -1 && currentHour < 1) {
    ({ year, month, day } = addCalendarDays({ year, month, day }, -1));
  }

  const period0Start = zonedLocalToUtc(
    { year, month, day, hour: startHour, minute: 0, second: 0 },
    userTimezone,
  );

  const periods: Array<{ id: HourPeriod; start: Date; end: Date }> = [];
  const slotMs = 2 * 60 * 60 * 1000;

  for (let i = 0; i < 12; i++) {
    const periodStart = new Date(period0Start.getTime() + i * slotMs);
    const periodEnd = new Date(periodStart.getTime() + slotMs);
    const idx = (currentIdx + i) % 12;
    periods.push({
      id: HOUR_PERIOD_ORDER[idx],
      start: periodStart,
      end: periodEnd,
    });
  }

  return periods;
}

function addCalendarDays(
  parts: { year: number; month: number; day: number },
  delta: number,
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}
