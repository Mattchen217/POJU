"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CitySearchBox, type CitySearchSelection } from "@/components/syncro/CitySearchBox";
import { buildDefaultBirthLocation } from "@/lib/profile/birth-info-utils";
import type { BirthLocation } from "@/lib/profile/types";

export type BirthLocationSelection = BirthLocation;

interface BirthLocationStepProps {
  userTimezone: string;
  onSelect: (location: BirthLocationSelection) => void;
  onSkip: () => void;
  onBack?: () => void;
}

export function BirthLocationStep({ userTimezone, onSelect, onSkip, onBack }: BirthLocationStepProps) {
  const t = useTranslations("profile.birth_location");
  const [showHelp, setShowHelp] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CitySearchSelection | null>(null);

  function handleCitySelect(city: CitySearchSelection) {
    setSelectedCity(city);
  }

  function handleConfirmCity() {
    if (!selectedCity) return;
    onSelect({
      name: selectedCity.name,
      longitude: selectedCity.lng,
      latitude: selectedCity.lat,
      timezone: userTimezone,
      use_defaults: false,
    });
  }

  function handleSkip() {
    onSkip();
  }

  return (
    <div className="birth-location-step">
      <h2 className="picker-title">{t("title")}</h2>
      <p className="picker-description">{t("subtitle")}</p>

      <button type="button" className="why-link" onClick={() => setShowHelp((v) => !v)}>
        {t("why_link")}
      </button>

      {showHelp ? (
        <div className="birth-location-explanation">
          <p>{t("explanation_1")}</p>
          <p>{t("explanation_2")}</p>
          <p className="example">{t("explanation_example")}</p>
        </div>
      ) : null}

      <CitySearchBox onSelect={handleCitySelect} />

      {selectedCity ? (
        <div className="selected-city-preview">
          <span className="selected-city-name">{selectedCity.name}</span>
          <span className="selected-city-coords">
            {selectedCity.lat.toFixed(2)}, {selectedCity.lng.toFixed(2)}
          </span>
          <button type="button" onClick={handleConfirmCity} className="submit-btn confirm-city-btn">
            {t("confirm_city")}
          </button>
        </div>
      ) : null}

      <button type="button" onClick={handleSkip} className="skip-button">
        {t("skip_use_default")}
      </button>

      <p className="default-note">{t("default_note", { timezone: userTimezone })}</p>

      {onBack ? (
        <div className="picker-actions location-back-actions">
          <button type="button" onClick={onBack} className="cancel-btn">
            {t("back")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
