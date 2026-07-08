import {
  callWithOpenRouterModelFallback,
  getOpenRouterDefaultModel,
  isOpenRouterModelNotFoundHttpStatus,
  logOpenRouterModelSlug404Hint,
  logOpenRouterProviderServed,
  logOpenRouterRequestRouting,
  markOpenRouterSlugDead,
  openRouterProviderExtras,
  openRouterRequestExtras,
  type OpenRouterChatMessage,
  type OpenRouterChatOptions,
  type OpenRouterCompletionResult,
} from "@/lib/llm/openrouter-shared";
import { withOpenRouterExponentialBackoff } from "@/lib/llm/openrouter-retry";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

  return callWithOpenRouterModelFallback((model) =>
    openRouterChatCompletionStreamWithModel(model, options, callbacks, apiKey),
  );
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
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(buildBody()),
      signal: options.signal,
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
    let finish_reason: string | null = null;
    let provider: string | null = null;
    let buffer = "";

    const reader = res.body.getReader();
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
        if (typeof parsed.provider === "string" && parsed.provider.trim()) {
          provider = parsed.provider.trim();
        }
        const usage = parsed.usage as Record<string, unknown> | undefined;
        if (usage) {
          if (typeof usage.total_tokens === "number") tokens_used = usage.total_tokens;
          if (typeof usage.prompt_tokens === "number") prompt_tokens = usage.prompt_tokens;
          if (typeof usage.completion_tokens === "number") completion_tokens = usage.completion_tokens;
          const details = usage.prompt_tokens_details as Record<string, unknown> | undefined;
          if (details && typeof details.cached_tokens === "number") {
            cached_tokens = details.cached_tokens;
          } else if (typeof usage.native_tokens_cached === "number") {
            cached_tokens = usage.native_tokens_cached;
          }
        }

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
      finish_reason,
      provider,
      reasoning: reasoning.trim() || undefined,
    };
  }

  let transportAttempt = 1;
  const result = await withOpenRouterExponentialBackoff(runOnce, {
    signal: options.signal,
    onRetry: (info) => {
      transportAttempt = info.attempt + 1;
      console.warn(
        `[openrouter-stream] retry attempt=${info.attempt} wait_ms=${info.wait_ms} locked=${lockedLabel ?? "none"} model=${model}`,
      );
    },
  });
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
    attempt: transportAttempt,
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
    const referer = process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://pojulife.com";
    const title = process.env.OPENROUTER_APP_TITLE?.trim() || "Pojulife";
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
      await runWithModel(fixedModel);
      return;
    }
    await callWithOpenRouterModelFallback(runWithModel);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.startsWith("openrouter_stream_")) {
      throw e;
    }
    await input.onError(e instanceof Error ? e.message : "Stream error");
  }
}

export { getOpenRouterDefaultModel };
