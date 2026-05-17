import {
  generateGeminiChatCompletion,
  getGeminiClient,
} from "@/lib/llm/gemini-shared";
import { isOpenRouterConfigured, openRouterChatCompletion } from "@/lib/llm/openrouter-shared";

export async function callPhaseJsonTransport(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { temperature?: number; max_tokens?: number },
): Promise<{ content: string; model: string; tokens_used: number }> {
  const temperature = options?.temperature ?? 0.5;
  const max_tokens = options?.max_tokens ?? 2500;

  if (isOpenRouterConfigured()) {
    const msgs = [
      { role: "system" as const, content: system },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const out = await openRouterChatCompletion({
      messages: msgs,
      temperature,
      max_tokens,
      json_mode: true,
      reasoning_effort: "high",
    });
    return { content: out.text, model: out.model, tokens_used: out.tokens_used };
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
