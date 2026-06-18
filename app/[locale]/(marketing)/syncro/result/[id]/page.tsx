"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { SyncroGuardedRoute } from "@/components/syncro/SyncroGuardedRoute";
import type { SyncroLlmProgress } from "@/lib/syncro/syncro-llm-progress";
import { SyncroLlmProgressBar } from "@/components/syncro/SyncroLlmProgressBar";
import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
import { ReadingDecoderBanner } from "@/components/reading-ritual/ReadingDecoderBanner";
import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { SyncroMainView } from "@/components/syncro/SyncroMainView";
import { SyncroPreparingLiveHour } from "@/components/syncro/SyncroPreparingLiveHour";
import { extractSyncroSummary } from "@/lib/poju/tool-result-summary";
import {
  deleteSyncroSession,
  isSyncroSessionExpired,
  loadSyncroSession,
  patchSyncroSessionMatrix,
  patchSyncroSessionMatrixFailure,
} from "@/lib/syncro/syncro-session";
import {
  getLivePeriodInSubmissionTimeline,
  isSyncroCompassGateReady,
  isSubmissionTimelineComplete,
} from "@/lib/syncro/syncro-submission-schedule";
import { useSyncroBackgroundStream } from "@/lib/syncro/use-syncro-background-stream";
import { useSyncroInngestJob } from "@/lib/syncro/use-syncro-inngest-job";
import { SyncroOrientationProvider } from "@/components/syncro/SyncroOrientationProvider";
import { acknowledgeDeliveryViewed } from "@/lib/archive/archive-delivery-pending";
import { Link } from "@/i18n/navigation";
import { generateSyncroHourWithRetry } from "@/lib/syncro/generate-syncro-hour-with-retry";
import { HOUR_ORDER } from "@/lib/syncro/hour-order";
import { getOrderedHourPeriodsFromSession } from "@/lib/syncro/syncro-view-helpers";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import { resolveSyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";
import { useDeliveryWaitPhase } from "@/lib/wait-ritual/use-delivery-wait-phase";
import type { HourPeriod, SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro.css";
import "@/styles/syncro-preparing-live.css";

type Stage = "loading" | "ready" | "expired" | "error";

function SyncroResultPageContent() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations("syncro.expired");
  const tError = useTranslations("syncro.main");

  const sessionId = params.id as string;

  useEffect(() => {
    if (!sessionId) return;
    acknowledgeDeliveryViewed(sessionId);
  }, [sessionId]);

  const [session, setSession] = useState<SyncroSession | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [llmProgress, setLlmProgress] = useState<SyncroLlmProgress>({
    completed: 0,
    total: 12,
    running: true,
    failed: 0,
  });
  const [highlightKeys, setHighlightKeys] = useState<Set<string>>(() => new Set());
  const [retryingHour, setRetryingHour] = useState<HourPeriod | null>(null);
  const [waitVisualDone, setWaitVisualDone] = useState(false);

  const handleSessionUpdate = useCallback((next: SyncroSession) => {
    setSession(next);
  }, []);

  const handleRetryHour = useCallback(
    async (hourId: HourPeriod) => {
      if (!session) return;
      setRetryingHour(hourId);
      try {
        const ctx = await resolveSyncroLlmContext(sessionId);
        if (!ctx) {
          console.error("[Syncro] retry: no llm context");
          return;
        }

        const result = await generateSyncroHourWithRetry(hourId, ctx);
        const cellKeys = Object.keys(ctx.local_matrix).filter((k) =>
          k.startsWith(`${hourId}__`),
        );
        const hourIdx = HOUR_ORDER.indexOf(hourId);

        if (result.success && result.advice) {
          const updated = await patchSyncroSessionMatrix(sessionId, result.advice, {
            model: result.model,
            tokens_used: result.tokens_used ?? 0,
            cost_usd_delta: 0,
          });
          if (updated) {
            handleSessionUpdate(updated);
            dispatchSyncroMatrixPatch({
              session_id: sessionId,
              batch_index: hourIdx,
              batch_total: 12,
              updated_keys: Object.keys(result.advice),
            });
          }
        } else {
          const updated = await patchSyncroSessionMatrixFailure(sessionId, cellKeys);
          if (updated) handleSessionUpdate(updated);
        }
      } finally {
        setRetryingHour(null);
      }
    },
    [session, sessionId, handleSessionUpdate],
  );

  useEffect(() => {
    void loadSession();
  }, [sessionId]);

  const liveHourReady =
    stage === "ready" && session !== null && isSyncroCompassGateReady(session);

  const showMainView = liveHourReady && waitVisualDone;

  const waitFlow = useDeliveryWaitPhase({
    product: "syncro",
    skipBazi: true,
    baziComplete: true,
    productComplete: liveHourReady,
    enabled: stage === "ready" && session !== null && !showMainView,
    onExitComplete: () => setWaitVisualDone(true),
  });

  /** Optional on-page SSE; cloud batches (Inngest) run regardless via useSyncroInngestJob. */
  const backgroundStream = useSyncroBackgroundStream({
    sessionId,
    session,
    locale,
    enabled: false,
    onSessionUpdate: handleSessionUpdate,
    onProgress: setLlmProgress,
  });

  useSyncroInngestJob({
    sessionId,
    session,
    enabled: stage === "ready" && session !== null,
    startBackground: liveHourReady,
    onSessionUpdate: handleSessionUpdate,
    onProgress: setLlmProgress,
  });

  const handleTimelineComplete = useCallback(() => {
    void isSyncroSessionExpired(sessionId).then((expired) => {
      if (expired) setStage("expired");
    });
  }, [sessionId]);

  useEffect(() => {
    if (stage !== "ready" || !sessionId) return;

    const interval = window.setInterval(() => {
      void isSyncroSessionExpired(sessionId).then((expired) => {
        if (expired) setStage("expired");
      });
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [stage, sessionId]);

  useEffect(() => {
    function onPatch(ev: Event) {
      const detail = (ev as CustomEvent<{ session_id: string; updated_keys: string[] }>).detail;
      if (detail?.session_id !== sessionId) return;
      setHighlightKeys((prev) => {
        const next = new Set(prev);
        for (const k of detail.updated_keys) next.add(k);
        return next;
      });
      window.setTimeout(() => {
        setHighlightKeys((prev) => {
          const next = new Set(prev);
          for (const k of detail.updated_keys) next.delete(k);
          return next;
        });
      }, 2400);
    }
    window.addEventListener("syncro-matrix-patch", onPatch);
    return () => window.removeEventListener("syncro-matrix-patch", onPatch);
  }, [sessionId]);

  async function loadSession() {
    try {
      const expired = await isSyncroSessionExpired(sessionId);
      if (expired) {
        setStage("expired");
        return;
      }

      const s = await loadSyncroSession(sessionId);
      if (!s) {
        setStage("error");
        return;
      }

      if (isSubmissionTimelineComplete(s)) {
        await deleteSyncroSession(sessionId);
        setStage("expired");
        return;
      }

      setSession(s);
      setStage("ready");
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("syncro_last_session_id", sessionId);
        } catch {
          // ignore
        }
      }
    } catch {
      setStage("error");
    }
  }

  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-deep text-text-dim">
        …
      </div>
    );
  }

  if (stage === "expired") {
    return (
      <div className="syncro-expired">
        <h2>{t("title")}</h2>
        <p>{t("message")}</p>
        <Link href="/syncro" className="primary">
          {t("cta")}
        </Link>
      </div>
    );
  }

  if (stage === "error" || !session) {
    return (
      <div className="syncro-error flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4 text-center">
        <p className="text-text-secondary">{tError("session_not_found")}</p>
        <p className="mt-2 text-sm text-text-dim">
          本地记录可能已清除。可在 Archive 中打开最近的 Syncro 任务继续查看。
        </p>
        <Link href="/archive" className="mt-4 text-cyan-200 underline">
          Archive
        </Link>
        <Link href="/syncro" className="mt-6 block text-cyan-200 underline">
          {t("cta")}
        </Link>
      </div>
    );
  }

  const syncroSummary = extractSyncroSummary(session);
  const timelineLivePeriod =
    getLivePeriodInSubmissionTimeline(session) ??
    getOrderedHourPeriodsFromSession(session)[0] ??
    "zi";

  return (
    <SyncroOrientationProvider>
      <div className="px-4 pt-4">
        <ReturnToPojuCTA
          tool="syncro"
          resultId={sessionId}
          resultData={syncroSummary}
          variant="banner"
        />
      </div>
      <div
        className={
          llmProgress.running || llmProgress.failed > 0
            ? "syncro-result-shell--progress"
            : undefined
        }
      >
        <SyncroLlmProgressBar progress={llmProgress} />
        {showMainView ? (
          <div className="reading-ritual-fade-in">
            <SyncroMainView
              session={session}
              locale={locale}
              highlightMatrixKeys={highlightKeys}
              llmProgress={llmProgress}
              liveHourReady
              backgroundStream={backgroundStream}
              onRetryHour={handleRetryHour}
              retryingHour={retryingHour}
              onTimelineComplete={handleTimelineComplete}
            />
          </div>
        ) : (
          <DeliveryWaitFrame
            wait={waitFlow}
            hiddenWork={
              session ? (
                <SyncroPreparingLiveHour
                  session={session}
                  locale={locale}
                  realtimePeriod={timelineLivePeriod}
                  progress={llmProgress}
                  onSessionUpdate={handleSessionUpdate}
                  headless
                />
              ) : null
            }
          />
        )}
      </div>
      {showMainView ? (
        <div className="px-4 pb-8">
          <PojuDeepDiveCTA productId="syncro" result_id={sessionId} result_data={syncroSummary} />
          <ReturnToPojuCTA
            tool="syncro"
            resultId={sessionId}
            resultData={syncroSummary}
            variant="footer"
          />
        </div>
      ) : null}
    </SyncroOrientationProvider>
  );
}

export default function SyncroResultPage() {
  return (
    <SyncroGuardedRoute>
      <SyncroResultPageContent />
    </SyncroGuardedRoute>
  );
}
