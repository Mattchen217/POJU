/** Fallback city when GPS/IP cache is empty — keyed by IANA timezone. */
export const TIMEZONE_FALLBACK_CITIES: Record<
  string,
  { city: string; country: string; lng: number; lat: number; state?: string }
> = {
  "America/New_York": { city: "New York", country: "USA", lng: -74.0, lat: 40.7 },
  "America/Chicago": { city: "Chicago", country: "USA", lng: -87.6, lat: 41.9 },
  "America/Denver": { city: "Denver", country: "USA", lng: -105.0, lat: 39.7 },
  "America/Los_Angeles": { city: "Los Angeles", country: "USA", lng: -118.2, lat: 34.1 },
  "America/Phoenix": { city: "Phoenix", country: "USA", lng: -112.1, lat: 33.4 },
  "America/Anchorage": { city: "Anchorage", country: "USA", lng: -149.9, lat: 61.2 },
  "Pacific/Honolulu": { city: "Honolulu", country: "USA", lng: -157.9, lat: 21.3 },
  "America/Toronto": { city: "Toronto", country: "Canada", lng: -79.4, lat: 43.7 },
  "America/Vancouver": { city: "Vancouver", country: "Canada", lng: -123.1, lat: 49.3 },
  "America/Mexico_City": { city: "Mexico City", country: "Mexico", lng: -99.1, lat: 19.4 },
  "Europe/London": { city: "London", country: "UK", lng: -0.1, lat: 51.5 },
  "Europe/Paris": { city: "Paris", country: "France", lng: 2.3, lat: 48.9 },
  "Europe/Berlin": { city: "Berlin", country: "Germany", lng: 13.4, lat: 52.5 },
  "Europe/Madrid": { city: "Madrid", country: "Spain", lng: -3.7, lat: 40.4 },
  "Europe/Rome": { city: "Rome", country: "Italy", lng: 12.5, lat: 41.9 },
  "Europe/Moscow": { city: "Moscow", country: "Russia", lng: 37.6, lat: 55.8 },
  "Asia/Shanghai": { city: "Shanghai", country: "China", lng: 121.5, lat: 31.2 },
  "Asia/Hong_Kong": { city: "Hong Kong", country: "Hong Kong", lng: 114.2, lat: 22.3 },
  "Asia/Taipei": { city: "Taipei", country: "Taiwan", lng: 121.5, lat: 25.0 },
  "Asia/Tokyo": { city: "Tokyo", country: "Japan", lng: 139.7, lat: 35.7 },
  "Asia/Seoul": { city: "Seoul", country: "South Korea", lng: 127.0, lat: 37.6 },
  "Asia/Singapore": { city: "Singapore", country: "Singapore", lng: 103.8, lat: 1.3 },
  "Asia/Kolkata": { city: "Mumbai", country: "India", lng: 72.9, lat: 19.1 },
  "Asia/Bangkok": { city: "Bangkok", country: "Thailand", lng: 100.5, lat: 13.8 },
  "Asia/Dubai": { city: "Dubai", country: "UAE", lng: 55.3, lat: 25.2 },
  "Australia/Sydney": { city: "Sydney", country: "Australia", lng: 151.2, lat: -33.9 },
  "Australia/Melbourne": { city: "Melbourne", country: "Australia", lng: 145.0, lat: -37.8 },
  "Pacific/Auckland": { city: "Auckland", country: "New Zealand", lng: 174.8, lat: -36.9 },
  "America/Sao_Paulo": { city: "São Paulo", country: "Brazil", lng: -46.6, lat: -23.5 },
  UTC: { city: "London", country: "UK", lng: 0, lat: 51.5 },
};

export function getTimezoneFallbackCity(timezone: string) {
  return TIMEZONE_FALLBACK_CITIES[timezone] ?? TIMEZONE_FALLBACK_CITIES.UTC;
}
