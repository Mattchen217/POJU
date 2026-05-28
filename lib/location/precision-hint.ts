function getTimezoneCenterLongitude(timezone: string): number | null {
  const tzCenters: Record<string, number> = {
    "America/New_York": -75,
    "America/Chicago": -90,
    "America/Denver": -105,
    "America/Los_Angeles": -120,
    "America/Phoenix": -105,
    "America/Anchorage": -135,
    "Pacific/Honolulu": -150,
    "America/Toronto": -75,
    "America/Vancouver": -120,
    "Europe/London": 0,
    "Europe/Paris": 15,
    "Europe/Berlin": 15,
    "Europe/Moscow": 45,
    "Asia/Shanghai": 120,
    "Asia/Tokyo": 135,
    "Asia/Singapore": 105,
    "Asia/Seoul": 135,
    "Asia/Kolkata": 82.5,
    "Australia/Sydney": 150,
    UTC: 0,
  };

  return tzCenters[timezone] ?? null;
}

/** Simplified true solar offset for UI hint (longitude vs timezone center). */
export function calculateOffsetMinutes(longitude: number, timezone: string): number {
  const tzCenter = getTimezoneCenterLongitude(timezone);
  if (tzCenter === null) return 0;
  return Math.round((longitude - tzCenter) * 4);
}

export function formatOffset(minutes: number): string {
  if (minutes === 0) return "0 minutes";

  const sign = minutes > 0 ? "+" : "-";
  const abs = Math.abs(minutes);

  if (abs < 60) {
    return `${sign}${abs} minutes`;
  }

  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return mins > 0 ? `${sign}${hours}h ${mins}min` : `${sign}${hours}h`;
}
