"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { usePreparingBlockInput } from "@/components/poju/preparing-spline-control";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { finalizeUnlockBaziSession } from "@/lib/poju/finalize-unlock-bazi-session";
import { POJU_RELEASE_PENDING_QUESTION_FLAG } from "@/lib/poju/preview-unlock";
import {
  PREVIEW_MATRIX_MIN_PREP_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { savePOJUSession } from "@/lib/poju/session-manager";
import type { POJUSessionState } from "@/lib/poju/types";

type Props = {
  session: POJUSessionState;
  sessionId: string;
  profile: StoredProfileData;
  profileId: string;
  locale: string;
  startedAt: number;
  onRefund: () => void;
};

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
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [streamDone, setStreamDone] = useState(false);

  usePreparingBlockInput(true);

  useEffect(() => {
    if (!streamDone) return;
    const ac = new AbortController();
    void (async () => {
      try {
        await waitRemainingMinSpline(startedAt, PREVIEW_MATRIX_MIN_PREP_MS);
        if (ac.signal.aborted) return;
        sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, sessionId);
        router.replace(`/poju/session/${sessionId}`);
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => ac.abort();
  }, [streamDone, startedAt, sessionId, router]);

  if (error) {
    return (
      <ChartReadingLoader
        profile={profile}
        currentStep="error"
        error={error}
        onRetry={() => {
          setError(null);
          setStreamDone(false);
          setRetryKey((k) => k + 1);
        }}
        onRefund={onRefund}
        locale={locale}
      />
    );
  }

  return (
    <>
      <BaseAnalysisStreamPreparing
        key={retryKey}
        profile={profile}
        profileId={profileId}
        locale={locale}
        logLabel="POJUUnlockPreparing"
        hideStreamView
        reportOutputLanguageFromUi
        onComplete={async (displayText) => {
          const finalSession = finalizeUnlockBaziSession(session, displayText, profileId);
          await savePOJUSession(finalSession);
          setStreamDone(true);
        }}
        onError={(err) => setError(err)}
      />
      <ChartReadingLoader
        profile={profile}
        currentStep="analyzing"
        error={null}
        onRetry={() => {}}
        onRefund={onRefund}
        locale={locale}
        variant="portrait"
      />
    </>
  );
}
