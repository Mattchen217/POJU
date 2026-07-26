/**
 * 流月 / 流日干支（lunar-typescript）+ 子时换日边界。
 * 日运换日用用户本地墙钟，不用出生地真太阳时。
 */

import { Solar } from "lunar-typescript";

import type { EarthlyBranch, HeavenlyStem } from "@/lib/match/data/stems-branches";
import { getZonedCalendarParts } from "@/lib/syncro/true-solar-time";

export type LiuRiGanzhi = {
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  ganzhi: string;
};

export type LiuYueGanzhi = {
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  ganzhi: string;
};

/** Product default: 八字日自 23:00 子时起算（本地墙钟）。 */
export const DAY_BOUNDARY_POLICY = "zi_2300_local" as const;
export type DayBoundaryPolicy = typeof DAY_BOUNDARY_POLICY;

export type SolarYmd = {
  year: number;
  month: number;
  day: number;
};

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month] ?? 30;
}

/** Add one civil calendar day (Y/M/D only). */
export function addOneCalendarDay(ymd: SolarYmd): SolarYmd {
  let { year, month, day } = ymd;
  day += 1;
  const dim = daysInMonth(year, month);
  if (day > dim) {
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return { year, month, day };
}

/**
 * Normalize wall-clock hour and apply 23:00 子时换日.
 * `hour === 24` (some Intl locales for midnight) → treat as 00:00 on the reported civil day
 * without an extra roll (date parts already represent that midnight's civil day when hour is 0;
 * when hour is 24 on the previous label day, roll once).
 */
export function resolveBaziDayYmd(
  ymd: SolarYmd,
  hour: number,
): SolarYmd {
  if (hour === 24) {
    return addOneCalendarDay(ymd);
  }
  if (hour >= 23) {
    return addOneCalendarDay(ymd);
  }
  return { ...ymd };
}

function ganzhiFromSolarYmd(ymd: SolarYmd): {
  day: LiuRiGanzhi;
  month: LiuYueGanzhi;
} {
  const solar = Solar.fromYmd(ymd.year, ymd.month, ymd.day);
  const lunar = solar.getLunar();
  const dayStem = lunar.getDayGan() as HeavenlyStem;
  const dayBranch = lunar.getDayZhi() as EarthlyBranch;
  const monthStem = lunar.getMonthGan() as HeavenlyStem;
  const monthBranch = lunar.getMonthZhi() as EarthlyBranch;
  return {
    day: {
      stem: dayStem,
      branch: dayBranch,
      ganzhi: `${dayStem}${dayBranch}`,
    },
    month: {
      stem: monthStem,
      branch: monthBranch,
      ganzhi: `${monthStem}${monthBranch}`,
    },
  };
}

export type BaziDayContext = {
  wall: SolarYmd & { hour: number; minute: number; second: number };
  baziDay: SolarYmd;
  /** YYYY-MM-DD of the 八字日 (after zi boundary). */
  baziDayDate: string;
  dayBoundaryPolicy: DayBoundaryPolicy;
  timezone: string;
};

function formatYmd(ymd: SolarYmd): string {
  const m = String(ymd.month).padStart(2, "0");
  const d = String(ymd.day).padStart(2, "0");
  return `${ymd.year}-${m}-${d}`;
}

/** Resolve local wall clock + 八字日 YMD for a UTC instant in `timezone`. */
export function resolveBaziDayContext(
  date: Date,
  timezone: string,
): BaziDayContext {
  const parts = getZonedCalendarParts(date, timezone);
  const wall: SolarYmd & { hour: number; minute: number; second: number } = {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
  const baziDay = resolveBaziDayYmd(
    { year: parts.year, month: parts.month, day: parts.day },
    parts.hour,
  );
  return {
    wall,
    baziDay,
    baziDayDate: formatYmd(baziDay),
    dayBoundaryPolicy: DAY_BOUNDARY_POLICY,
    timezone,
  };
}

/** 流日干支（子时换日后的公历日）。 */
export function getLiuriGanzhi(date = new Date(), timezone = "UTC"): LiuRiGanzhi {
  const ctx = resolveBaziDayContext(date, timezone);
  return ganzhiFromSolarYmd(ctx.baziDay).day;
}

/**
 * 流月干支（节令月）。
 * Uses the same 八字日 YMD so late-night wall clock near 节令 stays consistent with 流日.
 */
export function getLiuyueGanzhi(date = new Date(), timezone = "UTC"): LiuYueGanzhi {
  const ctx = resolveBaziDayContext(date, timezone);
  return ganzhiFromSolarYmd(ctx.baziDay).month;
}

/** Both pillars from one Solar lookup (after zi boundary). */
export function getLiuriAndLiuyue(
  date = new Date(),
  timezone = "UTC",
): { liuri: LiuRiGanzhi; liuyue: LiuYueGanzhi; context: BaziDayContext } {
  const context = resolveBaziDayContext(date, timezone);
  const both = ganzhiFromSolarYmd(context.baziDay);
  return { liuri: both.day, liuyue: both.month, context };
}
