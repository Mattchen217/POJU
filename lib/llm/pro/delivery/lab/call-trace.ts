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
  };
};

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
    },
  };
}
