/** Minimal city hit used by birth form + legacy Syncro nominatim mapper. */
export type CitySearchResult = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type?: string;
};
