export type CitySearchResult = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type?: string;
};

type NominatimRow = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
};

export function mapNominatimResults(data: NominatimRow[]): CitySearchResult[] {
  return data.map((r) => ({
    id: r.place_id,
    name: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    type: r.type,
  }));
}
