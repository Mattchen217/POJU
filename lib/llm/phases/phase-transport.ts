import { auditDeliveredText, sanitizeChatResponse, stripGlossTokensForPrompt } from "@/lib/llm/sanitize/compliance-terms";
import { extractStreamingResponseText } from "@/lib/poju/extract-streaming-response";
import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
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
    phase_name?: string;
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
          call_type: call_type,
          phase_name: options?.phase_name,
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
      phase_name: options?.phase_name,
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
    const audited = sanitizeChatResponse(raw, options.locale);
    auditDeliveredText(audited, options.locale);
    return audited;
  };

  try {
    const parsed = parsePhaseJson(rawText);
    let responseRaw =
      typeof parsed.response === "string"
        ? parsed.response.trim()
        : typeof parsed.reply === "string"
          ? parsed.reply.trim()
          : "";
    if (!responseRaw) {
      responseRaw = extractStreamingResponseText(rawText).trim();
    }
    const response = sanitizeResponse(responseRaw);
    if (typeof parsed.response === "string") parsed.response = response;
    return { parsed, response };
  } catch {
    const salvaged = extractStreamingResponseText(rawText).trim();
    if (salvaged) {
      return { parsed: {}, response: sanitizeResponse(salvaged) };
    }
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
    return { parsed: {}, response: "" };
  }
}

/** User-visible fallback when the model returns no parseable `response` (e.g. truncated JSON). */
export function getPhaseResponseFallback(locale?: string): string {
  const loc = locale?.toLowerCase().startsWith("zh")
    ? "zh"
    : locale?.toLowerCase().startsWith("es")
      ? "es"
      : "en";
  const messages: Record<string, string> = {
    en: "[POJU] Reply could not be generated. Please send again. Your session is saved.",
    zh: "[POJU] 本轮回复未能生成，请重试发送。会话已保存。",
    es: "[POJU] No se pudo generar la respuesta. Reintenta. Tu sesión está guardada.",
  };
  return messages[loc] ?? messages.en!;
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

/**
 * Prepend per-turn dynamic context (date, language, task) to the latest user turn.
 * Keeps the system prompt byte-stable for OpenRouter/DeepSeek prefix cache.
 */
export function applyTurnContext(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  turnContext: string,
): Array<{ role: "user" | "assistant"; content: string }> {
  const ctx = turnContext.trim();
  if (!ctx) return messages;

  if (messages.length === 0) {
    return [{ role: "user", content: ctx }];
  }

  const last = messages[messages.length - 1]!;
  if (last.role === "user") {
    return [
      ...messages.slice(0, -1),
      { role: "user", content: `${ctx}\n\n---\n\n${last.content}` },
    ];
  }

  return [
    ...messages,
    {
      role: "user",
      content: `${ctx}\n\n(Continue the conversation above per the current task.)`,
    },
  ];
}

/** Pass stream hooks + abort signal from phase input into transport options. */
export function withPhaseStreamOpts<
  T extends {
    temperature?: number;
    max_tokens?: number;
    call_type?: import("@/lib/llm/router").LLMCallType;
    phase_name?: string;
  },
>(
  input: { stream_hooks?: PhaseStreamHooks; signal?: AbortSignal; session: { session_id: string } },
  opts: T,
): T & { stream_hooks?: PhaseStreamHooks; signal?: AbortSignal; session_id?: string; phase_name?: string } {
  return {
    ...opts,
    stream_hooks: input.stream_hooks,
    signal: input.signal,
    session_id: pojuCacheSessionId(input.session.session_id),
    phase_name: opts.phase_name,
  };
}
