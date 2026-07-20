import type { BaseAnalysisJob } from "@/lib/base-analysis/job-types";
import {
  isBaseAnalysisProgressStage,
  type ProgressPayload,
} from "@/lib/base-analysis/progress-stages";

export type StreamSseCallbacks = {
  onStart?: (job_id: string) => void;
  onChunk?: (text: string, accumulated: string) => void;
  onPollContent?: (accumulated: string) => void;
  /** Layer-1 judgments (v1 only; v2 does not emit). */
  onCoreJudgments?: (judgments: unknown, source?: string) => void;
  /** Wait-UI progress stage (chart_ready → v2_compute → v2_narrative…). */
  onProgress?: (payload: ProgressPayload) => void;
};

export type StreamSseResult = {
  content: string;
  meta: BaseAnalysisJob["meta"] | Record<string, unknown>;
  job_id: string | null;
};

/** v2 stream endpoint — three-call orchestrate (compute → narrative∥evidence). */
export const BASE_ANALYSIS_STREAM_PATH = "/api/profile/base-analysis-v2/stream";

const POLL_INTERVAL_MS = 2_500;
/** Above server `maxDuration` (800s) + reconnect slack. */
const POLL_MAX_MS = 900_000;

type StatusPayload = {
  job_id?: string;
  status?: string;
  accumulated_content?: string;
  progress_stage?: unknown;
  meta?: BaseAnalysisJob["meta"] | Record<string, unknown>;
  error?: string;
  error_detail?: string;
  ok?: boolean;
};

function emitProgressFromPoll(
  data: StatusPayload,
  callbacks?: StreamSseCallbacks,
  lastStageRef?: { current: string | null },
): void {
  if (!isBaseAnalysisProgressStage(data.progress_stage)) return;
  if (lastStageRef && lastStageRef.current === data.progress_stage) return;
  if (lastStageRef) lastStageRef.current = data.progress_stage;
  callbacks?.onProgress?.({ stage: data.progress_stage });
}

async function pollJobUntilDone(
  job_id: string,
  callbacks?: StreamSseCallbacks,
  signal?: AbortSignal,
): Promise<StreamSseResult> {
  const startedAt = Date.now();
  const lastStageRef = { current: null as string | null };

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (Date.now() - startedAt > POLL_MAX_MS) {
      throw new Error("BASE_ANALYSIS_POLL_TIMEOUT");
    }

    const res = await fetch(
      `/api/profile/base-analysis/status?job_id=${encodeURIComponent(job_id)}`,
      { signal },
    );
    if (!res.ok) {
      throw new Error(`status poll failed (${res.status})`);
    }
    const data = (await res.json()) as StatusPayload;
    const accumulated = String(data.accumulated_content ?? "");
    callbacks?.onPollContent?.(accumulated);
    emitProgressFromPoll(data, callbacks, lastStageRef);

    if (data.status === "completed") {
      return {
        content: accumulated,
        meta: data.meta ?? {},
        job_id,
      };
    }
    if (data.status === "failed") {
      const detail = data.error_detail ? `: ${data.error_detail}` : "";
      throw new Error(String(data.error || "base analysis job failed") + detail);
    }

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, POLL_INTERVAL_MS);
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}

/**
 * Start v2 base-analysis job and poll until completed / failed.
 * Same public shape as the old SSE client so hooks/callers stay unchanged.
 */
export async function consumeBaseAnalysisStream(input: {
  profile_id: string;
  locale: string;
  local_data: BaseAnalysisJob["local_data"];
  resume_job_id?: string;
  signal?: AbortSignal;
  callbacks?: StreamSseCallbacks;
}): Promise<StreamSseResult> {
  const res = await fetch(BASE_ANALYSIS_STREAM_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile_id: input.profile_id,
      locale: input.locale,
      local_data: input.local_data,
      resume_job_id: input.resume_job_id,
    }),
    signal: input.signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status}: ${errText}`);
  }

  const data = (await res.json()) as StatusPayload & {
    poll?: string;
    kind?: string;
  };

  if (data.ok === false) {
    throw new Error(String(data.error || "base analysis v2 start failed"));
  }

  const jobId = String(data.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("base analysis v2: missing job_id");
  }

  input.callbacks?.onStart?.(jobId);
  emitProgressFromPoll(data, input.callbacks);

  // Resume / cache hit: content already final
  if (data.status === "completed") {
    const content = String(data.accumulated_content ?? "");
    input.callbacks?.onPollContent?.(content);
    return {
      content,
      meta: data.meta ?? {},
      job_id: jobId,
    };
  }

  return pollJobUntilDone(jobId, input.callbacks, input.signal);
}
