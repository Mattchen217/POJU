/**
 * Next 12 two-hour slots from session start (for Syncro 96-combo prompt + matrix enrichment).
 */

import { HOUR_PERIODS, getCurrentHourPeriod, type HourPeriod } from "./types";

const HOUR_ORDER: HourPeriod[] = [
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

export type HourPeriodSlot = {
  hour_period: HourPeriod;
  hour_period_name_zh: string;
  hour_period_name_en: string;
  start_time: string;
  end_time: string;
};

function startOfHourPeriod(date: Date, period: HourPeriod): Date {
  const d = new Date(date);
  const hour = date.getHours();

  if (period === "zi") {
    if (hour >= 23) {
      d.setHours(23, 0, 0, 0);
      return d;
    }
    d.setDate(d.getDate() - 1);
    d.setHours(23, 0, 0, 0);
    return d;
  }

  const startHour = HOUR_PERIODS[period].start_hour;
  d.setHours(startHour, 0, 0, 0);
  if (hour < startHour) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

/** 12 consecutive 2-hour periods starting from the period containing `startTime`. */
export function generateNext12HourPeriodSlots(startTime: Date = new Date()): HourPeriodSlot[] {
  const current = getCurrentHourPeriod(startTime);
  const startIdx = HOUR_ORDER.indexOf(current);
  let cursor = startOfHourPeriod(startTime, current);

  const slots: HourPeriodSlot[] = [];
  for (let i = 0; i < 12; i++) {
    const period = HOUR_ORDER[(startIdx + i) % 12];
    const info = HOUR_PERIODS[period];
    const periodStart = new Date(cursor);
    const periodEnd = new Date(periodStart.getTime() + 2 * 60 * 60 * 1000);
    slots.push({
      hour_period: period,
      hour_period_name_zh: info.name_zh,
      hour_period_name_en: info.name_en,
      start_time: periodStart.toISOString(),
      end_time: periodEnd.toISOString(),
    });
    cursor = periodEnd;
  }
  return slots;
}
