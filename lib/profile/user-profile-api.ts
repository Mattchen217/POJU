/**
 * Server API validation for UserProfile (v5 + legacy birth payloads).
 */
import { representativeHour } from "@/lib/profile/birth-info-utils";
import { HOUR_PERIOD_INFO, type BirthInfo, type BirthLocation, type HourPeriod, type TstMeta, type UserProfile } from "@/lib/profile/types";

const HOUR_PERIODS = new Set<string>(Object.keys(HOUR_PERIOD_INFO));

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function normalizeGender(raw: unknown): "M" | "F" | null {
  if (raw === "M" || raw === "male") return "M";
  if (raw === "F" || raw === "female") return "F";
  if (raw === "other") return "M";
  return null;
}

function hourToPeriod(hour: number): HourPeriod {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  let best: HourPeriod = "zi_early";
  let bestDist = 99;
  for (const key of HOUR_PERIODS) {
    const period = key as HourPeriod;
    const rep = HOUR_PERIOD_INFO[period].representative_hour;
    const dist = Math.min(Math.abs(h - rep), 24 - Math.abs(h - rep));
    if (dist < bestDist) {
      bestDist = dist;
      best = period;
    }
  }
  return best;
}

function normalizeBirthLocation(raw: unknown, timezone: string): BirthLocation | undefined {
  if (!isRecord(raw)) return undefined;
  if (typeof raw.longitude !== "number") return undefined;
  return {
    name: typeof raw.name === "string" ? raw.name : "Custom",
    longitude: raw.longitude,
    latitude: typeof raw.latitude === "number" ? raw.latitude : undefined,
    timezone: typeof raw.timezone === "string" && raw.timezone.trim() ? raw.timezone.trim() : timezone,
    use_defaults: Boolean(raw.use_defaults),
  };
}

function normalizeTstMeta(raw: unknown): TstMeta | undefined {
  if (!isRecord(raw)) return undefined;
  if (typeof raw.original_date !== "string" || typeof raw.true_solar_date !== "string") return undefined;
  return {
    original_date: raw.original_date,
    original_time: String(raw.original_time ?? ""),
    true_solar_date: raw.true_solar_date,
    true_solar_time: String(raw.true_solar_time ?? ""),
    diff_minutes: typeof raw.diff_minutes === "number" ? raw.diff_minutes : 0,
    longitude: typeof raw.longitude === "number" ? raw.longitude : 0,
    timezone: String(raw.timezone ?? "UTC"),
    computation_version: raw.computation_version === "v2_with_tst" ? "v2_with_tst" : "v1",
  };
}

function normalizeBirth(raw: unknown): BirthInfo | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.year !== "number" || typeof raw.month !== "number" || typeof raw.day !== "number") {
    return null;
  }

  const gender = normalizeGender(raw.gender);
  if (!gender) return null;

  const timezone = typeof raw.timezone === "string" && raw.timezone.trim() ? raw.timezone.trim() : "UTC";
  const birth_location = normalizeBirthLocation(raw.birth_location, timezone);
  const tst_meta = normalizeTstMeta(raw.tst_meta);

  if (typeof raw.hour_period === "string" && HOUR_PERIODS.has(raw.hour_period)) {
    return {
      year: raw.year,
      month: raw.month,
      day: raw.day,
      hour_period: raw.hour_period as HourPeriod,
      gender,
      timezone,
      birth_location,
      tst_meta,
    };
  }

  if (typeof raw.hour === "number") {
    const legacy: BirthInfo = {
      year: raw.year,
      month: raw.month,
      day: raw.day,
      hour_period: hourToPeriod(raw.hour),
      gender,
      timezone,
      birth_location,
      tst_meta,
    };
    if (typeof raw.hour_period === "string" && HOUR_PERIODS.has(raw.hour_period)) {
      legacy.hour_period = raw.hour_period as HourPeriod;
    }
    return legacy;
  }

  return null;
}

/**
 * Parse and validate `user_profile` from API request body (v5 stored profile shape).
 */
export function parseUserProfileForApi(raw: unknown): UserProfile | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;

  const birth = normalizeBirth(raw.birth);
  if (!birth) return null;

  if (!isRecord(raw.bazi)) return null;
  const z = raw.bazi;
  if (typeof z.yearPillar !== "string" || typeof z.monthPillar !== "string") return null;
  if (typeof z.dayPillar !== "string" || typeof z.hourPillar !== "string") return null;

  if (!isRecord(raw.diagnosis)) return null;
  if (typeof raw.diagnosis.dayMaster !== "string") return null;
  if (!Array.isArray(raw.diagnosis.favorableElements) || !Array.isArray(raw.diagnosis.challengingElements)) {
    return null;
  }
  if (typeof raw.diagnosis.patternSummary !== "string") return null;

  const source = raw.source === "fallback" ? "fallback" : "shunshi";
  const now = Date.now();

  return {
    id: raw.id.trim(),
    birth,
    bazi: {
      yearPillar: z.yearPillar,
      monthPillar: z.monthPillar,
      dayPillar: z.dayPillar,
      hourPillar: z.hourPillar,
    },
    diagnosis: {
      dayMaster: raw.diagnosis.dayMaster,
      favorableElements: raw.diagnosis.favorableElements.map(String),
      challengingElements: raw.diagnosis.challengingElements.map(String),
      patternSummary: raw.diagnosis.patternSummary,
    },
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
    source,
    used_true_solar_time: raw.used_true_solar_time === true,
    tst_meta: normalizeTstMeta(raw.tst_meta) ?? birth.tst_meta,
  };
}

/** @deprecated use parseUserProfileForApi */
export function isApiUserProfile(raw: unknown): raw is UserProfile {
  return parseUserProfileForApi(raw) !== null;
}

/** Ensure stream/JSON routes send a body that passes API validation. */
export function userProfileForApiRequest(profile: UserProfile): UserProfile {
  const birth = normalizeBirth(profile.birth) ?? profile.birth;
  return { ...profile, birth };
}

export function assertUserProfileApiShape(profile: UserProfile): void {
  const repHour = representativeHour(profile.birth);
  if (!parseUserProfileForApi({ ...profile, birth: { ...profile.birth, hour: repHour } })) {
    throw new Error("UserProfile is missing required v5 birth fields (hour_period, gender M/F)");
  }
}
