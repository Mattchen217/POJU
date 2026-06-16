import { standardMeridianFromTimezone } from "@/lib/profile/location-utils";

/** Primary civil-time IANA zone for a country label (English or Chinese). */
const COUNTRY_TIMEZONE: Record<string, string> = {
  China: "Asia/Shanghai",
  中国: "Asia/Shanghai",
  Japan: "Asia/Tokyo",
  日本: "Asia/Tokyo",
  "South Korea": "Asia/Seoul",
  Korea: "Asia/Seoul",
  韩国: "Asia/Seoul",
  "Hong Kong": "Asia/Hong_Kong",
  香港: "Asia/Hong_Kong",
  Taiwan: "Asia/Taipei",
  台湾: "Asia/Taipei",
  Singapore: "Asia/Singapore",
  新加坡: "Asia/Singapore",
  "United Kingdom": "Europe/London",
  UK: "Europe/London",
  France: "Europe/Paris",
  Germany: "Europe/Berlin",
  Australia: "Australia/Sydney",
};

function countryFromLocationName(name: string): string {
  const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** Rough IANA zone from longitude when country mapping is unavailable. */
export function inferTimezoneFromLongitude(longitude: number): string {
  if (longitude >= 127.5) return "Asia/Tokyo";
  if (longitude >= 112.5) return "Asia/Shanghai";
  if (longitude >= 97.5) return "Asia/Shanghai";
  if (longitude >= 82.5) return "Asia/Kolkata";
  if (longitude >= 52.5) return "Asia/Dubai";
  if (longitude >= 37.5) return "Europe/Moscow";
  if (longitude >= 22.5) return "Europe/Berlin";
  if (longitude >= 7.5) return "Europe/Paris";
  if (longitude >= -7.5) return "Europe/London";
  if (longitude >= -52.5) return "America/New_York";
  if (longitude >= -67.5) return "America/New_York";
  if (longitude >= -82.5) return "America/Chicago";
  if (longitude >= -97.5) return "America/Denver";
  if (longitude >= -112.5) return "America/Denver";
  if (longitude >= -127.5) return "America/Los_Angeles";
  return "Pacific/Honolulu";
}

export function inferTimezoneFromBirthLocation(loc: {
  name: string;
  longitude: number;
  latitude?: number;
}): string {
  const country = countryFromLocationName(loc.name);
  if (country && COUNTRY_TIMEZONE[country]) {
    return COUNTRY_TIMEZONE[country]!;
  }
  return inferTimezoneFromLongitude(loc.longitude);
}

/** True when stored IANA zone's standard meridian is plausible for birth longitude. */
export function timezoneMatchesLongitude(
  timezone: string,
  longitude: number,
  date = new Date(),
): boolean {
  const sm = standardMeridianFromTimezone(timezone, date);
  return Math.abs(longitude - sm) <= 22.5;
}

/**
 * Civil-timezone for true-solar / standard-meridian math.
 * Re-infers from birth coordinates when a device timezone was stored by mistake.
 */
export function resolveBirthTimezone(birth: {
  timezone: string;
  birth_location?: {
    name: string;
    longitude: number;
    latitude?: number;
    timezone?: string;
    use_defaults?: boolean;
  };
}): string {
  const loc = birth.birth_location;
  if (loc && !loc.use_defaults) {
    const inferred = inferTimezoneFromBirthLocation(loc);
    const stored = loc.timezone?.trim() || birth.timezone?.trim();
    if (stored && timezoneMatchesLongitude(stored, loc.longitude)) {
      return stored;
    }
    return inferred;
  }
  return birth.timezone?.trim() || "Asia/Shanghai";
}
