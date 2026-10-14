/**
 * Lab · full LLM call trace for ops human review.
 * One attempt = one invoke's feed + prompts + reasoning + output.
 */

import type { CallLLMResult } from "@/lib/llm/router";
import { formatReasoningDetails } from "@/lib/llm/thinking-process";

/** Persisted on LabAttempt — complete invoke observability. */
export type LabCallTrace = {
  phase: string;
  system: string;
  user: string;
  /** Pre-wrap feed block when distinct from full user (judgment/body). */
  user_feed?: string;
  reasoning: string | null;
  reasoning_details?: unknown;
  raw_text: string | null;
  parsed?: unknown;
  meta: {
    actual_model?: string;
    thinking_effort?: string;
    thinking_enabled?: boolean;
    tokens_used?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    reasoning_tokens?: number | null;
    latency_ms?: number;
    generation_id?: string | null;
    finish_reason?: string | null;
    /**
     * True when provider usage was present on the invoke.
     * False/undefined + tokens_used 0 (or missing) => display as usage-not-written.
     */
    usage_written?: boolean;
  };
};

/** Meta slice used by call-trace token display (Lab UI + tests). */
export type LabTokenUsageMeta = {
  tokens_used?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  usage_written?: boolean | null;
  finish_reason?: string | null;
  generation_id?: string | null;
  actual_model?: string | null;
};

/**
 * Display rule: never imply measured zero when usage was not written back.
 * Returns null when the tokens segment should be omitted entirely (no meta at all).
 */
export function formatLabTokenUsageLabel(meta: LabTokenUsageMeta | null | undefined): string | null {
  if (meta == null) return null;
  const written = meta.usage_written === true;
  const tokens = meta.tokens_used;
  const prompt = meta.prompt_tokens;
  const completion = meta.completion_tokens;
  const hasBreakdown =
    (typeof prompt === "number" && prompt > 0) ||
    (typeof completion === "number" && completion > 0);

  if (written) {
    if (typeof tokens === "number") return `tokens=${tokens}`;
    if (hasBreakdown) {
      const sum = (typeof prompt === "number" ? prompt : 0) + (typeof completion === "number" ? completion : 0);
      return `tokens=${sum}`;
    }
    return "用量未回写";
  }

  // Explicit missing write-back
  if (meta.usage_written === false) return "用量未回写";

  // Legacy traces coerced missing -> 0 (no breakdown): do not show tokens=0 as success noise
  if (tokens == null) return "用量未回写";
  if (tokens === 0 && !hasBreakdown) return "用量未回写";
  return `tokens=${tokens}`;
}

export function buildLabCallTrace(input: {
  phase: string;
  system: string;
  user: string;
  user_feed?: string;
  result?: Pick<CallLLMResult, "reasoning" | "reasoning_details" | "actual_model" | "meta">;
  raw_text?: string | null;
  parsed?: unknown;
}): LabCallTrace {
  const reasoningFromDetails = formatReasoningDetails(input.result?.reasoning_details);
  const reasoning =
    (typeof input.result?.reasoning === "string" && input.result.reasoning.trim()) ||
    reasoningFromDetails ||
    null;
  return {
    phase: input.phase,
    system: input.system,
    user: input.user,
    ...(input.user_feed?.trim() ? { user_feed: input.user_feed.trim() } : {}),
    reasoning,
    ...(input.result?.reasoning_details != null
      ? { reasoning_details: input.result.reasoning_details }
      : {}),
    raw_text: input.raw_text?.trim() ? input.raw_text : null,
    ...(input.parsed !== undefined ? { parsed: input.parsed } : {}),
    meta: {
      actual_model: input.result?.actual_model,
      thinking_effort: input.result?.meta.thinking_effort,
      thinking_enabled: input.result?.meta.thinking_enabled,
      tokens_used: input.result?.meta.tokens_used,
      prompt_tokens: input.result?.meta.prompt_tokens,
      completion_tokens: input.result?.meta.completion_tokens,
      reasoning_tokens: input.result?.meta.reasoning_tokens ?? null,
      latency_ms: input.result?.meta.latency_ms,
      generation_id: input.result?.meta.generation_id ?? null,
      finish_reason: input.result?.meta.finish_reason ?? null,
      usage_written: input.result?.meta.usage_written,
    },
  };
}

const SLIM_REASONING_CHARS = 16_000;
const SLIM_RAW_CHARS = 24_000;
const SLIM_PROMPT_CHARS = 12_000;

/** Shrink trace for KV + ops JSON — keeps head of prompts/reasoning/raw, drops bulky details. */
export function slimLabCallTrace(trace: LabCallTrace): LabCallTrace {
  const trimHead = (s: string | null | undefined, max: number): string | null => {
    if (s == null) return s ?? null;
    if (s.length <= max) return s;
    return `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`;
  };
  /** Keep the tail — dyad/task feed is usually appended at the end of turn context. */
  const trimTail = (s: string | null | undefined, max: number): string | null => {
    if (s == null) return s ?? null;
    if (s.length <= max) return s;
    return `…[truncated head ${s.length - max} chars]\n${s.slice(-max)}`;
  };
  return {
    ...trace,
    system: trimHead(trace.system, SLIM_PROMPT_CHARS) ?? "",
    user: trimTail(trace.user, SLIM_PROMPT_CHARS) ?? "",
    ...(trace.user_feed != null
      ? { user_feed: trimTail(trace.user_feed, SLIM_PROMPT_CHARS) ?? undefined }
      : {}),
    reasoning: trimHead(trace.reasoning, SLIM_REASONING_CHARS),
    raw_text: trimHead(trace.raw_text, SLIM_RAW_CHARS),
    reasoning_details: undefined,
  };
}

/** Drop bulky prompt bodies from older attempts so KV set stays fast after many retries. */
export function stripStaleAttemptCallTraces(
  attempts: Array<{ call_trace?: LabCallTrace }>,
  keepLast = 2,
): void {
  if (attempts.length <= keepLast) return;
  const cut = attempts.length - keepLast;
  for (let i = 0; i < cut; i++) {
    const t = attempts[i]?.call_trace;
    if (!t) continue;
    attempts[i]!.call_trace = {
      phase: t.phase,
      system: "",
      user: "",
      reasoning: null,
      raw_text: null,
      meta: t.meta,
    };
  }
}
