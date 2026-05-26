"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type CitySearchSelection = {
  id: number;
  name: string;
  lat: number;
  lng: number;
};

type CitySearchBoxProps = {
  onSelect: (city: CitySearchSelection) => void;
};

export function CitySearchBox({ onSelect }: CitySearchBoxProps) {
  const t = useTranslations("syncro.location");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CitySearchSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/syncro/search-city?q=${encodeURIComponent(q)}`);
      const data = (await response.json()) as { results?: CitySearchSelection[] };
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      console.error("[city-search] error", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void runSearch(value.trim());
    }, 400);
  }

  return (
    <div className="city-search mt-6 w-full max-w-md text-left">
      <div className="search-input-wrapper relative">
        <span className="search-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg" aria-hidden>
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder={t("city_search_placeholder")}
          autoFocus
          autoComplete="off"
          className="w-full rounded-xl border border-white/15 bg-black/30 py-3 pl-10 pr-10 text-[15px] text-text-primary outline-none ring-cyan-400/40 focus:border-cyan-400/50 focus:ring-2"
        />
        {loading ? (
          <span
            className="search-spinner absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300"
            aria-hidden
          />
        ) : null}
      </div>

      {results.length > 0 ? (
        <ul className="city-results mt-3 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/25">
          {results.map((city) => (
            <li key={city.id} className="border-b border-white/5 last:border-0">
              <button
                type="button"
                onClick={() => onSelect(city)}
                className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-cyan-400/10"
              >
                <span className="city-name text-sm font-medium text-text-primary">{city.name}</span>
                <span className="city-coords font-mono text-xs text-text-dim">
                  {city.lat.toFixed(2)}, {city.lng.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {query.trim().length >= 2 && results.length === 0 && !loading ? (
        <p className="no-results mt-4 text-center text-sm text-text-dim">{t("no_cities_found")}</p>
      ) : null}
    </div>
  );
}
