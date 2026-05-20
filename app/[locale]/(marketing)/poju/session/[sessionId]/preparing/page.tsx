"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import type { StoredProfileData } from "@/lib/db/poju-db";
import {
  getStoredProfile,
  getStoredProfileRecord,
  recordProfileUsage,
} from "@/lib/profile/stored-profiles-service";
import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import { withSessionProfileFlags } from "@/lib/poju/session-profile";

/** First-time base analysis — Spline visible at least this long before chat. */
const PREPARING_MIN_SPLINE_MS = 5000;
/** Cached base_analysis JSON — skip LLM but keep scene longer for pacing. */
const PREPARING_MIN_SPLINE_CACHE_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitRemainingMinSpline(startedAt: number, minMs: number): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
}

function PreparingInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const tPrep = useTranslations("session_prep");

  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
  const profileIdFromUrl = searchParams.get("profile");

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [currentStep, setCurrentStep] = useState("loading");
  const [error, setError] = useState<string | null>(null);

  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || hasStartedRef.current) return;
    hasStartedRef.current = true;
    void startPreparation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount
  }, [sessionId]);

  async function bindSessionProfile(profileId: string) {
    const session = await loadPOJUSession(sessionId);
    if (!session) return null;

    const agentBase =
      session.agent_v2 ??
      createInitialAgentState({
        original_question: session.original_question,
        selected_profile_id: profileId,
      });

    const updated = withSessionProfileFlags(
      {
        ...session,
        selected_stored_profile_id: profileId,
        profile_skipped: false,
        agent_v2: {
          ...agentBase,
          selected_profile_id: profileId,
          current_phase: "opening",
        },
      },
      { selected_stored_profile_id: profileId },
    );

    await savePOJUSession(updated);
    await recordProfileUsage(profileId, "poju");
    return updated;
  }

  async function startPreparation() {
    const splineStartedAt = Date.now();
    try {
      setCurrentStep("loading");
      setError(null);

      const session = await loadPOJUSession(sessionId);
      if (!session) {
        router.replace("/poju");
        return;
      }

      const profileId = profileIdFromUrl?.trim() || session.selected_stored_profile_id?.trim();
      if (!profileId) {
        router.replace(`/poju/session/${sessionId}/prepare`);
        return;
      }

      const profileData = await getStoredProfile(profileId);
      if (!profileData) {
        throw new Error("Profile not found");
      }

      setProfile(profileData);
      await bindSessionProfile(profileId);

      const record = await getStoredProfileRecord(profileId);
      const hasCache =
        Boolean(record?.has_base_analysis) ||
        (profileData.base_analysis?.content !== undefined &&
          profileData.base_analysis?.content !== null);

      if (hasCache) {
        setCurrentStep("using_cache");
        const refreshed = await getStoredProfile(profileId);
        if (refreshed) setProfile(refreshed);
        await bindSessionWithBaseAnalysis(profileId);
        await waitRemainingMinSpline(splineStartedAt, PREPARING_MIN_SPLINE_CACHE_MS);
        router.replace(`/poju/session/${sessionId}`);
        return;
      }

      setCurrentStep("analyzing");
      await Promise.all([
        generateBaseAnalysis(profileId),
        waitRemainingMinSpline(splineStartedAt, PREPARING_MIN_SPLINE_MS),
      ]);
      await bindSessionWithBaseAnalysis(profileId);

      const refreshed = await getStoredProfile(profileId);
      if (refreshed) setProfile(refreshed);

      setCurrentStep("done");
      router.replace(`/poju/session/${sessionId}`);
    } catch (err) {
      console.error("[preparing] Failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setCurrentStep("error");
    }
  }

  async function bindSessionWithBaseAnalysis(profileId: string) {
    const session = await loadPOJUSession(sessionId);
    if (!session) return;

    const agentBase =
      session.agent_v2 ??
      createInitialAgentState({
        original_question: session.original_question,
        selected_profile_id: profileId,
      });

    const updated = withSessionProfileFlags(
      {
        ...session,
        selected_stored_profile_id: profileId,
        profile_skipped: false,
        agent_v2: {
          ...agentBase,
          selected_profile_id: profileId,
          has_base_analysis: true,
          current_phase: "opening",
        },
      },
      { selected_stored_profile_id: profileId },
    );

    await savePOJUSession(updated);
  }

  function handleRetry() {
    setError(null);
    setCurrentStep("loading");
    hasStartedRef.current = false;
    void startPreparation();
  }

  function handleRefund() {
    router.push(`/poju/session/${sessionId}/refund`);
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
      onRefund={handleRefund}
      locale={locale}
    />
  );
}

export default function PreparingPage() {
  const tPrep = useTranslations("session_prep");

  return (
    <Suspense
      fallback={
        <PreparingStatusOverlay>
          <p className="preparing-spline-page__status">{tPrep("preparing")}</p>
        </PreparingStatusOverlay>
      }
    >
      <PreparingInner />
    </Suspense>
  );
}
