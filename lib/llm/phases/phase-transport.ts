import { applyComplianceSanitize, stripGlossTokensForPrompt } from "@/lib/llm/sanitize/compliance-terms";
import {
  generateGeminiChatCompletion,
  getGeminiClient,
} from "@/lib/llm/gemini-shared";
import { callLLM, type LLMCallType } from "@/lib/llm/router";
import { openRouterChatCompletionStream } from "@/lib/llm/openrouter-stream";
import { getOpenRouterDefaultModel, isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export type PhaseStreamHooks = {
  onReasoning?: (fullReasoning: string) => void;
  onContent?: (fullContent: string) => void;
};

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
    session_id?: string;
    stream_hooks?: PhaseStreamHooks;
    signal?: AbortSignal;
  },
): Promise<PhaseTransportResult> {
  const temperature = options?.temperature ?? 0.5;
  const max_tokens = options?.max_tokens ?? 2500;
  const call_type = options?.call_type ?? "poju_reply";
  const streamHooks = options?.stream_hooks;

  if (isOpenRouterConfigured()) {
    if (streamHooks) {
      const chatMessages = [
        { role: "system" as const, content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const streamed = await openRouterChatCompletionStream(
        {
          messages: chatMessages,
          max_tokens,
          temperature,
          json_mode: true,
          reasoning_effort: call_type === "collection_flash" ? "medium" : "medium",
          session_id: options?.session_id,
        },
        {
          onReasoning: streamHooks.onReasoning,
          onContent: streamHooks.onContent,
        },
      );
      return {
        content: streamed.text,
        model: streamed.model ?? getOpenRouterDefaultModel(),
        tokens_used: streamed.tokens_used ?? 0,
        reasoning: streamed.reasoning,
      };
    }

    const result = await callLLM({
      call_type,
      system,
      messages,
      max_tokens,
      temperature,
      response_format: "json",
      session_id: options?.session_id,
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

/** Parse phase JSON; sanitize `response` when locale provided (output-side gloss tokens). */
export function parsePhaseResult(
  rawText: string,
  options?: { locale?: string },
): {
  parsed: Record<string, unknown>;
  response: string;
} {
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!cleaned) return { parsed: {}, response: "" };

  const sanitizeResponse = (raw: string): string => {
    if (!options?.locale || !raw.trim()) return raw;
    return applyComplianceSanitize(raw, options.locale).text;
  };

  try {
    const parsed = parsePhaseJson(rawText);
    const responseRaw =
      typeof parsed.response === "string"
        ? parsed.response.trim()
        : typeof parsed.reply === "string"
          ? parsed.reply.trim()
          : cleaned;
    const response = sanitizeResponse(responseRaw);
    if (typeof parsed.response === "string") parsed.response = response;
    return { parsed, response };
  } catch {
    const fieldMatch = cleaned.match(/"response"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (fieldMatch?.[1]) {
      try {
        const unescaped = JSON.parse(`"${fieldMatch[1]}"`) as string;
        return { parsed: {}, response: sanitizeResponse(String(unescaped).trim()) };
      } catch {
        return {
          parsed: {},
          response: sanitizeResponse(fieldMatch[1].replace(/\\n/g, "\n").trim()),
        };
      }
    }
    return { parsed: {}, response: sanitizeResponse(cleaned) };
  }
}

export function formatPhaseMessageHistory(
  messages: Array<{ role: string; content: string; is_rejected?: boolean }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => !m.is_rejected)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: stripGlossTokensForPrompt(m.content),
    }));
}

/** Pass stream hooks + abort signal from phase input into transport options. */
export function withPhaseStreamOpts<
  T extends {
    temperature?: number;
    max_tokens?: number;
    call_type?: import("@/lib/llm/router").LLMCallType;
  },
>(
  input: { stream_hooks?: PhaseStreamHooks; signal?: AbortSignal; session: { session_id: string } },
  opts: T,
): T & { stream_hooks?: PhaseStreamHooks; signal?: AbortSignal; session_id?: string } {
  return {
    ...opts,
    stream_hooks: input.stream_hooks,
    signal: input.signal,
    session_id: input.session.session_id,
  };
}
