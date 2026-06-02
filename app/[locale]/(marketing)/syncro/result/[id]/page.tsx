"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { SyncroGuardedRoute } from "@/components/syncro/SyncroGuardedRoute";
import { SyncroLlmBatchRunner, type SyncroLlmProgress } from "@/components/syncro/SyncroLlmBatchRunner";
import { SyncroLlmProgressBar } from "@/components/syncro/SyncroLlmProgressBar";
import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
import { SyncroMainView } from "@/components/syncro/SyncroMainView";
import { SyncroPreparingLiveHour } from "@/components/syncro/SyncroPreparingLiveHour";
import { extractSyncroSummary } from "@/lib/poju/tool-result-summary";
import { isInitialSyncroGateReady } from "@/lib/syncro/hour-llm-ready";
import { SyncroOrientationProvider } from "@/components/syncro/SyncroOrientationProvider";
import { Link } from "@/i18n/navigation";
import { generateSyncroHourWithRetry } from "@/lib/syncro/generate-syncro-hour-with-retry";
import { HOUR_ORDER } from "@/lib/syncro/hour-order";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import { resolveSyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";
import {
  isSyncroSessionExpired,
  loadSyncroSession,
  patchSyncroSessionMatrix,
  patchSyncroSessionMatrixFailure,
} from "@/lib/syncro/syncro-session";
import { getCurrentHourPeriod, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro.css";
import "@/styles/syncro-preparing-live.css";

type Stage = "loading" | "ready" | "expired" | "error";

function SyncroResultPageContent() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations("syncro.expired");
  const tError = useTranslations("syncro.main");

  const sessionId = params.id as string;

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

      setSession(s);
      setStage("ready");
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
        <Link href="/syncro" className="mt-6 text-cyan-200 underline">
          {t("cta")}
        </Link>
      </div>
    );
  }

  const syncroSummary = extractSyncroSummary(session);
  const livePeriod = getCurrentHourPeriod();
  const liveHourReady = isInitialSyncroGateReady(session, livePeriod);

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
      <SyncroLlmProgressBar progress={llmProgress} />
      <SyncroLlmBatchRunner
        sessionId={sessionId}
        session={session}
        onSessionUpdate={handleSessionUpdate}
        onProgress={setLlmProgress}
      />
      {liveHourReady ? (
        <SyncroMainView
          session={session}
          locale={locale}
          highlightMatrixKeys={highlightKeys}
          llmProgress={llmProgress}
          liveHourReady
          onRetryHour={handleRetryHour}
          retryingHour={retryingHour}
        />
      ) : (
        <SyncroPreparingLiveHour
          session={session}
          locale={locale}
          livePeriod={livePeriod}
          progress={llmProgress}
        />
      )}
      {liveHourReady ? (
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
