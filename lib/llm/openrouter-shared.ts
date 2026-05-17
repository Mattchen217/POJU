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

export type OpenRouterChatOptions = {
  messages: OpenRouterChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /** When true, sets response_format json_object (still instruct JSON in prompts). */
  json_mode?: boolean;
  reasoning_effort?: "high" | "xhigh" | "off";
};

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function getOpenRouterDefaultModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || "deepseek/deepseek-v4-pro";
}

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

export type OpenRouterCompletionResult = {
  text: string;
  model: string;
  tokens_used: number;
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

  async function post(body: Record<string, unknown>) {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    return { res, raw };
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
  const tokens_used =
    typeof u?.total_tokens === "number"
      ? u.total_tokens
      : (typeof u?.prompt_tokens === "number" ? u.prompt_tokens : 0) +
        (typeof u?.completion_tokens === "number" ? u.completion_tokens : 0);

  const reasoning =
    typeof message?.reasoning === "string" && message.reasoning.trim()
      ? message.reasoning.trim()
      : undefined;

  return {
    text,
    model: modelOut,
    tokens_used,
    reasoning,
    reasoning_details: message?.reasoning_details,
  };
}
