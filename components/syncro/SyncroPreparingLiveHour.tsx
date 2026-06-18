"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { HourProgressBar } from "@/components/syncro/HourProgressBar";
import { SyncroPreparingLiveCompassMini } from "@/components/syncro/SyncroPreparingLiveCompassMini";
import { SyncroPreparingLiveStreamTicker } from "@/components/syncro/SyncroPreparingLiveStreamTicker";
import type { SyncroLlmProgress } from "@/lib/syncro/syncro-llm-progress";
import { SYNCRO_LLM_BATCH_COUNT } from "@/lib/llm/services/syncro-reading-service";
import { hourPeriodDisplayName, HOUR_PERIOD_RANGES } from "@/lib/syncro/hour-period-ranges";
import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import { rebuildSyncroLlmContext } from "@/lib/syncro/rebuild-syncro-llm-context";
import { buildSyncroLlmHoursInput } from "@/lib/syncro/syncro-llm-batch-core";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import { resolveSyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";
import { patchSyncroSessionMatrix } from "@/lib/syncro/syncro-session";
import { getOpenRouterDefaultModel } from "@/lib/llm/openrouter-shared";
import { runStreamHoursWithRetry } from "@/lib/syncro/syncro-stream-hours-runner";
import { getOrderedHourPeriodsFromSession } from "@/lib/syncro/syncro-view-helpers";
import type { HourPeriod, SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-preparing-live.css";

type Props = {
  session: SyncroSession;
  locale: string;
  realtimePeriod: HourPeriod;
  progress: SyncroLlmProgress;
  onSessionUpdate: (session: SyncroSession) => void;
  /** SSE only — no compass / ticker UI (used inside DeliveryWaitFrame). */
  headless?: boolean;
};

type StreamPhase =
  | "idle"
  | "connecting"
  | "reasoning"
  | "writing"
  | "done"
  | "error";

function mergeAdviceIntoSession(target: SyncroSession, patched: SyncroSession, keys: string[]): void {
  for (const key of keys) {
    const src = patched.matrix[key];
    const dst = target.matrix[key];
    if (!src || !dst) continue;
    dst.short_advice = src.short_advice;
    dst.detailed_advice = src.detailed_advice;
    dst.rationale = src.rationale;
    dst.llm_pending = src.llm_pending;
    dst.llm_failed = src.llm_failed;
  }
  target.llm_meta = { ...target.llm_meta, ...patched.llm_meta };
}

/**
 * Wait page: SSE stream for current (NOW) hour only → compass.
 * Remaining 11 hours start after compass (see useSyncroInngestJob).
 */
export function SyncroPreparingLiveHour({
  session,
  locale,
  realtimePeriod,
  progress,
  onSessionUpdate,
  headless = false,
}: Props) {
  const t = useTranslations("syncro.preparing_live");
  const params = useParams();
  const sessionId = typeof params.id === "string" ? params.id : "";

  const priorityHour = realtimePeriod;
  const orderedPeriods = getOrderedHourPeriodsFromSession(session);
  const hourName = hourPeriodDisplayName(priorityHour, locale);
  const hourRange = HOUR_PERIOD_RANGES[priorityHour];

  const [streamText, setStreamText] = useState("");
  const [streamPhase, setStreamPhase] = useState<StreamPhase>("idle");
  const [attemptInfo, setAttemptInfo] = useState<{ current: number; max: number } | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [ctxMissing, setCtxMissing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const streamActive =
    streamPhase === "connecting" ||
    streamPhase === "reasoning" ||
    streamPhase === "writing";

  const handleRetry = () => {
    abortRef.current?.abort();
    startedRef.current = false;
    setStreamText("");
    setStreamPhase("idle");
    setStreamError(null);
    setAttemptInfo(null);
    setCtxMissing(false);
    setRetryKey((k) => k + 1);
  };

  useEffect(() => {
    if (!sessionId) return;
    if (startedRef.current) return;
    if (isHourPeriodLlmReady(session.matrix, priorityHour, session.llm_meta)) {
      setStreamPhase("done");
      return;
    }
    startedRef.current = true;

    const abort = new AbortController();
    abortRef.current = abort;

    void (async () => {
      let ctx = await resolveSyncroLlmContext(sessionId);
      if (!ctx) {
        ctx = await rebuildSyncroLlmContext(session);
      }
      if (!ctx) {
        setCtxMissing(true);
        setStreamPhase("error");
        setStreamError(t("ctx_missing"));
        return;
      }

      const hoursInput = buildSyncroLlmHoursInput(sessionId, [priorityHour], ctx);
      setStreamPhase("connecting");

      const result = await runStreamHoursWithRetry(
        hoursInput,
        {
          onProgress: (phase) => {
            setStreamPhase(phase);
          },
          onReasoningChunk: (text) => {
            setStreamPhase((prev) => (prev === "writing" ? prev : "reasoning"));
            setStreamText((prev) => prev + text);
          },
          onContentChunk: (text) => {
            setStreamText((prev) => prev + text);
          },
          onError: (err) => {
            setStreamPhase("error");
            setStreamError(err.detail ?? err.error);
          },
        },
        {
          signal: abort.signal,
          onAttemptStart: (current, max) => {
            setAttemptInfo({ current, max });
            setStreamText("");
          },
        },
      );

      if (abort.signal.aborted) return;

      if (result.success && result.advice) {
        setStreamPhase("done");
        const updated = await patchSyncroSessionMatrix(sessionId, result.advice, {
          model: getOpenRouterDefaultModel(),
          tokens_used: 1,
          cost_usd_delta: 0,
        });
        if (updated) {
          mergeAdviceIntoSession(session, updated, Object.keys(result.advice));
          onSessionUpdate(updated);
          dispatchSyncroMatrixPatch({
            session_id: sessionId,
            batch_index: 0,
            batch_total: SYNCRO_LLM_BATCH_COUNT,
            updated_keys: Object.keys(result.advice),
          });
        } else {
          setStreamPhase("error");
          setStreamError(t("save_failed"));
        }
        return;
      }

      if (result.lastError === "aborted") return;

      setStreamPhase("error");
      setStreamError(result.lastError ?? t("gen_failed", { error: "unknown" }));
    })();

    return () => {
      abort.abort();
    };
  }, [sessionId, priorityHour, locale, session, retryKey, onSessionUpdate, t]);

  if (headless) {
    return null;
  }

  return (
    <div className="syncro-preparing-live">
      <HourProgressBar
        matrix={session.matrix}
        llmMeta={session.llm_meta}
        orderedPeriods={orderedPeriods}
        livePeriod={realtimePeriod}
        activeHour={realtimePeriod}
        onSelect={() => {}}
        locale={locale}
      />

      <div className="syncro-preparing-live-body">
        <SyncroPreparingLiveCompassMini />

        <h2 className="syncro-preparing-live-title">{t("analyzing_title")}</h2>

        <p className="syncro-preparing-live-hint syncro-preparing-live-hint--wide">
          {t("live_hour_hint", { hour: hourName, range: hourRange })}
        </p>
        <p className="syncro-preparing-live-hint syncro-preparing-live-hint--wide syncro-preparing-live-hint--muted">
          {t("background_hint")}
        </p>

        {(streamActive || streamText.length > 0) ? (
          <div className="syncro-preparing-live-stream-slot">
            <SyncroPreparingLiveStreamTicker
              text={streamText}
              active={streamActive}
              placeholder={
                streamPhase === "connecting"
                  ? t("connecting")
                  : streamPhase === "reasoning"
                    ? t("reasoning")
                    : "…"
              }
            />
          </div>
        ) : null}

        {streamPhase === "error" ? (
          <div className="syncro-preparing-live-error">
            <p className="syncro-preparing-live-progress syncro-preparing-live-progress--error">
              {t("gen_failed", { error: streamError ?? "unknown" })}
              {ctxMissing ? t("ctx_missing_suffix") : ""}
            </p>
            <button type="button" className="primary" onClick={handleRetry}>
              {t("retry")}
            </button>
          </div>
        ) : null}

        {attemptInfo && attemptInfo.current > 1 ? (
          <p className="syncro-preparing-live-progress">
            {t("retrying", { current: attemptInfo.current, max: attemptInfo.max })}
          </p>
        ) : null}

        {progress.running && progress.completed > 0 ? (
          <p className="syncro-preparing-live-progress">
            {t("background_progress", { done: progress.completed })}
          </p>
        ) : null}

        <p className="syncro-preparing-live-hint syncro-preparing-live-hint--footer">
          {t("patience_hint")}
        </p>
      </div>
    </div>
  );
}
