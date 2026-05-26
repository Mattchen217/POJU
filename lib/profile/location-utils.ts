import { getTimezoneOffsetMinutes } from "@/lib/syncro/true-solar-time";

/** IANA timezone → standard meridian (°E). Fallback uses offset at birth date. */
const TZ_CENTER_LONGITUDE: Record<string, number> = {
  "Asia/Shanghai": 120,
  "Asia/Beijing": 120,
  "Asia/Hong_Kong": 120,
  "Asia/Tokyo": 135,
  "Asia/Seoul": 135,
  "Asia/Singapore": 105,
  "America/New_York": -75,
  "America/Chicago": -90,
  "America/Denver": -105,
  "America/Los_Angeles": -120,
  "Europe/London": 0,
  "Europe/Paris": 15,
  "Europe/Berlin": 15,
  "Australia/Sydney": 150,
  UTC: 0,
};

/** Standard meridian for shunshi-bazi-core `standardMeridian` (DST-aware). */
export function standardMeridianFromTimezone(timezone: string, date: Date): number {
  if (TZ_CENTER_LONGITUDE[timezone] != null) {
    return TZ_CENTER_LONGITUDE[timezone];
  }
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, date);
  return (offsetMinutes / 60) * 15;
}

/** Default birth longitude when user skips location (timezone center). */
export function guessLongitudeFromTimezone(timezone: string, date?: Date): number {
  if (TZ_CENTER_LONGITUDE[timezone] != null) {
    return TZ_CENTER_LONGITUDE[timezone];
  }
  return standardMeridianFromTimezone(timezone, date ?? new Date());
}
