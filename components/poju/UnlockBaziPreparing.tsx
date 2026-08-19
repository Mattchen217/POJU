"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

import { Layer1PrepareWork } from "@/components/poju/Layer1PrepareWork";
import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { usePreparingBlockInput } from "@/components/poju/preparing-spline-control";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { finalizeUnlockBaziSession } from "@/lib/poju/finalize-unlock-bazi-session";
import { POJU_RELEASE_PENDING_QUESTION_FLAG } from "@/lib/poju/preview-unlock";
import {
  PREPARING_MIN_SPLINE_CACHE_MS,
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
  const [layer1Done, setLayer1Done] = useState(false);
  const [waitVisualDone, setWaitVisualDone] = useState(false);

  usePreparingBlockInput(true);

  const waitFlow = useDeliveryWaitPhase({
    product: "poju",
    baziComplete: layer1Done,
    productComplete: false,
    enabled: !error,
    onExitComplete: () => setWaitVisualDone(true),
  });

  useEffect(() => {
    if (!layer1Done || !waitVisualDone) return;
    const ac = new AbortController();
    void (async () => {
      try {
        await waitRemainingMinSpline(startedAt, PREPARING_MIN_SPLINE_CACHE_MS);
        if (ac.signal.aborted) return;
        sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, sessionId);
        router.replace(`/poju/session/${sessionId}`);
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => ac.abort();
  }, [layer1Done, waitVisualDone, startedAt, sessionId, router]);

  return (
    <DeliveryWaitFrame
      wait={waitFlow}
      error={error}
      onRetry={() => {
        setError(null);
        setLayer1Done(false);
        setWaitVisualDone(false);
        setRetryKey((k) => k + 1);
      }}
      onRefund={onRefund}
      hiddenWork={
        <Layer1PrepareWork
          key={retryKey}
          profileId={profileId}
          locale={locale}
          onComplete={async () => {
            const finalSession = finalizeUnlockBaziSession(session, "", profileId);
            await savePOJUSession(finalSession);
            setLayer1Done(true);
          }}
          onError={(err) => setError(err)}
        />
      }
    />
  );
}
