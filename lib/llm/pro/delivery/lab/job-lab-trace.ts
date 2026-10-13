/**
 * Build slim LabCallTrace rows from xhigh job invokes (ops Stage2/3 observability).
 */

import { buildLabCallTrace, slimLabCallTrace, type LabCallTrace } from "@/lib/llm/pro/delivery/lab/call-trace";
import type { ReasoningEffort } from "@/lib/llm/router";

export function buildXhighLabCallTrace(input: {
  phase: string;
  system: string;
  user: string;
  user_feed?: string;
  raw_text?: string | null;
  parsed?: unknown;
  reasoning?: string | null;
  actual_model?: string;
  thinking_effort?: ReasoningEffort;
  tokens_used?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  reasoning_tokens?: number | null;
  latency_ms?: number;
  generation_id?: string | null;
  finish_reason?: string | null;
}): LabCallTrace {
  return slimLabCallTrace(
    buildLabCallTrace({
      phase: input.phase,
      system: input.system,
      user: input.user,
      user_feed: input.user_feed,
      raw_text: input.raw_text ?? null,
      parsed: input.parsed,
      result: {
        reasoning: input.reasoning?.trim() || undefined,
        actual_model: input.actual_model ?? "unknown",
        meta: {
          call_type: "deep_analysis",
          tokens_used: Number(input.tokens_used ?? 0),
          latency_ms: Number(input.latency_ms ?? 0),
          cost_usd: 0,
          cached_tokens: 0,
          thinking_enabled: true,
          thinking_effort: input.thinking_effort ?? "high",
          prompt_tokens: input.prompt_tokens,
          completion_tokens: input.completion_tokens,
          reasoning_tokens: input.reasoning_tokens ?? undefined,
          generation_id: input.generation_id ?? null,
          finish_reason: input.finish_reason ?? null,
        },
      },
    }),
  );
}
