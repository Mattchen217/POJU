"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { HourProgressBar } from "@/components/syncro/HourProgressBar";
import type { SyncroLlmProgress } from "@/components/syncro/SyncroLlmBatchRunner";
import { SYNCRO_LLM_BATCH_COUNT } from "@/lib/llm/services/syncro-reading-service";
import { buildHourPairsFromLive, getNextHourPeriod } from "@/lib/syncro/syncro-hour-pairs";
import { buildSyncroLlmHoursInput } from "@/lib/syncro/syncro-llm-batch-core";
import { hourPeriodDisplayName, HOUR_PERIOD_RANGES } from "@/lib/syncro/hour-period-ranges";
import { rebuildSyncroLlmContext } from "@/lib/syncro/rebuild-syncro-llm-context";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import { resolveSyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";
import { patchSyncroSessionMatrix } from "@/lib/syncro/syncro-session";
import { runStreamHoursWithRetry } from "@/lib/syncro/syncro-stream-hours-runner";
import { getOrderedHourPeriodsFromSession } from "@/lib/syncro/syncro-view-helpers";
import type { HourPeriod, SyncroSession } from "@/lib/syncro/types";

type Props = {
  session: SyncroSession;
  locale: string;
  livePeriod: HourPeriod;
  progress: SyncroLlmProgress;
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

/** Full-screen wait: stream first pair (live + next), then compass. */
export function SyncroPreparingLiveHour({ session, locale, livePeriod, progress }: Props) {
  const params = useParams();
  const sessionId = typeof params.id === "string" ? params.id : "";

  const nextPeriod = getNextHourPeriod(livePeriod);
  const orderedPeriods = getOrderedHourPeriodsFromSession(session);
  const hourName = hourPeriodDisplayName(livePeriod, locale);
  const nextName = hourPeriodDisplayName(nextPeriod, locale);
  const hourRange = HOUR_PERIOD_RANGES[livePeriod];

  const [streamText, setStreamText] = useState("");
  const [streamPhase, setStreamPhase] = useState<StreamPhase>("idle");
  const [attemptInfo, setAttemptInfo] = useState<{ current: number; max: number } | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [ctxMissing, setCtxMissing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [cursorVisible, setCursorVisible] = useState(true);

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

      const pairs = buildHourPairsFromLive(livePeriod);
      const [firstHour, secondHour] = pairs[0]!;
      const hoursInput = buildSyncroLlmHoursInput(sessionId, [firstHour, secondHour], ctx);

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
          cost_usd_delta: 0,
        });
        if (updated) {
          const keys = Object.keys(result.advice);
          mergeAdviceIntoSession(session, updated, keys);
          dispatchSyncroMatrixPatch({
            session_id: sessionId,
            batch_index: 0,
            batch_total: SYNCRO_LLM_BATCH_COUNT,
            updated_keys: keys,
          });

          void fetch("/api/syncro/trigger-background", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: sessionId,
              live_period: livePeriod,
              llm_context: ctx,
            }),
          }).catch((e) => {
            console.warn("[SyncroPreparingLiveHour] trigger-background failed:", e);
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
  }, [sessionId, livePeriod, locale, session, retryKey]);

  return (
    <div className="syncro-preparing-live">
      <HourProgressBar
        matrix={session.matrix}
        llmMeta={session.llm_meta}
        orderedPeriods={orderedPeriods}
        livePeriod={livePeriod}
        activeHour={livePeriod}
        onSelect={() => {}}
        locale={locale}
      />

      <div className="syncro-preparing-live-body">
        <h2 className="syncro-preparing-live-title" style={{ marginTop: 0 }}>
          AI 正在深度分析中...
        </h2>

        <p className="syncro-preparing-live-hint" style={{ maxWidth: "28rem" }}>
          ◐ 首批:{hourName}、{nextName}（{hourRange} 起）· 共 6 次 LLM,每次 2 时辰
        </p>

        {streamPhase === "reasoning" ? (
          <p className="syncro-preparing-live-progress">AI 在深度推理...</p>
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
        ) : null}

        {streamPhase === "error" ? (
          <div style={{ marginTop: 12 }}>
            <p className="syncro-preparing-live-progress" style={{ color: "#f87171" }}>
              生成失败:{streamError ?? "未知错误"}
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

        {progress.running ? (
          <p className="syncro-preparing-live-progress">
            后台 Inngest:{progress.completed}/{progress.total} 时辰已完成
          </p>
        ) : null}

        <p className="syncro-preparing-live-hint" style={{ marginTop: 20 }}>
          准确分析需要时间,请耐心等待
          <br />
          使用 V4 Pro 深度推理,首批约 2-4 分钟
        </p>
      </div>
    </div>
  );
}
