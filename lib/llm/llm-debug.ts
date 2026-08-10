import type { LLMCallType, ReasoningEffort } from "@/lib/llm/router";

/** Per-turn LLM call diagnostics — attached to assistant message meta when debug mode is on. */
export type LLMCallDebug = {
  phase?: string;
  requested_effort: ReasoningEffort;
  max_tokens: number;
  reasoning_budget: number;
  model: string;
  served_provider?: string | null;
  finish_reason?: string | null;
  prompt_tokens: number;
  cached_tokens: number;
  cache_ratio: number;
  completion_tokens: number;
  reasoning_tokens: number;
  reasoning_used_ratio: number;
  latency_ms: number;
  generation_time_ms?: number | null;
  attempt: number;
  retried: boolean;
  fell_back: boolean;
  phase_from?: string;
  phase_to?: string;
  understanding_sufficient?: boolean;
  generation_id?: string | null;
};

const EFFORT_RATIO: Record<ReasoningEffort, number> = {
  off: 0,
  low: 0.2,
  medium: 0.5,
  high: 0.8,
  xhigh: 0.95,
};

export function effortRatio(effort: ReasoningEffort): number {
  return EFFORT_RATIO[effort] ?? 0;
}

export function reasoningBudget(max_tokens: number, effort: ReasoningEffort): number {
  if (effort === "off") return 0;
  return Math.round(max_tokens * effortRatio(effort));
}

export function parseReasoningTokens(usage: Record<string, unknown> | undefined): number {
  if (!usage) return 0;
  const details = usage.completion_tokens_details;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const reasoning = (details as Record<string, unknown>).reasoning_tokens;
    if (typeof reasoning === "number") return reasoning;
  }
  if (typeof usage.native_tokens_reasoning === "number") return usage.native_tokens_reasoning;
  if (typeof usage.reasoning_tokens === "number") return usage.reasoning_tokens;
  return 0;
}

export function parseGenerationTimeMs(data: Record<string, unknown>): number | null {
  if (typeof data.generation_time === "number") return data.generation_time;
  const usage = data.usage;
  if (usage && typeof usage === "object" && !Array.isArray(usage)) {
    const gt = (usage as Record<string, unknown>).generation_time;
    if (typeof gt === "number") return gt;
  }
  return null;
}

/** Expected minimum effort tier for highlighting mismatches (actual below expected → warn). */
export function expectedEffortForCall(call_type?: string, phase?: string): ReasoningEffort | undefined {
  const p = phase?.trim();
  if (
    p === "opening_conversion" ||
    p === "final_delivery" ||
    p === "segment2_breakthrough_core" ||
    p === "synthesis"
  ) {
    return "xhigh";
  }

  const t = call_type?.trim();
  if (t === "main_delivery" || t === "deep_analysis" || t === "poju_final_delivery" || t === "poju_situation_analysis") {
    return "xhigh";
  }
  if (
    t === "chat_flash" ||
    t === "collection_flash" ||
    t === "tracking_flash" ||
    t === "poju_reply"
  ) {
    return "high";
  }
  if (
    p === "opening" ||
    p === "awaiting_understanding_confirm" ||
    p === "collecting_context" ||
    p === "awaiting_confirmation" ||
    p === "tracking" ||
    p === "delivery"
  ) {
    return "high";
  }
  return undefined;
}

const EFFORT_RANK: Record<ReasoningEffort, number> = {
  off: 0,
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 4,
};

export function isEffortBelowExpected(actual: ReasoningEffort, expected: ReasoningEffort): boolean {
  return (EFFORT_RANK[actual] ?? 0) < (EFFORT_RANK[expected] ?? 0);
}

export function buildLlmDebug(input: {
  phase?: string;
  requested_effort: ReasoningEffort;
  max_tokens: number;
  model: string;
  served_provider?: string | null;
  finish_reason?: string | null;
  prompt_tokens?: number;
  cached_tokens?: number;
  completion_tokens?: number;
  reasoning_tokens?: number;
  latency_ms?: number;
  generation_time_ms?: number | null;
  generation_id?: string | null;
  attempt?: number;
  retried?: boolean;
  fell_back?: boolean;
  phase_from?: string;
  phase_to?: string;
  understanding_sufficient?: boolean;
}): LLMCallDebug {
  const prompt_tokens = input.prompt_tokens ?? 0;
  const cached_tokens = input.cached_tokens ?? 0;
  const completion_tokens = input.completion_tokens ?? 0;
  const reasoning_tokens = input.reasoning_tokens ?? 0;
  const budget = reasoningBudget(input.max_tokens, input.requested_effort);
  const cache_ratio = prompt_tokens > 0 ? cached_tokens / prompt_tokens : 0;
  const reasoning_used_ratio = budget > 0 ? reasoning_tokens / budget : 0;

  return {
    phase: input.phase,
    requested_effort: input.requested_effort,
    max_tokens: input.max_tokens,
    reasoning_budget: budget,
    model: input.model,
    served_provider: input.served_provider ?? null,
    finish_reason: input.finish_reason ?? null,
    prompt_tokens,
    cached_tokens,
    cache_ratio: Number(cache_ratio.toFixed(4)),
    completion_tokens,
    reasoning_tokens,
    reasoning_used_ratio: Number(reasoning_used_ratio.toFixed(4)),
    latency_ms: input.latency_ms ?? 0,
    generation_time_ms: input.generation_time_ms ?? null,
    attempt: input.attempt ?? 1,
    retried: Boolean(input.retried),
    fell_back: Boolean(input.fell_back),
    phase_from: input.phase_from,
    phase_to: input.phase_to,
    understanding_sufficient: input.understanding_sufficient,
    generation_id: input.generation_id ?? null,
  };
}

export function enrichLlmDebugPhaseTransition(
  debug: LLMCallDebug | undefined,
  ctx: {
    phase_from?: string;
    phase_to?: string;
    understanding_sufficient?: boolean;
    call_type?: LLMCallType | string;
  },
): LLMCallDebug | undefined {
  if (!debug) return undefined;
  return {
    ...debug,
    phase_from: ctx.phase_from ?? debug.phase_from,
    phase_to: ctx.phase_to ?? debug.phase_to,
    understanding_sufficient:
      typeof ctx.understanding_sufficient === "boolean"
        ? ctx.understanding_sufficient
        : debug.understanding_sufficient,
    phase: debug.phase ?? (typeof ctx.call_type === "string" ? ctx.call_type : undefined),
  };
}

export function formatTokenCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatRatio(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}

export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}
