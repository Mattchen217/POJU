import type { StoredProfileData } from "@/lib/db/poju-db";
import { HOUR_PERIOD_INFO } from "@/lib/profile/types";
import { normalizeStoredBirthInfo } from "@/lib/profile/birth-info-utils";

export function formatGlyphProfileShort(profile: StoredProfileData, locale: string): string {
  const b = normalizeStoredBirthInfo(profile.birth_info as unknown as Record<string, unknown>);
  const dateStr = `${b.year}.${String(b.month).padStart(2, "0")}.${String(b.day).padStart(2, "0")}`;
  const period = HOUR_PERIOD_INFO[b.hour_period];
  const periodLabel = locale.startsWith("zh") ? period.zh_label : period.en_label;
  const gender = b.gender === "M" ? (locale.startsWith("zh") ? "男" : "M") : locale.startsWith("zh") ? "女" : "F";
  return `${dateStr} · ${periodLabel} · ${gender}`;
}

/** Map v5 hour_period → legacy Oracle `UserInput.birthShichen` (zi/chou/…). */
export function hourPeriodToShichen(hourPeriod: string): string {
  const base = hourPeriod.split("_")[0];
  const allowed = ["zi", "chou", "yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai"];
  return allowed.includes(base) ? base : "wu";
}
