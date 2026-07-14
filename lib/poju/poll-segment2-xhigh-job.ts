import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import type { PojuXhighJob, PojuXhighJobFailureReason } from "@/lib/poju/xhigh-job-types";

export const XHIGH_JOB_POLL_INTERVAL_MS = 3000;
/** Must exceed SEGMENT2_XHIGH_TIMEOUT_MS (270s) so client doesn't abort a still-running job. */
export const XHIGH_JOB_POLL_MAX_MS = 290_000;

export type Segment2PollFailureReason =
  | PojuXhighJobFailureReason
  | "completed_without_core"
  | "completed_without_result"
  | "poll_timeout"
  | "stale_running"
  | "job_abandoned";

export type XhighJobPollCallbacks = {
  onProgress?: (accumulated_chars: number, status: PojuXhighJob["status"]) => void;
};

export type Segment2JobPollResult =
  | {
      ok: true;
      job_id: string;
      breakthrough_core: NonNullable<PojuXhighJob["result"]>["breakthrough_core"];
      investigation_agenda: AgendaItem[];
      model?: string;
      tokens_used?: number;
      llm_debug?: PojuXhighJob["llm_debug"];
    }
  | {
      ok: false;
      job_id: string;
      retryable: boolean;
      reason: Segment2PollFailureReason;
      error: string;
    };

type StatusPayload = {
  ok?: boolean;
  job_id?: string;
  status?: PojuXhighJob["status"] | "failed";
  accumulated_content?: string;
  breakthrough_core?: Segment2JobPollResult extends { ok: true; breakthrough_core: infer B } ? B : never;
  investigation_agenda?: AgendaItem[] | null;
  model?: string;
  tokens_used?: number;
  llm_debug?: PojuXhighJob["llm_debug"];
  retryable?: boolean;
  reason?: Segment2PollFailureReason;
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
  console.info("[segment2] polling", { job_id: input.job_id });

  while (true) {
    if (input.signal?.aborted) {
      throw new Error("AbortError");
    }
    if (Date.now() - startedAt > XHIGH_JOB_POLL_MAX_MS) {
      console.warn("[segment2] poll timeout", {
        job_id: input.job_id,
        elapsed_ms: Date.now() - startedAt,
      });
      return {
        ok: false,
        job_id: input.job_id,
        retryable: true,
        reason: "poll_timeout",
        error: "SEGMENT2_JOB_POLL_TIMEOUT",
      };
    }

    const data = await fetchBreakthroughCoreJobStatus(input.job_id);
    const status = data.status ?? "pending";
    const accumulated = String(data.accumulated_content ?? "");
    input.callbacks?.onProgress?.(accumulated.length, status);

    // Fix 1 — `completed` is terminal. Never keep polling after completed.
    if (status === "completed") {
      if (data.breakthrough_core) {
        const agenda = Array.isArray(data.investigation_agenda)
          ? data.investigation_agenda
          : [];
        console.info("[segment2] poll completed", {
          job_id: input.job_id,
          has_core: true,
          agenda_len: agenda.length,
          elapsed_ms: Date.now() - startedAt,
        });
        return {
          ok: true,
          job_id: input.job_id,
          breakthrough_core: data.breakthrough_core,
          investigation_agenda: agenda,
          model: data.model,
          tokens_used: data.tokens_used,
          llm_debug: data.llm_debug,
        };
      }
      console.warn("[segment2] completed without core", { job_id: input.job_id });
      return {
        ok: false,
        job_id: input.job_id,
        retryable: true,
        reason: "completed_without_core",
        error: "job completed without breakthrough_core",
      };
    }

    if (status === "failed" || data.ok === false) {
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
