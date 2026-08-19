"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Layer1PrepareWork } from "@/components/poju/Layer1PrepareWork";
import { PreviewMatrixPreparing } from "@/components/poju/PreviewMatrixPreparing";
import { UnlockBaziPreparing } from "@/components/poju/UnlockBaziPreparing";
import { usePreparingBlockInput } from "@/components/poju/preparing-spline-control";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import type { StoredProfileData } from "@/lib/db/poju-db";
import {
  needsPreviewMatrixPreparation,
  sessionMatrixReadyForChat,
} from "@/lib/poju/matrix-narrative-ready";
import { clearPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import {
  discardIncompletePendingProfile,
  getStoredProfile,
  getStoredProfileRecord,
  profileHasBaseAnalysis,
  recordProfileUsage,
} from "@/lib/profile/stored-profiles-service";
import { bindPreviewProfileToSession, needsUnlockBaziPreparation } from "@/lib/poju/preview-unlock";
import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import {
  PREPARING_MIN_SPLINE_CACHE_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { withSessionProfileFlags } from "@/lib/poju/session-profile";
import { ensureProfileMatrixList } from "@/lib/poju/resolve-matrix-preview";
import type { POJUSessionState } from "@/lib/poju/types";

type Phase = "loading" | "preview_matrix" | "unlock_bazi" | "cache" | "streaming" | "error";

function PreparingInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const tPrep = useTranslations("session_prep");
  const tChart = useTranslations("chart_loader");

  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
  const profileIdFromUrl = searchParams.get("profile");
  const unlockFromUrl = searchParams.get("unlock") === "1";

  const [session, setSession] = useState<POJUSessionState | null>(null);
  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [profileId, setProfileId] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const previewSplineStartedRef = useRef(0);
  const unlockSplineStartedRef = useRef(0);
  const cacheSplineStartedRef = useRef(0);
  const initRef = useRef(false);

  const bindSessionWithBaseAnalysis = useCallback(
    async (pid: string) => {
      const loaded = await loadPOJUSession(sessionId);
      if (!loaded) return;

      const agentBase =
        loaded.agent_v2 ??
        createInitialAgentState({
          original_question: loaded.original_question,
          selected_profile_id: pid,
        });

      const updated = withSessionProfileFlags(
        {
          ...loaded,
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
        let loaded = await loadPOJUSession(sessionId);
        if (!loaded) {
          router.replace("/poju");
          return;
        }

        const pid = profileIdFromUrl?.trim() || loaded.selected_stored_profile_id?.trim();
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

        if (sessionMatrixReadyForChat(loaded) && !unlockFromUrl && !needsUnlockBaziPreparation(loaded)) {
          await finishToSession();
          return;
        }

        if (unlockFromUrl || needsUnlockBaziPreparation(loaded)) {
          if (loaded.unlock_status !== "unlocked") {
            const pendingQ = loaded.pending_question?.trim();
            loaded = {
              ...loaded,
              unlock_status: "unlocked",
              original_question: pendingQ || loaded.original_question,
            };
            await savePOJUSession(loaded);
          }
          await recordProfileUsage(pid, "poju");
          setSession(loaded);
          unlockSplineStartedRef.current = Date.now();
          setPhase("unlock_bazi");
          return;
        }

        if (needsPreviewMatrixPreparation(loaded)) {
          if (!loaded.matrix_payload) {
            loaded = await bindPreviewProfileToSession(loaded, pid, locale);
            await savePOJUSession(loaded);
          }
          await recordProfileUsage(pid, "poju");
          setSession(loaded);
          previewSplineStartedRef.current = Date.now();
          setPhase("preview_matrix");
          return;
        }

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
  }, [
    sessionId,
    profileIdFromUrl,
    unlockFromUrl,
    locale,
    router,
    bindSessionWithBaseAnalysis,
    finishToSession,
  ]);

  if (!profile || phase === "loading") {
    return (
      <PreparingStatusOverlay>
        <p className="preparing-spline-page__status">{tPrep("preparing")}</p>
      </PreparingStatusOverlay>
    );
  }

  if (phase === "unlock_bazi" && session) {
    return (
      <UnlockBaziPreparing
        session={session}
        sessionId={sessionId}
        profile={profile}
        profileId={profileId}
        locale={locale}
        startedAt={unlockSplineStartedRef.current}
        onRefund={handleRefund}
      />
    );
  }

  if (phase === "preview_matrix" && session) {
    return (
      <PreviewMatrixPreparing
        session={session}
        sessionId={sessionId}
        profile={profile}
        locale={locale}
        startedAt={previewSplineStartedRef.current}
        onRefund={handleRefund}
      />
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
  const tPrep = useTranslations("session_prep");
  usePreparingBlockInput(true);

  return (
    <>
      <Layer1PrepareWork
        profileId={profileId}
        locale={locale}
        preWork={async () => {
          await ensureProfileMatrixList({
            profileId,
            userProfile: profile.user_profile,
            locale,
          });
        }}
        onComplete={onComplete}
        onError={onError}
      />
      <PreparingStatusOverlay>
        <p className="preparing-spline-page__status">{tPrep("preparing")}</p>
      </PreparingStatusOverlay>
    </>
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
