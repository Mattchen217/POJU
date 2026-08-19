/**
 * City search backends for birth form + Syncro.
 * - Local `pnpm dev` (NODE_ENV !== "production"): Open-Meteo (reachable in CN)
 * - Deployed production: Nominatim OpenStreetMap (unchanged)
 */

import type { CitySuggestion } from "@/lib/location/nominatim-city-search";
import type { CitySearchResult } from "@/lib/syncro/nominatim-search";

const FETCH_MS = 8_000;
const NOMINATIM_UA = "pojulife/1.0 (https://easternos.com; birth-location)";

export type CitySearchHit = {
  id: string;
  name: string;
  city: string;
  state?: string;
  country: string;
  latitude: number;
  longitude: number;
};

type OpenMeteoRow = {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  admin1?: string;
  admin2?: string;
};

type NominatimRow = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
};

/** Prefer Open-Meteo on local Next.js; Nominatim on deployed production. */
export function shouldUseOpenMeteoCitySearch(): boolean {
  const override = process.env.CITY_SEARCH_ENGINE?.trim().toLowerCase();
  if (override === "open-meteo" || override === "openmeteo") return true;
  if (override === "nominatim") return false;
  return process.env.NODE_ENV !== "production";
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function mapOpenMeteo(rows: OpenMeteoRow[]): CitySearchHit[] {
  const out: CitySearchHit[] = [];
  for (const row of rows) {
    const city = row.name?.trim();
    const country = row.country?.trim();
    const lat = row.latitude;
    const lon = row.longitude;
    if (!city || !country || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const state = row.admin1?.trim() || undefined;
    out.push({
      id: String(row.id ?? `${city}-${lon}-${lat}`),
      name: [city, state, country].filter(Boolean).join(", "),
      city,
      state: state && state !== country ? state : undefined,
      country,
      latitude: lat as number,
      longitude: lon as number,
    });
  }
  return out;
}

function mapNominatim(rows: NominatimRow[]): CitySearchHit[] {
  return rows
    .map((item) => {
      const parts = item.display_name.split(",").map((s) => s.trim());
      const city = parts[0] ?? item.display_name;
      const country = parts[parts.length - 1] ?? "";
      const state = parts.length > 2 ? parts[parts.length - 2] : undefined;
      return {
        id: String(item.place_id),
        name: item.display_name,
        city,
        state: state && state !== country ? state : undefined,
        country,
        longitude: parseFloat(item.lon),
        latitude: parseFloat(item.lat),
      };
    })
    .filter((r) => r.city && r.country && Number.isFinite(r.longitude) && Number.isFinite(r.latitude));
}

async function searchOpenMeteo(q: string): Promise<CitySearchHit[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({
    name: q,
    count: "8",
    language: "en",
    format: "json",
  })}`;
  const res = await fetchWithTimeout(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`open_meteo_${res.status}`);
  const data = (await res.json()) as { results?: OpenMeteoRow[] };
  return mapOpenMeteo(Array.isArray(data.results) ? data.results : []);
}

async function searchNominatim(q: string, acceptLanguage: string): Promise<CitySearchHit[]> {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q,
    format: "json",
    limit: "8",
    "accept-language": acceptLanguage,
  })}`;
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": NOMINATIM_UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`nominatim_${res.status}`);
  const data = (await res.json()) as NominatimRow[];
  return mapNominatim(Array.isArray(data) ? data : []);
}

export async function searchCities(q: string, opts?: { acceptLanguage?: string }): Promise<CitySearchHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  if (shouldUseOpenMeteoCitySearch()) {
    return searchOpenMeteo(query);
  }
  return searchNominatim(query, opts?.acceptLanguage ?? "en");
}

export function hitsToBirthSuggestions(hits: CitySearchHit[]): CitySuggestion[] {
  return hits.map((h) => ({
    name: h.name,
    city: h.city,
    state: h.state,
    country: h.country,
    longitude: h.longitude,
    latitude: h.latitude,
  }));
}

export function hitsToSyncroResults(hits: CitySearchHit[]): CitySearchResult[] {
  return hits.map((h, i) => ({
    id: Number.parseInt(h.id, 10) || i + 1,
    name: h.name,
    lat: h.latitude,
    lng: h.longitude,
  }));
}
