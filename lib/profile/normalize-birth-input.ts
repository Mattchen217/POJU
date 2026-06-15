import { buildDefaultBirthLocation, legacyFormToBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, BirthLocation, HourPeriod, LegacyBirthFormInput } from "@/lib/profile/types";

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
  user_timezone?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  use_defaults?: boolean;
  birth_location?: Partial<BirthLocation>;
};

function parseBirthLocation(raw: RawBirthInput, timezone: string): BirthInfo["birth_location"] | undefined {
  if (raw.use_defaults) {
    return buildDefaultBirthLocation(timezone);
  }

  if (raw.birth_location && typeof raw.birth_location.longitude === "number") {
    return {
      name: raw.birth_location.name?.trim() || raw.location_name?.trim() || "Custom",
      longitude: raw.birth_location.longitude,
      latitude: raw.birth_location.latitude,
      timezone: raw.birth_location.timezone?.trim() || timezone,
      use_defaults: false,
    };
  }

  if (raw.longitude != null && Number.isFinite(Number(raw.longitude))) {
    return {
      name: raw.city?.trim() || raw.location_name?.trim() || "Custom",
      longitude: Number(raw.longitude),
      latitude: raw.latitude != null ? Number(raw.latitude) : undefined,
      timezone,
      use_defaults: false,
    };
  }

  return undefined;
}

export function normalizeBirthInfoInput(input: BirthInfoInput): BirthInfo {
  const raw = input as RawBirthInput;
  if (
    raw.hour_period &&
    raw.year != null &&
    raw.month != null &&
    raw.day != null &&
    (raw.gender === "M" || raw.gender === "F")
  ) {
    const timezone =
      raw.timezone?.trim() ||
      raw.user_timezone?.trim() ||
      (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Shanghai");
    const birth_location = parseBirthLocation(raw, timezone);

    return {
      year: Number(raw.year),
      month: Number(raw.month),
      day: Number(raw.day),
      hour_period: raw.hour_period,
      hour: raw.hour != null ? Number(raw.hour) : undefined,
      minute: raw.minute != null ? Number(raw.minute) : undefined,
      gender: raw.gender,
      timezone,
      birth_location,
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
