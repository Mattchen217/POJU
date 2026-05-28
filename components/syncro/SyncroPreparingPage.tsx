"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { useRouter } from "@/i18n/navigation";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
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

/** 与 POJU preparing 一致：首次分析至少展示 Spline 时长 */
const PREPARING_MIN_SPLINE_MS = 5000;
const PREPARING_MIN_SPLINE_CACHE_MS = 10_000;
/** 若 LLM 已完成但导航失败，轮询 IndexedDB 并重复尝试跳转 */
const NAV_WATCHDOG_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitRemainingMinSpline(startedAt: number, minMs: number): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
}

/**
 * 选中命主后：若无缓存的命主基础分析则调用 /api/profile/base-analysis 并写入 IndexedDB。
 */
export function SyncroPreparingPage() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const tPrep = useTranslations("session_prep");
  const tSyncro = useTranslations("syncro");

  const profileId = searchParams.get("profile")?.trim() ?? "";

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [currentStep, setCurrentStep] = useState("loading");
  const [error, setError] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  const goToLocation = useCallback(() => {
    if (!profileId) return;
    sessionStorage.setItem("syncro_profile_id", profileId);
    clearPendingBaseAnalysisProfile();
    setCurrentStep("done");
    replaceSyncroPreparingWithLocation(router);
  }, [router, profileId]);

  const startPreparation = useCallback(async () => {
    const splineStartedAt = Date.now();
    try {
      setCurrentStep("loading");
      setError(null);

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
        setCurrentStep("using_cache");
        await waitRemainingMinSpline(splineStartedAt, PREPARING_MIN_SPLINE_CACHE_MS);
        goToLocation();
        return;
      }

      setCurrentStep("analyzing");
      await Promise.all([
        generateBaseAnalysis(profileId),
        waitRemainingMinSpline(splineStartedAt, PREPARING_MIN_SPLINE_MS),
      ]);

      goToLocation();
    } catch (e) {
      console.error("[syncro/preparing]", e);
      if (await profileHasBaseAnalysis(profileId)) {
        goToLocation();
        return;
      }
      await discardIncompletePendingProfile(profileId);
      setError(e instanceof Error ? e.message : String(e));
      setCurrentStep("error");
    }
  }, [profileId, router, goToLocation]);

  useEffect(() => {
    if (!profileId) {
      router.replace("/syncro/prepare");
      return;
    }
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    void startPreparation();
  }, [profileId, router, startPreparation]);

  useEffect(() => {
    if (!profileId || currentStep === "loading" || currentStep === "error") return;

    const interval = window.setInterval(() => {
      void (async () => {
        if (!isOnSyncroPreparingRoute()) return;

        const ready =
          currentStep === "using_cache" ||
          currentStep === "done" ||
          (await profileHasBaseAnalysis(profileId));

        if (ready) {
          goToLocation();
        }
      })();
    }, NAV_WATCHDOG_MS);

    return () => window.clearInterval(interval);
  }, [currentStep, profileId, goToLocation]);

  function handleRetry() {
    setError(null);
    hasStartedRef.current = false;
    void startPreparation();
  }

  async function handleBack() {
    await discardIncompletePendingProfile(profileId);
    router.push("/syncro/prepare");
  }

  if (!profileId) {
    return null;
  }

  if (!profile) {
    return (
      <PreparingStatusOverlay>
        <p className="preparing-spline-page__status">{tPrep("preparing")}</p>
      </PreparingStatusOverlay>
    );
  }

  return (
    <ChartReadingLoader
      profile={profile}
      currentStep={currentStep}
      error={error}
      onRetry={handleRetry}
      onRefund={handleBack}
      locale={locale}
      secondaryActionLabel={tSyncro("back_to_home")}
    />
  );
}
