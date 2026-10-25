"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { clsx } from "clsx";

import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { WaitFxLayer } from "@/components/wait-ritual/WaitFxLayer";
import { useWorkspaceGlyphPrepare } from "@/components/workspace/WorkspaceGlyphPrepareContext";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { finalizeToolPreview } from "@/lib/cross-product/finalize-tool-preview";
import { saveGlyphToolPreviewSession } from "@/lib/cross-product/tool-preview-session-cache";
import {
  WORKSPACE_PREPARING_ANALYZING_ZOOM,
  configureWorkspacePreparingSpline,
} from "@/lib/poju/configure-workspace-preparing-spline";
import {
  PREVIEW_MATRIX_MIN_PREP_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

const EXIT_MS = 700;

/**
 * Workspace Glyph prepare: local matrix (≤10s) → open right rail → center draw (question).
 * Mirrors Atmos/POJU preparing, not the marketing CachedProfilePrepareWait route.
 */
export function WorkspaceGlyphPreparingStage() {
  const locale = useLocale();
  const {
    profileId,
    openRight,
    setPhase,
    setMatrixPayload,
    setNarrative,
    setError,
    error,
    resetPrepare,
  } = useWorkspaceGlyphPrepare();

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!profileId) return;
    startedAtRef.current = Date.now();
    const ac = new AbortController();

    void (async () => {
      try {
        setError(null);
        setExiting(false);
        const stored = await getStoredProfile(profileId);
        if (!stored?.user_profile) throw new Error("Profile not found");
        if (ac.signal.aborted) return;
        setProfile(stored);

        const [preview] = await Promise.all([
          finalizeToolPreview({
            profileId,
            userProfile: stored.user_profile,
            locale,
            product: "glyph",
            signal: ac.signal,
          }),
          waitRemainingMinSpline(startedAtRef.current, PREVIEW_MATRIX_MIN_PREP_MS),
        ]);
        if (ac.signal.aborted) return;

        saveGlyphToolPreviewSession(profileId, preview);
        setMatrixPayload(preview.matrix_payload);
        setNarrative(preview.narrative);

        setShowFlash(true);
        setExiting(true);
        openRight();
        await new Promise((r) => setTimeout(r, EXIT_MS));
        if (ac.signal.aborted) return;
        setShowFlash(false);
        setPhase("draw");
      } catch (e) {
        if (ac.signal.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[workspace-glyph-prepare]", e);
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
    setNarrative,
    setPhase,
    setError,
  ]);

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
        <WaitFxLayer
          glowColor="rgba(242,202,80,0.35)"
          showBreath={false}
          showFlash={showFlash}
        />
        {error && profile ? (
          <ChartReadingLoader
            profile={profile}
            currentStep="error"
            error={error}
            onRetry={() => {
              setError(null);
              setRetryKey((k) => k + 1);
            }}
            onRefund={resetPrepare}
            locale={locale}
            variant="matrix"
          />
        ) : profile ? (
          <ChartReadingLoader
            profile={profile}
            currentStep="analyzing"
            error={null}
            onRetry={() => {}}
            onRefund={resetPrepare}
            locale={locale}
            variant="matrix"
          />
        ) : (
          <PreparingStatusOverlay>
            <p className="preparing-spline-page__status" role="status" aria-live="polite">
              …
            </p>
          </PreparingStatusOverlay>
        )}
      </PreparingSplineShell>
    </div>
  );
}
