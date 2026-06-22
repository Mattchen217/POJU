import {
  getOpenRouterDefaultModel,
  logOpenRouterPrefixCacheMetrics,
  openRouterRequestExtras,
  type OpenRouterChatMessage,
  type OpenRouterChatOptions,
  type OpenRouterCompletionResult,
} from "@/lib/llm/openrouter-shared";

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

/**
 * Stream OpenRouter chat completions; accumulates reasoning + content deltas.
 */
export async function openRouterChatCompletionStream(
  options: OpenRouterChatOptions,
  callbacks: OpenRouterStreamCallbacks,
): Promise<OpenRouterCompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("missing_openrouter_api_key");

  const model = getOpenRouterDefaultModel();
  const effort = resolveReasoningEffort(options.reasoning_effort);

  const buildBody = (includeReasoning: boolean): Record<string, unknown> => ({
    model,
    stream: true,
    messages: options.messages,
    temperature: options.temperature ?? 0.55,
    max_tokens: options.max_tokens ?? 4096,
    ...(options.json_mode ? { response_format: { type: "json_object" } } : {}),
    ...(includeReasoning && effort !== "off" ? { reasoning: { effort } } : {}),
    ...openRouterRequestExtras(options.session_id),
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim();
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;

  async function run(includeReasoning: boolean) {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(buildBody(includeReasoning)),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false as const, status: res.status, errText };
    }
    if (!res.body) {
      return { ok: false as const, status: 500, errText: "no_response_body" };
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
      ok: true as const,
      result: {
        text: content.trim(),
        model: modelOut,
        tokens_used,
        prompt_tokens,
        completion_tokens,
        cached_tokens,
        finish_reason,
        provider,
        reasoning: reasoning.trim() || undefined,
      },
    };
  }

  let includeReasoning = effort !== "off";
  let out = await run(includeReasoning);
  if (!out.ok && includeReasoning) {
    console.warn("[openrouter-stream] Retrying without reasoning:", out.errText.slice(0, 200));
    includeReasoning = false;
    out = await run(false);
  }
  if (!out.ok) {
    throw new Error(`openrouter_stream_${out.status}: ${out.errText.slice(0, 900)}`);
  }
  logOpenRouterPrefixCacheMetrics({
    cached_tokens: out.result.cached_tokens,
    prompt_tokens: out.result.prompt_tokens,
    session_id: options.session_id,
    call_type: options.call_type,
    phase_name: options.phase_name,
  });
  return out.result;
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

  const model = input.model ?? getOpenRouterDefaultModel();
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
    await input.onError(`OpenRouter ${response.status}: ${errText.slice(0, 900)}`);
    return;
  }

  if (!response.body) {
    await input.onError("Response body is null");
    return;
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
    await input.onError(e instanceof Error ? e.message : "Stream error");
  } finally {
    reader.releaseLock();
  }
}
