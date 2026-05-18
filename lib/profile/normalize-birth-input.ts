import { legacyFormToBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, HourPeriod, LegacyBirthFormInput } from "@/lib/profile/types";

/** API / form body: v5 `BirthInfo` or legacy hour/minute form (Step B bridge until Step C picker). */
export type BirthInfoInput = Partial<BirthInfo> | Partial<LegacyBirthFormInput>;

type RawBirthInput = {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  hour_period?: HourPeriod;
  gender?: BirthInfo["gender"] | LegacyBirthFormInput["gender"];
  timezone?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
};

export function normalizeBirthInfoInput(input: BirthInfoInput): BirthInfo {
  const raw = input as RawBirthInput;
  if (
    raw.hour_period &&
    raw.year != null &&
    raw.month != null &&
    raw.day != null &&
    (raw.gender === "M" || raw.gender === "F")
  ) {
    return {
      year: Number(raw.year),
      month: Number(raw.month),
      day: Number(raw.day),
      hour_period: raw.hour_period,
      gender: raw.gender,
      timezone: raw.timezone?.trim() || "Asia/Shanghai",
    };
  }
  return legacyFormToBirthInfo({
    year: Number(raw.year ?? 1990),
    month: Number(raw.month ?? 1),
    day: Number(raw.day ?? 1),
    hour: Number(raw.hour ?? 12),
    minute: Number(raw.minute ?? 0),
    gender:
      raw.gender === "male" || raw.gender === "female" || raw.gender === "other"
        ? raw.gender
        : raw.gender === "F"
          ? "female"
          : "male",
    city: raw.city,
    latitude: raw.latitude,
    longitude: raw.longitude,
    hour_period: raw.hour_period,
    timezone: raw.timezone,
  });
}
