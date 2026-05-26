import { HOUR_PERIOD_INFO, type BirthInfo, type BirthLocation, type HourPeriod, type LegacyBirthFormInput } from "@/lib/profile/types";
import { guessLongitudeFromTimezone, standardMeridianFromTimezone } from "@/lib/profile/location-utils";

const HOUR_TO_PERIOD: Record<number, HourPeriod> = {
  0: "zi_early",
  1: "chou",
  2: "chou",
  3: "yin",
  4: "yin",
  5: "mao",
  6: "mao",
  7: "chen",
  8: "chen",
  9: "si",
  10: "si",
  11: "wu",
  12: "wu",
  13: "wei",
  14: "wei",
  15: "shen",
  16: "shen",
  17: "you",
  18: "you",
  19: "xu",
  20: "xu",
  21: "hai",
  22: "hai",
  23: "zi_early",
};

/** Map legacy hour (0–23) to nearest 时辰段 (for v4 → v5 migration). */
export function hourToHourPeriod(hour: number): HourPeriod {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  return HOUR_TO_PERIOD[h] ?? "wu";
}

export function legacyGenderToMF(gender: LegacyBirthFormInput["gender"]): "M" | "F" {
  if (gender === "female") return "F";
  return "M";
}

export function legacyFormToBirthInfo(input: LegacyBirthFormInput, timezoneFallback?: string): BirthInfo {
  const timezone =
    input.timezone?.trim() ||
    timezoneFallback ||
    (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
  return {
    year: input.year,
    month: input.month,
    day: input.day,
    hour_period: input.hour_period ?? hourToHourPeriod(input.hour),
    gender: legacyGenderToMF(input.gender),
    timezone,
  };
}

export function generateDisplayName(birth: BirthInfo): string {
  const dateStr = `${birth.year}-${String(birth.month).padStart(2, "0")}-${String(birth.day).padStart(2, "0")}`;
  const periodInfo = HOUR_PERIOD_INFO[birth.hour_period];
  const periodShort = periodInfo.en_label.split(" ").slice(0, 5).join(" ");
  const genderShort = birth.gender === "M" ? "M" : "F";
  return `${dateStr} · ${periodShort} · ${genderShort}`;
}

export function representativeHour(birth: BirthInfo): number {
  return HOUR_PERIOD_INFO[birth.hour_period].representative_hour;
}

export function buildDefaultBirthLocation(userTimezone: string): BirthLocation {
  return {
    name: "Default",
    longitude: guessLongitudeFromTimezone(userTimezone),
    timezone: userTimezone,
    use_defaults: true,
  };
}

/** Default city labels by IANA timezone (fallback when user skips location). */
const TZ_COORDS: Record<string, { latitude: number; longitude: number; city: string }> = {
  "Asia/Shanghai": { latitude: 31.23, longitude: 120, city: "Default (China)" },
  "Asia/Hong_Kong": { latitude: 22.32, longitude: 120, city: "Default (Hong Kong)" },
  "America/New_York": { latitude: 40.71, longitude: -75, city: "Default (US East)" },
  "America/Los_Angeles": { latitude: 34.05, longitude: -120, city: "Default (US West)" },
  "Europe/London": { latitude: 51.51, longitude: 0, city: "Default (London)" },
};

export function resolveBirthCoordinates(birth: BirthInfo): {
  longitude: number;
  latitude?: number;
  city?: string;
  name: string;
  use_defaults: boolean;
} {
  const loc = birth.birth_location;
  if (loc && !loc.use_defaults) {
    return {
      longitude: loc.longitude,
      latitude: loc.latitude,
      name: loc.name,
      use_defaults: false,
    };
  }

  const timezone = loc?.timezone ?? birth.timezone;
  const defaults = TZ_COORDS[timezone] ?? TZ_COORDS["Asia/Shanghai"];
  const longitude = guessLongitudeFromTimezone(timezone);
  return {
    longitude,
    latitude: defaults.latitude,
    city: defaults.city,
    name: loc?.name ?? defaults.city,
    use_defaults: true,
  };
}

export function shunshiParamsFromBirthInfo(birth: BirthInfo): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: 0 | 1;
  city?: string;
  latitude?: number;
  longitude?: number;
  standardMeridian: number;
  usedTrueSolarTime: boolean;
} {
  const coords = resolveBirthCoordinates(birth);
  const birthDate = new Date(birth.year, birth.month - 1, birth.day, representativeHour(birth));
  const timezone = birth.birth_location?.timezone ?? birth.timezone;

  return {
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour: representativeHour(birth),
    minute: 0,
    gender: birth.gender === "M" ? 1 : 0,
    city: coords.city,
    latitude: coords.latitude,
    longitude: coords.longitude,
    standardMeridian: standardMeridianFromTimezone(timezone, birthDate),
    usedTrueSolarTime: !coords.use_defaults,
  };
}

/** Normalize encrypted DB birth blob (v4 legacy or v5). */
export function normalizeStoredBirthInfo(raw: Record<string, unknown>): BirthInfo {
  const timezone = String(raw.timezone ?? "Asia/Shanghai");

  let birth_location: BirthInfo["birth_location"];
  if (raw.birth_location && typeof raw.birth_location === "object") {
    const bl = raw.birth_location as Record<string, unknown>;
    birth_location = {
      name: String(bl.name ?? "Default"),
      longitude: Number(bl.longitude),
      latitude: bl.latitude != null ? Number(bl.latitude) : undefined,
      timezone: String(bl.timezone ?? timezone),
      use_defaults: Boolean(bl.use_defaults),
    };
  } else if (raw.longitude != null && raw.location_name) {
    birth_location = {
      name: String(raw.location_name),
      longitude: Number(raw.longitude),
      latitude: raw.latitude != null ? Number(raw.latitude) : undefined,
      timezone,
      use_defaults: false,
    };
  }

  if (typeof raw.hour_period === "string" && HOUR_PERIOD_INFO[raw.hour_period as HourPeriod]) {
    return {
      year: Number(raw.year),
      month: Number(raw.month),
      day: Number(raw.day),
      hour_period: raw.hour_period as HourPeriod,
      gender: raw.gender === "F" || raw.gender === "female" ? "F" : "M",
      timezone,
      birth_location,
      tst_meta: raw.tst_meta as BirthInfo["tst_meta"],
    };
  }
  const hour = typeof raw.hour === "number" ? raw.hour : 12;
  const genderRaw = raw.gender;
  let gender: "M" | "F" = "M";
  if (genderRaw === "F" || genderRaw === "female") gender = "F";
  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    hour_period: hourToHourPeriod(hour),
    gender,
    timezone,
    birth_location,
    tst_meta: raw.tst_meta as BirthInfo["tst_meta"],
  };
}
