"use client";

/**
 * Right-rail host for unlock base-analysis: wait chrome under the matrix + stream pipeline.
 * Center chat stays interactive; Layer1 is persisted mid-pipeline for segment2.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
import { useBaseAnalysisWaitProgress } from "@/lib/base-analysis/use-base-analysis-wait-progress";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { savePOJUSession } from "@/lib/poju/session-manager";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  getStoredProfile,
  storedBaseAnalysisPresent,
} from "@/lib/profile/stored-profiles-service";

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
  const t = useTranslations("workspace.pojuRail");
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
          {t("dismissError")}
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
    <WorkspaceRailBaseAnalysisInner
      session={session}
      profile={profile}
      profileId={resolvedProfileId}
      locale={locale}
      onSessionUpdate={(next) => {
        setSession(next);
        void savePOJUSession(next);
      }}
      onComplete={(text) => completeUnlockRitual(text)}
      onError={(msg) => failUnlockRitual(msg)}
    />
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
  onSessionUpdate,
  onComplete,
  onError,
}: {
  session: POJUSessionState;
  profile: StoredProfileData;
  profileId: string;
  locale: string;
  onSessionUpdate: (s: POJUSessionState) => void;
  onComplete: (text: string) => void;
  onError: (msg: string) => void;
}) {
  const t = useTranslations("workspace.pojuRail");
  const hasCachedReport = useMemo(
    () => storedBaseAnalysisPresent(profile.base_analysis),
    [profile.base_analysis],
  );
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const waitProgress = useBaseAnalysisWaitProgress();

  const stageLabel = (() => {
    const stage = waitProgress.liveProgressStage;
    if (!stage) return t("baComputing");
    if (stage.startsWith("v2_compute")) return t("baComputing");
    if (stage.startsWith("v2_narrative") || stage.startsWith("v2_evidence")) {
      return t("baWriting");
    }
    if (stage.startsWith("v2_final") || stage.startsWith("v2_translate")) {
      return t("baFinishing");
    }
    return t("baComputing");
  })();

  return (
    <div className="workspace-rail-ba" aria-busy={!error}>
      {error ? (
        <div className="workspace-rail-ba__error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              waitProgress.reset();
              setRetryKey((k) => k + 1);
            }}
          >
            {t("retryBa")}
          </button>
        </div>
      ) : (
        <div className="workspace-rail-ba__wait">
          <div className="workspace-rail-ba__pulse" aria-hidden />
          <p className="workspace-rail-ba__status">{stageLabel}</p>
        </div>
      )}

      <div className="workspace-rail-ba__hidden" aria-hidden>
        {hasCachedReport ? (
          <UnlockCachedRailWork
            key={retryKey}
            profile={profile}
            session={session}
            profileId={profileId}
            onSessionUpdate={onSessionUpdate}
            onDone={(text) => onComplete(text)}
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
              onComplete(displayText);
            }}
            onError={(err) => {
              setError(err);
              onError(err);
            }}
          />
        )}
      </div>
    </div>
  );
}
