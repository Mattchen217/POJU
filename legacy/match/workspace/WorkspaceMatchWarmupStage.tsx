"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { clsx } from "clsx";

import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { WaitFxLayer } from "@/components/wait-ritual/WaitFxLayer";
import { useWorkspaceMatchPrepare } from "@/components/workspace/WorkspaceMatchPrepareContext";
import type { StoredProfileData } from "@/lib/db/poju-db";
import {
  WORKSPACE_PREPARING_ANALYZING_ZOOM,
  configureWorkspacePreparingSpline,
} from "@/lib/poju/configure-workspace-preparing-spline";
import {
  PREVIEW_MATRIX_MIN_PREP_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { resolveProfileMatrixPayload } from "@/lib/poju/resolve-matrix-preview";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

/**
 * Stage 2 center — same BaZi-list preparing Spline as POJU (forced 10s),
 * builds Match A/B energy-matrix payloads, then hands off to inquiry.
 */
export function WorkspaceMatchWarmupStage() {
  const locale = useLocale();
  const tPrep = useTranslations("session_prep");
  const {
    profileIdA,
    profileIdB,
    setPhase,
    setMatrixPayloadA,
    setMatrixPayloadB,
    setMatrixUnreadA,
    setMatrixUnreadB,
    openRightAfterWarmup,
    setError,
  } = useWorkspaceMatchPrepare();

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [fading, setFading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!profileIdA || !profileIdB) return;
    startedAtRef.current = Date.now();
    const ac = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        setLocalError(null);
        setError(null);
        setFading(false);
        const [aRow, bRow] = await Promise.all([
          getStoredProfile(profileIdA),
          getStoredProfile(profileIdB),
        ]);
        if (ac.signal.aborted || cancelled) return;
        if (!aRow?.user_profile || !bRow?.user_profile) {
          throw new Error("Profile not found");
        }
        setProfile(aRow);

        const [payloadA, payloadB] = await Promise.all([
          resolveProfileMatrixPayload({
            profileId: profileIdA,
            userProfile: aRow.user_profile,
            locale,
            product: "match",
            signal: ac.signal,
          }),
          resolveProfileMatrixPayload({
            profileId: profileIdB,
            userProfile: bRow.user_profile,
            locale,
            product: "match",
            signal: ac.signal,
          }),
        ]);
        await waitRemainingMinSpline(startedAtRef.current, PREVIEW_MATRIX_MIN_PREP_MS);
        if (ac.signal.aborted || cancelled) return;

        setMatrixPayloadA(payloadA);
        setMatrixPayloadB(payloadB);
        setMatrixUnreadA(true);
        setMatrixUnreadB(true);

        setFading(true);
        openRightAfterWarmup();
        const reduced =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        await new Promise((r) => setTimeout(r, reduced ? 0 : 600));
        if (ac.signal.aborted || cancelled) return;
        setPhase("inquiry");
      } catch (e) {
        if (ac.signal.aborted || cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[workspace-match-warmup]", e);
        const msg = e instanceof Error ? e.message : String(e);
        setLocalError(msg);
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [
    locale,
    openRightAfterWarmup,
    profileIdA,
    profileIdB,
    retryKey,
    setError,
    setMatrixPayloadA,
    setMatrixPayloadB,
    setMatrixUnreadA,
    setMatrixUnreadB,
    setPhase,
  ]);

  return (
    <div
      className={clsx(
        "workspace-poju-preparing-stage workspace-match-warmup-stage",
        fading && "workspace-poju-preparing-stage--exit",
      )}
      aria-busy="true"
    >
      <PreparingSplineShell
        blockInteraction
        eagerSpline
        className="workspace-poju-preparing"
        sceneZoom={WORKSPACE_PREPARING_ANALYZING_ZOOM}
        onSplineLoad={configureWorkspacePreparingSpline}
      >
        <WaitFxLayer glowColor="rgba(255,255,255,0.35)" showBreath={false} showFlash={false} />
        {localError && profile ? (
          <ChartReadingLoader
            profile={profile}
            currentStep="error"
            error={localError}
            onRetry={() => {
              setLocalError(null);
              setError(null);
              setRetryKey((k) => k + 1);
            }}
            onRefund={() => setPhase("entry")}
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
