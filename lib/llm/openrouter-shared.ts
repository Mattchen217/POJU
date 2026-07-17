/**
 * OpenRouter (OpenAI-compatible) chat completions.
 *
 * Env:
 * - OPENROUTER_API_KEY — required to use this path
 * - OPENROUTER_MODEL — optional override (first in candidate pool)
 * - OPENROUTER_REASONING_EFFORT — `high` | `xhigh` | `off` (default `high`)
 * - OPENROUTER_PROVIDER_ORDER — comma-separated provider slugs (production: `streamlake`)
 * - OPENROUTER_PROVIDER_IGNORE — comma-separated providers to skip (merged with ORDER)
 * - OPENROUTER_HTTP_REFERER, OPENROUTER_APP_TITLE — optional OpenRouter attribution headers
 */

import {
  MAX_EMPTY_CONTENT_RESEND,
  OPENROUTER_EMPTY_AFTER_RESEND,
  OpenRouterProviderQueueError,
  isEmptyResponseError,
} from "@/lib/llm/openrouter-retry";
import {
  openRouterProviderExtras,
  servedProviderInOrder,
  type OpenRouterRoutePath,
} from "@/lib/llm/openrouter-provider-routing";

export { OpenRouterProviderQueueError, isEmptyResponseError, MAX_EMPTY_CONTENT_RESEND } from "@/lib/llm/openrouter-retry";

export {
  openRouterProviderExtras,
  providerMatchesOrderEntry,
  servedProviderInOrder,
  normalizeProviderSlugForLock,
  resolveSessionLockedProvider,
  isProviderEscapeHttpStatus,
  type OpenRouterRoutePath,
} from "@/lib/llm/openrouter-provider-routing";

import {
  callWithOpenRouterModelFallback,
  callWithRetryAndFallback,
  isOpenRouterModelNotFoundHttpStatus,
  markOpenRouterSlugDead,
  resolveOpenRouterCandidateOrder,
} from "@/lib/llm/openrouter-model-resolver";
import { parseGenerationTimeMs, parseReasoningTokens } from "@/lib/llm/llm-debug";

export {
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterDefaultModel,
  OPENROUTER_MODEL_CANDIDATES_BUILTIN,
  resolveOpenRouterCandidateOrder,
  callWithOpenRouterModelFallback,
  callWithRetryAndFallback,
  isOpenRouterModelNotFoundError,
  isOpenRouterModelNotFoundHttpStatus,
  markOpenRouterSlugPreferred,
  markOpenRouterSlugDead,
  resetOpenRouterModelResolverForTests,
} from "@/lib/llm/openrouter-model-resolver";

export {
  isTransientNoEndpoints404,
  parseOpenRouterErrorStatus,
} from "@/lib/llm/openrouter-retry";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Log when OpenRouter returns 404 — triggers model slug fallback in caller. */
export function logOpenRouterModelSlug404Hint(model: string, httpStatus: number, body = ""): void {
  if (httpStatus !== 404) return;
  if (isOpenRouterModelNotFoundHttpStatus(httpStatus, body)) {
    console.warn(
      `[openrouter] HTTP 404 model endpoint (model=${model}) — will try next candidate if available.`,
    );
    return;
  }
  console.error(`[openrouter] HTTP 404 (model=${model}): ${body.slice(0, 200)}`);
}

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
  /** Per-slug OpenRouter transport retries (default OPENROUTER_MAX_ATTEMPTS). */
  max_attempts?: number;
  /** Observability / session affinity — does NOT pin upstream supplier for DeepSeek prefix cache. */
  session_id?: string;
  /** Router call_type — for cache observability logs. */
  call_type?: string;
  /** POJU phase name — for cache observability logs. */
  phase_name?: string;
  /** Explicit provider routing override (normally built from locked_provider + ORDER). */
  provider?: Record<string, unknown>;
  /** `chat` = multi-turn session lock; `once` = full ORDER each call. */
  route_path?: OpenRouterRoutePath;
  /** Session-pinned supplier slug (chat path). */
  locked_provider?: string | null;
  signal?: AbortSignal;
};

export function parseProviderOrder(): string[] {
  const raw = process.env.OPENROUTER_PROVIDER_ORDER?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseProviderIgnore(): string[] {
  const raw = process.env.OPENROUTER_PROVIDER_IGNORE?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function openRouterRequestExtras(
  session_id?: string,
  opts?: { lockedProvider?: string; extra_ignore?: string[] },
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  if (session_id?.trim()) extras.session_id = session_id.trim();
  const provider = openRouterProviderExtras(opts);
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

function resolveProviderBody(options: OpenRouterChatOptions): Record<string, unknown> | undefined {
  if (options.provider) return options.provider;
  const locked = options.locked_provider?.trim();
  return openRouterProviderExtras(locked ? { lockedProvider: locked } : undefined);
}

/** Log prefix-cache metrics — delegates to {@link logOpenRouterProviderServed}. */
export function logOpenRouterPrefixCacheMetrics(meta: {
  cached_tokens: number;
  prompt_tokens: number;
  completion_tokens?: number;
  session_id?: string;
  call_type?: string;
  phase_name?: string;
  provider?: string | null;
  finish_reason?: string | null;
  reasoning?: "on" | "off";
  path?: OpenRouterRoutePath;
  locked?: string | null;
  attempt?: number;
}): void {
  logOpenRouterProviderServed(meta);
}

/** Log actual served provider + token stats (stream + non-stream). */
export function logOpenRouterProviderServed(meta: {
  provider?: string | null;
  finish_reason?: string | null;
  cached_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  session_id?: string;
  call_type?: string;
  phase_name?: string;
  reasoning?: "on" | "off";
  path?: OpenRouterRoutePath;
  locked?: string | null;
  attempt?: number;
}): void {
  const served = meta.provider?.trim() || "—";
  const locked = meta.locked?.trim() || "none";
  const path = meta.path ?? "—";
  const promptTokens = meta.prompt_tokens ?? 0;
  const cachedTokens = meta.cached_tokens ?? 0;
  const cacheRatio =
    promptTokens > 0 ? (cachedTokens / promptTokens).toFixed(3) : "—";
  console.log(
    `[openrouter] path=${path} locked=${locked} served=${served} finish=${meta.finish_reason ?? "—"} prompt=${promptTokens} cached=${cachedTokens} cache_ratio=${cacheRatio} attempt=${meta.attempt ?? 1}`,
  );
  const order = parseProviderOrder();
  if (order.length > 0 && served !== "—" && !servedProviderInOrder(served)) {
    console.warn(
      `[openrouter] served provider "${served}" not in OPENROUTER_PROVIDER_ORDER (${order.join(",")}) — slug may be misspelled or order was bypassed`,
    );
  }
}

let warnedMissingProviderOrder = false;

/** Warn once per process when supplier order env is missing. */
export function warnIfProviderNotPinned(): void {
  if (warnedMissingProviderOrder || !isOpenRouterConfigured()) return;
  if (parseProviderOrder().length > 0) return;
  warnedMissingProviderOrder = true;
  console.warn(
    "[openrouter] OPENROUTER_PROVIDER_ORDER is not set — OpenRouter may rotate suppliers and prefix cache will miss. Set provider.order via env.",
  );
}

/** Log outbound provider routing constraints (verify allow_fallbacks:false when pinned). */
export function logOpenRouterRequestRouting(
  body: Record<string, unknown>,
  meta?: { call_type?: string; phase_name?: string },
): void {
  warnIfProviderNotPinned();
  const provider = body.provider;
  const phase = meta?.phase_name ?? meta?.call_type ?? "—";
  if (!provider || typeof provider !== "object") {
    console.warn(`[openrouter] request routing: no provider constraints (phase=${phase})`);
    return;
  }
  console.log(`[openrouter] request routing: ${JSON.stringify(provider)} phase=${phase}`);
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
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
  reasoning_tokens: number;
  finish_reason?: string | null;
  provider?: string | null;
  reasoning?: string;
  reasoning_details?: unknown;
  generation_id?: string | null;
  generation_time_ms?: number | null;
  transport?: {
    attempt: number;
    retried: boolean;
    fell_back: boolean;
  };
};

export async function openRouterChatCompletion(
  options: OpenRouterChatOptions,
): Promise<OpenRouterCompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("missing_openrouter_api_key");
  }

  const candidates = resolveOpenRouterCandidateOrder();
  let fell_back = false;

  const result = await callWithRetryAndFallback(
    async (model) => {
      if (model !== candidates[0]) fell_back = true;
      return openRouterChatCompletionWithModel(model, options, apiKey);
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

async function openRouterChatCompletionWithModel(
  model: string,
  options: OpenRouterChatOptions,
  apiKey: string,
): Promise<OpenRouterCompletionResult> {
  const effort = resolveReasoningEffort(options.reasoning_effort);
  const includeReasoning = effort !== "off";
  const routePath = options.route_path ?? "once";
  const lockedLabel = options.locked_provider?.trim() || null;

  const buildBody = (): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.55,
      max_tokens: options.max_tokens ?? 4096,
    };
    if (options.session_id?.trim()) {
      body.session_id = options.session_id.trim();
    }
    const provider = resolveProviderBody(options);
    if (provider) body.provider = provider;
    if (options.json_mode) {
      body.response_format = { type: "json_object" };
    }
    if (includeReasoning) {
      body.reasoning = { effort };
    }
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
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://pojulife.com";
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "Pojulife";
  headers["HTTP-Referer"] = referer;
  headers["X-Title"] = title;

  const timeoutMs = options.timeout_ms ?? OPENROUTER_FETCH_TIMEOUT_MS;

  async function postOnce() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(buildBody()),
        signal: controller.signal,
      });
      const raw = await res.text();
      if (!res.ok) {
        logOpenRouterModelSlug404Hint(model, res.status, raw);
        if (isOpenRouterModelNotFoundHttpStatus(res.status, raw)) {
          markOpenRouterSlugDead(model);
        }
        throw new Error(`openrouter_http_${res.status}: ${raw.slice(0, 900)}`);
      }
      return raw;
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
    }
  }

  type ParsedEnvelope = {
    id?: string;
    provider?: string;
    model?: string;
    choices?: Array<{
      finish_reason?: string | null;
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
      completion_tokens_details?: { reasoning_tokens?: number };
      native_tokens_cached?: number;
      native_tokens_reasoning?: number;
      reasoning_tokens?: number;
      generation_time?: number;
    };
  };

  // Same slug / same body / same effort — invisible resend when billed empty content.
  for (let attempt = 1; attempt <= MAX_EMPTY_CONTENT_RESEND; attempt++) {
    const raw = await postOnce();

    if (!raw || !raw.trim()) {
      console.info(
        `[openrouter] empty HTTP body, invisible resend ${attempt}/${MAX_EMPTY_CONTENT_RESEND} (same params)`,
      );
      continue;
    }

    let data: ParsedEnvelope;
    try {
      data = JSON.parse(raw) as ParsedEnvelope;
    } catch {
      const snippet = raw.slice(0, 400).replace(/\s+/g, " ").trim();
      console.error("[openrouter] Invalid JSON envelope:", snippet);
      throw new Error("openrouter_invalid_json_response");
    }

    const message = data.choices?.[0]?.message;
    const text = String(message?.content ?? "").trim();
    const modelOut = typeof data.model === "string" ? data.model : model;
    const finish_reason = data.choices?.[0]?.finish_reason ?? null;
    const provider =
      typeof data.provider === "string" && data.provider.trim() ? data.provider.trim() : null;
    const u = data.usage;
    const prompt_tokens = typeof u?.prompt_tokens === "number" ? u.prompt_tokens : 0;
    const completion_tokens = typeof u?.completion_tokens === "number" ? u.completion_tokens : 0;
    const cached_tokens = parseCachedTokens(u as Record<string, unknown> | undefined);
    const reasoning_tokens = parseReasoningTokens(u as Record<string, unknown> | undefined);
    const tokens_used =
      typeof u?.total_tokens === "number" ? u.total_tokens : prompt_tokens + completion_tokens;
    const generation_id = typeof data.id === "string" ? data.id : null;
    const generation_time_ms = parseGenerationTimeMs(data as Record<string, unknown>);
    const reasoning =
      typeof message?.reasoning === "string" && message.reasoning.trim()
        ? message.reasoning.trim()
        : undefined;

    logOpenRouterProviderServed({
      provider,
      finish_reason,
      cached_tokens,
      prompt_tokens,
      completion_tokens,
      session_id: options.session_id,
      call_type: options.call_type,
      phase_name: options.phase_name,
      reasoning: includeReasoning ? "on" : "off",
      path: routePath,
      locked: lockedLabel,
      attempt,
    });

    if (text) {
      return {
        text,
        model: modelOut,
        tokens_used,
        prompt_tokens,
        completion_tokens,
        cached_tokens,
        reasoning_tokens,
        finish_reason,
        provider,
        reasoning,
        reasoning_details: message?.reasoning_details,
        generation_id,
        generation_time_ms,
        transport: {
          attempt,
          retried: attempt > 1,
          fell_back: false,
        },
      };
    }

    // Billed call with reasoning but no user-visible content — slug is fine; same-param resend.
    console.info(
      `[openrouter] empty content, invisible resend ${attempt}/${MAX_EMPTY_CONTENT_RESEND} (same params)`,
      JSON.stringify({
        model,
        provider: provider ?? "—",
        finish_reason: finish_reason ?? "—",
        has_reasoning: Boolean(reasoning),
        reasoning_tokens,
        completion_tokens,
      }),
    );
  }

  throw new Error(OPENROUTER_EMPTY_AFTER_RESEND);
}
