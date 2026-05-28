"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BirthInfoPicker } from "@/components/poju/BirthInfoPicker";
import { BirthInfoConfirmDialog } from "@/components/poju/BirthInfoConfirmDialog";
import { BaseAnalysisViewModal } from "@/components/profile/BaseAnalysisViewModal";
import { ProfileAccuracyBadge } from "@/components/profile/ProfileAccuracyBadge";
import { ProfileUpgradeModal } from "@/components/profile/ProfileUpgradeModal";
import {
  getSessionPrepBrand,
  getWelcomeText,
  type MatchPrepPerson,
  type SessionPrepProduct,
} from "@/lib/poju/session-prep-copy";
import { markPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import { createStoredProfile, listStoredProfilesForSessionPrep, type StoredProfileSummary } from "@/lib/profile/stored-profiles-service";
import type { BirthInfo } from "@/lib/profile/types";

export interface SessionPreparationProps {
  sessionId: string;
  originalQuestion?: string;
  existingProfiles: StoredProfileSummary[];
  onProfileSelected: (profileId: string) => void;
  onRefund: () => void;
  locale: string;
  productType?: SessionPrepProduct;
  /** Match: e.g. "Person A" / "命主 A" shown in the welcome block. */
  customLabel?: string;
  /** Match step A vs B welcome copy. */
  matchPerson?: MatchPrepPerson;
  /** Override cancel/refund link label (e.g. back to select-a). */
  refundLabel?: string;
}

export function SessionPreparation({
  existingProfiles,
  onProfileSelected,
  onRefund,
  locale,
  originalQuestion = "",
  productType = "poju",
  customLabel,
  matchPerson = "a",
  refundLabel,
}: SessionPreparationProps) {
  const t = useTranslations("session_prep");
  const tGlyph = useTranslations("glyph");
  const tSyncro = useTranslations("syncro");
  const tMatch = useTranslations("match");

  const [mode, setMode] = useState<"list" | "new">(existingProfiles.length > 0 ? "list" : "new");
  const [profiles, setProfiles] = useState(existingProfiles);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [pendingBirthInfo, setPendingBirthInfo] = useState<BirthInfo | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<StoredProfileSummary | null>(null);
  const [viewAnalysisProfile, setViewAnalysisProfile] = useState<StoredProfileSummary | null>(null);
  const hadProfilesRef = useRef(existingProfiles.length > 0);

  useEffect(() => {
    setProfiles(existingProfiles);
  }, [existingProfiles]);

  async function refreshProfiles() {
    const list = await listStoredProfilesForSessionPrep();
    setProfiles(list);
    return list;
  }

  useEffect(() => {
    if (profiles.length > 0 && !hadProfilesRef.current) {
      hadProfilesRef.current = true;
      setMode("list");
    } else if (profiles.length === 0) {
      hadProfilesRef.current = false;
      setMode("new");
    }
  }, [profiles.length]);

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
        markPendingBaseAnalysisProfile(result.profile_id);
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
      <WelcomeSection
        locale={locale}
        productType={productType}
        originalQuestion={originalQuestion}
        customLabel={customLabel}
        matchPerson={matchPerson}
      />

      <div className="prep-main">
        {mode === "list" && profiles.length > 0 ? (
          <ProfileListView
            profiles={profiles}
            onSelect={handleSelectExisting}
            onAddNew={() => setMode("new")}
            onUpgrade={(p) => setUpgradeTarget(p)}
            onViewAnalysis={(p) => setViewAnalysisProfile(p)}
          />
        ) : null}

        {mode === "new" ? (
          <BirthInfoPicker
            onSubmit={handleBirthInfoSubmit}
            onCancel={profiles.length > 0 ? () => setMode("list") : undefined}
            locale={locale}
          />
        ) : null}
      </div>

      <div className="refund-link-section">
        <button type="button" onClick={onRefund} className="refund-link">
          {productType === "glyph"
            ? tGlyph("back_to_home")
            : productType === "syncro"
              ? tSyncro("back_to_home")
              : productType === "match"
                ? refundLabel ?? tMatch("back_to_home")
                : t("refund_link")}
        </button>
      </div>

      {showConfirm ? (
        <BirthInfoConfirmDialog
          birthInfo={pendingBirthInfo}
          existingProfile={
            selectedProfileId
              ? profiles.find((p) => p.profile_id === selectedProfileId) ?? null
              : null
          }
          onConfirm={() => void handleConfirmAndContinue()}
          onCancel={handleConfirmCancel}
          processing={creating}
        />
      ) : null}

      {upgradeTarget ? (
        <ProfileUpgradeModal
          profile={upgradeTarget}
          onClose={() => setUpgradeTarget(null)}
          onUpgraded={() => void refreshProfiles()}
        />
      ) : null}

      {viewAnalysisProfile ? (
        <BaseAnalysisViewModal
          profileId={viewAnalysisProfile.profile_id}
          displayName={viewAnalysisProfile.display_name}
          onClose={() => setViewAnalysisProfile(null)}
        />
      ) : null}
    </div>
  );
}

function WelcomeSection({
  locale,
  productType,
  originalQuestion,
  customLabel,
  matchPerson,
}: {
  locale: string;
  productType: SessionPrepProduct;
  originalQuestion: string;
  customLabel?: string;
  matchPerson: MatchPrepPerson;
}) {
  const tGlyph = useTranslations("glyph");
  const tSyncro = useTranslations("syncro");

  const questionLabel =
    productType === "syncro" ? tSyncro("your_task_label") : tGlyph("your_question_label");

  const brandClass =
    productType === "glyph"
      ? "glyph-brand"
      : productType === "syncro"
        ? "syncro-brand"
        : productType === "match"
          ? "match-brand"
          : "";

  return (
    <div className="welcome-section">
      <div className={`poju-logo ${brandClass}`}>{getSessionPrepBrand(productType)}</div>
      {customLabel ? <p className="match-person-label">{customLabel}</p> : null}
      <p className="welcome-text">{getWelcomeText(locale, productType, matchPerson)}</p>
      {originalQuestion.trim() && questionLabel ? (
        <div className="your-question">
          <span className="label">{questionLabel}</span>
          <p className="question-text">&ldquo;{originalQuestion}&rdquo;</p>
        </div>
      ) : null}
    </div>
  );
}

function ProfileListView({
  profiles,
  onSelect,
  onAddNew,
  onUpgrade,
  onViewAnalysis,
}: {
  profiles: StoredProfileSummary[];
  onSelect: (id: string, summary: StoredProfileSummary) => void;
  onAddNew: () => void;
  onUpgrade: (summary: StoredProfileSummary) => void;
  onViewAnalysis: (summary: StoredProfileSummary) => void;
}) {
  const t = useTranslations("session_prep");

  return (
    <div className="profile-list-view">
      <h2>{t("list_title")}</h2>
      <p>{t("list_description")}</p>
      <div className="profiles-grid">
        {profiles.map((p) => (
          <div key={p.profile_id} className="profile-card-wrapper">
            <button
              type="button"
              className="profile-card-button"
              onClick={() => onSelect(p.profile_id, p)}
            >
              <div className="display-name">{p.display_name}</div>
              <div className="card-meta">
                <span>{p.gender === "M" ? t("male") : t("female")}</span>
                {p.has_base_analysis ? <span className="ready-badge">{t("ready")}</span> : null}
              </div>
              <ProfileAccuracyBadge profile={p} onUpgrade={() => onUpgrade(p)} />
              <div className="usage-stats">
                {p.used_in_products.poju > 0 ? <span>POJU {p.used_in_products.poju}×</span> : null}
                {p.used_in_products.glyph > 0 ? <span>Glyph {p.used_in_products.glyph}×</span> : null}
                {p.used_in_products.syncro > 0 ? <span>Syncro {p.used_in_products.syncro}×</span> : null}
              </div>
            </button>
            {p.has_base_analysis ? (
              <button
                type="button"
                className="mt-2 w-full text-left text-xs font-medium text-cyan-200/90 underline underline-offset-2 hover:text-cyan-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewAnalysis(p);
                }}
              >
                {t("view_analysis")}
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className="add-new-card-button" onClick={onAddNew}>
          <span className="plus-icon">+</span>
          <span>{t("add_new_person")}</span>
        </button>
      </div>
    </div>
  );
}
