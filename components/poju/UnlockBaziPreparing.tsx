"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { ReadingRitualWaitingPanel } from "@/components/reading-ritual/ReadingRitualWaitingPanel";
import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
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
  const [ritualReleased, setRitualReleased] = useState(false);
  const [waitVisualDone, setWaitVisualDone] = useState(false);

  usePreparingBlockInput(true);

  const waitFlow = useDeliveryWaitPhase({
    product: "poju",
    baziComplete: streamDone,
    productComplete: false,
    enabled: !error,
    onExitComplete: () => setWaitVisualDone(true),
  });

  useEffect(() => {
    if (!streamDone || !ritualReleased || !waitVisualDone) return;
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
  }, [streamDone, ritualReleased, waitVisualDone, startedAt, sessionId, router]);

  return (
    <DeliveryWaitFrame
      wait={waitFlow}
      error={error}
      onRetry={() => {
        setError(null);
        setStreamDone(false);
        setWaitVisualDone(false);
        setRitualReleased(false);
        setRetryKey((k) => k + 1);
      }}
      onRefund={onRefund}
      hiddenWork={
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
      }
      ritualPanel={
        <ReadingRitualWaitingPanel
          product="poju"
          ready={streamDone}
          onReleased={() => setRitualReleased(true)}
        />
      }
    />
  );
}
