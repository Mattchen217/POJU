"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BirthInfoPicker } from "@/components/poju/BirthInfoPicker";
import { BirthInfoConfirmDialog } from "@/components/poju/BirthInfoConfirmDialog";
import { ProfileAccuracyBadge } from "@/components/profile/ProfileAccuracyBadge";
import { AppDialogProvider, useAppDialog } from "@/components/ui/app-dialog";
import { formatBirthLocationLabel } from "@/lib/profile/birth-info-display";
import { ProfileUpgradeModal } from "@/components/profile/ProfileUpgradeModal";
import {
  getSessionPrepBrand,
  getWelcomeText,
  type MatchPrepPerson,
  type SessionPrepProduct,
} from "@/lib/poju/session-prep-copy";
import { markPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import { createStoredProfile, deleteStoredProfile, listStoredProfilesForSessionPrep, type StoredProfileSummary } from "@/lib/profile/stored-profiles-service";
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
  /** Match select pages: page header already has person label — hide duplicate welcome copy. */
  suppressMatchWelcomeCopy?: boolean;
  /** Match step A vs B welcome copy. */
  matchPerson?: MatchPrepPerson;
  /** Override cancel/refund link label (e.g. back to select-a). */
  refundLabel?: string;
  /** Optional block below profile list (e.g. Syncro task input). */
  footerSlot?: ReactNode;
  /** When false, profile confirm is blocked (e.g. missing Syncro task). */
  canProceed?: () => boolean;
  onProceedBlocked?: () => void;
}

export function SessionPreparation(props: SessionPreparationProps) {
  return (
    <AppDialogProvider>
      <SessionPreparationInner {...props} />
    </AppDialogProvider>
  );
}

function SessionPreparationInner({
  existingProfiles,
  onProfileSelected,
  onRefund,
  locale,
  originalQuestion = "",
  productType = "poju",
  customLabel,
  suppressMatchWelcomeCopy = false,
  matchPerson = "a",
  refundLabel,
  footerSlot,
  canProceed,
  onProceedBlocked,
}: SessionPreparationProps) {
  const t = useTranslations("session_prep");
  const tCommon = useTranslations("common");
  const tGlyph = useTranslations("glyph");
  const tSyncro = useTranslations("syncro");
  const tMatch = useTranslations("match");
  const { confirm } = useAppDialog();
  const router = useRouter();

  const [mode, setMode] = useState<"list" | "new">(existingProfiles.length > 0 ? "list" : "new");
  const [profiles, setProfiles] = useState(existingProfiles);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [pendingBirthInfo, setPendingBirthInfo] = useState<BirthInfo | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<StoredProfileSummary | null>(null);
  const hadProfilesRef = useRef(existingProfiles.length > 0);

  useEffect(() => {
    setProfiles(existingProfiles);
  }, [existingProfiles]);

  async function refreshProfiles() {
    const list = await listStoredProfilesForSessionPrep();
    setProfiles(list);
    return list;
  }

  async function handleDeleteProfile(profileId: string) {
    const profile = profiles.find((p) => p.profile_id === profileId);
    const ok = await confirm(tCommon("deleteConfirmWarning"), t("delete"), {
      confirmLabel: t("delete"),
      cancelLabel: t("rename_cancel"),
      tone: "danger",
      target: profile?.display_name?.trim() || profile?.birth_date,
    });
    if (!ok) return;
    await deleteStoredProfile(profileId);
    const list = await refreshProfiles();
    if (list.length === 0) {
      setMode("new");
    }
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

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [mode]);

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
    if (canProceed && !canProceed()) {
      onProceedBlocked?.();
      setShowConfirm(false);
      return;
    }

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
        suppressMatchWelcomeCopy={suppressMatchWelcomeCopy}
        matchPerson={matchPerson}
      />

      <div className="prep-main">
        {mode === "list" && profiles.length > 0 ? (
          <ProfileListView
            profiles={profiles}
            onSelect={handleSelectExisting}
            onAddNew={() => setMode("new")}
            onUpgrade={(p) => setUpgradeTarget(p)}
            onViewAnalysis={(p) => router.push(`/profile/${p.profile_id}`)}
            onDelete={(id) => void handleDeleteProfile(id)}
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

      {footerSlot}

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
    </div>
  );
}

function WelcomeSection({
  locale,
  productType,
  originalQuestion,
  customLabel,
  matchPerson,
  suppressMatchWelcomeCopy,
}: {
  locale: string;
  productType: SessionPrepProduct;
  originalQuestion: string;
  customLabel?: string;
  matchPerson: MatchPrepPerson;
  suppressMatchWelcomeCopy?: boolean;
}) {
  const t = useTranslations("session_prep");
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
      {!suppressMatchWelcomeCopy && customLabel ? (
        <p className="match-person-label">{customLabel}</p>
      ) : null}
      {!suppressMatchWelcomeCopy ? (
        productType === "poju" ? (
          <>
            <p className="welcome-text welcome-text--lead">{t("welcome_title")}</p>
            <p className="welcome-text">{t("welcome_desc")}</p>
          </>
        ) : (
          <p className="welcome-text">{getWelcomeText(locale, productType, matchPerson)}</p>
        )
      ) : null}
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
  onDelete,
}: {
  profiles: StoredProfileSummary[];
  onSelect: (id: string, summary: StoredProfileSummary) => void;
  onAddNew: () => void;
  onUpgrade: (summary: StoredProfileSummary) => void;
  onViewAnalysis: (summary: StoredProfileSummary) => void;
  onDelete: (profileId: string) => void;
}) {
  const t = useTranslations("session_prep");
  const tConfirm = useTranslations("birth_confirm");

  return (
    <div className="profile-list-view">
      <h2>{t("list_title")}</h2>
      <p>{t("list_description")}</p>
      <div className="profiles-grid">
        {profiles.map((p) => (
          <div key={p.profile_id} className="profile-card">
            <button
              type="button"
              className="profile-card-button"
              onClick={() => onSelect(p.profile_id, p)}
            >
              <div className="display-name">{p.display_name}</div>
              <div className="card-meta">
                <span>{p.gender === "M" ? t("male") : t("female")}</span>
                {p.birth_location_name ? (
                  <span className="card-location">
                    {formatBirthLocationLabel(
                      {
                        name: p.birth_location_name,
                        use_defaults: p.birth_location_use_defaults,
                      },
                      tConfirm("location_default"),
                    )}
                  </span>
                ) : null}
                {p.has_base_analysis ? <span className="ready-badge">{t("ready")}</span> : null}
              </div>
              <ProfileAccuracyBadge profile={p} onUpgrade={() => onUpgrade(p)} />
              <div className="usage-stats">
                {p.used_in_products.poju > 0 ? <span>POJU {p.used_in_products.poju}×</span> : null}
                {p.used_in_products.match > 0 ? <span>Match {p.used_in_products.match}×</span> : null}
                {p.used_in_products.atmos > 0 ? <span>Atmos {p.used_in_products.atmos}×</span> : null}
                {p.used_in_products.glyph > 0 ? <span>Glyph {p.used_in_products.glyph}×</span> : null}
                {p.used_in_products.syncro > 0 ? <span>Syncro {p.used_in_products.syncro}×</span> : null}
              </div>
            </button>
            <div className="profile-card-actions">
              {p.has_base_analysis ? (
                <button
                  type="button"
                  className="profile-card-action profile-card-action--view"
                  onClick={() => onViewAnalysis(p)}
                >
                  {t("view_analysis")}
                </button>
              ) : null}
              <button
                type="button"
                className="profile-card-action profile-card-action--delete"
                onClick={() => onDelete(p.profile_id)}
              >
                {t("delete")}
              </button>
            </div>
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
