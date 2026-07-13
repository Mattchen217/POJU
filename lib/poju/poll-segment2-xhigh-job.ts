import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";

export const XHIGH_JOB_POLL_INTERVAL_MS = 3000;
/** Slightly above server maxDuration (300s) + slack. */
export const XHIGH_JOB_POLL_MAX_MS = 320_000;

export type XhighJobPollCallbacks = {
  onProgress?: (accumulated_chars: number, status: PojuXhighJob["status"]) => void;
};

export type Segment2JobPollResult =
  | {
      ok: true;
      job_id: string;
      breakthrough_core: NonNullable<PojuXhighJob["result"]>["breakthrough_core"];
      investigation_agenda: NonNullable<PojuXhighJob["result"]>["investigation_agenda"];
      model?: string;
      tokens_used?: number;
      llm_debug?: PojuXhighJob["llm_debug"];
    }
  | {
      ok: false;
      job_id: string;
      retryable: boolean;
      reason: NonNullable<PojuXhighJob["failure_reason"]>;
      error: string;
    };

type StatusPayload = {
  ok?: boolean;
  job_id?: string;
  status?: PojuXhighJob["status"];
  accumulated_content?: string;
  breakthrough_core?: Segment2JobPollResult extends { ok: true; breakthrough_core: infer B } ? B : never;
  investigation_agenda?: unknown;
  model?: string;
  tokens_used?: number;
  llm_debug?: PojuXhighJob["llm_debug"];
  retryable?: boolean;
  reason?: PojuXhighJob["failure_reason"];
  error?: string;
};

export async function fetchBreakthroughCoreJobStatus(job_id: string): Promise<StatusPayload> {
  const res = await fetch(
    `/api/poju/breakthrough-core/status?job_id=${encodeURIComponent(job_id)}`,
  );
  if (!res.ok) {
    throw new Error(`breakthrough-core status poll failed (${res.status})`);
  }
  return (await res.json()) as StatusPayload;
}

export async function pollBreakthroughCoreJobUntilDone(input: {
  job_id: string;
  signal?: AbortSignal;
  callbacks?: XhighJobPollCallbacks;
}): Promise<Segment2JobPollResult> {
  const startedAt = Date.now();

  while (true) {
    if (input.signal?.aborted) {
      throw new Error("AbortError");
    }
    if (Date.now() - startedAt > XHIGH_JOB_POLL_MAX_MS) {
      throw new Error("SEGMENT2_JOB_POLL_TIMEOUT");
    }

    const data = await fetchBreakthroughCoreJobStatus(input.job_id);
    const status = data.status ?? "pending";
    const accumulated = String(data.accumulated_content ?? "");
    input.callbacks?.onProgress?.(accumulated.length, status);

    if (status === "completed" && data.breakthrough_core && data.investigation_agenda) {
      return {
        ok: true,
        job_id: input.job_id,
        breakthrough_core: data.breakthrough_core,
        investigation_agenda: data.investigation_agenda as NonNullable<
          PojuXhighJob["result"]
        >["investigation_agenda"],
        model: data.model,
        tokens_used: data.tokens_used,
        llm_debug: data.llm_debug,
      };
    }

    if (status === "failed") {
      return {
        ok: false as const,
        job_id: input.job_id,
        retryable: Boolean(data.retryable),
        reason: data.reason ?? "provider_busy",
        error: String(data.error || "segment2 job failed"),
      };
    }

    await new Promise((r) => setTimeout(r, XHIGH_JOB_POLL_INTERVAL_MS));
  }
}
