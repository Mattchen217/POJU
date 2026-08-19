"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { BirthInfoConfirmDialog } from "@/components/poju/BirthInfoConfirmDialog";
import { WorkspaceBirthInfoPicker } from "@/components/workspace/WorkspaceBirthInfoPicker";
import { WorkspacePojuProfileRecords, getWorkspaceProfileCardTitle } from "@/components/workspace/WorkspacePojuProfileRecords";
import { markPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import {
  createStoredProfile,
  deleteStoredProfile,
  listStoredProfiles,
  recordProfileUsage,
  renameStoredProfile,
  type StoredProfileSummary,
} from "@/lib/profile/stored-profiles-service";
import type { BirthInfo } from "@/lib/profile/types";

import "@/styles/session-prep.css";

type Props = {
  onHasProfilesChange?: (hasProfiles: boolean) => void;
  /** After confirm — enter workspace preparing (Spline + right-rail matrix). */
  onPrepareStart?: (profileId: string) => void;
  /** Which product records usage against the selected profile. */
  usageProduct?: "poju" | "match" | "glyph" | "syncro" | "atmos";
  /** Hide this profile from the picker (Match B cannot equal Match A). */
  excludeProfileId?: string | null;
  /**
   * Match-only: always show the records frame (tip + scroll cards + add-new),
   * with a pinned slot tip that switches A/B copy.
   */
  matchCollectingSlot?: "a" | "b";
};

/**
 * Workspace host — new users see the birth form; returning users see profile cards
 * + add-new inside the same-sized frame. Does not modify BirthInfoPicker / SessionPreparation.
 */
export function WorkspacePojuBirthHost({
  onHasProfilesChange,
  onPrepareStart,
  usageProduct = "poju",
  excludeProfileId = null,
  matchCollectingSlot,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("session_prep");
  const tMatchWs = useTranslations("match.workspace");
  const isMatchFrame = matchCollectingSlot === "a" || matchCollectingSlot === "b";

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [mode, setMode] = useState<"list" | "new">("new");

  const [pendingBirthInfo, setPendingBirthInfo] = useState<BirthInfo | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);

  const visibleProfiles = profiles.filter((p) => p.profile_id !== excludeProfileId);

  const refreshProfiles = useCallback(async () => {
    const list = await listStoredProfiles();
    setProfiles(list);
    onHasProfilesChange?.(list.length > 0);
    return list;
  }, [onHasProfilesChange]);

  useEffect(() => {
    let cancelled = false;
    const failOpen = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);
    void (async () => {
      try {
        const list = await listStoredProfiles();
        if (cancelled) return;
        setProfiles(list);
        const visible = list.filter((p) => p.profile_id !== excludeProfileId);
        setMode(isMatchFrame || visible.length > 0 ? "list" : "new");
        onHasProfilesChange?.(list.length > 0);
      } catch (err) {
        console.error("[workspace-poju] Load profiles failed:", err);
      } finally {
        window.clearTimeout(failOpen);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(failOpen);
    };
  }, [onHasProfilesChange, excludeProfileId, isMatchFrame]);

  async function handleDeleteProfile(profileId: string) {
    try {
      await deleteStoredProfile(profileId);
      const list = await refreshProfiles();
      const visible = list.filter((p) => p.profile_id !== excludeProfileId);
      if (visible.length === 0 && !isMatchFrame) setMode("new");
    } catch (err) {
      console.error("[workspace-poju] Delete profile failed:", err);
    }
  }

  async function handleRenameProfile(profileId: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    const current = profiles.find((p) => p.profile_id === profileId);
    const initial = current ? getWorkspaceProfileCardTitle(current) : "";
    if (trimmed === initial) return;
    try {
      await renameStoredProfile(profileId, trimmed);
      await refreshProfiles();
    } catch (err) {
      console.error("[workspace-poju] Rename profile failed:", err);
    }
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
        await recordProfileUsage(selectedProfileId, usageProduct);
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
      await recordProfileUsage(result.profile_id, usageProduct);
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

  const showList = mode === "list" && (isMatchFrame || visibleProfiles.length > 0);

  const matchPinnedHint = (() => {
    if (!isMatchFrame || !matchCollectingSlot) return undefined;
    const hasSelectable = visibleProfiles.length > 0;
    if (matchCollectingSlot === "a") {
      return hasSelectable ? tMatchWs("hint_a_with_history") : tMatchWs("hint_a_new");
    }
    return hasSelectable ? tMatchWs("hint_b_with_history") : tMatchWs("hint_b_new");
  })();

  return (
    <>
      {showList ? (
        <div className="birth-info-picker birth-info-picker--workspace workspace-poju-records-frame">
          <WorkspacePojuProfileRecords
            profiles={visibleProfiles}
            onSelect={handleSelectExisting}
            onAddNew={() => setMode("new")}
            onRename={(id, nextName) => void handleRenameProfile(id, nextName)}
            onDelete={(id) => void handleDeleteProfile(id)}
            pinnedHint={matchPinnedHint}
          />
        </div>
      ) : (
        <WorkspaceBirthInfoPicker
          locale={locale}
          onSubmit={handleBirthInfoSubmit}
          onCancel={
            visibleProfiles.length > 0 || isMatchFrame ? () => setMode("list") : undefined
          }
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
