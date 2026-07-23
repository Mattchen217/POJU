"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { BirthInfoConfirmDialog } from "@/components/poju/BirthInfoConfirmDialog";
import { WorkspaceBirthInfoPicker } from "@/components/workspace/WorkspaceBirthInfoPicker";
import { WorkspacePojuProfileRecords } from "@/components/workspace/WorkspacePojuProfileRecords";
import { markPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import {
  createStoredProfile,
  deleteStoredProfile,
  listStoredProfiles,
  recordProfileUsage,
  type StoredProfileSummary,
} from "@/lib/profile/stored-profiles-service";
import type { BirthInfo } from "@/lib/profile/types";

import "@/styles/session-prep.css";

type Props = {
  onHasProfilesChange?: (hasProfiles: boolean) => void;
  /** After confirm — enter workspace preparing (Spline + right-rail matrix). */
  onPrepareStart?: (profileId: string) => void;
};

/**
 * Workspace host — new users see the birth form; returning users see profile cards
 * + add-new inside the same-sized frame. Does not modify BirthInfoPicker / SessionPreparation.
 */
export function WorkspacePojuBirthHost({ onHasProfilesChange, onPrepareStart }: Props) {
  const locale = useLocale();
  const t = useTranslations("session_prep");

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [mode, setMode] = useState<"list" | "new">("new");

  const [pendingBirthInfo, setPendingBirthInfo] = useState<BirthInfo | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);

  const refreshProfiles = useCallback(async () => {
    const list = await listStoredProfiles();
    setProfiles(list);
    onHasProfilesChange?.(list.length > 0);
    return list;
  }, [onHasProfilesChange]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listStoredProfiles();
        if (cancelled) return;
        setProfiles(list);
        setMode(list.length > 0 ? "list" : "new");
        onHasProfilesChange?.(list.length > 0);
      } catch (err) {
        console.error("[workspace-poju] Load profiles failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onHasProfilesChange]);

  async function handleDeleteProfile(profileId: string) {
    if (!window.confirm(t("confirm_delete"))) return;
    await deleteStoredProfile(profileId);
    const list = await refreshProfiles();
    if (list.length === 0) setMode("new");
  }

  function handleSelectExisting(summary: StoredProfileSummary) {
    setSelectedProfileId(summary.profile_id);
    setPendingBirthInfo(null);
    setShowConfirm(true);
  }

  function handleBirthInfoSubmit(info: BirthInfo) {
    setPendingBirthInfo(info);
    setSelectedProfileId(null);
    setShowConfirm(true);
  }

  function handleConfirmCancel() {
    setShowConfirm(false);
    setSelectedProfileId(null);
    setPendingBirthInfo(null);
  }

  async function handleConfirmAndContinue() {
    if (selectedProfileId) {
      try {
        await recordProfileUsage(selectedProfileId, "poju");
        const selected = profiles.find((p) => p.profile_id === selectedProfileId);
        if (selected && !selected.has_base_analysis) {
          markPendingBaseAnalysisProfile(selectedProfileId);
        }
        const profileId = selectedProfileId;
        setShowConfirm(false);
        setSelectedProfileId(null);
        await refreshProfiles();
        onPrepareStart?.(profileId);
      } catch (err) {
        console.error("[workspace-poju] Select profile failed:", err);
        alert(t("error_create_profile"));
      }
      return;
    }

    if (!pendingBirthInfo) return;
    setCreating(true);
    try {
      const result = await createStoredProfile({ birth_info: pendingBirthInfo });
      markPendingBaseAnalysisProfile(result.profile_id);
      setShowConfirm(false);
      setPendingBirthInfo(null);
      setCreating(false);
      await refreshProfiles();
      onPrepareStart?.(result.profile_id);
    } catch (err) {
      console.error("[workspace-poju] Create profile failed:", err);
      alert(t("error_create_profile"));
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="birth-info-picker birth-info-picker--workspace workspace-poju-records-frame">
        <p className="workspace-poju-records__loading">{t("loading")}</p>
      </div>
    );
  }

  const showList = mode === "list" && profiles.length > 0;

  return (
    <>
      {showList ? (
        <div className="birth-info-picker birth-info-picker--workspace workspace-poju-records-frame">
          <WorkspacePojuProfileRecords
            profiles={profiles}
            onSelect={handleSelectExisting}
            onAddNew={() => setMode("new")}
            onDelete={(id) => void handleDeleteProfile(id)}
          />
        </div>
      ) : (
        <WorkspaceBirthInfoPicker
          locale={locale}
          onSubmit={handleBirthInfoSubmit}
          onCancel={profiles.length > 0 ? () => setMode("list") : undefined}
        />
      )}

      {showConfirm ? (
        <BirthInfoConfirmDialog
          birthInfo={pendingBirthInfo}
          existingProfile={
            selectedProfileId
              ? (profiles.find((p) => p.profile_id === selectedProfileId) ?? null)
              : null
          }
          onConfirm={() => void handleConfirmAndContinue()}
          onCancel={handleConfirmCancel}
          processing={creating}
        />
      ) : null}
    </>
  );
}
