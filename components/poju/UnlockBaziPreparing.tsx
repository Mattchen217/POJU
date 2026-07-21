"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";

import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { usePreparingBlockInput } from "@/components/poju/preparing-spline-control";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
import { useBaseAnalysisWaitProgress } from "@/lib/base-analysis/use-base-analysis-wait-progress";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { finalizeUnlockBaziSession } from "@/lib/poju/finalize-unlock-bazi-session";
import { POJU_RELEASE_PENDING_QUESTION_FLAG } from "@/lib/poju/preview-unlock";
import {
  PREPARING_MIN_SPLINE_CACHE_MS,
  PREVIEW_MATRIX_MIN_PREP_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { savePOJUSession } from "@/lib/poju/session-manager";
import type { POJUSessionState } from "@/lib/poju/types";
import { storedBaseAnalysisPresent } from "@/lib/profile/stored-profiles-service";
import { useDeliveryWaitPhase } from "@/lib/wait-ritual/use-delivery-wait-phase";

type Props = {
  session: POJUSessionState;
  sessionId: string;
  profile: StoredProfileData;
  profileId: string;
  locale: string;
  startedAt: number;
  onRefund: () => void;
};

/** Old profile with stored report: no LLM — attach cached text and mark stream done. */
function UnlockBaziCachedWork({
  profile,
  session,
  profileId,
  onDone,
  onError,
}: {
  profile: StoredProfileData;
  session: POJUSessionState;
  profileId: string;
  onDone: () => void;
  onError: (msg: string) => void;
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
        await savePOJUSession(finalSession);
        onDone();
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [profile.base_analysis, session, profileId, onDone, onError]);

  return null;
}

export function UnlockBaziPreparing({
  session,
  sessionId,
  profile,
  profileId,
  locale,
  startedAt,
  onRefund,
}: Props) {
  const router = useRouter();
  const hasCachedReport = useMemo(
    () => storedBaseAnalysisPresent(profile.base_analysis),
    [profile.base_analysis],
  );
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [streamDone, setStreamDone] = useState(false);
  const [waitVisualDone, setWaitVisualDone] = useState(false);
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
    if (!streamDone || !waitVisualDone) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const minMs = hasCachedReport ? PREPARING_MIN_SPLINE_CACHE_MS : PREVIEW_MATRIX_MIN_PREP_MS;
        await waitRemainingMinSpline(startedAt, minMs);
        if (ac.signal.aborted) return;
        sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, sessionId);
        router.replace(`/poju/session/${sessionId}`);
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => ac.abort();
  }, [streamDone, waitVisualDone, startedAt, sessionId, router, hasCachedReport]);

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
        waitProgress.reset();
        setRetryKey((k) => k + 1);
      }}
      onRefund={onRefund}
      hiddenWork={
        hasCachedReport ? (
          <UnlockBaziCachedWork
            key={retryKey}
            profile={profile}
            session={session}
            profileId={profileId}
            onDone={() => setStreamDone(true)}
            onError={(msg) => setError(msg)}
          />
        ) : (
          <BaseAnalysisStreamPreparing
            key={retryKey}
            profile={profile}
            profileId={profileId}
            locale={locale}
            logLabel="POJUUnlockPreparing"
            hideStreamView
            reportOutputLanguageFromUi
            onProgress={waitProgress.onProgress}
            onComplete={async (displayText) => {
              const finalSession = finalizeUnlockBaziSession(session, displayText, profileId);
              await savePOJUSession(finalSession);
              setStreamDone(true);
            }}
            onError={(err) => setError(err)}
          />
        )
      }
    />
  );
}
