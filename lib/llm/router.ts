/**
 * Single entry for server-side LLM calls (POJU v4 Agent doc: `callLLM`).
 * Dev phase: routes to OpenRouter `deepseek/deepseek-v4-pro` with high reasoning when configured.
 */

import { openRouterChatCompletion, type OpenRouterChatMessage } from "@/lib/llm/openrouter-shared";

export type LLMCallType = string;

export interface CallLLMInput {
  call_type: LLMCallType;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  max_tokens?: number;
  /** Maps to OpenRouter `reasoning.effort` for supported models (e.g. DeepSeek V4 Pro). */
  thinking_effort?: "high" | "xhigh" | "off";
  response_format?: "json" | "text";
}

export interface CallLLMResult {
  content: string;
  actual_model: string;
  meta: { tokens_used: number };
}

/**
 * OpenRouter-only path (see `isOpenRouterConfigured` in openrouter-shared).
 * Used by future Step 7/8 modules and any code that should share one transport.
 */
export async function callLLM(input: CallLLMInput): Promise<CallLLMResult> {
  const msgs: OpenRouterChatMessage[] = [
    { role: "system", content: input.system },
    ...input.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const { text, model, tokens_used } = await openRouterChatCompletion({
    messages: msgs,
    max_tokens: input.max_tokens ?? 8192,
    temperature: 0.55,
    json_mode: input.response_format === "json",
    reasoning_effort: input.thinking_effort ?? "high",
  });

  return {
    content: text,
    actual_model: model,
    meta: { tokens_used },
  };
}
