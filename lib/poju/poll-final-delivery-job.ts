import type { LLMCallDebug } from "@/lib/llm/llm-debug";
import type { PojuXhighJob, PojuXhighJobFailureReason } from "@/lib/poju/xhigh-job-types";
import { XHIGH_JOB_POLL_INTERVAL_MS } from "@/lib/poju/poll-segment2-xhigh-job";

/** Book pipeline ≈11–16+ LLM calls (narrative → evidence → mark). */
const FINAL_DELIVERY_POLL_MAX_MS = 600_000;

export type FinalDeliveryJobPollResult =
  | {
      ok: true;
      job_id: string;
      full_text: string;
      actions: unknown[];
      model: string;
      tokens_used: number;
      llm_debug?: LLMCallDebug;
      timings?: Record<string, number | undefined>;
    }
  | {
      ok: false;
      job_id: string;
      retryable: boolean;
      reason: PojuXhighJobFailureReason | "poll_timeout" | "completed_without_result";
      error: string;
    };

type StatusPayload = {
  ok?: boolean;
  job_id?: string;
  status?: PojuXhighJob["status"];
  accumulated_content?: string;
  full_text?: string;
  actions?: unknown[];
  model?: string;
  tokens_used?: number;
  llm_debug?: LLMCallDebug;
  timings?: Record<string, number | undefined>;
  retryable?: boolean;
  reason?: FinalDeliveryJobPollResult extends { ok: false; reason: infer R } ? R : never;
  error?: string;
};

export async function fetchFinalDeliveryJobStatus(job_id: string): Promise<StatusPayload> {
  const res = await fetch(
    `/api/poju/final-delivery/status?job_id=${encodeURIComponent(job_id)}`,
    { credentials: "same-origin" },
  );
  if (!res.ok) {
    throw new Error(`final-delivery status poll failed (${res.status})`);
  }
  return (await res.json()) as StatusPayload;
}

/** Resume lookup — latest job for session (completed or in-flight). */
export async function fetchLatestFinalDeliveryJob(session_id: string): Promise<StatusPayload | null> {
  const res = await fetch("/api/poju/final-delivery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ session_id, resume_latest: true }),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`final-delivery resume_latest failed (${res.status})`);
  }
  return (await res.json()) as StatusPayload;
}

export async function pollFinalDeliveryJobUntilDone(input: {
  job_id: string;
  signal?: AbortSignal;
  onProgress?: (status: PojuXhighJob["status"], hint: string) => void;
}): Promise<FinalDeliveryJobPollResult> {
  const startedAt = Date.now();
  console.info("[final-delivery] polling", { job_id: input.job_id });

  while (true) {
    if (input.signal?.aborted) throw new Error("AbortError");
    if (Date.now() - startedAt > FINAL_DELIVERY_POLL_MAX_MS) {
      return {
        ok: false,
        job_id: input.job_id,
        retryable: true,
        reason: "poll_timeout",
        error: "FINAL_DELIVERY_JOB_POLL_TIMEOUT",
      };
    }

    const data = await fetchFinalDeliveryJobStatus(input.job_id);
    const status = data.status ?? "pending";
    input.onProgress?.(status, String(data.accumulated_content ?? ""));

    if (status === "completed") {
      if (typeof data.full_text === "string" && data.full_text.trim()) {
        return {
          ok: true,
          job_id: input.job_id,
          full_text: data.full_text.trim(),
          actions: Array.isArray(data.actions) ? data.actions : [],
          model: String(data.model ?? ""),
          tokens_used: typeof data.tokens_used === "number" ? data.tokens_used : 0,
          llm_debug: data.llm_debug,
          timings: data.timings,
        };
      }
      return {
        ok: false,
        job_id: input.job_id,
        retryable: true,
        reason: "completed_without_result",
        error: "FINAL_DELIVERY_COMPLETED_WITHOUT_TEXT",
      };
    }

    if (status === "failed") {
      return {
        ok: false,
        job_id: input.job_id,
        retryable: data.retryable ?? true,
        reason: data.reason ?? "transport_error",
        error: data.error ?? "final delivery failed",
      };
    }

    await new Promise((r) => setTimeout(r, XHIGH_JOB_POLL_INTERVAL_MS));
  }
}
