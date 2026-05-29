"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
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

  useEffect(() => {
    if (phase !== "cache" || !profileId) return;
    void (async () => {
      await waitRemainingMinSpline(cacheSplineStartedRef.current, PREPARING_MIN_SPLINE_CACHE_MS);
      await finishToSession();
    })();
  }, [phase, profileId, finishToSession]);

  async function handleStreamError(err: string) {
    if (profileId && (await profileHasBaseAnalysis(profileId))) {
      await finishToSession();
      return;
    }
    if (profileId) {
      await discardIncompletePendingProfile(profileId);
    }
    setError(err);
    setPhase("error");
  }

  function handleRefund() {
    router.push(`/poju/session/${sessionId}/refund`);
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
      <PreparingSplineShell blockInteraction>
        <PreparingStatusOverlay>
          <p className="preparing-spline-page__status">{tPrep("preparing_done")}</p>
        </PreparingStatusOverlay>
      </PreparingSplineShell>
    );
  }

  if (phase === "error") {
    return (
      <PreparingSplineShell blockInteraction>
        <div className="preparing-spline-page__overlay preparing-spline-page__overlay--error" role="alert">
          <p className="preparing-spline-page__status">{error}</p>
          <div className="error-actions">
            <button type="button" className="primary" onClick={() => setPhase("streaming")}>
              {tChart("retry")}
            </button>
            <button type="button" className="secondary" onClick={handleRefund}>
              {tChart("refund_instead")}
            </button>
          </div>
        </div>
      </PreparingSplineShell>
    );
  }

  return (
    <PreparingSplineShell blockInteraction>
      <BaseAnalysisStreamPreparing
        profile={profile}
        profileId={profileId}
        locale={locale}
        logLabel="POJUPreparing"
        onComplete={async () => {
          await bindSessionWithBaseAnalysis(profileId);
          await finishToSession();
        }}
        onError={handleStreamError}
      />
    </PreparingSplineShell>
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
