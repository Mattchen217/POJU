/**
 * 当前运限：大运 + 流年 + 流月 + 流日（正确 dayunIndex）。
 */

import { resolveCurrentDaYunStep } from "@/lib/base-analysis/core-judgments";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";
import { getCurrentLiunian, type LiuNianGanzhi } from "@/lib/calculations/liunian";
import {
  DAY_BOUNDARY_POLICY,
  getLiuriAndLiuyue,
  type DayBoundaryPolicy,
  type LiuRiGanzhi,
  type LiuYueGanzhi,
} from "@/lib/calculations/liuri";
import type { EarthlyBranch, HeavenlyStem } from "@/lib/match/data/stems-branches";

export type LuckCycleGanzhi = {
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  ganzhi: string;
};

export type ResolvedLuckCycles = {
  dayun: LuckCycleGanzhi | null;
  dayunIndex: number | null;
  dayunEntry: DaYunEntry | null;
  liunian: LiuNianGanzhi;
  liuyue: LiuYueGanzhi;
  liuri: LiuRiGanzhi;
  asOf: {
    iso: string;
    timezone: string;
    localDate: string;
    localTime: string;
    baziDayDate: string;
    dayBoundaryPolicy: DayBoundaryPolicy;
  };
};

function parseGanzhi(ganzhi: string): LuckCycleGanzhi | null {
  const stem = ganzhi.charAt(0) as HeavenlyStem;
  const branch = ganzhi.charAt(1) as EarthlyBranch;
  if (!stem || !branch) return null;
  return { stem, branch, ganzhi };
}

/**
 * Resolve all luck-cycle pillars for Atmos / dynamic relations.
 * `date` is a UTC instant; wall clock + zi boundary use `timezone`.
 */
export function resolveLuckCycles(
  structured: ProfileStructured,
  date: Date = new Date(),
  timezone = "UTC",
): ResolvedLuckCycles {
  const { liuri, liuyue, context } = getLiuriAndLiuyue(date, timezone);

  // 流年仍按立春换年；用 八字日 YMD 构造 Date，避免 23:00 后仍用「昨天」立春判断漂移。
  const liunianAnchor = new Date(
    Date.UTC(context.baziDay.year, context.baziDay.month - 1, context.baziDay.day, 12, 0, 0),
  );
  const liunian = getCurrentLiunian(liunianAnchor);

  const nowYear = context.baziDay.year;
  const dayunIndex = resolveCurrentDaYunStep(structured.da_yun ?? [], nowYear);
  const dayunEntry =
    dayunIndex !== null && structured.da_yun?.[dayunIndex]
      ? structured.da_yun[dayunIndex]!
      : null;
  const dayun = dayunEntry ? parseGanzhi(dayunEntry.ganzhi) : null;

  const localDate = `${String(context.wall.year).padStart(4, "0")}-${String(context.wall.month).padStart(2, "0")}-${String(context.wall.day).padStart(2, "0")}`;
  const localTime = `${String(context.wall.hour).padStart(2, "0")}:${String(context.wall.minute).padStart(2, "0")}:${String(context.wall.second).padStart(2, "0")}`;

  return {
    dayun,
    dayunIndex,
    dayunEntry,
    liunian,
    liuyue,
    liuri,
    asOf: {
      iso: date.toISOString(),
      timezone,
      localDate,
      localTime,
      baziDayDate: context.baziDayDate,
      dayBoundaryPolicy: DAY_BOUNDARY_POLICY,
    },
  };
}
