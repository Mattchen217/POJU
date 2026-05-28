export const USER_LOCATION_CACHE_KEY = "pojulife_user_location";
export const USER_LOCATION_CACHE_TTL_HOURS = 24;

export type UserLocationSource = "gps" | "ip" | "fallback";

export interface UserLocation {
  city: string;
  state?: string;
  country: string;
  longitude: number;
  latitude: number;
  source: UserLocationSource;
  cached_at: number;
}

export function isUserLocationValid(loc: UserLocation): boolean {
  const ageHours = (Date.now() - loc.cached_at) / 3_600_000;
  return (
    ageHours < USER_LOCATION_CACHE_TTL_HOURS &&
    Boolean(loc.city) &&
    Boolean(loc.country) &&
    Number.isFinite(loc.longitude) &&
    Number.isFinite(loc.latitude)
  );
}

export function loadCachedUserLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserLocation;
    return isUserLocationValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function cacheUserLocation(loc: UserLocation): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USER_LOCATION_CACHE_KEY, JSON.stringify(loc));
  } catch {
    // quota / private mode
  }
}
