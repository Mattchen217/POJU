"use client";

/**
 * Right-rail host for unlock base-analysis:
 * full DeliveryWaitFrame ritual under the matrix (collapsed by default; expands push this down).
 * Center chat stays interactive. Layer1 is persisted mid-pipeline for segment2.
 */

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useLocale } from "next-intl";

import { Layer1PrepareWork } from "@/components/poju/Layer1PrepareWork";
import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
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
  storedLayer1Present,
} from "@/lib/profile/stored-profiles-service";
import { useDeliveryWaitPhase } from "@/lib/wait-ritual/use-delivery-wait-phase";

function markSessionLayer1Ready(
  session: POJUSessionState,
  profileId: string,
): POJUSessionState {
  if (!session.agent_v2) return session;
  if (
    session.agent_v2.has_base_analysis &&
    session.agent_v2.selected_profile_id === profileId
  ) {
    return session;
  }
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
        onFatalError={(msg) => failUnlockRitual(msg)}
      />
    </div>
  );
}

/** Cached report: run once — do not depend on `session` (avoids setSession loops). */
function UnlockCachedRailWork({
  profile,
  sessionRef,
  profileId,
  onDone,
  onError,
  onSessionUpdate,
}: {
  profile: StoredProfileData;
  sessionRef: MutableRefObject<POJUSessionState>;
  profileId: string;
  onDone: (text: string) => void;
  onError: (msg: string) => void;
  onSessionUpdate: (s: POJUSessionState) => void;
}) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    void (async () => {
      try {
        const next = markSessionLayer1Ready(sessionRef.current, profileId);
        if (next !== sessionRef.current) {
          onSessionUpdate(next);
        }
        onDone("");
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [profile.base_analysis, profileId, sessionRef, onDone, onError, onSessionUpdate]);

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
  onFatalError,
}: {
  session: POJUSessionState;
  profile: StoredProfileData;
  profileId: string;
  locale: string;
  startedAt: number;
  onSessionUpdate: (s: POJUSessionState) => void;
  onComplete: (text: string) => void;
  onFatalError: (msg: string) => void;
}) {
  const hasCachedReport = useMemo(
    () => storedLayer1Present(profile.base_analysis),
    [profile.base_analysis],
  );
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const onCompleteRef = useRef(onComplete);
  const onFatalErrorRef = useRef(onFatalError);
  const onSessionUpdateRef = useRef(onSessionUpdate);
  onCompleteRef.current = onComplete;
  onFatalErrorRef.current = onFatalError;
  onSessionUpdateRef.current = onSessionUpdate;

  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [streamDone, setStreamDone] = useState(false);
  const [waitVisualDone, setWaitVisualDone] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const waitProgress = useBaseAnalysisWaitProgress();
  const includeTranslate = !locale.startsWith("zh");
  const completingRef = useRef(false);

  const waitFlow = useDeliveryWaitPhase({
    product: "poju",
    baziComplete: streamDone,
    productComplete: false,
    isReturningUser: hasCachedReport,
    enabled: !error,
    onExitComplete: () => setWaitVisualDone(true),
  });

  const stableOnDone = useRef((text: string) => {
    setReportText(text);
    setStreamDone(true);
  }).current;

  const stableOnError = useRef((msg: string) => {
    setError(msg);
  }).current;

  const stableOnSessionUpdate = useRef((s: POJUSessionState) => {
    onSessionUpdateRef.current(s);
  }).current;

  useEffect(() => {
    if (!streamDone || !waitVisualDone) return;
    if (completingRef.current) return;
    completingRef.current = true;
    const ac = new AbortController();
    void (async () => {
      try {
        const minMs = hasCachedReport ? PREPARING_MIN_SPLINE_CACHE_MS : PREVIEW_MATRIX_MIN_PREP_MS;
        await waitRemainingMinSpline(startedAt, minMs);
        if (ac.signal.aborted) {
          completingRef.current = false;
          return;
        }
        onCompleteRef.current(reportText ?? "");
      } catch (e) {
        if (ac.signal.aborted) {
          completingRef.current = false;
          return;
        }
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        completingRef.current = false;
      }
    })();
    return () => {
      ac.abort();
      completingRef.current = false;
    };
  }, [streamDone, waitVisualDone, reportText, startedAt, hasCachedReport]);

  return (
    <DeliveryWaitFrame
      wait={waitFlow}
      isReturningUser={hasCachedReport}
      liveProgressStage={waitProgress.liveProgressStage}
      completedArtifacts={waitProgress.completedArtifacts}
      includeTranslateArtifact={includeTranslate}
      showBreath={false}
      error={error}
      onRetry={() => {
        completingRef.current = false;
        setError(null);
        setStreamDone(false);
        setWaitVisualDone(false);
        setReportText(null);
        waitProgress.reset();
        setRetryKey((k) => k + 1);
      }}
      onRefund={() => onFatalErrorRef.current(error || "Base analysis cancelled")}
      secondaryActionLabel="Dismiss"
      hiddenWork={
        hasCachedReport ? (
          <UnlockCachedRailWork
            key={retryKey}
            profile={profile}
            sessionRef={sessionRef}
            profileId={profileId}
            onSessionUpdate={stableOnSessionUpdate}
            onDone={stableOnDone}
            onError={stableOnError}
          />
        ) : (
          <Layer1PrepareWork
            key={retryKey}
            profileId={profileId}
            locale={locale}
            onComplete={async () => {
              const next = markSessionLayer1Ready(sessionRef.current, profileId);
              if (next !== sessionRef.current) {
                onSessionUpdateRef.current(next);
              }
              setReportText("");
              setStreamDone(true);
            }}
            onError={(err) => {
              setError(err);
            }}
          />
        )
      }
    />
  );
}
