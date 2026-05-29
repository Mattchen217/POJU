"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  BirthLocationField,
  resolveBirthLocationForSubmit,
} from "@/components/forms/BirthLocationField";
import type { BirthLocation } from "@/lib/profile/types";

export type BirthLocationSelection = BirthLocation;

interface BirthLocationStepProps {
  userTimezone: string;
  onSelect: (location: BirthLocationSelection) => void;
  onBack?: () => void;
}

export function BirthLocationStep({ userTimezone, onSelect, onBack }: BirthLocationStepProps) {
  const tProfile = useTranslations("profile.birth_location");
  const tForm = useTranslations("birth_form");
  const [birthLocation, setBirthLocation] = useState<BirthLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    setError(null);
    const resolved = resolveBirthLocationForSubmit(birthLocation, userTimezone);
    if (!Number.isFinite(resolved.longitude)) {
      setError(tForm("location_required"));
      return;
    }
    console.log("[BirthLocation] submit:", resolved);
    onSelect(resolved);
  }

  return (
    <div className="birth-location-step">
      <h2 className="picker-title">{tProfile("title")}</h2>
      <p className="picker-description">{tProfile("subtitle")}</p>

      <BirthLocationField value={birthLocation} onChange={setBirthLocation} />

      {error ? <p className="birth-location-step__error">{error}</p> : null}

      <button type="button" onClick={handleContinue} className="submit-btn confirm-city-btn">
        {tForm("confirm_continue")}
      </button>

      <p className="default-note">{tProfile("location_required_note")}</p>

      {onBack ? (
        <div className="picker-actions location-back-actions">
          <button type="button" onClick={onBack} className="cancel-btn">
            {tProfile("back")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
