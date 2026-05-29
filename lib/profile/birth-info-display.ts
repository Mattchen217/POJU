import { HOUR_PERIOD_INFO, type BirthLocation, type HourPeriod } from "@/lib/profile/types";
import type { StoredProfileSummary } from "@/lib/profile/stored-profiles-service";

export interface BirthInfoDisplayRow {
  year: number;
  month: number;
  day: number;
  hour_period: HourPeriod;
  gender: "M" | "F";
  timezone: string;
  birth_location_name?: string;
  birth_location_defaults?: boolean;
}

/** True when the stored name is a timezone placeholder, not a user-selected city. */
export function isGenericDefaultLocationName(name: string | undefined | null): boolean {
  const n = name?.trim();
  if (!n) return true;
  if (n === "Default") return true;
  return /^Default\s*\(/i.test(n);
}

/** Display label for birth location — always prefer a real city name over "default" copy. */
export function formatBirthLocationLabel(
  loc: Pick<BirthLocation, "name" | "use_defaults"> | null | undefined,
  defaultLabel: string,
): string {
  if (!loc) return defaultLabel;
  const name = loc.name?.trim();
  if (name && !isGenericDefaultLocationName(name)) {
    return name;
  }
  if (loc.use_defaults) return defaultLabel;
  return name || defaultLabel;
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
    birth_location_name: p.birth_location_name,
    birth_location_defaults: p.birth_location_use_defaults,
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
