"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { HourProgressBar } from "@/components/syncro/HourProgressBar";
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

type Props = {
  session: SyncroSession;
  locale: string;
  realtimePeriod: HourPeriod;
  progress: SyncroLlmProgress;
  onSessionUpdate: (session: SyncroSession) => void;
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
}: Props) {
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
  const [cursorVisible, setCursorVisible] = useState(true);

  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (streamPhase !== "writing" && streamPhase !== "reasoning") return;
    const id = window.setInterval(() => setCursorVisible((v) => !v), 500);
    return () => window.clearInterval(id);
  }, [streamPhase]);

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
        setStreamError("无法加载 LLM 上下文");
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
          onReasoningChunk: () => {
            setStreamPhase((prev) => (prev === "writing" ? prev : "reasoning"));
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
          setStreamError("保存结果失败");
        }
        return;
      }

      if (result.lastError === "aborted") return;

      setStreamPhase("error");
      setStreamError(result.lastError ?? "生成失败");
    })();

    return () => {
      abort.abort();
    };
  }, [sessionId, priorityHour, locale, session, retryKey, onSessionUpdate]);

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
        <h2 className="syncro-preparing-live-title" style={{ marginTop: 0 }}>
          AI 正在深度分析中…
        </h2>

        <p className="syncro-preparing-live-hint" style={{ maxWidth: "28rem" }}>
          ◐ 正在生成当前时辰 {hourName}（{hourRange}）· 完成后进入罗盘
        </p>
        <p className="syncro-preparing-live-hint" style={{ maxWidth: "28rem", opacity: 0.85 }}>
          其余 11 个时辰在进入罗盘后由后台继续生成（Inngest）
        </p>

        {streamPhase === "reasoning" ? (
          <p className="syncro-preparing-live-progress">AI 在深度推理…</p>
        ) : null}

        {streamText ? (
          <div
            className="syncro-preparing-live-stream-box"
            style={{
              marginTop: 16,
              maxWidth: "28rem",
              maxHeight: 220,
              overflow: "auto",
              padding: "12px 14px",
              textAlign: "left",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "var(--pj-text-sm, 0.875rem)",
              lineHeight: 1.6,
              color: "var(--pj-text-secondary, #a8b0c8)",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(212, 175, 55, 0.2)",
              borderRadius: 8,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {streamText}
            {streamPhase === "writing" || streamPhase === "reasoning" ? (
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  marginLeft: 2,
                  color: "var(--pj-gold, #d4af37)",
                  opacity: cursorVisible ? 1 : 0,
                }}
              >
                ▊
              </span>
            ) : null}
          </div>
        ) : streamPhase === "connecting" ? (
          <p className="syncro-preparing-live-progress" style={{ marginTop: 16 }}>
            正在连接 AI…
          </p>
        ) : null}

        {streamPhase === "error" ? (
          <div style={{ marginTop: 12 }}>
            <p className="syncro-preparing-live-progress" style={{ color: "#f87171" }}>
              生成失败：{streamError ?? "未知错误"}
              {ctxMissing ? "（上下文缺失）" : ""}
            </p>
            <button type="button" className="primary" style={{ marginTop: 8 }} onClick={handleRetry}>
              重试
            </button>
          </div>
        ) : null}

        {attemptInfo && attemptInfo.current > 1 ? (
          <p className="syncro-preparing-live-progress">
            正在重试（{attemptInfo.current}/{attemptInfo.max}）
          </p>
        ) : null}

        {progress.running && progress.completed > 0 ? (
          <p className="syncro-preparing-live-progress">
            后台已完成 {progress.completed}/12 时辰
          </p>
        ) : null}

        <p className="syncro-preparing-live-hint" style={{ marginTop: 20 }}>
          准确分析需要时间，请耐心等待
          <br />
          使用 V4 Pro 深度推理，当前时辰约 1–3 分钟
        </p>
      </div>
    </div>
  );
}
