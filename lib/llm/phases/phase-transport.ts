import {
  generateGeminiChatCompletion,
  getGeminiClient,
} from "@/lib/llm/gemini-shared";
import { callLLM, type LLMCallType } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export type PhaseTransportResult = {
  content: string;
  model: string;
  tokens_used: number;
  reasoning?: string;
  reasoning_details?: unknown;
};

export async function callPhaseJsonTransport(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: {
    temperature?: number;
    max_tokens?: number;
    call_type?: LLMCallType;
  },
): Promise<PhaseTransportResult> {
  const temperature = options?.temperature ?? 0.5;
  const max_tokens = options?.max_tokens ?? 2500;
  const call_type = options?.call_type ?? "collection_flash";

  if (isOpenRouterConfigured()) {
    const result = await callLLM({
      call_type,
      system,
      messages,
      max_tokens,
      temperature,
      response_format: "json",
    });
    return {
      content: result.content,
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      reasoning: result.reasoning,
      reasoning_details: result.reasoning_details,
    };
  }

  if (!getGeminiClient()) {
    throw new Error("missing_llm_api_key");
  }
  const gemini = await generateGeminiChatCompletion({
    systemInstruction: system,
    messages,
    temperature,
    maxOutputTokens: max_tokens,
  });
  return { content: gemini.text, model: gemini.modelUsed, tokens_used: gemini.tokens_used };
}

export function parsePhaseJson(rawText: string): Record<string, unknown> {
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

export function formatPhaseMessageHistory(
  messages: Array<{ role: string; content: string; is_rejected?: boolean }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => !m.is_rejected)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}
