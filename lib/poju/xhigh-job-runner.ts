import { baseAnalysisCacheSessionId, pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import {
  buildBreakthroughCorePrompt,
  parseAndMapBreakthroughCore,
} from "@/lib/llm/deepseek/breakthrough-core";
import { buildLlmDebug } from "@/lib/llm/llm-debug";
import {
  getOpenRouterDefaultModel,
  isOpenRouterConfigured,
  openRouterProviderExtras,
  type OpenRouterChatMessage,
} from "@/lib/llm/openrouter-shared";
import { openRouterChatCompletionStream } from "@/lib/llm/openrouter-stream";
import { OpenRouterProviderQueueError } from "@/lib/llm/openrouter-retry";
import {
  appendXhighJobChunk,
  completeXhighJob,
  failXhighJob,
  getXhighJob,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob, PojuXhighJobPhase } from "@/lib/poju/xhigh-job-types";

/** Segment-2 xhigh — reasoning ~7–11k + full analysis content ~8–12k + headroom. */
export const SEGMENT2_XHIGH_MAX_TOKENS = 32_000;
/** Wall budget for xhigh (~168s observed); job runner uses full Vercel maxDuration. */
export const SEGMENT2_XHIGH_TIMEOUT_MS = 240_000;

export type XhighJobRunnerConfig = {
  phase: PojuXhighJobPhase;
  phase_name: string;
  call_type: string;
  reasoning_effort: "xhigh" | "high";
  max_tokens: number;
  timeout_ms: number;
  max_attempts: number;
  buildMessages: (job: PojuXhighJob) => {
    system: string;
    user: string;
    sessionCacheId: string;
  };
  finalizeContent: (content: string, job: PojuXhighJob) => {
    result: PojuXhighJob["result"];
  };
};

function isProviderTransportFailure(e: unknown): boolean {
  if (e instanceof OpenRouterProviderQueueError) return true;
  if (e instanceof Error) {
    return (
      e.message === "openrouter_provider_queue" ||
      e.message === "llm_timeout" ||
      e.message === "openrouter_empty_response" ||
      e.message === "openrouter_empty_after_resend"
    );
  }
  return false;
}

export const SEGMENT2_XHIGH_RUNNER_CONFIG: XhighJobRunnerConfig = {
  phase: "segment2_breakthrough_core",
  phase_name: "segment2_breakthrough_core",
  call_type: "deep_analysis",
  reasoning_effort: "xhigh",
  max_tokens: SEGMENT2_XHIGH_MAX_TOKENS,
  timeout_ms: SEGMENT2_XHIGH_TIMEOUT_MS,
  max_attempts: 1,
  buildMessages(job) {
    const { input } = job;
    const profileId = input.profile_id;
    const { system, user } = buildBreakthroughCorePrompt({
      base_analysis: input.base_analysis,
      agent_v2: input.agent_v2 ?? undefined,
      original_question: input.original_question,
      locale: input.locale,
    });
    const sessionCacheId = profileId
      ? baseAnalysisCacheSessionId(profileId)
      : pojuCacheSessionId(input.session_id);
    return { system, user, sessionCacheId };
  },
  finalizeContent(content) {
    const mapped = parseAndMapBreakthroughCore(content);
    return {
      result: {
        breakthrough_core: mapped.breakthrough_core,
        investigation_agenda: mapped.investigation_agenda,
      },
    };
  },
};

/**
 * Run an xhigh job in the background (scheduled via Next.js `after()`).
 * Streams LLM output into KV; parses + completes or fails the job.
 */
export async function runXhighJob(job_id: string, config: XhighJobRunnerConfig): Promise<void> {
  if (!isOpenRouterConfigured()) {
    await failXhighJob(job_id, "missing_openrouter_api_key");
    return;
  }

  const job = await getXhighJob(job_id);
  if (!job) {
    console.warn("[xhigh-job] run skipped — job not found:", job_id);
    return;
  }
  if (job.status === "completed") return;
  if (job.status === "running" && Date.now() - job.updated_at < 15_000) {
    console.info("[xhigh-job] run skipped — already running:", job_id);
    return;
  }
  if (job.phase !== config.phase) {
    await failXhighJob(job_id, "job_phase_mismatch");
    return;
  }

  await updateXhighJobStatus(job_id, "running", { accumulated_content: "" });

  const { system, user, sessionCacheId } = config.buildMessages(job);
  const messages: OpenRouterChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const defaultModel = getOpenRouterDefaultModel();
  const startTime = Date.now();
  let lastPersistedLen = 0;

  let out: Awaited<ReturnType<typeof openRouterChatCompletionStream>>;
  try {
    out = await openRouterChatCompletionStream(
      {
        messages,
        max_tokens: config.max_tokens,
        json_mode: true,
        reasoning_effort: config.reasoning_effort,
        timeout_ms: config.timeout_ms,
        max_attempts: config.max_attempts,
        session_id: sessionCacheId,
        call_type: config.call_type,
        phase_name: config.phase_name,
        route_path: "once",
        provider: openRouterProviderExtras(),
      },
      {
        onContent: (full) => {
          const delta = full.slice(lastPersistedLen);
          if (!delta) return;
          lastPersistedLen = full.length;
          void appendXhighJobChunk(job_id, delta);
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[xhigh-job] ${config.phase} transport failed:`, msg);
    if (isProviderTransportFailure(e)) {
      await failXhighJob(job_id, msg, {
        retryable: true,
        failure_reason: "provider_busy",
      });
      return;
    }
    await failXhighJob(job_id, msg, { retryable: false });
    return;
  }

  const latency_ms = Date.now() - startTime;
  const content = out.text.trim();
  const finish = out.finish_reason ?? null;

  if (finish === "length" || !content) {
    console.warn(`[xhigh-job] ${config.phase} truncated/empty (max_tokens=${config.max_tokens})`);
    await failXhighJob(job_id, "deep analysis output was truncated", {
      retryable: true,
      failure_reason: "truncated",
      accumulated_content: content,
    });
    return;
  }

  let parsed: PojuXhighJob["result"];
  try {
    parsed = config.finalizeContent(content, job).result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[xhigh-job] ${config.phase} parse failed:`, msg);
    await failXhighJob(job_id, "deep analysis JSON was incomplete", {
      retryable: true,
      failure_reason: "parse_failed",
      accumulated_content: content,
      error_detail: msg,
    });
    return;
  }

  if (!parsed) {
    await failXhighJob(job_id, "deep analysis JSON was incomplete", {
      retryable: true,
      failure_reason: "parse_failed",
      accumulated_content: content,
    });
    return;
  }

  const transport = out.transport;
  const llm_debug = buildLlmDebug({
    phase: config.phase_name,
    requested_effort: config.reasoning_effort,
    max_tokens: config.max_tokens,
    model: out.model || defaultModel,
    served_provider: out.provider,
    finish_reason: out.finish_reason,
    prompt_tokens: out.prompt_tokens,
    cached_tokens: out.cached_tokens,
    completion_tokens: out.completion_tokens,
    reasoning_tokens: out.reasoning_tokens,
    latency_ms,
    generation_time_ms: out.generation_time_ms,
    generation_id: out.generation_id,
    attempt: transport?.attempt ?? 1,
    retried: transport?.retried ?? false,
    fell_back: transport?.fell_back ?? false,
  });

  await completeXhighJob(job_id, {
    accumulated_content: content,
    result: parsed,
    llm_debug,
    model: out.model || defaultModel,
    tokens_used: out.tokens_used,
  });

  console.info(`[xhigh-job] ${config.phase} completed`, {
    job_id,
    latency_ms,
    reasoning_tokens: out.reasoning_tokens,
    finish_reason: finish,
  });
}

export async function runSegment2BreakthroughCoreJob(job_id: string): Promise<void> {
  return runXhighJob(job_id, SEGMENT2_XHIGH_RUNNER_CONFIG);
}
