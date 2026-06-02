"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { usePreparingBlockInput } from "@/components/poju/preparing-spline-control";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { clearPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import {
  discardIncompletePendingProfile,
  getStoredProfile,
  getStoredProfileRecord,
  profileHasBaseAnalysis,
  recordProfileUsage,
} from "@/lib/profile/stored-profiles-service";
import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import { withSessionProfileFlags } from "@/lib/poju/session-profile";

const PREPARING_MIN_SPLINE_CACHE_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitRemainingMinSpline(startedAt: number, minMs: number): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
}

type Phase = "loading" | "cache" | "streaming" | "error";

function PreparingInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const tPrep = useTranslations("session_prep");
  const tChart = useTranslations("chart_loader");

  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
  const profileIdFromUrl = searchParams.get("profile");

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [profileId, setProfileId] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const cacheSplineStartedRef = useRef(0);
  const initRef = useRef(false);

  const bindSessionWithBaseAnalysis = useCallback(
    async (pid: string) => {
      const session = await loadPOJUSession(sessionId);
      if (!session) return;

      const agentBase =
        session.agent_v2 ??
        createInitialAgentState({
          original_question: session.original_question,
          selected_profile_id: pid,
        });

      const updated = withSessionProfileFlags(
        {
          ...session,
          selected_stored_profile_id: pid,
          profile_skipped: false,
          agent_v2: {
            ...agentBase,
            selected_profile_id: pid,
            has_base_analysis: true,
            current_phase: "opening",
          },
        },
        { selected_stored_profile_id: pid },
      );

      await savePOJUSession(updated);
      await recordProfileUsage(pid, "poju");
    },
    [sessionId],
  );

  const finishToSession = useCallback(async () => {
    clearPendingBaseAnalysisProfile();
    router.replace(`/poju/session/${sessionId}`);
  }, [router, sessionId]);

  const handleStreamError = useCallback(
    async (err: string) => {
      if (profileId && (await profileHasBaseAnalysis(profileId))) {
        await finishToSession();
        return;
      }
      if (profileId) {
        await discardIncompletePendingProfile(profileId);
      }
      setError(err);
      setPhase("error");
    },
    [profileId, finishToSession],
  );

  function handleRefund() {
    router.push(`/poju/session/${sessionId}/refund`);
  }

  useEffect(() => {
    if (!sessionId || initRef.current) return;
    initRef.current = true;

    void (async () => {
      try {
        const session = await loadPOJUSession(sessionId);
        if (!session) {
          router.replace("/poju");
          return;
        }

        const pid = profileIdFromUrl?.trim() || session.selected_stored_profile_id?.trim();
        if (!pid) {
          router.replace(`/poju/session/${sessionId}/prepare`);
          return;
        }
        setProfileId(pid);

        const profileData = await getStoredProfile(pid);
        if (!profileData) {
          throw new Error("Profile not found");
        }
        setProfile(profileData);
        await bindSessionWithBaseAnalysis(pid);

        const record = await getStoredProfileRecord(pid);
        const hasCache =
          Boolean(record?.has_base_analysis) ||
          (profileData.base_analysis?.content !== undefined &&
            profileData.base_analysis?.content !== null);

        if (hasCache) {
          cacheSplineStartedRef.current = Date.now();
          setPhase("cache");
          return;
        }

        setPhase("streaming");
      } catch (err) {
        console.error("[poju/preparing]", err);
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    })();
  }, [sessionId, profileIdFromUrl, router, bindSessionWithBaseAnalysis]);

  if (!profile || phase === "loading") {
    return (
      <PreparingStatusOverlay>
        <p className="preparing-spline-page__status">{tPrep("preparing")}</p>
      </PreparingStatusOverlay>
    );
  }

  if (phase === "cache") {
    return (
      <CachePhaseOverlay finishToSession={finishToSession} startedAt={cacheSplineStartedRef.current} />
    );
  }

  if (phase === "error") {
    return (
      <ErrorPhaseOverlay
        error={error}
        onRetry={() => setPhase("streaming")}
        onRefund={handleRefund}
        tChart={tChart}
      />
    );
  }

  return (
    <StreamingPhase
      profile={profile}
      profileId={profileId}
      locale={locale}
      onComplete={async () => {
        await bindSessionWithBaseAnalysis(profileId);
        await finishToSession();
      }}
      onError={handleStreamError}
    />
  );
}

function CachePhaseOverlay({
  startedAt,
  finishToSession,
}: {
  startedAt: number;
  finishToSession: () => Promise<void>;
}) {
  const tPrep = useTranslations("session_prep");
  usePreparingBlockInput(true);

  useEffect(() => {
    void (async () => {
      await waitRemainingMinSpline(startedAt, PREPARING_MIN_SPLINE_CACHE_MS);
      await finishToSession();
    })();
  }, [startedAt, finishToSession]);

  return (
    <PreparingStatusOverlay>
      <p className="preparing-spline-page__status">{tPrep("preparing_done")}</p>
    </PreparingStatusOverlay>
  );
}

function ErrorPhaseOverlay({
  error,
  onRetry,
  onRefund,
  tChart,
}: {
  error: string | null;
  onRetry: () => void;
  onRefund: () => void;
  tChart: ReturnType<typeof useTranslations>;
}) {
  usePreparingBlockInput(true);

  return (
    <div className="preparing-spline-page__overlay preparing-spline-page__overlay--error" role="alert">
      <p className="preparing-spline-page__status">{error}</p>
      <div className="error-actions">
        <button type="button" className="primary" onClick={onRetry}>
          {tChart("retry")}
        </button>
        <button type="button" className="secondary" onClick={onRefund}>
          {tChart("refund_instead")}
        </button>
      </div>
    </div>
  );
}

function StreamingPhase({
  profile,
  profileId,
  locale,
  onComplete,
  onError,
}: {
  profile: StoredProfileData;
  profileId: string;
  locale: string;
  onComplete: () => void | Promise<void>;
  onError: (error: string) => void;
}) {
  usePreparingBlockInput(true);

  return (
    <BaseAnalysisStreamPreparing
      profile={profile}
      profileId={profileId}
      locale={locale}
      logLabel="POJUPreparing"
      onComplete={onComplete}
      onError={onError}
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
