"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { getCurrentLocation } from "@/components/global/FirstTimeLocation";
import { BirthCitySearchInput, type CitySuggestion } from "@/components/forms/BirthCitySearchInput";
import { calculateOffsetMinutes, formatOffset } from "@/lib/location/precision-hint";
import {
  formatCitySuggestionLabel,
  type CitySuggestion as CitySuggestionType,
} from "@/lib/location/nominatim-city-search";
import { getTimezoneFallbackCity } from "@/lib/location/timezone-defaults";
import type { BirthLocation } from "@/lib/profile/types";

import "@/styles/birth-location.css";

type PlaceholderCity = {
  city: string;
  state?: string;
  country: string;
};

type Props = {
  value: BirthLocation | null;
  onChange: (loc: BirthLocation) => void;
};

function birthLocationToSuggestion(loc: BirthLocation): CitySuggestion | null {
  if (loc.use_defaults) return null;
  const parts = loc.name.split(",").map((s) => s.trim());
  if (parts.length < 2) return null;
  const city = parts[0] ?? loc.name;
  const country = parts[parts.length - 1] ?? "";
  const state = parts.length > 2 ? parts.slice(1, -1).join(", ") : undefined;
  return {
    name: loc.name,
    city,
    state,
    country,
    longitude: loc.longitude,
    latitude: loc.latitude ?? 0,
  };
}

function suggestionToBirthLocation(city: CitySuggestionType, timezone: string): BirthLocation {
  return {
    name: formatCitySuggestionLabel(city.city, city.state, city.country),
    longitude: city.longitude,
    latitude: city.latitude,
    timezone,
    use_defaults: false,
  };
}

export function BirthLocationField({ value, onChange }: Props) {
  const t = useTranslations("birth_form");
  const [timezone, setTimezone] = useState("UTC");
  const [placeholder, setPlaceholder] = useState<PlaceholderCity | null>(null);

  useEffect(() => {
    const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC";
    setTimezone(tz);

    const detected = getCurrentLocation();
    if (detected) {
      setPlaceholder({
        city: detected.city,
        state: detected.state,
        country: detected.country,
      });
      return;
    }

    const fallback = getTimezoneFallbackCity(tz);
    setPlaceholder({
      city: fallback.city,
      state: fallback.state,
      country: fallback.country,
    });
  }, []);

  const selectedSuggestion = useMemo(() => (value ? birthLocationToSuggestion(value) : null), [value]);

  const effectiveLongitude =
    value?.longitude ?? getCurrentLocation()?.longitude ?? getTimezoneFallbackCity(timezone).lng;

  const offsetMinutes = calculateOffsetMinutes(effectiveLongitude, timezone);

  function handleCitySelect(city: CitySuggestionType) {
    const loc = suggestionToBirthLocation(city, timezone);
    console.log("[BirthLocation] submit:", loc);
    onChange(loc);
  }

  return (
    <div className="birth-location-field">
      <label className="birth-location-field__label">
        {t("birth_location")} <span className="birth-location-field__required">*</span>
      </label>

      <BirthCitySearchInput
        value={selectedSuggestion}
        placeholder={placeholder ?? undefined}
        onChange={handleCitySelect}
      />

      <p className="birth-location-field__precision">
        {t("true_solar_offset", { offset: formatOffset(offsetMinutes) })}
      </p>

      <details className="birth-location-field__why">
        <summary>{t("why_we_ask")}</summary>
        <p>{t("why_explanation")}</p>
      </details>
    </div>
  );
}

/** Resolve birth location from explicit selection, GPS cache, or timezone fallback. */
export function resolveBirthLocationForSubmit(
  value: BirthLocation | null,
  timezone: string,
): BirthLocation {
  if (value && !value.use_defaults) {
    return { ...value, timezone: value.timezone || timezone };
  }

  const detected = getCurrentLocation();
  if (detected) {
    return {
      name: formatCitySuggestionLabel(detected.city, detected.state, detected.country),
      longitude: detected.longitude,
      latitude: detected.latitude,
      timezone,
      use_defaults: false,
    };
  }

  const fallback = getTimezoneFallbackCity(timezone);
  return {
    name: formatCitySuggestionLabel(fallback.city, fallback.state, fallback.country),
    longitude: fallback.lng,
    latitude: fallback.lat,
    timezone,
    use_defaults: false,
  };
}
