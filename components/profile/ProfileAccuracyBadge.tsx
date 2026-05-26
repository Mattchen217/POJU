"use client";

import type { StoredProfileSummary } from "@/lib/profile/stored-profiles-service";
import { profileNeedsLocationUpgrade } from "@/lib/profile/upgrade-profile-location";
import { useTranslations } from "next-intl";

type ProfileAccuracyBadgeProps = {
  profile: Pick<StoredProfileSummary, "used_true_solar_time">;
  onUpgrade?: () => void;
  className?: string;
};

export function ProfileAccuracyBadge({ profile, onUpgrade, className = "" }: ProfileAccuracyBadgeProps) {
  const t = useTranslations("profile.upgrade");

  if (!profileNeedsLocationUpgrade(profile.used_true_solar_time)) {
    return (
      <span className={`profile-badge profile-badge-precise ${className}`.trim()}>
        {t("badge_precise")}
      </span>
    );
  }

  if (!onUpgrade) {
    return (
      <span className={`profile-badge profile-badge-upgradeable ${className}`.trim()}>
        {t("badge_upgradeable")}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`profile-badge profile-badge-upgradeable profile-badge-action ${className}`.trim()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onUpgrade();
      }}
    >
      {t("badge_upgradeable")}
    </button>
  );
}
