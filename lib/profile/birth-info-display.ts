import { HOUR_PERIOD_INFO, type HourPeriod } from "@/lib/profile/types";
import type { StoredProfileSummary } from "@/lib/profile/stored-profiles-service";

export interface BirthInfoDisplayRow {
  year: number;
  month: number;
  day: number;
  hour_period: HourPeriod;
  gender: "M" | "F";
  timezone: string;
}

export function parseStoredProfileSummaryForDisplay(p: StoredProfileSummary): BirthInfoDisplayRow {
  const [y, m, d] = p.birth_date.split("-").map((x) => parseInt(x, 10));
  return {
    year: Number.isFinite(y) ? y : 0,
    month: Number.isFinite(m) ? m : 1,
    day: Number.isFinite(d) ? d : 1,
    hour_period: p.hour_period,
    gender: p.gender,
    timezone: p.timezone || "UTC",
  };
}

/** Primary + secondary labels for 时辰 (always bilingual per Step D). */
export function formatHourPeriodBilingual(hourPeriod: HourPeriod): {
  primary: string;
  secondary: string;
} {
  const info = HOUR_PERIOD_INFO[hourPeriod];
  return {
    primary: info.en_label,
    secondary: `${info.zh_label} · ${info.chinese_name}`,
  };
}
