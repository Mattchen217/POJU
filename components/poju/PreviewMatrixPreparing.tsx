"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { usePreparingBlockInput } from "@/components/poju/preparing-spline-control";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { finalizePreviewMatrixSession } from "@/lib/poju/finalize-preview-matrix-session";
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
  locale: string;
  startedAt: number;
  onRefund: () => void;
};

export function PreviewMatrixPreparing({
  session,
  sessionId,
  profile,
  locale,
  startedAt,
  onRefund,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  usePreparingBlockInput(true);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const [finalSession] = await Promise.all([
          finalizePreviewMatrixSession(session, locale, { signal: ac.signal }),
          waitRemainingMinSpline(startedAt, PREVIEW_MATRIX_MIN_PREP_MS),
        ]);
        if (ac.signal.aborted) return;
        await savePOJUSession(finalSession);
        router.replace(`/poju/session/${sessionId}`);
      } catch (e) {
        if (ac.signal.aborted) return;
        console.error("[poju/preview-matrix-preparing]", e);
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => ac.abort();
  }, [session, sessionId, locale, startedAt, router, retryKey]);

  if (error) {
    return (
      <ChartReadingLoader
        profile={profile}
        currentStep="error"
        error={error}
        onRetry={() => {
          setError(null);
          setRetryKey((k) => k + 1);
        }}
        onRefund={onRefund}
        locale={locale}
      />
    );
  }

  return (
    <ChartReadingLoader
      profile={profile}
      currentStep="analyzing"
      error={null}
      onRetry={() => {}}
      onRefund={onRefund}
      locale={locale}
      variant="matrix"
    />
  );
}
