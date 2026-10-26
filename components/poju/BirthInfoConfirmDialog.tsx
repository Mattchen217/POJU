"use client";

import { useEffect, useId, useRef, useState } from "react";
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

export type JointConfirmPayload = {
  partnerEmail: string;
  sharedQuestion: string;
  /** Pre-resolved bound seat — skips email lookup when set. */
  partnerUserId?: string | null;
};

export interface BirthInfoConfirmDialogProps {
  birthInfo?: BirthInfo | null;
  existingProfile?: StoredProfileSummary | null;
  /** @deprecated Prefer onConfirmMode — kept for Match / legacy callers. */
  onConfirm?: () => void;
  /** Solo vs joint. When set, replaces single onConfirm CTA. */
  onConfirmMode?: (mode: BirthConfirmMode) => void;
  /** Joint-initiate confirm: partner account + question required. */
  onConfirmJoint?: (payload: JointConfirmPayload) => void;
  onCancel: () => void;
  processing?: boolean;
  /**
   * When true, dialog is for initiating a joint decision:
   * shows partner email + shared question; single confirm CTA.
   */
  jointInitiate?: boolean;
  /** Prefill partner email (bound Duo seat). */
  partnerEmailPrefill?: string;
  partnerUserIdPrefill?: string | null;
  /** @deprecated Dual CTA removed from solo confirm; kept for API compat. */
  showJointOption?: boolean;
  /** @deprecated */
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
  onConfirmJoint,
  onCancel,
  processing = false,
  jointInitiate = false,
  partnerEmailPrefill = "",
  partnerUserIdPrefill = null,
}: BirthInfoConfirmDialogProps) {
  const t = useTranslations("birth_confirm");
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [partnerEmail, setPartnerEmail] = useState(partnerEmailPrefill);
  const [sharedQuestion, setSharedQuestion] = useState("");
  const [partnerUserId] = useState(partnerUserIdPrefill);

  useEffect(() => {
    setPartnerEmail(partnerEmailPrefill);
  }, [partnerEmailPrefill]);

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
  const prefilledBound =
    Boolean(partnerUserIdPrefill) &&
    partnerEmail.trim().toLowerCase() === partnerEmailPrefill.trim().toLowerCase();

  function startSolo() {
    if (onConfirmMode) onConfirmMode("solo");
    else onConfirm?.();
  }

  function startJointConfirm() {
    if (!onConfirmJoint || processing) return;
    onConfirmJoint({
      partnerEmail: partnerEmail.trim(),
      sharedQuestion: sharedQuestion.trim(),
      partnerUserId: prefilledBound ? partnerUserId : null,
    });
  }

  const jointReady =
    sharedQuestion.trim().length >= 4 &&
    (prefilledBound || partnerEmail.trim().includes("@"));

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
          <h2 id={titleId}>
            {jointInitiate ? t("joint_confirm_title") : t("title")}
          </h2>
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

        {jointInitiate ? (
          <>
            <label className="confirm-joint-field">
              <span className="confirm-joint-field__label">{t("partner_account_label")}</span>
              <input
                type="email"
                className="confirm-joint-account"
                value={partnerEmail}
                disabled={processing}
                placeholder={t("partner_account_placeholder")}
                autoComplete="email"
                onChange={(e) => setPartnerEmail(e.target.value)}
              />
              {partnerEmailPrefill ? (
                <span className="confirm-joint-field__hint">{t("partner_account_bound_hint")}</span>
              ) : null}
            </label>
            <label className="confirm-joint-field">
              <span className="confirm-joint-field__label">{t("joint_question_title")}</span>
              <textarea
                className="confirm-joint-question"
                rows={3}
                value={sharedQuestion}
                disabled={processing}
                placeholder={t("joint_question_placeholder")}
                onChange={(e) => setSharedQuestion(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                onClick={startJointConfirm}
                disabled={processing || !jointReady}
                className="primary"
              >
                {processing ? t("processing") : t("joint_send_invite")}
              </button>
            </div>
          </>
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
