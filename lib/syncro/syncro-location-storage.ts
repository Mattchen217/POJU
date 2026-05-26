/** Session payload written at /syncro/location before computing. */

export const SYNCRO_LOCATION_STORAGE_KEY = "syncro_location";

export type SyncroStoredLocation = {
  lat: number;
  lng: number;
  timezone: string;
  accuracy?: number;
  source: "geolocation" | "manual";
  city_name?: string;
};

export function buildSyncroStoredLocation(
  input: Omit<SyncroStoredLocation, "timezone"> & { timezone?: string },
): SyncroStoredLocation {
  const timezone =
    input.timezone?.trim() ||
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC");

  return {
    lat: input.lat,
    lng: input.lng,
    timezone,
    accuracy: input.accuracy,
    source: input.source,
    city_name: input.city_name,
  };
}

export function parseSyncroStoredLocation(raw: string): SyncroStoredLocation | null {
  try {
    const data = JSON.parse(raw) as Partial<SyncroStoredLocation> & {
      latitude?: number;
      longitude?: number;
    };
    const lat = data.lat ?? data.latitude;
    const lng = data.lng ?? data.longitude;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return buildSyncroStoredLocation({
      lat,
      lng,
      timezone: typeof data.timezone === "string" ? data.timezone : undefined,
      accuracy: data.accuracy,
      source: data.source === "manual" ? "manual" : "geolocation",
      city_name: data.city_name,
    });
  } catch {
    return null;
  }
}
