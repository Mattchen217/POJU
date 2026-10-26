"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  BirthInfoConfirmDialog,
  type JointConfirmPayload,
} from "@/components/poju/BirthInfoConfirmDialog";
import { useAppDialog } from "@/components/ui/app-dialog";
import { WorkspaceBirthInfoPicker } from "@/components/workspace/WorkspaceBirthInfoPicker";
import { WorkspacePojuProfileRecords, getWorkspaceProfileCardTitle } from "@/components/workspace/WorkspacePojuProfileRecords";
import { markPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import {
  createStoredProfile,
  deleteStoredProfile,
  getStoredProfile,
  listStoredProfiles,
  recordProfileUsage,
  renameStoredProfile,
  type StoredProfileSummary,
} from "@/lib/profile/stored-profiles-service";
import type { BirthInfo } from "@/lib/profile/types";
import {
  mapLatestPojuSessionByProfileId,
  type BirthRecordLatestSession,
} from "@/lib/profile/birth-record-latest-session";
import { notifyJointListUpdated } from "@/lib/poju/joint-client-events";

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
  /**
   * When true: birth → confirm with partner account + question → create joint invite
   * (no solo prepare). Used from sidebar “发起双人共同决策”.
   */
  jointInitiate?: boolean;
  /** After joint invite created successfully. */
  onJointCreated?: () => void;
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
  jointInitiate = false,
  onJointCreated,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("session_prep");
  const tMatchWs = useTranslations("match.workspace");
  const tConfirm = useTranslations("birth_confirm");
  const tJoint = useTranslations("joint_flow");
  const { alert } = useAppDialog();
  const isMatchFrame = matchCollectingSlot === "a" || matchCollectingSlot === "b";

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [mode, setMode] = useState<"list" | "new">("new");

  const [pendingBirthInfo, setPendingBirthInfo] = useState<BirthInfo | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [latestByProfileId, setLatestByProfileId] = useState<Map<string, BirthRecordLatestSession>>(() => new Map());
  const [partnerPrefill, setPartnerPrefill] = useState("");
  const [partnerUserIdPrefill, setPartnerUserIdPrefill] = useState<string | null>(null);

  const visibleProfiles = profiles.filter((p) => p.profile_id !== excludeProfileId);

  useEffect(() => {
    if (!jointInitiate) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/joint/bound-peer", { credentials: "same-origin" });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          peer_email?: string | null;
          peer_user_id?: string | null;
        };
        if (cancelled || !data.ok) return;
        if (data.peer_email) setPartnerPrefill(data.peer_email);
        if (data.peer_user_id) setPartnerUserIdPrefill(data.peer_user_id);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jointInitiate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const map = await mapLatestPojuSessionByProfileId(locale);
        if (!cancelled) setLatestByProfileId(map);
      } catch {
        if (!cancelled) setLatestByProfileId(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, profiles]);

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

  async function resolveConfirmBirth(): Promise<BirthInfo | null> {
    if (pendingBirthInfo) return pendingBirthInfo;
    if (!selectedProfileId) return null;
    const stored = await getStoredProfile(selectedProfileId);
    return (stored?.birth_info as BirthInfo | undefined) ?? null;
  }

  async function handleConfirmSolo() {
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
        await alert(t("error_create_profile"));
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
      await alert(t("error_create_profile"));
      setCreating(false);
    }
  }

  async function handleConfirmJoint(payload: JointConfirmPayload) {
    setCreating(true);
    try {
      const birth = await resolveConfirmBirth();
      if (!birth) {
        await alert(t("error_create_profile"));
        return;
      }

      // Soft client validation
      const email = payload.partnerEmail.trim();
      if (!payload.partnerUserId) {
        if (!email.includes("@")) {
          await alert(tJoint("err_invalid_email"), tConfirm("joint_confirm_title"));
          return;
        }
        const look = await fetch("/api/joint/lookup-partner", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partner_email: email }),
        });
        const lookData = (await look.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          user_id?: string;
        };
        if (!look.ok || !lookData.ok) {
          await alert(
            mapCreateError(lookData.error, tJoint),
            tConfirm("joint_confirm_title"),
          );
          return;
        }
        payload = { ...payload, partnerUserId: lookData.user_id ?? null };
      }

      if (pendingBirthInfo) {
        const result = await createStoredProfile({ birth_info: pendingBirthInfo });
        markPendingBaseAnalysisProfile(result.profile_id);
        await recordProfileUsage(result.profile_id, usageProduct);
        await refreshProfiles();
      } else if (selectedProfileId) {
        await recordProfileUsage(selectedProfileId, usageProduct);
      }

      const res = await fetch("/api/joint/create", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shared_question: payload.sharedQuestion,
          birth,
          partner_email: payload.partnerEmail,
          partner_user_id: payload.partnerUserId ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        await alert(
          mapCreateError(data.error, tJoint),
          tConfirm("joint_confirm_title"),
        );
        return;
      }

      setShowConfirm(false);
      setSelectedProfileId(null);
      setPendingBirthInfo(null);
      notifyJointListUpdated();
      await alert(tJoint("invite_sent_waiting"), tConfirm("joint_confirm_title"));
      onJointCreated?.();
    } catch (err) {
      console.error("[workspace-poju] Joint create failed:", err);
      await alert(tJoint("network_error"), tConfirm("joint_confirm_title"));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="workspace-poju-birth-column">
        <div className="workspace-poju-birth">
          <div className="birth-info-picker birth-info-picker--workspace workspace-poju-records-frame">
            <p className="workspace-poju-records__loading">{t("loading")}</p>
          </div>
        </div>
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
    <div className="workspace-poju-birth-column">
      <div className="workspace-poju-birth">
        {showList ? (
          <div className="birth-info-picker birth-info-picker--workspace workspace-poju-records-frame">
            <WorkspacePojuProfileRecords
              profiles={visibleProfiles}
              onSelect={handleSelectExisting}
              onAddNew={() => setMode("new")}
              onRename={(id, nextName) => void handleRenameProfile(id, nextName)}
              onDelete={(id) => void handleDeleteProfile(id)}
              pinnedHint={matchPinnedHint}
              latestByProfileId={latestByProfileId}
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
      </div>

      {showConfirm ? (
        <BirthInfoConfirmDialog
          birthInfo={pendingBirthInfo}
          existingProfile={
            selectedProfileId
              ? (profiles.find((p) => p.profile_id === selectedProfileId) ?? null)
              : null
          }
          jointInitiate={jointInitiate}
          partnerEmailPrefill={partnerPrefill}
          partnerUserIdPrefill={partnerUserIdPrefill}
          onConfirm={jointInitiate ? undefined : () => void handleConfirmSolo()}
          onConfirmJoint={
            jointInitiate ? (payload) => void handleConfirmJoint(payload) : undefined
          }
          onCancel={handleConfirmCancel}
          processing={creating}
        />
      ) : null}
    </div>
  );
}

function mapCreateError(
  code: string | undefined,
  t: ReturnType<typeof useTranslations<"joint_flow">>,
): string {
  switch (code) {
    case "partner_not_registered":
      return t("err_partner_not_registered");
    case "cannot_invite_self":
      return t("err_cannot_invite_self");
    case "invalid_email":
      return t("err_invalid_email");
    case "question_too_short":
      return t("err_question_too_short");
    default:
      return t("err_generic");
  }
}
