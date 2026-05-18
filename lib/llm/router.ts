/**
 * POJU v5 Step J — single server-side LLM entry (OpenRouter → DeepSeek V4 Pro).
 */

import {
  getOpenRouterDefaultModel,
  isOpenRouterConfigured,
  openRouterChatCompletion,
  type OpenRouterChatMessage,
} from "@/lib/llm/openrouter-shared";
import type { AgentPhase } from "@/lib/poju/agent-state";

export type LLMCallType =
  | "chat_flash"
  | "collection_flash"
  | "deep_analysis"
  | "main_delivery"
  | "tracking_flash"
  /** @deprecated use deep_analysis */
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
    thinking_enabled: boolean;
    thinking_effort: ReasoningEffort;
  };
}

const DEFAULT_MODEL = "deepseek/deepseek-v4-pro";

function normalizeCallType(callType: LLMCallType): Exclude<
  LLMCallType,
  "poju_base_analysis" | "poju_situation_analysis" | "poju_final_delivery"
> {
  switch (callType) {
    case "poju_base_analysis":
    case "poju_situation_analysis":
      return "deep_analysis";
    case "poju_final_delivery":
      return "main_delivery";
    default:
      return callType;
  }
}

export function getThinkingConfig(callType: LLMCallType): { enabled: boolean; effort: ReasoningEffort } {
  const t = normalizeCallType(callType);
  switch (t) {
    case "chat_flash":
    case "tracking_flash":
      return { enabled: false, effort: "off" };
    case "collection_flash":
      return { enabled: true, effort: "low" };
    case "deep_analysis":
      return { enabled: true, effort: "high" };
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

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 0.435;
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

  const out = await openRouterChatCompletion({
    messages: msgs,
    max_tokens,
    temperature: input.temperature ?? 0.55,
    json_mode: input.response_format === "json",
    reasoning_effort: effort,
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
      cost_usd: estimateCostUsd(out.prompt_tokens, out.completion_tokens),
      thinking_enabled: thinkingEnabled,
      thinking_effort: effort,
    },
  };
}
