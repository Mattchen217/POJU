"use client";

/**
 * After Stripe unlock return to `/app?tab=poju`:
 * restore prepare context, ensure Layer-1 natal facts, release pending question into opening.
 * Does not block center chat and does not generate a personal energy report.
 */

import { useEffect, useRef } from "react";

import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { buildMatrixPayloadFromProfile } from "@/lib/poju/build-matrix-payload";
import {
  needsUnlockBaziPreparation,
  POJU_RELEASE_PENDING_QUESTION_FLAG,
  POJU_WORKSPACE_UNLOCK_RITUAL_KEY,
} from "@/lib/poju/preview-unlock";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import { ensureLayer1ForProfile } from "@/lib/profile/ensure-layer1";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

export function useWorkspaceUnlockRitualResume(locale: string) {
  const {
    phase,
    setPhase,
    setProfileId,
    setSession,
    setMatrixPayload,
    startUnlockRitual,
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

        await ensureLayer1ForProfile(profileId, locale);
        if (cancelled) return;

        if (session.pending_question?.trim()) {
          sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, sessionId);
        }

        if (needsUnlockBaziPreparation(session) || session.unlock_status === "unlocked") {
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
    startUnlockRitual,
  ]);
}
