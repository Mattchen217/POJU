/**
 * POJU v5 Step J — single server-side LLM entry (OpenRouter → DeepSeek V4 Pro).
 */

import {
  getOpenRouterDefaultModel,
  isOpenRouterConfigured,
  openRouterChatCompletion,
  openRouterProviderExtras,
  parseProviderIgnore,
  type OpenRouterChatMessage,
} from "@/lib/llm/openrouter-shared";
import type { AgentPhase } from "@/lib/poju/agent-state";

export type LLMCallType =
  | "chat_flash"
  | "collection_flash"
  | "deep_analysis"
  | "main_delivery"
  | "tracking_flash"
  /** 命主基础分析 — medium / 8000 */
  | "base_analysis"
  /** POJU 对话回合 — low / 2500 */
  | "poju_reply"
  /** Syncro 单批 16 cell — low / 6000 */
  | "syncro_batch"
  /** Match 合盘报告 — medium / 10000 */
  | "match_report"
  /** Glyph 全篇解读 — low / 15000 */
  | "glyph_reading"
  /** Energy Matrix 三段文案 — no thinking / fast JSON */
  | "matrix_narrative"
  /** @deprecated use base_analysis */
  | "poju_base_analysis"
  /** @deprecated use deep_analysis */
  | "poju_situation_analysis"
  /** @deprecated use main_delivery */
  | "poju_final_delivery";

export type ReasoningEffort = "off" | "low" | "medium" | "high" | "xhigh";

export interface CallLLMInput {
  call_type: LLMCallType;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  max_tokens?: number;
  /** Overrides router default for this call_type when set. */
  thinking_effort?: ReasoningEffort;
  response_format?: "json" | "text";
  temperature?: number;
  /** OpenRouter HTTP timeout (ms). Defaults to 90s; deep_analysis uses 180s. */
  timeout_ms?: number;
  /** OpenRouter session key for observability (see lib/llm/cache-session-id.ts). Supplier pin = OPENROUTER_PROVIDER_ONLY. */
  session_id?: string;
  /** POJU phase label for cache observability. */
  phase_name?: string;
}

export interface CallLLMResult {
  content: string;
  actual_model: string;
  reasoning?: string;
  reasoning_details?: unknown;
  meta: {
    call_type: LLMCallType;
    tokens_used: number;
    latency_ms: number;
    cost_usd: number;
    cached_tokens: number;
    thinking_enabled: boolean;
    thinking_effort: ReasoningEffort;
    finish_reason?: string | null;
    provider?: string | null;
  };
}

const DEFAULT_MODEL = "deepseek/deepseek-v4-pro";

const HIGH_OUTPUT_CALL_TYPES = new Set<LLMCallType>([
  "glyph_reading",
  "match_report",
  "syncro_batch",
  "main_delivery",
  "deep_analysis",
  "poju_situation_analysis",
  "poju_final_delivery",
]);

/** Long JSON deliveries — exclude low max-output providers; merges OPENROUTER_PROVIDER_ONLY pin. */
export function highOutputProviderConstraints(): Record<string, unknown> {
  const pinned = openRouterProviderExtras({ require_parameters: true });
  if (pinned) return pinned;
  const ignore = parseProviderIgnore();
  return {
    require_parameters: true,
    ...(ignore.length > 0 ? { ignore } : {}),
    allow_fallbacks: true,
  };
}

function normalizeCallType(callType: LLMCallType): Exclude<
  LLMCallType,
  | "poju_base_analysis"
  | "poju_situation_analysis"
  | "poju_final_delivery"
  | "base_analysis"
  | "poju_reply"
  | "syncro_batch"
  | "match_report"
  | "glyph_reading"
> {
  switch (callType) {
    case "poju_base_analysis":
    case "base_analysis":
      return "deep_analysis";
    case "poju_situation_analysis":
      return "deep_analysis";
    case "poju_final_delivery":
      return "main_delivery";
    case "poju_reply":
      return "collection_flash";
    case "syncro_batch":
    case "match_report":
    case "glyph_reading":
      return "deep_analysis";
    case "matrix_narrative":
      return "chat_flash";
    default:
      return callType;
  }
}

export function getThinkingConfig(callType: LLMCallType): { enabled: boolean; effort: ReasoningEffort } {
  switch (callType) {
    case "matrix_narrative":
      return { enabled: false, effort: "off" };
    case "base_analysis":
    case "match_report":
      return { enabled: true, effort: "medium" };
    case "poju_reply":
    case "syncro_batch":
      return { enabled: true, effort: "low" };
    case "glyph_reading":
      return { enabled: true, effort: "medium" };
    default:
      break;
  }

  const t = normalizeCallType(callType);
  switch (t) {
    case "chat_flash":
    case "tracking_flash":
      return { enabled: false, effort: "off" };
    case "collection_flash":
      return { enabled: true, effort: "low" };
    case "deep_analysis":
      return { enabled: true, effort: "medium" };
    case "main_delivery":
      return { enabled: true, effort: "xhigh" };
    default:
      return { enabled: false, effort: "off" };
  }
}

/** Map agent phase → router call type (Step J thinking tiers). */
export function callTypeForAgentPhase(phase: AgentPhase): LLMCallType {
  switch (phase) {
    case "opening":
      return "chat_flash";
    case "collecting_context":
    case "awaiting_confirmation":
      return "collection_flash";
    case "delivered":
      return "chat_flash";
    case "tracking":
      return "tracking_flash";
    default:
      return "collection_flash";
  }
}

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0,
): number {
  const uncachedInput = Math.max(0, inputTokens - cachedTokens);
  const inputCost =
    (uncachedInput / 1_000_000) * 0.435 + (cachedTokens / 1_000_000) * 0.003625;
  const outputCost = (outputTokens / 1_000_000) * 0.87;
  return Number((inputCost + outputCost).toFixed(6));
}

function defaultMaxTokens(thinkingEnabled: boolean, override?: number): number {
  if (override !== undefined) return override;
  return thinkingEnabled ? 8000 : 2000;
}

/**
 * OpenRouter-only (see `isOpenRouterConfigured`). All POJU server routes should use this.
 */
export async function callLLM(input: CallLLMInput): Promise<CallLLMResult> {
  if (!isOpenRouterConfigured()) {
    throw new Error("missing_openrouter_api_key");
  }

  const normalizedType = normalizeCallType(input.call_type);
  const config = getThinkingConfig(input.call_type);
  const effort: ReasoningEffort =
    input.thinking_effort ??
    (config.enabled ? config.effort : "off");

  const thinkingEnabled = effort !== "off";
  const max_tokens = defaultMaxTokens(thinkingEnabled, input.max_tokens);
  const model = getOpenRouterDefaultModel() || DEFAULT_MODEL;

  const msgs: OpenRouterChatMessage[] = [
    { role: "system", content: input.system },
    ...input.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const startTime = Date.now();
  console.log(
    `[llm/router] ${input.call_type} → ${normalizedType} (thinking: ${thinkingEnabled ? effort : "off"}, max_tokens: ${max_tokens})`,
  );

  const timeout_ms =
    input.timeout_ms ??
    (input.call_type === "syncro_batch"
      ? 90_000
      : input.call_type === "base_analysis"
        ? 240_000
        : normalizedType === "deep_analysis"
          ? 180_000
          : undefined);

  const provider = HIGH_OUTPUT_CALL_TYPES.has(input.call_type)
    ? highOutputProviderConstraints()
    : openRouterProviderExtras();

  const out = await openRouterChatCompletion({
    messages: msgs,
    max_tokens,
    temperature: input.temperature ?? 0.55,
    json_mode: input.response_format === "json",
    reasoning_effort: effort,
    timeout_ms,
    session_id: input.session_id,
    call_type: input.call_type,
    phase_name: input.phase_name,
    provider,
  });

  const latency_ms = Date.now() - startTime;

  return {
    content: out.text,
    actual_model: out.model || model,
    reasoning: out.reasoning,
    reasoning_details: out.reasoning_details,
    meta: {
      call_type: input.call_type,
      tokens_used: out.tokens_used,
      latency_ms,
      cost_usd: estimateCostUsd(out.prompt_tokens, out.completion_tokens, out.cached_tokens),
      cached_tokens: out.cached_tokens,
      thinking_enabled: thinkingEnabled,
      thinking_effort: effort,
      finish_reason: out.finish_reason,
      provider: out.provider,
    },
  };
}
