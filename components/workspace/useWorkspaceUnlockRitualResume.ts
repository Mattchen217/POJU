"use client";

/**
 * After Stripe unlock return to `/app?tab=poju`, restore prepare context + start center ritual.
 * Does not change right-rail open/close — only restores session/matrix and flips ritual on.
 */

import { useEffect, useRef } from "react";

import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { buildMatrixPayloadFromProfile } from "@/lib/poju/build-matrix-payload";
import { getUnlockReportText } from "@/lib/poju/unlock-report-gate";
import {
  hasUnlockReportMessage,
} from "@/lib/poju/finalize-unlock-bazi-session";
import {
  needsUnlockBaziPreparation,
  POJU_WORKSPACE_UNLOCK_RITUAL_KEY,
} from "@/lib/poju/preview-unlock";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";

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

        if (hasUnlockReportMessage(session)) {
          const reportMsg = session.messages.find((m) => m.meta?.kind === "report");
          const text =
            getUnlockReportText(reportMsg) ||
            markedTextFromStoredBaseAnalysis(profile.base_analysis) ||
            "";
          if (text) {
            setMatrixExpanded(false);
            completeUnlockRitual(text);
          }
          return;
        }

        if (needsUnlockBaziPreparation(session)) {
          startUnlockRitual();
        }
      } catch (e) {
        console.error("[workspace] unlock ritual resume failed:", e);
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
