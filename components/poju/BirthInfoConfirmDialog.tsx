"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  formatHourPeriodBilingual,
  parseStoredProfileSummaryForDisplay,
  type BirthInfoDisplayRow,
} from "@/lib/profile/birth-info-display";
import type { BirthInfo, HourPeriod } from "@/lib/profile/types";
import type { StoredProfileSummary } from "@/lib/profile/stored-profiles-service";

export interface BirthInfoConfirmDialogProps {
  birthInfo?: BirthInfo | null;
  existingProfile?: StoredProfileSummary | null;
  onConfirm: () => void;
  onCancel: () => void;
  processing?: boolean;
}

function birthInfoToDisplay(birth: BirthInfo): BirthInfoDisplayRow {
  return {
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour_period: birth.hour_period,
    gender: birth.gender,
    timezone: birth.timezone,
    birth_location_name: birth.birth_location?.name,
    birth_location_defaults: birth.birth_location?.use_defaults,
  };
}

export function BirthInfoConfirmDialog({
  birthInfo,
  existingProfile,
  onConfirm,
  onCancel,
  processing = false,
}: BirthInfoConfirmDialogProps) {
  const t = useTranslations("birth_confirm");
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const displayData: BirthInfoDisplayRow | null = birthInfo
    ? birthInfoToDisplay(birthInfo)
    : existingProfile
      ? parseStoredProfileSummaryForDisplay(existingProfile)
      : null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !processing) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, processing]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  if (!displayData) return null;

  const hour = formatHourPeriodBilingual(displayData.hour_period as HourPeriod);

  return (
    <div
      className="confirm-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !processing) onCancel();
      }}
    >
      <div className="confirm-dialog" ref={panelRef} tabIndex={-1}>
        <h2 id={titleId}>{t("title")}</h2>
        <p className="description">{t("description")}</p>

        {existingProfile ? (
          <p className="confirm-existing-name">{existingProfile.display_name}</p>
        ) : null}

        <div className="info-display">
          <div className="info-row">
            <span className="label">{t("date_label")}</span>
            <span className="value">
              {displayData.year} / {String(displayData.month).padStart(2, "0")} /{" "}
              {String(displayData.day).padStart(2, "0")}
            </span>
          </div>
          <div className="info-row">
            <span className="label">{t("hour_label")}</span>
            <span className="value">
              {hour.primary}
              <span className="value-sub"> ({hour.secondary})</span>
            </span>
          </div>
          <div className="info-row">
            <span className="label">{t("gender_label")}</span>
            <span className="value">{displayData.gender === "M" ? t("male") : t("female")}</span>
          </div>
          <div className="info-row">
            <span className="label">{t("timezone_label")}</span>
            <span className="value tz">{displayData.timezone}</span>
          </div>
          {displayData.birth_location_name ? (
            <div className="info-row">
              <span className="label">{t("location_label")}</span>
              <span className="value">
                {displayData.birth_location_defaults ? t("location_default") : displayData.birth_location_name}
              </span>
            </div>
          ) : null}
        </div>

        <div className="reassure">
          <p>{t("reassure_1")}</p>
          <p>{t("reassure_2")}</p>
        </div>

        <div className="dialog-actions">
          <button type="button" onClick={onCancel} disabled={processing} className="secondary">
            {t("go_back")}
          </button>
          <button type="button" onClick={onConfirm} disabled={processing} className="primary">
            {processing ? t("processing") : t("confirm_and_proceed")}
          </button>
        </div>
      </div>
    </div>
  );
}
