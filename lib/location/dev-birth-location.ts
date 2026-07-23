import type { BirthLocation } from "@/lib/profile/types";

/**
 * Local-dev only: prefill a complete birth city so Confirm unlocks without Nominatim.
 * Production / `next build` keeps `NODE_ENV === "production"` — always returns null.
 */
export function getDevPrefillBirthLocation(): BirthLocation | null {
  if (process.env.NODE_ENV !== "development") return null;
  return {
    name: "Chicago, Illinois, USA",
    longitude: -87.6298,
    latitude: 41.8781,
    timezone: "America/Chicago",
    use_defaults: false,
  };
}
