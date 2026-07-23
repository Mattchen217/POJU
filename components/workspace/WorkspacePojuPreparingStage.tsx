"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { clsx } from "clsx";

import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { WaitFxLayer } from "@/components/wait-ritual/WaitFxLayer";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import type { StoredProfileData } from "@/lib/db/poju-db";
import {
  WORKSPACE_PREPARING_ANALYZING_ZOOM,
  configureWorkspacePreparingSpline,
} from "@/lib/poju/configure-workspace-preparing-spline";
import { finalizeWorkspacePrepare } from "@/lib/poju/finalize-workspace-prepare";
import {
  PREVIEW_MATRIX_MIN_PREP_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

const EXIT_MS = 700;

/**
 * Center-only preparing: Spline + local matrix calc → open right rail with chart →
 * flash/fade out → hand off to chat shell.
 */
export function WorkspacePojuPreparingStage() {
  const locale = useLocale();
  const tPrep = useTranslations("session_prep");
  const {
    phase,
    profileId,
    openRight,
    setPhase,
    setMatrixPayload,
    setSession,
    setError,
    error,
    resetPrepare,
  } = useWorkspacePojuPrepare();

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!profileId) return;
    startedAtRef.current = Date.now();
    const ac = new AbortController();

    void (async () => {
      try {
        setError(null);
        const stored = await getStoredProfile(profileId);
        if (!stored) throw new Error("Profile not found");
        if (ac.signal.aborted) return;
        setProfile(stored);

        const [result] = await Promise.all([
          finalizeWorkspacePrepare(profileId, locale, { signal: ac.signal }),
          waitRemainingMinSpline(startedAtRef.current, PREVIEW_MATRIX_MIN_PREP_MS),
        ]);
        if (ac.signal.aborted) return;

        setMatrixPayload(result.matrixPayload);
        setSession(result.session);

        setShowFlash(true);
        setPhase("exiting");
        /* Open rail as prepare fades out — avoids resizing the Spline canvas mid-scene. */
        openRight();
        await new Promise((r) => setTimeout(r, EXIT_MS));
        if (ac.signal.aborted) return;
        setShowFlash(false);
        setPhase("chat");
      } catch (e) {
        if (ac.signal.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[workspace-poju-prepare]", e);
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      ac.abort();
    };
  }, [
    profileId,
    retryKey,
    locale,
    openRight,
    setMatrixPayload,
    setSession,
    setPhase,
    setError,
  ]);

  if (phase === "chat" || phase === "idle") return null;

  const exiting = phase === "exiting";

  return (
    <div
      className={clsx(
        "workspace-poju-preparing-stage",
        exiting && "workspace-poju-preparing-stage--exit",
      )}
    >
      <PreparingSplineShell
        blockInteraction
        eagerSpline
        className="workspace-poju-preparing"
        sceneZoom={WORKSPACE_PREPARING_ANALYZING_ZOOM}
        onSplineLoad={configureWorkspacePreparingSpline}
      >
        {/* No purple breath vignette — Spline is transparent; Classic WaitFx tint looked like a purple plate. */}
        <WaitFxLayer glowColor="rgba(255,255,255,0.35)" showBreath={false} showFlash={showFlash} />
        {error && profile ? (
          <ChartReadingLoader
            profile={profile}
            currentStep="error"
            error={error}
            onRetry={() => {
              setError(null);
              setRetryKey((k) => k + 1);
            }}
            onRefund={() => {
              resetPrepare();
            }}
            locale={locale}
            variant="matrix"
          />
        ) : profile ? (
          <ChartReadingLoader
            profile={profile}
            currentStep="analyzing"
            error={null}
            onRetry={() => {}}
            onRefund={() => {}}
            locale={locale}
            variant="matrix"
          />
        ) : (
          <PreparingStatusOverlay>
            <p className="preparing-spline-page__status">{tPrep("preparing")}</p>
          </PreparingStatusOverlay>
        )}
      </PreparingSplineShell>
    </div>
  );
}
