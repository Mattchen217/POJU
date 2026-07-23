"use client";

/**
 * Right-rail host for unlock base-analysis:
 * full DeliveryWaitFrame ritual under the matrix (collapsed by default; expands push this down).
 * Center chat stays interactive. Layer1 is persisted mid-pipeline for segment2.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";

import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
import { useBaseAnalysisWaitProgress } from "@/lib/base-analysis/use-base-analysis-wait-progress";
import type { StoredProfileData } from "@/lib/db/poju-db";
import {
  PREPARING_MIN_SPLINE_CACHE_MS,
  PREVIEW_MATRIX_MIN_PREP_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { savePOJUSession } from "@/lib/poju/session-manager";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  getStoredProfile,
  storedBaseAnalysisPresent,
} from "@/lib/profile/stored-profiles-service";
import { useDeliveryWaitPhase } from "@/lib/wait-ritual/use-delivery-wait-phase";

function markSessionLayer1Ready(
  session: POJUSessionState,
  profileId: string,
): POJUSessionState {
  if (!session.agent_v2) return session;
  return {
    ...session,
    agent_v2: {
      ...session.agent_v2,
      has_base_analysis: true,
      selected_profile_id: profileId,
    },
  };
}

export function WorkspaceRailBaseAnalysis() {
  const locale = useLocale();
  const {
    baseReportStatus,
    session,
    profileId,
    setSession,
    completeUnlockRitual,
    failUnlockRitual,
  } = useWorkspacePojuPrepare();

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    if (baseReportStatus !== "generating") {
      setProfile(null);
      setLoadError(null);
      return;
    }
    const id = profileId?.trim() || session?.selected_stored_profile_id?.trim();
    if (!id) {
      setLoadError("Missing profile");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const row = await getStoredProfile(id);
        if (cancelled) return;
        if (!row) {
          setLoadError("Profile not found");
          return;
        }
        setProfile(row);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseReportStatus, profileId, session?.selected_stored_profile_id]);

  if (baseReportStatus !== "generating" || !session) return null;

  if (loadError) {
    return (
      <div className="workspace-rail-ba workspace-rail-ba--error" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={() => failUnlockRitual(loadError)}>
          Dismiss
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="workspace-rail-ba workspace-rail-ba--loading" aria-busy>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  const resolvedProfileId =
    profileId?.trim() || session.selected_stored_profile_id?.trim() || "";
  if (!resolvedProfileId) {
    return (
      <div className="workspace-rail-ba workspace-rail-ba--error" role="alert">
        <p>Missing profile</p>
      </div>
    );
  }

  return (
    <div className="workspace-rail-ba">
      <WorkspaceRailBaseAnalysisInner
        session={session}
        profile={profile}
        profileId={resolvedProfileId}
        locale={locale}
        startedAt={startedAt}
        onSessionUpdate={(next) => {
          setSession(next);
          void savePOJUSession(next);
        }}
        onComplete={(text) => completeUnlockRitual(text)}
        onError={(msg) => failUnlockRitual(msg)}
      />
    </div>
  );
}

function UnlockCachedRailWork({
  profile,
  session,
  profileId,
  onDone,
  onError,
  onSessionUpdate,
}: {
  profile: StoredProfileData;
  session: POJUSessionState;
  profileId: string;
  onDone: (text: string) => void;
  onError: (msg: string) => void;
  onSessionUpdate: (s: POJUSessionState) => void;
}) {
  useEffect(() => {
    const text = markedTextFromStoredBaseAnalysis(profile.base_analysis);
    if (!text) {
      onError("Cached base analysis missing");
      return;
    }
    void (async () => {
      try {
        onSessionUpdate(markSessionLayer1Ready(session, profileId));
        onDone(text);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [profile.base_analysis, session, profileId, onDone, onError, onSessionUpdate]);

  return null;
}

function WorkspaceRailBaseAnalysisInner({
  session,
  profile,
  profileId,
  locale,
  startedAt,
  onSessionUpdate,
  onComplete,
  onError,
}: {
  session: POJUSessionState;
  profile: StoredProfileData;
  profileId: string;
  locale: string;
  startedAt: number;
  onSessionUpdate: (s: POJUSessionState) => void;
  onComplete: (text: string) => void;
  onError: (msg: string) => void;
}) {
  const hasCachedReport = useMemo(
    () => storedBaseAnalysisPresent(profile.base_analysis),
    [profile.base_analysis],
  );
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [streamDone, setStreamDone] = useState(false);
  const [waitVisualDone, setWaitVisualDone] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const waitProgress = useBaseAnalysisWaitProgress();
  const includeTranslate = !locale.startsWith("zh");

  const waitFlow = useDeliveryWaitPhase({
    product: "poju",
    baziComplete: streamDone,
    productComplete: false,
    enabled: !error,
    onExitComplete: () => setWaitVisualDone(true),
  });

  useEffect(() => {
    if (!streamDone || !waitVisualDone || !reportText) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const minMs = hasCachedReport ? PREPARING_MIN_SPLINE_CACHE_MS : PREVIEW_MATRIX_MIN_PREP_MS;
        await waitRemainingMinSpline(startedAt, minMs);
        if (ac.signal.aborted) return;
        onComplete(reportText);
      } catch (e) {
        if (ac.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        onError(msg);
      }
    })();
    return () => ac.abort();
  }, [
    streamDone,
    waitVisualDone,
    reportText,
    startedAt,
    hasCachedReport,
    onComplete,
    onError,
  ]);

  return (
    <DeliveryWaitFrame
      wait={waitFlow}
      liveProgressStage={waitProgress.liveProgressStage}
      completedArtifacts={waitProgress.completedArtifacts}
      includeTranslateArtifact={includeTranslate}
      showBreath={false}
      error={error}
      onRetry={() => {
        setError(null);
        setStreamDone(false);
        setWaitVisualDone(false);
        setReportText(null);
        waitProgress.reset();
        setRetryKey((k) => k + 1);
      }}
      hiddenWork={
        hasCachedReport ? (
          <UnlockCachedRailWork
            key={retryKey}
            profile={profile}
            session={session}
            profileId={profileId}
            onSessionUpdate={onSessionUpdate}
            onDone={(text) => {
              setReportText(text);
              setStreamDone(true);
            }}
            onError={(msg) => {
              setError(msg);
              onError(msg);
            }}
          />
        ) : (
          <BaseAnalysisStreamPreparing
            key={retryKey}
            profile={profile}
            profileId={profileId}
            locale={locale}
            logLabel="WorkspaceRailBaseAnalysis"
            hideStreamView
            reportOutputLanguageFromUi
            onProgress={waitProgress.onProgress}
            onComplete={async (displayText) => {
              const next = markSessionLayer1Ready(session, profileId);
              onSessionUpdate(next);
              setReportText(displayText);
              setStreamDone(true);
            }}
            onError={(err) => {
              setError(err);
              onError(err);
            }}
          />
        )
      }
    />
  );
}
