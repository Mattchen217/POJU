import type { ModernActionFrame } from "@/lib/poju/agent-state";
import type { PojuXhighJob, PojuXhighJobFailureReason } from "@/lib/poju/xhigh-job-types";

export const SYNTHESIS_JOB_POLL_INTERVAL_MS = 3000;
/** Must exceed SYNTHESIS_TIMEOUT_MS (270s) so client doesn't abort a still-running job. */
export const SYNTHESIS_JOB_POLL_MAX_MS = 290_000;

export type SynthesisPollFailureReason =
  | PojuXhighJobFailureReason
  | "completed_without_paths"
  | "completed_without_result"
  | "poll_timeout"
  | "stale_running"
  | "job_abandoned";

export type SynthesisJobPollCallbacks = {
  onProgress?: (accumulated_chars: number, status: PojuXhighJob["status"]) => void;
};

export type SynthesisJobPollResult =
  | {
      ok: true;
      job_id: string;
      primary_path: ModernActionFrame;
      backup_path: ModernActionFrame;
      action_plan?: { primary?: string; backup?: string };
      model?: string;
      tokens_used?: number;
      llm_debug?: PojuXhighJob["llm_debug"];
    }
  | {
      ok: false;
      job_id: string;
      retryable: boolean;
      reason: SynthesisPollFailureReason;
      error: string;
    };

type SynthesisStatusPayload = {
  ok?: boolean;
  job_id?: string;
  status?: PojuXhighJob["status"] | "failed";
  accumulated_content?: string;
  primary_path?: ModernActionFrame;
  backup_path?: ModernActionFrame;
  action_plan?: { primary?: string; backup?: string };
  model?: string;
  tokens_used?: number;
  llm_debug?: PojuXhighJob["llm_debug"];
  retryable?: boolean;
  reason?: SynthesisPollFailureReason;
  error?: string;
};

export async function fetchSynthesisJobStatus(
  job_id: string,
  signal?: AbortSignal,
): Promise<SynthesisStatusPayload> {
  const res = await fetch(
    `/api/poju/synthesis/status?job_id=${encodeURIComponent(job_id)}`,
    signal ? { signal } : undefined,
  );
  if (!res.ok) {
    throw new Error(`synthesis status poll failed (${res.status})`);
  }
  return (await res.json()) as SynthesisStatusPayload;
}

export async function pollSynthesisJobUntilDone(input: {
  job_id: string;
  signal?: AbortSignal;
  callbacks?: SynthesisJobPollCallbacks;
}): Promise<SynthesisJobPollResult> {
  const startedAt = Date.now();
  console.info("[synthesis] polling", { job_id: input.job_id });

  while (true) {
    if (input.signal?.aborted) {
      throw new Error("AbortError");
    }
    if (Date.now() - startedAt > SYNTHESIS_JOB_POLL_MAX_MS) {
      console.warn("[synthesis] poll timeout", {
        job_id: input.job_id,
        elapsed_ms: Date.now() - startedAt,
      });
      return {
        ok: false,
        job_id: input.job_id,
        retryable: true,
        reason: "poll_timeout",
        error: "SYNTHESIS_JOB_POLL_TIMEOUT",
      };
    }

    const data = await fetchSynthesisJobStatus(input.job_id, input.signal);
    const status = data.status ?? "pending";
    const accumulated = String(data.accumulated_content ?? "");
    input.callbacks?.onProgress?.(accumulated.length, status);

    if (status === "completed") {
      if (data.primary_path && data.backup_path) {
        console.info("[synthesis] poll completed", {
          job_id: input.job_id,
          elapsed_ms: Date.now() - startedAt,
        });
        return {
          ok: true,
          job_id: input.job_id,
          primary_path: data.primary_path,
          backup_path: data.backup_path,
          action_plan: data.action_plan,
          model: data.model,
          tokens_used: data.tokens_used,
          llm_debug: data.llm_debug,
        };
      }
      console.warn("[synthesis] completed without primary/backup", {
        job_id: input.job_id,
        content_len: accumulated.length,
      });
      return {
        ok: false,
        job_id: input.job_id,
        retryable: true,
        reason: "completed_without_paths",
        error: "job completed without primary_path/backup_path",
      };
    }

    if (status === "failed" || data.ok === false) {
      return {
        ok: false as const,
        job_id: input.job_id,
        retryable: Boolean(data.retryable),
        reason: data.reason ?? "provider_busy",
        error: String(data.error || "synthesis job failed"),
      };
    }

    await new Promise((r) => setTimeout(r, SYNTHESIS_JOB_POLL_INTERVAL_MS));
  }
}
