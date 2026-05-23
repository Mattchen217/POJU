"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { useRouter } from "@/i18n/navigation";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import { getStoredProfile, getStoredProfileRecord } from "@/lib/profile/stored-profiles-service";

/** 与 POJU preparing 一致：首次分析至少展示 Spline 时长 */
const PREPARING_MIN_SPLINE_MS = 5000;
const PREPARING_MIN_SPLINE_CACHE_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitRemainingMinSpline(startedAt: number, minMs: number): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
}

/**
 * 选中命主后：本地已有排盘（createStoredProfile 时 calculateProfile），
 * 若无缓存的命主基础分析则调用 /api/profile/base-analysis（DeepSeek）并写入 IndexedDB。
 */
export function SyncroPreparingPage() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const tPrep = useTranslations("session_prep");

  const profileId = searchParams.get("profile")?.trim() ?? "";

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [currentStep, setCurrentStep] = useState("loading");
  const [error, setError] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!profileId) {
      router.replace("/syncro/prepare");
      return;
    }
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    void startPreparation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount
  }, [profileId]);

  async function startPreparation() {
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

      const record = await getStoredProfileRecord(profileId);
      const hasCache =
        Boolean(record?.has_base_analysis) ||
        (profileData.base_analysis?.content !== undefined && profileData.base_analysis?.content !== null);

      if (hasCache) {
        setCurrentStep("using_cache");
        await waitRemainingMinSpline(splineStartedAt, PREPARING_MIN_SPLINE_CACHE_MS);
        router.replace("/syncro/location");
        return;
      }

      setCurrentStep("analyzing");
      await Promise.all([
        generateBaseAnalysis(profileId),
        waitRemainingMinSpline(splineStartedAt, PREPARING_MIN_SPLINE_MS),
      ]);

      setCurrentStep("done");
      router.replace("/syncro/location");
    } catch (e) {
      console.error("[syncro/preparing]", e);
      setError(e instanceof Error ? e.message : String(e));
      setCurrentStep("error");
    }
  }

  function handleRetry() {
    setError(null);
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
    />
  );
}
