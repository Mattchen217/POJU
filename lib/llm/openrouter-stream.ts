import {
  callWithRetryAndFallback,
  getOpenRouterDefaultModel,
  isOpenRouterModelNotFoundError,
  isOpenRouterModelNotFoundHttpStatus,
  logOpenRouterModelSlug404Hint,
  logOpenRouterProviderServed,
  logOpenRouterRequestRouting,
  markOpenRouterSlugDead,
  openRouterProviderExtras,
  openRouterRequestExtras,
  resolveOpenRouterCandidateOrder,
  type OpenRouterChatMessage,
  type OpenRouterChatOptions,
  type OpenRouterCompletionResult,
} from "@/lib/llm/openrouter-shared";
import {
  MAX_EMPTY_CONTENT_RESEND,
  OPENROUTER_EMPTY_AFTER_RESEND,
} from "@/lib/llm/openrouter-retry";
import { parseGenerationTimeMs, parseReasoningTokens } from "@/lib/llm/llm-debug";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_STREAM_FETCH_TIMEOUT_MS = 90_000;

export type OpenRouterStreamCallbacks = {
  onReasoning?: (fullReasoning: string) => void;
  onContent?: (fullContent: string) => void;
};

function resolveReasoningEffort(
  input: OpenRouterChatOptions["reasoning_effort"],
): "high" | "xhigh" | "off" {
  const fromEnv = process.env.OPENROUTER_REASONING_EFFORT?.trim().toLowerCase();
  if (fromEnv === "off" || fromEnv === "0" || fromEnv === "false") return "off";
  if (fromEnv === "xhigh") return "xhigh";
  if (input === "off") return "off";
  if (input === "xhigh") return "xhigh";
  if (input === "high") return "high";
  return "high";
}

function extractReasoningDelta(delta: Record<string, unknown> | undefined): string {
  if (!delta) return "";
  if (typeof delta.reasoning === "string") return delta.reasoning;
  const details = delta.reasoning_details;
  if (Array.isArray(details)) {
    return details
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          if (typeof o.text === "string") return o.text;
          if (typeof o.content === "string") return o.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function parseSseJsonBlocks(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const events: string[] = [];
  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (payload && payload !== "[DONE]") events.push(payload);
  }
  return { events, rest };
}

function resolveStreamProviderBody(options: OpenRouterChatOptions): Record<string, unknown> | undefined {
  if (options.provider) return options.provider;
  const locked = options.locked_provider?.trim();
  return openRouterProviderExtras(locked ? { lockedProvider: locked } : undefined);
}

/**
 * Stream OpenRouter chat completions; accumulates reasoning + content deltas.
 */
export async function openRouterChatCompletionStream(
  options: OpenRouterChatOptions,
  callbacks: OpenRouterStreamCallbacks,
): Promise<OpenRouterCompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("missing_openrouter_api_key");

  const candidates = resolveOpenRouterCandidateOrder();
  let fell_back = false;

  const result = await callWithRetryAndFallback(
    async (model) => {
      if (model !== candidates[0]) fell_back = true;
      return openRouterChatCompletionStreamWithModel(model, options, callbacks, apiKey);
    },
    { maxAttempts: options.max_attempts },
  );

  return {
    ...result,
    transport: {
      attempt: result.transport?.attempt ?? 1,
      retried: result.transport?.retried ?? false,
      fell_back: fell_back || Boolean(result.transport?.fell_back),
    },
  };
}

async function openRouterChatCompletionStreamWithModel(
  model: string,
  options: OpenRouterChatOptions,
  callbacks: OpenRouterStreamCallbacks,
  apiKey: string,
): Promise<OpenRouterCompletionResult> {
  const effort = resolveReasoningEffort(options.reasoning_effort);
  const includeReasoning = effort !== "off";
  const routePath = options.route_path ?? "chat";
  const lockedLabel = options.locked_provider?.trim() || null;

  const buildBody = (): Record<string, unknown> => {
    const extras = openRouterRequestExtras(options.session_id);
    const provider = resolveStreamProviderBody(options);
    if (provider) extras.provider = provider;
    const body: Record<string, unknown> = {
      model,
      stream: true,
      messages: options.messages,
      temperature: options.temperature ?? 0.55,
      max_tokens: options.max_tokens ?? 4096,
      ...(options.json_mode ? { response_format: { type: "json_object" } } : {}),
      ...(includeReasoning ? { reasoning: { effort } } : {}),
      ...extras,
    };
    logOpenRouterRequestRouting(body, {
      call_type: options.call_type,
      phase_name: options.phase_name,
    });
    return body;
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim();
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;

  async function runOnce() {
    const timeoutMs = options.timeout_ms ?? OPENROUTER_STREAM_FETCH_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(buildBody()),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errText = await res.text();
        logOpenRouterModelSlug404Hint(model, res.status, errText);
        if (isOpenRouterModelNotFoundHttpStatus(res.status, errText)) {
          markOpenRouterSlugDead(model);
        }
        throw new Error(`openrouter_stream_${res.status}: ${errText.slice(0, 900)}`);
      }
      if (!res.body) {
        throw new Error("openrouter_stream_500: no_response_body");
      }

      let reasoning = "";
      let content = "";
      let modelOut = model;
      let tokens_used = 0;
      let prompt_tokens = 0;
      let completion_tokens = 0;
      let cached_tokens = 0;
      let reasoning_tokens = 0;
      let finish_reason: string | null = null;
      let provider: string | null = null;
      let generation_id: string | null = null;
      let generation_time_ms: number | null = null;
      let buffer = "";

      reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseJsonBlocks(buffer);
        buffer = rest;

        for (const raw of events) {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (typeof parsed.model === "string") modelOut = parsed.model;
          if (typeof parsed.id === "string") generation_id = parsed.id;
          if (typeof parsed.provider === "string" && parsed.provider.trim()) {
            provider = parsed.provider.trim();
          }
          const usage = parsed.usage as Record<string, unknown> | undefined;
          if (usage) {
            if (typeof usage.total_tokens === "number") tokens_used = usage.total_tokens;
            if (typeof usage.prompt_tokens === "number") prompt_tokens = usage.prompt_tokens;
            if (typeof usage.completion_tokens === "number") completion_tokens = usage.completion_tokens;
            reasoning_tokens = parseReasoningTokens(usage);
            const details = usage.prompt_tokens_details as Record<string, unknown> | undefined;
            if (details && typeof details.cached_tokens === "number") {
              cached_tokens = details.cached_tokens;
            } else if (typeof usage.native_tokens_cached === "number") {
              cached_tokens = usage.native_tokens_cached;
            }
          }
          const genMs = parseGenerationTimeMs(parsed);
          if (genMs != null) generation_time_ms = genMs;

          const choice = (parsed.choices as Array<Record<string, unknown>> | undefined)?.[0];
          if (choice && typeof choice.finish_reason === "string") {
            finish_reason = choice.finish_reason;
          }
          const delta = choice?.delta as Record<string, unknown> | undefined;
          const message = choice?.message as Record<string, unknown> | undefined;

          const rDelta = extractReasoningDelta(delta);
          if (rDelta) {
            reasoning += rDelta;
            callbacks.onReasoning?.(reasoning);
          } else if (message && typeof message.reasoning === "string") {
            reasoning = message.reasoning;
            callbacks.onReasoning?.(reasoning);
          }

          const cDelta = typeof delta?.content === "string" ? delta.content : "";
          if (cDelta) {
            content += cDelta;
            callbacks.onContent?.(content);
          }
        }
      }

      return {
        text: content.trim(),
        model: modelOut,
        tokens_used,
        prompt_tokens,
        completion_tokens,
        cached_tokens,
        reasoning_tokens,
        finish_reason,
        provider,
        reasoning: reasoning.trim() || undefined,
        generation_id,
        generation_time_ms,
        transport: {
          attempt: 1,
          retried: false,
          fell_back: false,
        },
      };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        if (options.signal?.aborted) {
          const err = new Error("AbortError");
          err.name = "AbortError";
          throw err;
        }
        throw new Error("llm_timeout");
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", onAbort);
      reader?.releaseLock();
    }
  }

  // Same slug / same params — invisible resend when stream finishes with empty content.
  let result: OpenRouterCompletionResult | null = null;
  for (let attempt = 1; attempt <= MAX_EMPTY_CONTENT_RESEND; attempt++) {
    const once = await runOnce();
    once.transport = {
      attempt,
      retried: attempt > 1,
      fell_back: false,
    };
    if (once.text.trim()) {
      result = once;
      break;
    }
    console.info(
      `[openrouter] empty stream content, invisible resend ${attempt}/${MAX_EMPTY_CONTENT_RESEND} (same params)`,
      JSON.stringify({
        model,
        provider: once.provider ?? "—",
        finish_reason: once.finish_reason ?? "—",
        has_reasoning: Boolean(once.reasoning),
        reasoning_tokens: once.reasoning_tokens,
      }),
    );
  }
  if (!result) {
    throw new Error(OPENROUTER_EMPTY_AFTER_RESEND);
  }
  logOpenRouterProviderServed({
    provider: result.provider,
    finish_reason: result.finish_reason,
    cached_tokens: result.cached_tokens,
    prompt_tokens: result.prompt_tokens,
    completion_tokens: result.completion_tokens,
    session_id: options.session_id,
    call_type: options.call_type,
    phase_name: options.phase_name,
    reasoning: includeReasoning ? "on" : "off",
    path: routePath,
    locked: lockedLabel,
    attempt: result.transport?.attempt ?? 1,
  });
  return result;
}

export type StreamProxyMessage = OpenRouterChatMessage;

export function buildOpenRouterMessages(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): StreamProxyMessage[] {
  return [{ role: "system", content: system }, ...messages];
}

export type OpenRouterStreamInput = {
  system: string;
  user: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  session_id?: string;
  signal?: AbortSignal;
  onChunk: (chunk: string) => Promise<void> | void;
  onDone: () => Promise<void> | void;
  onError: (error: string) => Promise<void> | void;
};

/**
 * Stream OpenRouter chat completions — content deltas only (no reasoning_content).
 * Used by base_analysis KV + SSE pipeline.
 */
export async function openRouterStream(input: OpenRouterStreamInput): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    await input.onError("OPENROUTER_API_KEY not set");
    return;
  }

  const fixedModel = input.model?.trim();
  const runWithModel = async (model: string): Promise<void> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    const referer = process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://easternos.com";
    const title = process.env.OPENROUTER_APP_TITLE?.trim() || "Eastern OS";
    headers["HTTP-Referer"] = referer;
    headers["X-Title"] = title;

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: input.max_tokens ?? 8000,
        temperature: input.temperature ?? 0.7,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        ...openRouterRequestExtras(input.session_id),
      }),
      signal: input.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      logOpenRouterModelSlug404Hint(model, response.status, errText);
      if (isOpenRouterModelNotFoundHttpStatus(response.status, errText)) {
        markOpenRouterSlugDead(model);
        throw new Error(`openrouter_stream_${response.status}: ${errText.slice(0, 900)}`);
      }
      const msg = `OpenRouter ${response.status}: ${errText.slice(0, 900)}`;
      await input.onError(msg);
      throw new Error(msg);
    }

    if (!response.body) {
      const msg = "Response body is null";
      await input.onError(msg);
      throw new Error(msg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            await input.onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              await input.onChunk(content);
            }
          } catch {
            console.warn("[openrouter-stream] parse chunk failed:", data.slice(0, 100));
          }
        }
      }

      await input.onDone();
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        console.log("[openrouter-stream] aborted");
        return;
      }
      throw e;
    } finally {
      reader.releaseLock();
    }
  };

  try {
    if (fixedModel) {
      try {
        await runWithModel(fixedModel);
        return;
      } catch (e) {
        if (!isOpenRouterModelNotFoundError(e)) throw e;
      }
    }
    await callWithRetryAndFallback(runWithModel);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.startsWith("openrouter_stream_")) {
      throw e;
    }
    await input.onError(e instanceof Error ? e.message : "Stream error");
  }
}

export { getOpenRouterDefaultModel };
