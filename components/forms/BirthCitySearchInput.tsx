"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { CitySuggestion } from "@/lib/location/nominatim-city-search";
import { formatCitySuggestionLabel } from "@/lib/location/nominatim-city-search";

export type { CitySuggestion };

type PlaceholderCity = {
  city: string;
  state?: string;
  country: string;
};

type Props = {
  value: CitySuggestion | null;
  placeholder?: PlaceholderCity;
  onChange: (city: CitySuggestion) => void;
};

export function BirthCitySearchInput({ value, placeholder, onChange }: Props) {
  const t = useTranslations("birth_form");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void searchCity(query);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  async function searchCity(q: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/location/search-city?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results?: CitySuggestion[] };
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(city: CitySuggestion) {
    onChange(city);
    setActive(false);
    setQuery("");
    setResults([]);
  }

  function placeholderLabel(): string {
    if (!placeholder) return t("tap_to_enter_city");
    return formatCitySuggestionLabel(placeholder.city, placeholder.state, placeholder.country);
  }

  if (value && !active) {
    return (
      <div
        className="birth-city-input"
        role="button"
        tabIndex={0}
        onClick={() => setActive(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setActive(true);
        }}
      >
        <span className="city-selected">
          {formatCitySuggestionLabel(value.city, value.state, value.country)}
        </span>
      </div>
    );
  }

  if (!active) {
    return (
      <div
        className="birth-city-input birth-city-input--default"
        role="button"
        tabIndex={0}
        onClick={() => setActive(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setActive(true);
        }}
      >
        <span className="city-placeholder">{placeholderLabel()}</span>
      </div>
    );
  }

  return (
    <div className="birth-city-input birth-city-input--active">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search_city")}
        autoFocus
        autoComplete="off"
      />

      {loading ? <div className="birth-city-loading">{t("searching")}</div> : null}

      {results.length > 0 ? (
        <ul className="birth-city-suggestions">
          {results.map((city) => (
            <li key={`${city.name}-${city.longitude}`}>
              <button type="button" onClick={() => handleSelect(city)}>
                <span className="suggestion-name">
                  {formatCitySuggestionLabel(city.city, city.state, city.country)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button type="button" className="birth-city-cancel" onClick={() => setActive(false)}>
        {t("cancel")}
      </button>
    </div>
  );
}
