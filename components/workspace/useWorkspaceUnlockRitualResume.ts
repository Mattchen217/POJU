"use client";

/**
 * After Stripe unlock return to `/app?tab=poju`:
 * restore prepare context, start right-rail base analysis, release pending question into opening.
 * Does not block center chat.
 */

import { useEffect, useRef } from "react";

import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
import { buildMatrixPayloadFromProfile } from "@/lib/poju/build-matrix-payload";
import { hasUnlockReportMessage } from "@/lib/poju/finalize-unlock-bazi-session";
import {
  needsUnlockBaziPreparation,
  POJU_RELEASE_PENDING_QUESTION_FLAG,
  POJU_WORKSPACE_UNLOCK_RITUAL_KEY,
} from "@/lib/poju/preview-unlock";
import { getUnlockReportText } from "@/lib/poju/unlock-report-gate";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import {
  getStoredProfile,
  storedBaseAnalysisPresent,
} from "@/lib/profile/stored-profiles-service";

export function useWorkspaceUnlockRitualResume(locale: string) {
  const {
    phase,
    setPhase,
    setProfileId,
    setSession,
    setMatrixPayload,
    setMatrixExpanded,
    startUnlockRitual,
    completeUnlockRitual,
    profileId: ctxProfileId,
  } = useWorkspacePojuPrepare();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (typeof window === "undefined") return;
    const sessionId = sessionStorage.getItem(POJU_WORKSPACE_UNLOCK_RITUAL_KEY)?.trim();
    if (!sessionId) return;
    ran.current = true;
    sessionStorage.removeItem(POJU_WORKSPACE_UNLOCK_RITUAL_KEY);

    let cancelled = false;
    void (async () => {
      try {
        const session = await loadPOJUSession(sessionId);
        if (cancelled || !session) return;

        const profileId =
          session.selected_stored_profile_id?.trim() || ctxProfileId?.trim() || "";
        if (!profileId) return;

        const profile = await getStoredProfile(profileId);
        if (cancelled || !profile) return;

        const matrix =
          session.matrix_payload ??
          buildMatrixPayloadFromProfile(profileId, profile.user_profile, {
            locale,
          });

        setProfileId(profileId);
        setSession(session);
        setMatrixPayload(matrix);
        setPhase("chat");

        if (hasUnlockReportMessage(session) || storedBaseAnalysisPresent(profile.base_analysis)) {
          const reportMsg = session.messages.find((m) => m.meta?.kind === "report");
          const text =
            getUnlockReportText(reportMsg) ||
            markedTextFromStoredBaseAnalysis(profile.base_analysis) ||
            "";
          if (text) {
            setMatrixExpanded(false);
            completeUnlockRitual(text);
          }
          // Still release pending into opening if needed
          if (session.pending_question?.trim()) {
            sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, sessionId);
          }
          return;
        }

        if (needsUnlockBaziPreparation(session) || session.unlock_status === "unlocked") {
          sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, sessionId);
          startUnlockRitual();
        }
      } catch (e) {
        console.error("[workspace] unlock pipeline resume failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    locale,
    phase,
    ctxProfileId,
    setPhase,
    setProfileId,
    setSession,
    setMatrixPayload,
    setMatrixExpanded,
    startUnlockRitual,
    completeUnlockRitual,
  ]);
}
