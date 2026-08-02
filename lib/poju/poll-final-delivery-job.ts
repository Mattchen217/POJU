import type { LLMCallDebug } from "@/lib/llm/llm-debug";
import type { PojuXhighJob, PojuXhighJobFailureReason } from "@/lib/poju/xhigh-job-types";
import { XHIGH_JOB_POLL_INTERVAL_MS } from "@/lib/poju/poll-segment2-xhigh-job";

/** Wall clock across stage/task relays (matches status MAX_JOB_AGE headroom). */
const FINAL_DELIVERY_POLL_MAX_MS = 5_400_000;

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

export type StreamedDeliverySegment = {
  key: string;
  heading: string;
  body: string;
  evidence: string;
  evidence_ready: boolean;
};

type StatusPayload = {
  ok?: boolean;
  job_id?: string;
  status?: PojuXhighJob["status"];
  current_stage?: string;
  progress_label?: string;
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
  error_detail?: string | null;
  streamed_segments?: StreamedDeliverySegment[];
};

/** Build progressive markdown from streamed_segments (overwritten by full_text on complete). */
export function buildStreamedDeliveryMarkdown(
  segments: StreamedDeliverySegment[],
  locale: string,
): string {
  if (!segments.length) return "";
  const zh = locale.startsWith("zh");
  const lead = zh ? "**依据与推理:**" : "**Evidence & reasoning:**";
  const parts: string[] = [];
  for (const s of segments) {
    parts.push(`## ${s.heading}`);
    if (s.body.trim()) parts.push(s.body.trim());
    if (s.evidence_ready && s.evidence.trim()) {
      parts.push(`${lead}\n${s.evidence.trim()}`);
    }
  }
  return parts.join("\n\n") + "\n";
}

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
  onProgress?: (
    status: PojuXhighJob["status"],
    hint: string,
    streamed?: { segments: StreamedDeliverySegment[]; markdown: string },
  ) => void;
  /** Locale for streamed markdown assembly (default zh). */
  locale?: string;
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
    const hint =
      (typeof data.progress_label === "string" && data.progress_label.trim()) ||
      (typeof data.current_stage === "string" && data.current_stage.trim()) ||
      String(data.accumulated_content ?? "");
    const segs = Array.isArray(data.streamed_segments) ? data.streamed_segments : [];
    const streamedMd = buildStreamedDeliveryMarkdown(segs, input.locale ?? "zh");
    input.onProgress?.(
      status,
      hint,
      segs.length
        ? { segments: segs, markdown: streamedMd }
        : undefined,
    );

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
      const detail =
        typeof data.error_detail === "string" && data.error_detail.trim()
          ? data.error_detail.trim()
          : "";
      const base = (typeof data.error === "string" && data.error.trim()) || "final delivery failed";
      const stageHint =
        typeof data.current_stage === "string" && data.current_stage.trim()
          ? ` [stage=${data.current_stage}]`
          : "";
      console.error("[final-delivery] job failed", {
        job_id: input.job_id,
        stage: data.current_stage,
        error: base,
        error_detail: detail || null,
        accumulated_content: data.accumulated_content ?? null,
      });
      return {
        ok: false,
        job_id: input.job_id,
        retryable: data.retryable ?? true,
        reason: data.reason ?? "transport_error",
        error: detail ? `${base}${stageHint} | ${detail}` : `${base}${stageHint}`,
      };
    }

    await new Promise((r) => setTimeout(r, XHIGH_JOB_POLL_INTERVAL_MS));
  }
}
