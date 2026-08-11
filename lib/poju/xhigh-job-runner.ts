import { baseAnalysisCacheSessionId, pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import {
  AgendaAnchorError,
  AgendaBridgeParseError,
  buildAgendaBridgePrompt,
  buildBreakthroughCorePrompt,
  parseSanitizeAgendaBridge,
  parseSanitizeBreakthroughCore,
} from "@/lib/llm/deepseek/breakthrough-core";
import {
  buildBreakthroughCoreDimsPrompt,
  buildBreakthroughCoreSpinePrompt,
  buildBreakthroughCoreVoicePrompt,
  fallbackVoiceFromDims,
  finalizeMergedCallA,
  mergeSegment2APartials,
  parseDimsPartial,
  parseSpinePartial,
  parseVoiceResponse,
} from "@/lib/llm/deepseek/segment2-a-parallel";
import {
  buildSynthesisPrompt,
  parseSynthesisResponse,
  SynthesisParseError,
} from "@/lib/llm/deepseek/synthesis-task";
import { attachMetaphysicsPackToBreakthroughCore } from "@/lib/poju/attach-metaphysics-pack";
import { buildLlmDebug } from "@/lib/llm/llm-debug";
import {
  getOpenRouterDefaultModel,
  isOpenRouterConfigured,
  openRouterProviderExtras,
  type OpenRouterChatMessage,
} from "@/lib/llm/openrouter-shared";
import { openRouterChatCompletionStream } from "@/lib/llm/openrouter-stream";
import {
  isLlmTimeoutError,
  isProviderQueueClassError,
  parseOpenRouterErrorStatus,
} from "@/lib/llm/openrouter-retry";
import {
  appendXhighJobChunk,
  completeXhighJob,
  failXhighJob,
  getXhighJob,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob, PojuXhighJobFailureReason, PojuXhighJobPhase } from "@/lib/poju/xhigh-job-types";
import {
  isSegment2AgendaInput,
  isSegment2ReportInput,
  isSynthesisInput,
} from "@/lib/poju/xhigh-job-types";

/**
 * Segment-2 Call A (xhigh) — report only.
 */
export const SEGMENT2_XHIGH_MAX_TOKENS = 26_000;
/**
 * Call A stream timeout (legacy single-shot path / config). Parallel A uses SEGMENT2_A_* below.
 * maxDuration 300s → leave ~30s to write terminal.
 */
export const SEGMENT2_XHIGH_TIMEOUT_MS = 270_000;

/**
 * Parallel Call A: dims ∥ spine (both xhigh) then voice (high).
 * Wall ≈ max(dims,spine) + voice; must fit under INVOCATION_HARD_DEADLINE − headroom.
 */
export const SEGMENT2_A_PARALLEL_LEG_TIMEOUT_MS = 200_000;
export const SEGMENT2_A_PARALLEL_LEG_MAX_TOKENS = 20_000;
export const SEGMENT2_A_VOICE_TIMEOUT_MS = 70_000;
export const SEGMENT2_A_VOICE_MAX_TOKENS = 4_000;
export const SEGMENT2_A_VOICE_MIN_WALL_MS = 25_000;

/** Call B (high) — reasoning + JSON; leave room under Vercel maxDuration. */
export const SEGMENT2_AGENDA_MAX_TOKENS = 8_000;
export const SEGMENT2_AGENDA_TIMEOUT_MS = 150_000;

/**
 * Wall budget for *retrying* after fast transport failures only (429/503/no-endpoints).
 * Does NOT cap a single successful/long xhigh stream. Must stay well below maxDuration.
 */
export const JOB_RETRY_BUDGET_MS = 90_000;

/** Leave spare before Vercel kill so we can always write terminal status. */
export const INVOCATION_WRITE_HEADROOM_MS = 30_000;
/** Align with Vercel maxDuration so attemptTimeout can reach SEGMENT2_XHIGH_TIMEOUT_MS. */
export const INVOCATION_HARD_DEADLINE_MS = 300_000;

/** Backoff between outer retries (total sleep ≤ 35s under the 90s budget). */
export const CORE_RETRY_DELAYS_MS = [5_000, 10_000, 20_000] as const;

/** Heartbeat while a stream attempt is in-flight (silence during reasoning). */
export const XHIGH_JOB_HEARTBEAT_MS = 30_000;

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

/** Fast provider capacity errors — safe to outer-retry within JOB_RETRY_BUDGET_MS. */
export function isFastTransientProviderFailure(e: unknown): boolean {
  return isProviderQueueClassError(e);
}

/** @deprecated Prefer isFastTransientProviderFailure — kept for older smokes. */
export function isProviderTransportFailure(e: unknown): boolean {
  return isFastTransientProviderFailure(e);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Surface real provider HTTP status / body (not just "provider_queue"). */
export function describeTransportError(e: unknown): {
  msg: string;
  http_status: number | null;
  provider: string | null;
  body_snippet: string;
} {
  const msg = e instanceof Error ? e.message : String(e);
  const anyE = e as { status?: number; provider?: string; body?: unknown };
  const cause = e instanceof Error ? e.cause : undefined;
  const causeMsg = cause instanceof Error ? cause.message : cause != null ? String(cause) : "";
  const http_status =
    (typeof anyE.status === "number" ? anyE.status : null) ??
    parseOpenRouterErrorStatus(msg) ??
    (causeMsg ? parseOpenRouterErrorStatus(causeMsg) : null);
  const provider = typeof anyE.provider === "string" ? anyE.provider : null;
  const body_snippet = String(anyE.body ?? (causeMsg || msg)).slice(0, 300);
  return { msg, http_status, provider, body_snippet };
}

function resolveTransportFailureReason(e: unknown): {
  failure_reason: PojuXhighJobFailureReason;
  retryable: boolean;
} {
  if (isLlmTimeoutError(e)) {
    return { failure_reason: "llm_timeout", retryable: true };
  }
  if (isFastTransientProviderFailure(e)) {
    return { failure_reason: "provider_busy", retryable: true };
  }
  return { failure_reason: "transport_error", retryable: false };
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
    if (!isSegment2ReportInput(job.input)) {
      throw new Error("segment2_report_input_expected");
    }
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
  finalizeContent(content, job) {
    const mapped = parseSanitizeBreakthroughCore(content, job.locale || "zh");
    const base_analysis = isSegment2ReportInput(job.input) ? job.input.base_analysis : null;
    const breakthrough_core = attachMetaphysicsPackToBreakthroughCore(
      mapped.breakthrough_core,
      base_analysis,
    );
    if (breakthrough_core.metaphysics_pack) {
      console.info("[segment2] metaphysics_pack attached", {
        yong: breakthrough_core.metaphysics_pack.yong_shen.primary_yong_shen,
        preferred: breakthrough_core.metaphysics_pack.directions.preferred,
        scores_source: breakthrough_core.metaphysics_pack.element_scores_source,
      });
    }
    return {
      result: {
        breakthrough_core,
        investigation_agenda: [],
      },
    };
  },
};

/** Call B — high effort, short timeout; input = A JSON. */
export const SEGMENT2_AGENDA_RUNNER_CONFIG: XhighJobRunnerConfig = {
  phase: "segment2_agenda_bridge",
  phase_name: "segment2_agenda_bridge",
  call_type: "agenda_bridge",
  reasoning_effort: "high",
  max_tokens: SEGMENT2_AGENDA_MAX_TOKENS,
  timeout_ms: SEGMENT2_AGENDA_TIMEOUT_MS,
  max_attempts: 1,
  buildMessages(job) {
    if (!isSegment2AgendaInput(job.input)) {
      throw new Error("segment2_agenda_input_expected");
    }
    const { system, user } = buildAgendaBridgePrompt({
      breakthrough_core: job.input.breakthrough_core,
      original_question: job.input.original_question,
      locale: job.input.locale,
    });
    return {
      system,
      user,
      sessionCacheId: pojuCacheSessionId(job.input.session_id),
    };
  },
  finalizeContent(content, job) {
    if (!isSegment2AgendaInput(job.input)) {
      throw new Error("segment2_agenda_input_expected");
    }
    try {
      const mapped = parseSanitizeAgendaBridge(
        content,
        job.locale || job.input.locale || "zh",
        job.input.breakthrough_core,
      );
      return {
        result: {
          breakthrough_core: {
            ...job.input.breakthrough_core,
            first_question: mapped.first_question,
          },
          investigation_agenda: mapped.investigation_agenda,
          first_question: mapped.first_question,
          options: mapped.options,
        },
      };
    } catch (e) {
      if (e instanceof AgendaAnchorError) {
        const err = new Error(e.message);
        (err as Error & { failure_reason?: string }).failure_reason = "agenda_anchor_failed";
        throw err;
      }
      if (e instanceof AgendaBridgeParseError) {
        throw e;
      }
      throw e;
    }
  },
};

/** Synthesis (xhigh) — converge multi_dim + covered_agenda → primary/backup. */
export const SYNTHESIS_MAX_TOKENS = 12_000;
export const SYNTHESIS_TIMEOUT_MS = 270_000;

export const SYNTHESIS_RUNNER_CONFIG: XhighJobRunnerConfig = {
  phase: "synthesis",
  phase_name: "synthesis",
  call_type: "deep_analysis",
  reasoning_effort: "xhigh",
  max_tokens: SYNTHESIS_MAX_TOKENS,
  timeout_ms: SYNTHESIS_TIMEOUT_MS,
  max_attempts: 1,
  buildMessages(job) {
    if (!isSynthesisInput(job.input)) {
      throw new Error("synthesis_input_expected");
    }
    const { system, user } = buildSynthesisPrompt({
      job_input: job.input,
      locale: job.locale || "zh",
    });
    return {
      system,
      user,
      sessionCacheId: pojuCacheSessionId(job.session_id),
    };
  },
  finalizeContent(content) {
    try {
      const parsed = parseSynthesisResponse(content);
      return {
        result: {
          kind: "synthesis" as const,
          primary_path: parsed.primary_path,
          backup_path: parsed.backup_path,
          action_plan: parsed.action_plan,
        },
      };
    } catch (e) {
      if (e instanceof SynthesisParseError) {
        const err = new Error(e.message);
        (err as Error & { failure_reason?: string }).failure_reason = "parse_failed";
        throw err;
      }
      throw e;
    }
  },
};

/**
 * Call A — parallel A-dims ∥ A-spine (xhigh) → merge → A-voice (high).
 * Still one KV job / one UI poll id (segment2_breakthrough_core).
 */
export async function runSegment2BreakthroughCoreJob(job_id: string): Promise<void> {
  if (!isOpenRouterConfigured()) {
    await failXhighJob(job_id, "missing_openrouter_api_key");
    return;
  }

  const job = await getXhighJob(job_id);
  if (!job) {
    console.warn("[xhigh-job] run skipped — job not found:", { job_id });
    return;
  }
  if (job.status === "completed") return;
  if (job.status === "running" && Date.now() - job.updated_at < 15_000) {
    console.info("[xhigh-job] run skipped — already running:", { job_id });
    return;
  }
  if (job.phase !== "segment2_breakthrough_core") {
    await failXhighJob(job_id, "job_phase_mismatch");
    return;
  }
  if (!isSegment2ReportInput(job.input)) {
    await failXhighJob(job_id, "segment2_report_input_expected");
    return;
  }

  await updateXhighJobStatus(job_id, "running", { accumulated_content: "" });

  const invocationStartedAt = Date.now();
  const defaultModel = getOpenRouterDefaultModel();
  const locale = job.locale || job.input.locale || "zh";
  const profileId = job.input.profile_id;
  const sessionCacheId = profileId
    ? baseAnalysisCacheSessionId(profileId)
    : pojuCacheSessionId(job.input.session_id);

  const dimsPrompt = buildBreakthroughCoreDimsPrompt({
    base_analysis: job.input.base_analysis,
    agent_v2: job.input.agent_v2 ?? undefined,
    original_question: job.input.original_question,
    locale,
  });
  const spinePrompt = buildBreakthroughCoreSpinePrompt({
    base_analysis: job.input.base_analysis,
    agent_v2: job.input.agent_v2 ?? undefined,
    original_question: job.input.original_question,
    locale,
  });

  let dimsBuf = "";
  let spineBuf = "";
  let voiceBuf = "";

  const persistProgress = () => {
    const blob = [
      "===dims===\n",
      dimsBuf,
      "\n===spine===\n",
      spineBuf,
      voiceBuf ? `\n===voice===\n${voiceBuf}` : "",
    ].join("");
    void updateXhighJobStatus(job_id, "running", { accumulated_content: blob });
  };

  const heartbeat = setInterval(() => {
    void updateXhighJobStatus(job_id, "running", {});
  }, XHIGH_JOB_HEARTBEAT_MS);

  const wallForLegs = () =>
    Math.min(
      SEGMENT2_A_PARALLEL_LEG_TIMEOUT_MS,
      INVOCATION_HARD_DEADLINE_MS - (Date.now() - invocationStartedAt) - INVOCATION_WRITE_HEADROOM_MS,
    );

  try {
    const legTimeout = wallForLegs();
    if (legTimeout < 20_000) {
      throw new Error("invocation_deadline_exhausted");
    }

    console.info("[xhigh-job] segment2 parallel A start", {
      job_id,
      leg_timeout_ms: legTimeout,
    });

    const streamLeg = async (
      label: "dims" | "spine",
      system: string,
      user: string,
      onChunk: (full: string) => void,
    ) => {
      return openRouterChatCompletionStream(
        {
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: SEGMENT2_A_PARALLEL_LEG_MAX_TOKENS,
          json_mode: true,
          reasoning_effort: "xhigh",
          timeout_ms: legTimeout,
          max_attempts: 1,
          session_id: sessionCacheId,
          call_type: `deep_analysis_${label}`,
          phase_name: `segment2_a_${label}`,
          route_path: "once",
          provider: openRouterProviderExtras(),
        },
        { onContent: onChunk },
      );
    };

    const [dimsOut, spineOut] = await Promise.all([
      streamLeg("dims", dimsPrompt.system, dimsPrompt.user, (full) => {
        dimsBuf = full;
        persistProgress();
      }),
      streamLeg("spine", spinePrompt.system, spinePrompt.user, (full) => {
        spineBuf = full;
        persistProgress();
      }),
    ]);

    console.info("[xhigh-job] segment2 parallel legs done", {
      job_id,
      elapsed_ms: Date.now() - invocationStartedAt,
      dims_len: dimsOut.text.length,
      spine_len: spineOut.text.length,
      dims_finish: dimsOut.finish_reason,
      spine_finish: spineOut.finish_reason,
      dims_tokens: dimsOut.completion_tokens,
      spine_tokens: spineOut.completion_tokens,
    });

    const dimsText = (dimsOut.text || dimsBuf).trim();
    const spineText = (spineOut.text || spineBuf).trim();
    if (!dimsText || !spineText) {
      throw new Error("parallel_leg_empty");
    }
    if (dimsOut.finish_reason === "length" || spineOut.finish_reason === "length") {
      console.warn("[xhigh-job] segment2 parallel leg finish_reason=length — attempting parse anyway", {
        job_id,
        dims_finish: dimsOut.finish_reason,
        spine_finish: spineOut.finish_reason,
      });
    }

    const dims = parseDimsPartial(dimsText);
    const spine = parseSpinePartial(spineText);
    let merged = mergeSegment2APartials({ dims, spine, response: "" });

    const wallLeft =
      INVOCATION_HARD_DEADLINE_MS - (Date.now() - invocationStartedAt) - INVOCATION_WRITE_HEADROOM_MS;
    let voiceResponse = "";
    let voiceFinish: string | null = null;
    let voiceTokens = 0;

    if (wallLeft >= SEGMENT2_A_VOICE_MIN_WALL_MS) {
      const voiceTimeout = Math.min(SEGMENT2_A_VOICE_TIMEOUT_MS, wallLeft);
      const voicePrompt = buildBreakthroughCoreVoicePrompt({
        merged_core: merged,
        original_question: job.input.original_question,
        locale,
      });
      try {
        const voiceOut = await openRouterChatCompletionStream(
          {
            messages: [
              { role: "system", content: voicePrompt.system },
              { role: "user", content: voicePrompt.user },
            ],
            max_tokens: SEGMENT2_A_VOICE_MAX_TOKENS,
            json_mode: true,
            reasoning_effort: "high",
            timeout_ms: voiceTimeout,
            max_attempts: 1,
            session_id: sessionCacheId,
            call_type: "deep_analysis_voice",
            phase_name: "segment2_a_voice",
            route_path: "once",
            provider: openRouterProviderExtras(),
          },
          {
            onContent: (full) => {
              voiceBuf = full;
              persistProgress();
            },
          },
        );
        voiceFinish = voiceOut.finish_reason ?? null;
        voiceTokens = voiceOut.completion_tokens ?? 0;
        voiceResponse = parseVoiceResponse((voiceOut.text || voiceBuf).trim());
      } catch (voiceErr) {
        console.warn("[xhigh-job] segment2 voice failed — fallback from dims", {
          job_id,
          msg: voiceErr instanceof Error ? voiceErr.message : String(voiceErr),
          wall_left_ms: wallLeft,
        });
        voiceResponse = fallbackVoiceFromDims(dims, spine.situation_conclusion, locale);
      }
    } else {
      console.warn("[xhigh-job] segment2 skip voice — wall too tight", {
        job_id,
        wall_left_ms: wallLeft,
      });
      voiceResponse = fallbackVoiceFromDims(dims, spine.situation_conclusion, locale);
    }

    merged = mergeSegment2APartials({ dims, spine, response: voiceResponse });
    const sanitized = finalizeMergedCallA(merged, locale);
    const breakthrough_core = attachMetaphysicsPackToBreakthroughCore(
      sanitized.breakthrough_core,
      job.input.base_analysis,
    );

    const latency_ms = Date.now() - invocationStartedAt;
    const tokens_used =
      (dimsOut.completion_tokens ?? 0) +
      (spineOut.completion_tokens ?? 0) +
      voiceTokens +
      (dimsOut.prompt_tokens ?? 0) +
      (spineOut.prompt_tokens ?? 0);

    console.info("[xhigh-job] segment2 parallel A complete", {
      job_id,
      elapsed_ms: latency_ms,
      dims_count: dims.length,
      voice_finish: voiceFinish,
      tokens_used,
    });

    await completeXhighJob(job_id, {
      accumulated_content: [
        "===dims===\n",
        dimsText,
        "\n===spine===\n",
        spineText,
        "\n===voice===\n",
        voiceResponse,
      ].join(""),
      result: {
        breakthrough_core,
        investigation_agenda: [],
      },
      model: dimsOut.model || spineOut.model || defaultModel,
      tokens_used,
      llm_debug: buildLlmDebug({
        phase: "segment2_breakthrough_core",
        requested_effort: "xhigh",
        max_tokens: SEGMENT2_A_PARALLEL_LEG_MAX_TOKENS,
        model: dimsOut.model || defaultModel,
        latency_ms,
        finish_reason: `parallel:${dimsOut.finish_reason ?? "?"}+${spineOut.finish_reason ?? "?"}+${voiceFinish ?? "fallback"}`,
        prompt_tokens: (dimsOut.prompt_tokens ?? 0) + (spineOut.prompt_tokens ?? 0),
        completion_tokens:
          (dimsOut.completion_tokens ?? 0) + (spineOut.completion_tokens ?? 0) + voiceTokens,
      }),
    });
  } catch (e) {
    const detail = describeTransportError(e);
    const resolved = resolveTransportFailureReason(e);
    // Try salvage: parse whatever landed in buffers.
    try {
      if (dimsBuf.trim().length > 40 && spineBuf.trim().length > 40) {
        const dims = parseDimsPartial(dimsBuf);
        const spine = parseSpinePartial(spineBuf);
        const response =
          voiceBuf.trim().length > 10
            ? (() => {
                try {
                  return parseVoiceResponse(voiceBuf);
                } catch {
                  return fallbackVoiceFromDims(dims, spine.situation_conclusion, locale);
                }
              })()
            : fallbackVoiceFromDims(dims, spine.situation_conclusion, locale);
        const merged = mergeSegment2APartials({ dims, spine, response });
        const sanitized = finalizeMergedCallA(merged, locale);
        const breakthrough_core = attachMetaphysicsPackToBreakthroughCore(
          sanitized.breakthrough_core,
          job.input.base_analysis,
        );
        console.warn("[xhigh-job] segment2 parallel salvaged after error", {
          job_id,
          msg: detail.msg,
          failure_reason: resolved.failure_reason,
        });
        await completeXhighJob(job_id, {
          accumulated_content: `===dims===\n${dimsBuf}\n===spine===\n${spineBuf}\n===voice===\n${response}`,
          result: { breakthrough_core, investigation_agenda: [] },
          model: defaultModel,
          tokens_used: 0,
          llm_debug: buildLlmDebug({
            phase: "segment2_breakthrough_core",
            requested_effort: "xhigh",
            max_tokens: SEGMENT2_A_PARALLEL_LEG_MAX_TOKENS,
            model: defaultModel,
            latency_ms: Date.now() - invocationStartedAt,
            finish_reason: "salvaged_parallel",
          }),
        });
        return;
      }
    } catch (salvageErr) {
      console.warn("[xhigh-job] segment2 parallel salvage failed", {
        job_id,
        msg: salvageErr instanceof Error ? salvageErr.message : String(salvageErr),
      });
    }

    console.warn("[xhigh-job] segment2_breakthrough_core failed", {
      job_id,
      elapsed_ms: Date.now() - invocationStartedAt,
      content_len: dimsBuf.length + spineBuf.length,
      msg: detail.msg,
      http_status: detail.http_status,
      failure_reason: resolved.failure_reason,
    });
    await failXhighJob(job_id, detail.msg, {
      retryable: resolved.retryable,
      failure_reason: resolved.failure_reason,
      error_detail: detail.body_snippet,
      accumulated_content: `===dims===\n${dimsBuf}\n===spine===\n${spineBuf}`,
    });
  } finally {
    clearInterval(heartbeat);
  }
}

export async function runSegment2AgendaBridgeJob(job_id: string): Promise<void> {
  return runXhighJob(job_id, SEGMENT2_AGENDA_RUNNER_CONFIG);
}

export async function runSynthesisJob(job_id: string): Promise<void> {
  return runXhighJob(job_id, SYNTHESIS_RUNNER_CONFIG);
}

/**
 * Run an xhigh job in the background (scheduled via Next.js `after()`).
 * Streams LLM output into KV; parses + completes or fails the job.
 * Iron rule: every exit path writes a terminal status before returning.
 */
export async function runXhighJob(job_id: string, config: XhighJobRunnerConfig): Promise<void> {
  if (!isOpenRouterConfigured()) {
    await failXhighJob(job_id, "missing_openrouter_api_key");
    return;
  }

  const job = await getXhighJob(job_id);
  if (!job) {
    console.warn("[xhigh-job] run skipped — job not found:", { job_id });
    return;
  }
  if (job.status === "completed") return;
  if (job.status === "running" && Date.now() - job.updated_at < 15_000) {
    console.info("[xhigh-job] run skipped — already running:", { job_id });
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
  const invocationStartedAt = Date.now();
  const retryBudgetStartedAt = Date.now();
  let lastPersistedLen = 0;

  let out: Awaited<ReturnType<typeof openRouterChatCompletionStream>> | null = null;
  let lastErr: unknown = null;

  for (let attempt = 0; ; attempt++) {
    lastPersistedLen = 0;

    // Cap each attempt so we never run into Vercel kill without writing fail.
    const wallLeft =
      INVOCATION_HARD_DEADLINE_MS - (Date.now() - invocationStartedAt) - INVOCATION_WRITE_HEADROOM_MS;
    if (wallLeft < 8_000) {
      lastErr = lastErr ?? new Error("invocation_deadline_exhausted");
      break;
    }
    const attemptTimeoutMs = Math.min(config.timeout_ms, wallLeft);

    const heartbeat = setInterval(() => {
      void updateXhighJobStatus(job_id, "running", {});
    }, XHIGH_JOB_HEARTBEAT_MS);

    try {
      out = await openRouterChatCompletionStream(
        {
          messages,
          max_tokens: config.max_tokens,
          json_mode: true,
          reasoning_effort: config.reasoning_effort,
          timeout_ms: attemptTimeoutMs,
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
      lastErr = null;
      clearInterval(heartbeat);
      break;
    } catch (e) {
      clearInterval(heartbeat);
      lastErr = e;
      const detail = describeTransportError(e);

      // llm_timeout: never outer-retry (each attempt burns 180–270s → blows maxDuration → zombie running).
      if (isLlmTimeoutError(e)) {
        console.warn(`[xhigh-job] ${config.phase} llm_timeout — fail without retry`, {
          job_id,
          attempt: attempt + 1,
          msg: detail.msg,
          http_status: detail.http_status,
          body_snippet: detail.body_snippet,
        });
        break;
      }

      const transient = isFastTransientProviderFailure(e);
      const budgetLeft = JOB_RETRY_BUDGET_MS - (Date.now() - retryBudgetStartedAt);
      const delay =
        CORE_RETRY_DELAYS_MS[Math.min(attempt, CORE_RETRY_DELAYS_MS.length - 1)] ?? 20_000;

      console.warn(`[xhigh-job] ${config.phase} transport attempt ${attempt + 1} failed`, {
        job_id,
        attempt: attempt + 1,
        msg: detail.msg,
        http_status: detail.http_status,
        provider: detail.provider,
        body_snippet: detail.body_snippet,
        budget_left_ms: budgetLeft,
        transient,
      });

      // Budget exhausted / non-transient → write fail now (never ride to Vercel kill).
      if (!transient || budgetLeft <= delay) {
        break;
      }

      await updateXhighJobStatus(job_id, "running", { accumulated_content: "" });
      await sleep(delay);
    }
  }

  if (lastErr || !out) {
    const detail = describeTransportError(lastErr ?? new Error("transport_failed"));
    const resolved = resolveTransportFailureReason(lastErr);
    const snap = await getXhighJob(job_id).catch(() => null);
    const salvageContent = (snap?.accumulated_content || "").trim();
    const content_len = salvageContent.length || lastPersistedLen;

    // Call B: provider sometimes finishes JSON in the buffer right as the attempt
    // times out — salvage before painting the user-facing failure bubble.
    if (
      config.phase === "segment2_agenda_bridge" &&
      salvageContent.length > 40
    ) {
      try {
        const salvaged = config.finalizeContent(salvageContent, job).result;
        if (salvaged) {
          console.warn(`[xhigh-job] ${config.phase} salvaged after transport error`, {
            job_id,
            content_len,
            msg: detail.msg,
            failure_reason: resolved.failure_reason,
          });
          await completeXhighJob(job_id, {
            accumulated_content: salvageContent,
            result: salvaged,
            model: defaultModel,
            tokens_used: 0,
            llm_debug: buildLlmDebug({
              phase: config.phase_name,
              requested_effort: config.reasoning_effort,
              max_tokens: config.max_tokens,
              model: defaultModel,
              latency_ms: Date.now() - invocationStartedAt,
              finish_reason: "salvaged",
            }),
          });
          return;
        }
      } catch (salvageErr) {
        console.warn(`[xhigh-job] ${config.phase} salvage failed`, {
          job_id,
          msg: salvageErr instanceof Error ? salvageErr.message : String(salvageErr),
        });
      }
    }

    console.warn(`[xhigh-job] ${config.phase} failed`, {
      job_id,
      elapsed_ms: Date.now() - invocationStartedAt,
      content_len,
      prompt_tokens: out?.prompt_tokens ?? null,
      completion_tokens: out?.completion_tokens ?? null,
      finish_reason: out?.finish_reason ?? null,
      msg: detail.msg,
      http_status: detail.http_status,
      provider: detail.provider,
      body_snippet: detail.body_snippet,
      failure_reason: resolved.failure_reason,
    });
    await failXhighJob(job_id, detail.msg, {
      retryable: resolved.retryable,
      failure_reason: resolved.failure_reason,
      error_detail: detail.body_snippet,
      accumulated_content: snap?.accumulated_content || undefined,
    });
    return;
  }

  const latency_ms = Date.now() - invocationStartedAt;
  const content = out.text.trim();
  const finish = out.finish_reason ?? null;

  console.info(`[xhigh-job] ${config.phase} stream done`, {
    job_id,
    elapsed_ms: latency_ms,
    content_len: content.length,
    prompt_tokens: out.prompt_tokens ?? null,
    completion_tokens: out.completion_tokens ?? null,
    finish_reason: finish,
  });

  if (finish === "length" || !content) {
    console.warn(`[xhigh-job] ${config.phase} truncated/empty`, {
      job_id,
      elapsed_ms: latency_ms,
      content_len: content.length,
      prompt_tokens: out.prompt_tokens ?? null,
      finish_reason: finish,
      max_tokens: config.max_tokens,
    });
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
    const isAnchor =
      e instanceof AgendaAnchorError ||
      (e instanceof Error &&
        (e as Error & { failure_reason?: string }).failure_reason === "agenda_anchor_failed");
    console.warn(`[xhigh-job] ${config.phase} parse failed`, { job_id, msg, isAnchor });
    await failXhighJob(job_id, isAnchor ? msg : "deep analysis JSON was incomplete", {
      retryable: true,
      failure_reason: isAnchor ? "agenda_anchor_failed" : "parse_failed",
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
