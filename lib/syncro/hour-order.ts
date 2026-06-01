import type { HourPeriod } from "@/lib/syncro/types";

/** Canonical order of the twelve two-hour periods (zi → hai). */
export const HOUR_ORDER: HourPeriod[] = [
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

/** Rotate so `livePeriod` is first (timeline UI order). */
export function sortedHourPeriodsFromLive(livePeriod: HourPeriod): HourPeriod[] {
  const idx = HOUR_ORDER.indexOf(livePeriod);
  if (idx < 0) return [...HOUR_ORDER];
  return [...HOUR_ORDER.slice(idx), ...HOUR_ORDER.slice(0, idx)];
}
