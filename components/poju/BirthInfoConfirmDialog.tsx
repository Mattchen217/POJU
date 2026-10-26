"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  formatBirthLocationLabel,
  formatBirthTimeDisplay,
  parseStoredProfileSummaryForDisplay,
  type BirthInfoDisplayRow,
} from "@/lib/profile/birth-info-display";
import type { BirthInfo } from "@/lib/profile/types";
import type { StoredProfileSummary } from "@/lib/profile/stored-profiles-service";

export type BirthConfirmMode = "solo" | "joint";

export interface BirthInfoConfirmDialogProps {
  birthInfo?: BirthInfo | null;
  existingProfile?: StoredProfileSummary | null;
  /** @deprecated Prefer onConfirmMode — kept for Match / legacy callers. */
  onConfirm?: () => void;
  /** Solo vs joint. When set, replaces single onConfirm CTA. */
  onConfirmMode?: (mode: BirthConfirmMode) => void;
  onCancel: () => void;
  processing?: boolean;
  /** Show joint CTA (workspace Pivot). Match / Syncro should pass false. */
  showJointOption?: boolean;
  /** Duo subscribed (household exists) — joint CTA clickable; else gray. */
  jointEnabled?: boolean;
}

function birthInfoToDisplay(birth: BirthInfo): BirthInfoDisplayRow {
  return {
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour_period: birth.hour_period,
    hour: birth.hour,
    minute: birth.minute,
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
  onConfirmMode,
  onCancel,
  processing = false,
  showJointOption = false,
  jointEnabled = false,
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

  const timeDisplay = formatBirthTimeDisplay(displayData);
  const dual = showJointOption && typeof onConfirmMode === "function";

  function startSolo() {
    if (onConfirmMode) onConfirmMode("solo");
    else onConfirm?.();
  }

  function startJoint() {
    if (!jointEnabled || processing) return;
    onConfirmMode?.("joint");
  }

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
        <div className="confirm-dialog__header">
          <h2 id={titleId}>{t("title")}</h2>
          <button
            type="button"
            className="confirm-dialog__back-link"
            onClick={onCancel}
            disabled={processing}
          >
            {t("go_back")}
          </button>
        </div>

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
              {timeDisplay.primary}
              <span className="value-sub"> ({timeDisplay.secondary})</span>
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
          <div className="info-row">
            <span className="label">{t("location_label")}</span>
            <span className="value">
              {formatBirthLocationLabel(
                displayData.birth_location_name
                  ? {
                      name: displayData.birth_location_name,
                      use_defaults: displayData.birth_location_defaults,
                    }
                  : birthInfo?.birth_location,
                t("location_default"),
              )}
            </span>
          </div>
        </div>

        {dual ? (
          <div className="dialog-actions dialog-actions--stack">
            <button
              type="button"
              onClick={startSolo}
              disabled={processing}
              className="primary"
            >
              {processing ? t("processing") : t("start_solo")}
            </button>
            <div className="confirm-joint-wrap">
              <button
                type="button"
                onClick={startJoint}
                disabled={processing || !jointEnabled}
                className={
                  jointEnabled
                    ? "primary confirm-joint-btn"
                    : "confirm-joint-btn confirm-joint-btn--disabled"
                }
                aria-disabled={!jointEnabled}
                aria-describedby={`${titleId}-joint-tip`}
              >
                {t("start_joint")}
              </button>
              <div id={`${titleId}-joint-tip`} className="confirm-joint-tooltip" role="tooltip">
                {t("joint_tooltip")}
              </div>
            </div>
          </div>
        ) : (
          <div className="dialog-actions">
            <button
              type="button"
              onClick={startSolo}
              disabled={processing}
              className="primary"
            >
              {processing ? t("processing") : t("confirm_and_proceed")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
