/**
 * OpenRouter (OpenAI-compatible) chat completions.
 *
 * Env:
 * - OPENROUTER_API_KEY — required to use this path
 * - OPENROUTER_MODEL — default `deepseek/deepseek-v4-pro` (dev: single model per product decision)
 * - OPENROUTER_REASONING_EFFORT — `high` | `xhigh` | `off` (default `high` = deep reasoning where supported)
 * - OPENROUTER_HTTP_REFERER, OPENROUTER_APP_TITLE — optional OpenRouter attribution headers
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterChatRole = "system" | "user" | "assistant";

export type OpenRouterChatMessage = {
  role: OpenRouterChatRole;
  content: string;
};

const OPENROUTER_FETCH_TIMEOUT_MS = 90_000;

export type OpenRouterChatOptions = {
  messages: OpenRouterChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /** When true, sets response_format json_object (still instruct JSON in prompts). */
  json_mode?: boolean;
  reasoning_effort?: "off" | "low" | "medium" | "high" | "xhigh";
  /** Override default 90s abort (ms). */
  timeout_ms?: number;
  /** OpenRouter sticky routing — same session_id → same provider (prefix cache). */
  session_id?: string;
};

/** Provider extras: never set `order` (disables sticky routing). */
export function openRouterProviderExtras(): Record<string, unknown> | undefined {
  const ignoreRaw = process.env.OPENROUTER_PROVIDER_IGNORE?.trim();
  if (!ignoreRaw) return undefined;
  const ignore = ignoreRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ignore.length === 0) return undefined;
  return { ignore, allow_fallbacks: true };
}

export function openRouterRequestExtras(session_id?: string): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  if (session_id?.trim()) extras.session_id = session_id.trim();
  const provider = openRouterProviderExtras();
  if (provider) extras.provider = provider;
  return extras;
}

function parseCachedTokens(usage: Record<string, unknown> | undefined): number {
  if (!usage) return 0;
  const details = usage.prompt_tokens_details;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const cached = (details as Record<string, unknown>).cached_tokens;
    if (typeof cached === "number") return cached;
  }
  if (typeof usage.native_tokens_cached === "number") return usage.native_tokens_cached;
  return 0;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function getOpenRouterDefaultModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || "deepseek/deepseek-v4-pro";
}

function resolveReasoningEffort(
  input: OpenRouterChatOptions["reasoning_effort"],
): "off" | "low" | "medium" | "high" | "xhigh" {
  if (input === "off" || input === "low" || input === "medium" || input === "high" || input === "xhigh") {
    return input;
  }

  const fromEnv = process.env.OPENROUTER_REASONING_EFFORT?.trim().toLowerCase();
  if (fromEnv === "off" || fromEnv === "0" || fromEnv === "false") return "off";
  if (fromEnv === "xhigh") return "xhigh";
  if (fromEnv === "low") return "low";
  if (fromEnv === "medium") return "medium";
  if (fromEnv === "high") return "high";
  return "medium";
}

export type OpenRouterCompletionResult = {
  text: string;
  model: string;
  tokens_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  /** DeepSeek / OpenRouter reasoning tokens when `reasoning.effort` is enabled. */
  reasoning?: string;
  reasoning_details?: unknown;
};

export async function openRouterChatCompletion(
  options: OpenRouterChatOptions,
): Promise<OpenRouterCompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("missing_openrouter_api_key");
  }

  const model = getOpenRouterDefaultModel();
  const effort = resolveReasoningEffort(options.reasoning_effort);

  const buildBody = (includeReasoning: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.55,
      max_tokens: options.max_tokens ?? 4096,
      ...openRouterRequestExtras(options.session_id),
    };
    if (options.json_mode) {
      body.response_format = { type: "json_object" };
    }
    if (includeReasoning && effort !== "off") {
      body.reasoning = { effort };
    }
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

  const timeoutMs = options.timeout_ms ?? OPENROUTER_FETCH_TIMEOUT_MS;

  async function post(body: Record<string, unknown>) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await res.text();
      return { res, raw };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("llm_timeout");
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  let includeReasoning = effort !== "off";
  let { res, raw } = await post(buildBody(includeReasoning));

  if (!res.ok && includeReasoning) {
    console.warn("[openrouter] Request failed with reasoning; retrying without reasoning parameter:", raw.slice(0, 200));
    includeReasoning = false;
    ({ res, raw } = await post(buildBody(false)));
  }

  if (!res.ok) {
    throw new Error(`openrouter_http_${res.status}: ${raw.slice(0, 900)}`);
  }

  let data: {
    model?: string;
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning?: string | null;
        reasoning_details?: unknown;
      };
    }>;
    usage?: {
      total_tokens?: number;
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
      native_tokens_cached?: number;
    };
  };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error("openrouter_invalid_json_response");
  }

  const message = data.choices?.[0]?.message;
  const text = String(message?.content ?? "").trim();
  const modelOut = typeof data.model === "string" ? data.model : model;
  const u = data.usage;
  const prompt_tokens = typeof u?.prompt_tokens === "number" ? u.prompt_tokens : 0;
  const completion_tokens = typeof u?.completion_tokens === "number" ? u.completion_tokens : 0;
  const cached_tokens = parseCachedTokens(u as Record<string, unknown> | undefined);
  const tokens_used =
    typeof u?.total_tokens === "number" ? u.total_tokens : prompt_tokens + completion_tokens;

  if (cached_tokens > 0) {
    console.log(
      `[openrouter] cache hit: cached_tokens=${cached_tokens} prompt_tokens=${prompt_tokens} session=${options.session_id ?? "—"}`,
    );
  }

  const reasoning =
    typeof message?.reasoning === "string" && message.reasoning.trim()
      ? message.reasoning.trim()
      : undefined;

  return {
    text,
    model: modelOut,
    tokens_used,
    prompt_tokens,
    completion_tokens,
    cached_tokens,
    reasoning,
    reasoning_details: message?.reasoning_details,
  };
}
