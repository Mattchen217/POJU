"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BirthInfoPicker } from "@/components/poju/BirthInfoPicker";
import { BirthInfoConfirmDialog } from "@/components/poju/BirthInfoConfirmDialog";
import { getWelcomeText } from "@/lib/poju/session-prep-copy";
import { createStoredProfile, type StoredProfileSummary } from "@/lib/profile/stored-profiles-service";
import type { BirthInfo } from "@/lib/profile/types";

export interface SessionPreparationProps {
  sessionId: string;
  existingProfiles: StoredProfileSummary[];
  onProfileSelected: (profileId: string) => void;
  onRefund: () => void;
  locale: string;
}

export function SessionPreparation({
  existingProfiles,
  onProfileSelected,
  onRefund,
  locale,
}: SessionPreparationProps) {
  const t = useTranslations("session_prep");

  const [mode, setMode] = useState<"list" | "new">(existingProfiles.length > 0 ? "list" : "new");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [pendingBirthInfo, setPendingBirthInfo] = useState<BirthInfo | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);

  function handleSelectExisting(profileId: string) {
    setSelectedProfileId(profileId);
    setPendingBirthInfo(null);
    setShowConfirm(true);
  }

  function handleBirthInfoSubmit(info: BirthInfo) {
    setPendingBirthInfo(info);
    setSelectedProfileId(null);
    setShowConfirm(true);
  }

  async function handleConfirmAndContinue() {
    if (selectedProfileId) {
      setShowConfirm(false);
      onProfileSelected(selectedProfileId);
      return;
    }

    if (pendingBirthInfo) {
      setCreating(true);
      try {
        const result = await createStoredProfile({ birth_info: pendingBirthInfo });
        setShowConfirm(false);
        onProfileSelected(result.profile_id);
      } catch (err) {
        console.error("[session-prep] Create profile failed:", err);
        alert(t("error_create_profile"));
        setCreating(false);
      }
    }
  }

  function handleConfirmCancel() {
    setShowConfirm(false);
    setSelectedProfileId(null);
    setPendingBirthInfo(null);
  }

  return (
    <div className="session-prep-container">
      <WelcomeSection locale={locale} />

      <div className="prep-main">
        {mode === "list" && existingProfiles.length > 0 ? (
          <ProfileListView
            profiles={existingProfiles}
            onSelect={handleSelectExisting}
            onAddNew={() => setMode("new")}
          />
        ) : null}

        {mode === "new" ? (
          <BirthInfoPicker
            onSubmit={handleBirthInfoSubmit}
            onCancel={existingProfiles.length > 0 ? () => setMode("list") : undefined}
            locale={locale}
          />
        ) : null}
      </div>

      <div className="refund-link-section">
        <button type="button" onClick={onRefund} className="refund-link">
          {t("refund_link")}
        </button>
      </div>

      {showConfirm ? (
        <BirthInfoConfirmDialog
          birthInfo={pendingBirthInfo}
          existingProfile={
            selectedProfileId
              ? existingProfiles.find((p) => p.profile_id === selectedProfileId) ?? null
              : null
          }
          onConfirm={() => void handleConfirmAndContinue()}
          onCancel={handleConfirmCancel}
          processing={creating}
        />
      ) : null}
    </div>
  );
}

function WelcomeSection({ locale }: { locale: string }) {
  return (
    <div className="welcome-section">
      <div className="poju-logo">POJU</div>
      <p className="welcome-text">{getWelcomeText(locale)}</p>
    </div>
  );
}

function ProfileListView({
  profiles,
  onSelect,
  onAddNew,
}: {
  profiles: StoredProfileSummary[];
  onSelect: (id: string, summary: StoredProfileSummary) => void;
  onAddNew: () => void;
}) {
  const t = useTranslations("session_prep");

  return (
    <div className="profile-list-view">
      <h2>{t("list_title")}</h2>
      <p>{t("list_description")}</p>
      <div className="profiles-grid">
        {profiles.map((p) => (
          <button
            key={p.profile_id}
            type="button"
            className="profile-card-button"
            onClick={() => onSelect(p.profile_id, p)}
          >
            <div className="display-name">{p.display_name}</div>
            <div className="card-meta">
              <span>{p.gender === "M" ? t("male") : t("female")}</span>
              {p.has_base_analysis ? <span className="ready-badge">{t("ready")}</span> : null}
            </div>
            <div className="usage-stats">
              {p.used_in_products.poju > 0 ? <span>POJU {p.used_in_products.poju}×</span> : null}
              {p.used_in_products.glyph > 0 ? <span>Glyph {p.used_in_products.glyph}×</span> : null}
              {p.used_in_products.syncro > 0 ? <span>Syncro {p.used_in_products.syncro}×</span> : null}
            </div>
          </button>
        ))}
        <button type="button" className="add-new-card-button" onClick={onAddNew}>
          <span className="plus-icon">+</span>
          <span>{t("add_new_person")}</span>
        </button>
      </div>
    </div>
  );
}
