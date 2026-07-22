"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { BirthInfoConfirmDialog } from "@/components/poju/BirthInfoConfirmDialog";
import { WorkspaceBirthInfoPicker } from "@/components/workspace/WorkspaceBirthInfoPicker";
import { markPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import { createStoredProfile } from "@/lib/profile/stored-profiles-service";
import type { BirthInfo } from "@/lib/profile/types";

import "@/styles/session-prep.css";

/**
 * Workspace host — birth picker (workspace layout) + same confirm → createStoredProfile
 * chain as SessionPreparation "new" mode. Does not modify BirthInfoPicker / SessionPreparation.
 */
export function WorkspacePojuBirthHost() {
  const locale = useLocale();
  const t = useTranslations("session_prep");
  const [pendingBirthInfo, setPendingBirthInfo] = useState<BirthInfo | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);

  function handleBirthInfoSubmit(info: BirthInfo) {
    setPendingBirthInfo(info);
    setShowConfirm(true);
  }

  function handleConfirmCancel() {
    setShowConfirm(false);
    setPendingBirthInfo(null);
  }

  async function handleConfirmAndContinue() {
    if (!pendingBirthInfo) return;
    setCreating(true);
    try {
      const result = await createStoredProfile({ birth_info: pendingBirthInfo });
      markPendingBaseAnalysisProfile(result.profile_id);
      setShowConfirm(false);
      setPendingBirthInfo(null);
      setCreating(false);
    } catch (err) {
      console.error("[workspace-poju] Create profile failed:", err);
      alert(t("error_create_profile"));
      setCreating(false);
    }
  }

  return (
    <>
      <WorkspaceBirthInfoPicker locale={locale} onSubmit={handleBirthInfoSubmit} />
      {showConfirm ? (
        <BirthInfoConfirmDialog
          birthInfo={pendingBirthInfo}
          onConfirm={() => void handleConfirmAndContinue()}
          onCancel={handleConfirmCancel}
          processing={creating}
        />
      ) : null}
    </>
  );
}
