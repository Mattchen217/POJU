"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { useRouter } from "@/i18n/navigation";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { clearPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import {
  discardIncompletePendingProfile,
  getStoredProfile,
  getStoredProfileRecord,
  profileHasBaseAnalysis,
} from "@/lib/profile/stored-profiles-service";
import {
  isOnSyncroPreparingRoute,
  replaceSyncroPreparingWithLocation,
} from "@/lib/syncro/syncro-preparing-nav";
import { ensureProfileMatrixList } from "@/lib/poju/resolve-matrix-preview";

const PREPARING_MIN_SPLINE_CACHE_MS = 10_000;
const NAV_WATCHDOG_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitRemainingMinSpline(startedAt: number, minMs: number): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
}

type Phase = "loading" | "cache" | "streaming" | "error";

export function SyncroPreparingPage() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const tPrep = useTranslations("session_prep");
  const tSyncro = useTranslations("syncro");
  const tChart = useTranslations("chart_loader");

  const profileId = searchParams.get("profile")?.trim() ?? "";

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const cacheSplineStartedRef = useRef(0);
  const initRef = useRef(false);

  const goToLocation = useCallback(() => {
    if (!profileId) return;
    sessionStorage.setItem("syncro_profile_id", profileId);
    clearPendingBaseAnalysisProfile();
    replaceSyncroPreparingWithLocation(router);
  }, [router, profileId]);

  useEffect(() => {
    if (!profileId) {
      router.replace("/syncro/prepare");
      return;
    }
    if (initRef.current) return;
    initRef.current = true;

    void (async () => {
      const profileData = await getStoredProfile(profileId);
      if (!profileData) {
        router.replace("/syncro/prepare");
        return;
      }
      setProfile(profileData);
      sessionStorage.setItem("syncro_profile_id", profileId);

      const record = await getStoredProfileRecord(profileId);
      const hasCache =
        Boolean(record?.has_base_analysis) ||
        (profileData.base_analysis?.content !== undefined &&
          profileData.base_analysis?.content !== null) ||
        (await profileHasBaseAnalysis(profileId));

      if (hasCache) {
        cacheSplineStartedRef.current = Date.now();
        setPhase("cache");
        return;
      }

      setPhase("streaming");
    })();
  }, [profileId, router]);

  useEffect(() => {
    if (phase !== "cache") return;
    void (async () => {
      await waitRemainingMinSpline(cacheSplineStartedRef.current, PREPARING_MIN_SPLINE_CACHE_MS);
      goToLocation();
    })();
  }, [phase, goToLocation]);

  useEffect(() => {
    if (!profileId || phase === "loading" || phase === "error" || phase === "streaming") return;

    const interval = window.setInterval(() => {
      void (async () => {
        if (!isOnSyncroPreparingRoute()) return;
        if (await profileHasBaseAnalysis(profileId)) {
          goToLocation();
        }
      })();
    }, NAV_WATCHDOG_MS);

    return () => window.clearInterval(interval);
  }, [phase, profileId, goToLocation]);

  async function handleStreamError(err: string) {
    if (await profileHasBaseAnalysis(profileId)) {
      goToLocation();
      return;
    }
    await discardIncompletePendingProfile(profileId);
    setError(err);
    setPhase("error");
  }

  async function handleBack() {
    await discardIncompletePendingProfile(profileId);
    router.push("/syncro/prepare");
  }

  if (!profileId) {
    return null;
  }

  if (!profile || phase === "loading") {
    return (
      <PreparingStatusOverlay>
        <p className="preparing-spline-page__status">{tPrep("preparing")}</p>
      </PreparingStatusOverlay>
    );
  }

  if (phase === "cache") {
    return (
      <PreparingStatusOverlay>
        <p className="preparing-spline-page__status">{tPrep("preparing_done")}</p>
      </PreparingStatusOverlay>
    );
  }

  if (phase === "error") {
    return (
      <div className="preparing-spline-page__overlay preparing-spline-page__overlay--error" role="alert">
        <p className="preparing-spline-page__status">{error}</p>
        <div className="error-actions">
          <button type="button" className="primary" onClick={() => setPhase("streaming")}>
            {tChart("retry")}
          </button>
          <button type="button" className="secondary" onClick={() => void handleBack()}>
            {tSyncro("back_to_home")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <BaseAnalysisStreamPreparing
      profile={profile}
      profileId={profileId}
      locale={locale}
      logLabel="SyncroPreparing"
      preStreamWork={async () => {
        await ensureProfileMatrixList({
          profileId,
          userProfile: profile.user_profile,
          locale,
        });
      }}
      onComplete={goToLocation}
      onError={handleStreamError}
    />
  );
}
