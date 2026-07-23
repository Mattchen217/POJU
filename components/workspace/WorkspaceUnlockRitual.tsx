"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";

import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { usePreparingBlockInput } from "@/components/poju/preparing-spline-control";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
import { useBaseAnalysisWaitProgress } from "@/lib/base-analysis/use-base-analysis-wait-progress";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { finalizeUnlockBaziSession } from "@/lib/poju/finalize-unlock-bazi-session";
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

/**
 * Workspace center unlock ritual — same DeliveryWaitFrame + base-analysis pipeline
 * as marketing UnlockBaziPreparing, but stays in /app (no route push) and does not
 * touch right-rail open/close.
 */
export function WorkspaceUnlockRitual() {
  const locale = useLocale();
  const {
    unlockRitualActive,
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
    if (!unlockRitualActive) {
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
  }, [unlockRitualActive, profileId, session?.selected_stored_profile_id]);

  if (!unlockRitualActive || !session) return null;

  if (loadError) {
    return (
      <div className="workspace-unlock-ritual workspace-unlock-ritual--error" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={() => failUnlockRitual(loadError)}>
          Dismiss
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="workspace-unlock-ritual workspace-unlock-ritual--loading" aria-busy>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  const resolvedProfileId =
    profileId?.trim() || session.selected_stored_profile_id?.trim() || "";

  if (!resolvedProfileId) {
    return (
      <div className="workspace-unlock-ritual workspace-unlock-ritual--error" role="alert">
        <p>Missing profile</p>
      </div>
    );
  }

  return (
    <div className="workspace-unlock-ritual">
      <WorkspaceUnlockRitualInner
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

function UnlockBaziCachedWork({
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
        const finalSession = finalizeUnlockBaziSession(session, text, profileId);
        onSessionUpdate(finalSession);
        await savePOJUSession(finalSession);
        onDone(text);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [profile.base_analysis, session, profileId, onDone, onError, onSessionUpdate]);

  return null;
}

function WorkspaceUnlockRitualInner({
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

  usePreparingBlockInput(true);

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
          <UnlockBaziCachedWork
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
            logLabel="WorkspaceUnlockRitual"
            hideStreamView
            reportOutputLanguageFromUi
            onProgress={waitProgress.onProgress}
            onComplete={async (displayText) => {
              const finalSession = finalizeUnlockBaziSession(session, displayText, profileId);
              onSessionUpdate(finalSession);
              await savePOJUSession(finalSession);
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
