"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { useRouter } from "@/i18n/navigation";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import {
  getStoredProfile,
  profileHasBaseAnalysis,
} from "@/lib/profile/stored-profiles-service";
import { replaceSyncroPreparingWithLocation } from "@/lib/syncro/syncro-preparing-nav";

/** 与 POJU preparing 一致：首次分析至少展示 Spline 时长 */
const PREPARING_MIN_SPLINE_MS = 5000;
const PREPARING_MIN_SPLINE_CACHE_MS = 10_000;
/** 若 LLM 已完成但导航失败，轮询 IndexedDB 恢复前进 */
const ANALYSIS_POLL_MS = 8000;

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
  const navigatedRef = useRef(false);

  const goToLocation = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    setCurrentStep("done");
    replaceSyncroPreparingWithLocation(router);
  }, [router]);

  const startPreparation = useCallback(async () => {
    const splineStartedAt = Date.now();
    try {
      setCurrentStep("loading");
      setError(null);
      navigatedRef.current = false;

      const profileData = await getStoredProfile(profileId);
      if (!profileData) {
        router.replace("/syncro/prepare");
        return;
      }
      setProfile(profileData);

      const hasCache = await profileHasBaseAnalysis(profileId);

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
    if (currentStep !== "analyzing" || !profileId) return;

    const interval = window.setInterval(() => {
      void (async () => {
        if (navigatedRef.current) return;
        if (await profileHasBaseAnalysis(profileId)) {
          goToLocation();
        }
      })();
    }, ANALYSIS_POLL_MS);

    return () => window.clearInterval(interval);
  }, [currentStep, profileId, goToLocation]);

  function handleRetry() {
    setError(null);
    navigatedRef.current = false;
    hasStartedRef.current = false;
    void startPreparation();
  }

  function handleBack() {
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
