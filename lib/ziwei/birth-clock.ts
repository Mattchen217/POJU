/**
 * BirthInfo → iztro 入参。
 *
 * iztro `bySolar(solarDate, timeIndex, gender, fixLeap, language)`
 * - solarDate：阳历 `YYYY-M-D`（真太阳时或 tst_meta 校正后的日期）
 * - timeIndex：0 早子 … 11 亥，12 晚子。公式 `floor((hour + 1) / 2)`
 * - gender：`男` | `女`（大限顺逆由库内年干阴阳 + 性别决定）
 * - fixLeap：true（闰月前半月算上月，后半月算下月，库默认）
 * - language：`zh-CN`（只要宫名与星名，不要库内性格文案）
 *
 * 时辰来源，按优先级：
 * 1. `tst_meta` 已有真太阳时（与八字同一套校正）→ 直接用
 * 2. 具体出生地经度 → `calculateTrueSolarTime`（经度时差 + 时差方程）
 * 3. 否则用民事钟点，不拿时区猜测经度去改时辰
 *
 * 不调用 iztro `config()`。库默认 dayDivide=`forward`（晚子时 index 12 按库规则走）。
 */

import {
  calculateTrueSolarTime,
  getZonedCalendarParts,
  zonedLocalToUtc,
} from "@/lib/calendar/true-solar-time";
import { resolveBirthTimezone } from "@/lib/location/infer-birth-timezone";
import { representativeHour, resolveBirthCoordinates } from "@/lib/profile/birth-info-utils";
import type { BirthInfo } from "@/lib/profile/types";

export const IZTRO_FIX_LEAP = true;
export const IZTRO_LANGUAGE = "zh-CN" as const;

export type ZiweiClockSource = "tst_meta" | "true_solar" | "civil";

export type IztroBirthArgs = {
  solarDate: string;
  timeIndex: number;
  gender: "男" | "女";
  fixLeap: true;
  language: typeof IZTRO_LANGUAGE;
  clock: ZiweiClockSource;
};

type ClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  clock: ZiweiClockSource;
};

/** 0–23 点 → iztro 时辰序号。23 点为晚子（12），0 点为早子（0）。 */
export function hourToIztroTimeIndex(hour: number): number {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  return Math.floor((h + 1) / 2);
}

function solarDateString(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

function clockFromTstMeta(birth: BirthInfo): ClockParts | null {
  const meta = birth.tst_meta;
  if (!meta?.true_solar_date || !meta.true_solar_time) return null;
  const [year, month, day] = meta.true_solar_date.split("-").map((part) => Number(part));
  const hour = Number(meta.true_solar_time.slice(0, 2));
  if (!year || !month || !day || Number.isNaN(hour)) return null;
  return { year, month, day, hour, clock: "tst_meta" };
}

function clockFromCoordinates(birth: BirthInfo): ClockParts | null {
  const coords = resolveBirthCoordinates(birth);
  if (coords.use_defaults || !birth.birth_location) return null;
  const timezone = resolveBirthTimezone(birth);
  const hour = birth.hour ?? representativeHour(birth);
  const minute = birth.minute ?? 0;
  const instant = zonedLocalToUtc(
    { year: birth.year, month: birth.month, day: birth.day, hour, minute },
    timezone,
  );
  const tst = calculateTrueSolarTime({
    localTime: instant,
    longitude: coords.longitude,
    timezone,
  });
  const parts = getZonedCalendarParts(tst.trueSolarTime, timezone);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    clock: "true_solar",
  };
}

function clockFromCivil(birth: BirthInfo): ClockParts {
  return {
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour: birth.hour ?? representativeHour(birth),
    clock: "civil",
  };
}

export function birthInfoToIztroArgs(birth: BirthInfo): IztroBirthArgs {
  const clock = clockFromTstMeta(birth) ?? clockFromCoordinates(birth) ?? clockFromCivil(birth);
  return {
    solarDate: solarDateString(clock.year, clock.month, clock.day),
    timeIndex: hourToIztroTimeIndex(clock.hour),
    gender: birth.gender === "M" ? "男" : "女",
    fixLeap: IZTRO_FIX_LEAP,
    language: IZTRO_LANGUAGE,
    clock: clock.clock,
  };
}
