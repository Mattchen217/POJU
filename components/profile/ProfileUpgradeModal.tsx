"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CitySearchBox, type CitySearchSelection } from "@/components/syncro/CitySearchBox";
import type { StoredProfileSummary } from "@/lib/profile/stored-profiles-service";
import { HOUR_PERIOD_INFO } from "@/lib/profile/types";
import {
  type ProfileUpgradeResult,
  upgradeProfileWithLocation,
} from "@/lib/profile/upgrade-profile-location";

type ProfileUpgradeModalProps = {
  profile: StoredProfileSummary;
  onClose: () => void;
  onUpgraded?: (result: ProfileUpgradeResult) => void;
};

export function ProfileUpgradeModal({ profile, onClose, onUpgraded }: ProfileUpgradeModalProps) {
  const t = useTranslations("profile.upgrade");
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [selectedCity, setSelectedCity] = useState<CitySearchSelection | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProfileUpgradeResult | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !upgrading) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, upgrading]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  async function handleUpgrade() {
    if (!selectedCity) return;
    setError(null);
    setUpgrading(true);
    try {
      const upgradeResult = await upgradeProfileWithLocation(profile.profile_id, {
        name: selectedCity.name,
        longitude: selectedCity.lng,
        latitude: selectedCity.lat,
        timezone: profile.timezone,
        use_defaults: false,
      });
      setResult(upgradeResult);
      onUpgraded?.(upgradeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpgrading(false);
    }
  }

  const periodLabel = HOUR_PERIOD_INFO[profile.hour_period].zh_label;

  return (
    <div
      className="confirm-dialog-overlay profile-upgrade-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !upgrading) onClose();
      }}
    >
      <div className="confirm-dialog profile-upgrade-modal" ref={panelRef} tabIndex={-1}>
        <h2 id={titleId}>{t("title")}</h2>
        <p className="description">{t("description")}</p>

        <div className="profile-upgrade-info-box">
          <strong>{t("current_chart")}</strong>
          <p>
            {profile.birth_date} · {periodLabel} · {profile.gender === "M" ? t("male") : t("female")}
          </p>
          <p className="warning">{t("using_default_warning")}</p>
        </div>

        {result ? (
          <div className="profile-upgrade-success">
            <p>{t("upgrade_success")}</p>
            {result.hourChanged ? (
              <p className="hour-change">
                {t("hour_pillar_changed", {
                  old: result.oldHourPillar,
                  new: result.newHourPillar,
                })}
              </p>
            ) : (
              <p>{t("hour_pillar_unchanged", { pillar: result.newHourPillar })}</p>
            )}
            <p className="diff-note">
              {t("tst_diff_minutes", { minutes: Math.round(result.diffMinutes) })}
            </p>
            {result.baseAnalysisRegenerated ? (
              <p className="text-xs text-emerald-200/90">{t("base_analysis_regenerated")}</p>
            ) : null}
            <button type="button" className="primary" onClick={onClose}>
              {t("done")}
            </button>
          </div>
        ) : (
          <>
            <CitySearchBox onSelect={setSelectedCity} />

            {selectedCity ? (
              <div className="selected-city-preview">
                <span className="selected-city-name">{selectedCity.name}</span>
                <span className="selected-city-coords">
                  {selectedCity.lat.toFixed(2)}, {selectedCity.lng.toFixed(2)}
                </span>
              </div>
            ) : null}

            {error ? <p className="profile-upgrade-error">{error}</p> : null}

            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={onClose} disabled={upgrading}>
                {t("keep_old_for_now")}
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void handleUpgrade()}
                disabled={!selectedCity || upgrading}
              >
                {upgrading ? t("upgrading") : t("upgrade_chart")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
