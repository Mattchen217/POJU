import type { BirthInfo, BirthLocation, TstMeta } from "@/lib/profile/types";
import type { StoredProfileBirthInfo } from "@/lib/db/poju-db";
import { buildDefaultBirthLocation } from "@/lib/profile/birth-info-utils";

/** Serialize v5 BirthInfo for encrypted stored_profiles blob. */
export function birthInfoToStoredRecord(birth: BirthInfo): StoredProfileBirthInfo {
  const loc = birth.birth_location;
  return {
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour_period: birth.hour_period,
    gender: birth.gender,
    timezone: birth.timezone,
    birth_location: loc,
    tst_meta: birth.tst_meta,
    longitude: loc?.longitude,
    latitude: loc?.latitude,
    location_name: loc?.name,
  };
}

export type RegenerateChartBody = {
  profile_id?: string;
  birth_date?: string;
  birth_time?: string;
  year?: number;
  month?: number;
  day?: number;
  hour_period?: BirthInfo["hour_period"];
  gender?: "M" | "F";
  timezone?: string;
  longitude?: number | null;
  latitude?: number | null;
  location_name?: string;
  use_defaults?: boolean;
  user_timezone?: string;
  birth_location?: Partial<BirthLocation>;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

/** Parse regenerate / calculate API body into BirthInfo (Step 4). */
export function parseRegenerateChartBody(body: unknown): { birth: BirthInfo } | { error: string } {
  if (!isRecord(body)) return { error: "invalid_body" };

  const useDefaults = Boolean(body.use_defaults);
  const timezone =
    (typeof body.timezone === "string" && body.timezone.trim()) ||
    (typeof body.user_timezone === "string" && body.user_timezone.trim()) ||
    "UTC";

  let year = typeof body.year === "number" ? body.year : undefined;
  let month = typeof body.month === "number" ? body.month : undefined;
  let day = typeof body.day === "number" ? body.day : undefined;

  if (typeof body.birth_date === "string") {
    const [y, m, d] = body.birth_date.split("-").map(Number);
    if (Number.isFinite(y)) year = y;
    if (Number.isFinite(m)) month = m;
    if (Number.isFinite(d)) day = d;
  }

  if (year == null || month == null || day == null) {
    return { error: "invalid_birth_date" };
  }

  const gender = body.gender === "F" ? "F" : body.gender === "M" ? "M" : null;
  if (!gender) return { error: "invalid_gender" };

  const hourPeriod =
    typeof body.hour_period === "string"
      ? (body.hour_period as BirthInfo["hour_period"])
      : undefined;
  if (!hourPeriod) return { error: "invalid_hour_period" };

  let birth_location: BirthLocation | undefined;

  if (isRecord(body.birth_location)) {
    const bl = body.birth_location;
    if (!useDefaults && typeof bl.longitude !== "number") {
      return { error: "invalid_location" };
    }
    if (!useDefaults) {
      birth_location = {
        name: typeof bl.name === "string" ? bl.name : String(body.location_name ?? "Custom"),
        longitude: Number(bl.longitude),
        latitude: typeof bl.latitude === "number" ? bl.latitude : undefined,
        timezone: typeof bl.timezone === "string" ? bl.timezone : timezone,
        use_defaults: false,
      };
    }
  } else if (!useDefaults) {
    if (typeof body.longitude !== "number" || !Number.isFinite(body.longitude)) {
      return { error: "invalid_location" };
    }
    birth_location = {
      name: typeof body.location_name === "string" ? body.location_name : "Custom",
      longitude: body.longitude,
      latitude: typeof body.latitude === "number" ? body.latitude : undefined,
      timezone,
      use_defaults: false,
    };
  }

  if (useDefaults) {
    birth_location = buildDefaultBirthLocation(timezone);
  } else if (!birth_location) {
    return { error: "invalid_location" };
  }

  return {
    birth: {
      year,
      month,
      day,
      hour_period: hourPeriod,
      gender,
      timezone,
      birth_location,
    },
  };
}

export function tstMetaFromProfile(birth: BirthInfo, profile: {
  used_true_solar_time?: boolean;
  tst_meta?: TstMeta;
}): TstMeta | undefined {
  return profile.tst_meta ?? birth.tst_meta;
}
