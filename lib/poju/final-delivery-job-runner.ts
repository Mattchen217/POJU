import {
  extractActionsFromDelivery,
  resolveDeliveryMode,
} from "@/lib/llm/pro/final-delivery";
import { runDeliveryReport } from "@/lib/llm/pro/delivery/run-delivery-report";
import { enrichLlmDebugPhaseTransition } from "@/lib/llm/llm-debug";
import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import {
  completeXhighJob,
  failXhighJob,
  getXhighJob,
  setXhighJobContent,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";
import {
  isFinalDeliveryJobInput,
  type FinalDeliveryJobResult,
} from "@/lib/poju/xhigh-job-types";

/** Heartbeat while multi-task delivery runs (no stream chunks). */
const HEARTBEAT_MS = 15_000;

/**
 * Phase 4 delivery book runner — uses runDeliveryReport (not the segment2 stream runner).
 * Result is written to KV so the client can hydrate after leaving the page.
 */
export async function runFinalDeliveryJob(job_id: string): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job) {
    console.warn("[final-delivery-job] missing job", { job_id });
    return;
  }
  if (job.status === "completed" || job.status === "failed") {
    return;
  }
  if (!isFinalDeliveryJobInput(job.input)) {
    await failXhighJob(job_id, "invalid final_delivery job input", {
      retryable: false,
      failure_reason: "parse_failed",
    });
    return;
  }

  await updateXhighJobStatus(job_id, "running", {
    accumulated_content: "delivery_pipeline_started",
  });

  const heartbeat = setInterval(() => {
    void setXhighJobContent(job_id, `delivery_running:${Date.now()}`).catch(() => undefined);
  }, HEARTBEAT_MS);

  const t0 = Date.now();
  try {
    const input = job.input;
    const delivery_mode = resolveDeliveryMode({
      delivery_mode: input.delivery_mode,
      agent_v2: input.agent_v2,
    });
    const cacheId = pojuCacheSessionId(input.session_id);

    const report = await runDeliveryReport({
      breakthrough_core: input.breakthrough_core,
      covered_agenda: input.covered_agenda,
      agent_v2: input.agent_v2,
      locale: input.locale,
      delivery_mode,
      base_analysis: input.base_analysis ?? null,
      session_id: cacheId,
    });

    if (!report.ok) {
      await failXhighJob(job_id, `delivery_${report.stage}_failed:${report.reason}`, {
        retryable: true,
        failure_reason: "transport_error",
        accumulated_content: JSON.stringify(report.timings ?? {}),
      });
      return;
    }

    const actions = extractActionsFromDelivery(report.full_text, null);
    const latency_ms = Date.now() - t0;
    const llm_debug = enrichLlmDebugPhaseTransition(
      {
        phase: "final_delivery",
        requested_effort: "xhigh",
        max_tokens: 16_000,
        reasoning_budget: 0,
        model: report.model,
        prompt_tokens: 0,
        cached_tokens: 0,
        cache_ratio: 0,
        completion_tokens: 0,
        reasoning_tokens: 0,
        reasoning_used_ratio: 0,
        latency_ms,
        attempt: 1,
        retried: false,
        fell_back: false,
      },
      {
        phase_from: input.agent_v2.current_phase,
        phase_to: "delivered",
        call_type: "main_delivery",
      },
    );

    const result: FinalDeliveryJobResult = {
      kind: "final_delivery",
      full_text: report.full_text,
      actions: actions as unknown as Array<Record<string, unknown>>,
      model: report.model,
      tokens_used: report.tokens_used,
      llm_debug,
      timings: report.timings,
    };

    await completeXhighJob(job_id, {
      result,
      model: report.model,
      tokens_used: report.tokens_used,
      llm_debug,
      accumulated_content: `delivery_done:${report.full_text.length}`,
    });
    console.info("[final-delivery-job] completed", {
      job_id,
      chars: report.full_text.length,
      tokens_used: report.tokens_used,
      latency_ms,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[final-delivery-job] failed", { job_id, msg });
    await failXhighJob(job_id, msg, {
      retryable: true,
      failure_reason: "transport_error",
    });
  } finally {
    clearInterval(heartbeat);
  }
}
