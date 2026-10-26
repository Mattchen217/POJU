"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  BirthInfoConfirmDialog,
  type BirthConfirmMode,
} from "@/components/poju/BirthInfoConfirmDialog";
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
  /** Open linked past decision-dialogue session (rail path). */
  onOpenSession?: (sessionId: string) => void;
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
  onOpenSession,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("session_prep");
  const tMatchWs = useTranslations("match.workspace");
  const isMatchFrame = matchCollectingSlot === "a" || matchCollectingSlot === "b";

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [mode, setMode] = useState<"list" | "new">("new");

  const tConfirm = useTranslations("birth_confirm");
  const [pendingBirthInfo, setPendingBirthInfo] = useState<BirthInfo | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [latestByProfileId, setLatestByProfileId] = useState<Map<string, BirthRecordLatestSession>>(() => new Map());
  const [duoSubscribed, setDuoSubscribed] = useState(false);
  const [canJoint, setCanJoint] = useState(false);
  const [peerBound, setPeerBound] = useState(false);
  const [jointQuestionOpen, setJointQuestionOpen] = useState(false);
  const [jointBirth, setJointBirth] = useState<BirthInfo | null>(null);
  const [jointQuestion, setJointQuestion] = useState("");
  const [jointBusy, setJointBusy] = useState(false);

  const visibleProfiles = profiles.filter((p) => p.profile_id !== excludeProfileId);
  const showJointOption = !isMatchFrame && usageProduct === "poju";

  useEffect(() => {
    if (!showJointOption) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/household/me", { credentials: "same-origin" });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          can_joint?: boolean;
          household?: { peer_bound?: boolean } | null;
        };
        if (cancelled || !data.ok) return;
        setDuoSubscribed(Boolean(data.household));
        setCanJoint(Boolean(data.can_joint));
        setPeerBound(Boolean(data.household?.peer_bound));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showJointOption, showConfirm]);


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

  async function handleConfirmMode(mode: BirthConfirmMode) {
    if (mode === "solo") {
      await handleConfirmSolo();
      return;
    }
    if (!duoSubscribed) return;
    if (!peerBound) {
      alert(tConfirm("joint_need_bind"));
      return;
    }
    if (!canJoint) {
      alert(tConfirm("joint_need_balance"));
      return;
    }
    setCreating(true);
    try {
      const birth = await resolveConfirmBirth();
      if (!birth) {
        alert(t("error_create_profile"));
        return;
      }
      if (pendingBirthInfo) {
        const result = await createStoredProfile({ birth_info: pendingBirthInfo });
        markPendingBaseAnalysisProfile(result.profile_id);
        await recordProfileUsage(result.profile_id, usageProduct);
        await refreshProfiles();
      } else if (selectedProfileId) {
        await recordProfileUsage(selectedProfileId, usageProduct);
      }
      setJointBirth(birth);
      setJointQuestion("");
      setShowConfirm(false);
      setSelectedProfileId(null);
      setPendingBirthInfo(null);
      setJointQuestionOpen(true);
    } catch (err) {
      console.error("[workspace-poju] Joint prepare failed:", err);
      alert(t("error_create_profile"));
    } finally {
      setCreating(false);
    }
  }

  async function submitJointInvite() {
    if (!jointBirth || jointQuestion.trim().length < 4) return;
    setJointBusy(true);
    try {
      const res = await fetch("/api/joint/create", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shared_question: jointQuestion.trim(),
          birth: jointBirth,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        alert(data.error ?? tConfirm("joint_need_balance"));
        return;
      }
      alert(tConfirm("joint_invite_sent"));
      setJointQuestionOpen(false);
      setJointBirth(null);
      setJointQuestion("");
    } catch {
      alert("network_error");
    } finally {
      setJointBusy(false);
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
              onOpenSession={onOpenSession}
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
          onConfirmMode={(mode) => void handleConfirmMode(mode)}
          onCancel={handleConfirmCancel}
          processing={creating}
          showJointOption={showJointOption}
          jointEnabled={duoSubscribed}
        />
      ) : null}

      {jointQuestionOpen && jointBirth ? (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !jointBusy) {
              setJointQuestionOpen(false);
              setJointBirth(null);
            }
          }}
        >
          <div className="confirm-dialog">
            <div className="confirm-dialog__header">
              <h2>{tConfirm("joint_question_title")}</h2>
              <button
                type="button"
                className="confirm-dialog__back-link"
                disabled={jointBusy}
                onClick={() => {
                  setJointQuestionOpen(false);
                  setJointBirth(null);
                }}
              >
                {tConfirm("go_back")}
              </button>
            </div>
            <p className="description">{tConfirm("joint_question_hint")}</p>
            <textarea
              className="confirm-joint-question"
              rows={4}
              value={jointQuestion}
              disabled={jointBusy}
              placeholder={tConfirm("joint_question_placeholder")}
              onChange={(e) => setJointQuestion(e.target.value)}
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="primary"
                disabled={jointBusy || jointQuestion.trim().length < 4}
                onClick={() => void submitJointInvite()}
              >
                {jointBusy ? tConfirm("processing") : tConfirm("joint_send_invite")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
