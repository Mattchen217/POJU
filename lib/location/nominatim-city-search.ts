export type CitySuggestion = {
  name: string;
  city: string;
  state?: string;
  country: string;
  longitude: number;
  latitude: number;
};

type NominatimRow = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
};

export function mapNominatimCityResults(data: NominatimRow[]): CitySuggestion[] {
  return data
    .filter(
      (item) =>
        item.type === "city" ||
        item.type === "town" ||
        item.type === "administrative" ||
        item.class === "place",
    )
    .map((item) => {
      const parts = item.display_name.split(",").map((s) => s.trim());
      const city = parts[0] ?? item.display_name;
      const country = parts[parts.length - 1] ?? "";
      const state = parts.length > 2 ? parts[parts.length - 2] : undefined;

      return {
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

export function formatCitySuggestionLabel(city: string, state?: string, country?: string): string {
  return `${city}${state ? `, ${state}` : ""}, ${country}`;
}
