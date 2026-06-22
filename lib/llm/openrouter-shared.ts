/**
 * OpenRouter (OpenAI-compatible) chat completions.
 *
 * Env:
 * - OPENROUTER_API_KEY — required to use this path
 * - OPENROUTER_MODEL — default `deepseek/deepseek-v4-pro` (dev: single model per product decision)
 * - OPENROUTER_REASONING_EFFORT — `high` | `xhigh` | `off` (default `high` = deep reasoning where supported)
 * - OPENROUTER_PROVIDER_ORDER — comma-separated provider slugs in priority order (e.g. `baidu/fp8,streamlake,siliconflow/fp8`)
 * - OPENROUTER_PROVIDER_IGNORE — comma-separated providers to skip (merged with ORDER)
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
  /** Observability / session affinity — does NOT pin upstream supplier for DeepSeek prefix cache. */
  session_id?: string;
  /** Router call_type — for cache observability logs. */
  call_type?: string;
  /** POJU phase name — for cache observability logs. */
  phase_name?: string;
  /** Provider routing — `provider.order` via OPENROUTER_PROVIDER_ORDER (+ allow_fallbacks: false). */
  provider?: Record<string, unknown>;
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

/**
 * OpenRouter provider routing extras.
 *
 * `session_id` in the request body does NOT sticky-route to one upstream — DeepSeek prefix cache
 * is per supplier. Pin with `OPENROUTER_PROVIDER_ORDER` → `provider.order` + `allow_fallbacks: false`
 * (tries each slug in order; never drifts to unlisted providers). `OPENROUTER_PROVIDER_IGNORE` merges as `ignore`.
 */
export function openRouterProviderExtras(options?: {
  require_parameters?: boolean;
  /** One-off ignore slugs merged with OPENROUTER_PROVIDER_IGNORE (e.g. retry after bad provider). */
  extra_ignore?: string[];
}): Record<string, unknown> | undefined {
  const order = parseProviderOrder();
  const ignore = parseProviderIgnore();
  if (options?.extra_ignore?.length) {
    for (const slug of options.extra_ignore) {
      const s = slug.trim();
      if (s && !ignore.includes(s)) ignore.push(s);
    }
  }
  const out: Record<string, unknown> = {};

  if (options?.require_parameters) {
    out.require_parameters = true;
  }

  if (order.length > 0) {
    out.order = order;
    out.allow_fallbacks = false;
  }

  if (ignore.length > 0) {
    out.ignore = ignore;
    if (order.length === 0) {
      out.allow_fallbacks = true;
    }
  }

  if (Object.keys(out).length === 0) return undefined;
  return out;
}

export function openRouterRequestExtras(
  session_id?: string,
  opts?: { require_parameters?: boolean; extra_ignore?: string[] },
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  if (session_id?.trim()) extras.session_id = session_id.trim();
  const provider = openRouterProviderExtras(opts);
  if (provider) extras.provider = provider;
  return extras;
}

/** Match served provider name (e.g. `Baidu`) against order slug (e.g. `baidu/fp8`). */
export function providerMatchesOrderEntry(served: string, orderSlug: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  const s = norm(served);
  const o = norm(orderSlug);
  if (!s || !o) return false;
  if (s === o) return true;
  const sBase = s.split("/")[0]!;
  const oBase = o.split("/")[0]!;
  return sBase === oBase || s.includes(oBase) || o.includes(sBase);
}

export function servedProviderInOrder(served: string | null | undefined): boolean {
  if (!served?.trim()) return true;
  const order = parseProviderOrder();
  if (order.length === 0) return true;
  return order.some((slug) => providerMatchesOrderEntry(served, slug));
}

/** Ensure JSON calls carry require_parameters when merging explicit provider overrides. */
export function mergeJsonProviderConstraints(
  provider: Record<string, unknown>,
  json_mode?: boolean,
): Record<string, unknown> {
  if (!json_mode) return provider;
  if (provider.require_parameters === true) return provider;
  return { ...provider, require_parameters: true };
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

/** Log prefix-cache metrics (DeepSeek TTL is minute-level — misses after long gaps are expected). */
export function logOpenRouterPrefixCacheMetrics(meta: {
  cached_tokens: number;
  prompt_tokens: number;
  session_id?: string;
  call_type?: string;
  phase_name?: string;
  provider?: string | null;
}): void {
  const ratio =
    meta.prompt_tokens > 0 ? (meta.cached_tokens / meta.prompt_tokens).toFixed(3) : "0.000";
  const phase = meta.phase_name ?? meta.call_type ?? "—";
  const hit = meta.cached_tokens > 0 ? "HIT" : "miss";
  console.log(
    `[openrouter] prefix cache ${hit}: cached=${meta.cached_tokens} prompt=${meta.prompt_tokens} ratio=${ratio} phase=${phase} provider=${meta.provider ?? "—"} session=${meta.session_id ?? "—"}`,
  );
}

let warnedMissingProviderOrder = false;

/** Warn once per process when supplier order env is missing. */
export function warnIfProviderNotPinned(): void {
  if (warnedMissingProviderOrder || !isOpenRouterConfigured()) return;
  if (parseProviderOrder().length > 0) return;
  warnedMissingProviderOrder = true;
  console.warn(
    "[openrouter] OPENROUTER_PROVIDER_ORDER is not set — OpenRouter may rotate suppliers (e.g. NextBit) and prefix cache will miss. Set provider.order via env.",
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

/** Log actual served provider vs configured order (stream + non-stream). */
export function logOpenRouterProviderServed(meta: {
  provider?: string | null;
  finish_reason?: string | null;
  cached_tokens?: number;
  call_type?: string;
  phase_name?: string;
}): void {
  const order = parseProviderOrder();
  const served = meta.provider?.trim() || "—";
  const orderLabel = order.length > 0 ? `[${order.join(",")}]` : "[]";
  const phase = meta.phase_name ?? meta.call_type ?? "—";
  console.log(
    `[openrouter] provider served: order=${orderLabel} → served=${served} finish=${meta.finish_reason ?? "—"} cached=${meta.cached_tokens ?? 0} phase=${phase}`,
  );
  if (order.length > 0 && served !== "—" && !servedProviderInOrder(served)) {
    console.warn(
      `[openrouter] served provider "${served}" not in OPENROUTER_PROVIDER_ORDER (${order.join(",")}) — slug may be misspelled or order was bypassed`,
    );
  }
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
  /** Normalized finish reason from OpenRouter (stop | length | …). */
  finish_reason?: string | null;
  /** Upstream provider slug when returned by OpenRouter (e.g. Novita, DeepSeek). */
  provider?: string | null;
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
    if (options.session_id?.trim()) {
      body.session_id = options.session_id.trim();
    }
    if (options.provider) {
      body.provider = mergeJsonProviderConstraints(options.provider, options.json_mode);
    } else {
      const provider = openRouterProviderExtras({ require_parameters: Boolean(options.json_mode) });
      if (provider) body.provider = provider;
    }
    if (options.json_mode) {
      body.response_format = { type: "json_object" };
    }
    if (includeReasoning && effort !== "off") {
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
  const maxJsonAttempts = 3;
  let data: {
    provider?: string;
    model?: string;
    choices?: Array<{
      finish_reason?: string | null;
      native_finish_reason?: string | null;
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
  } | undefined;

  for (let attempt = 0; attempt < maxJsonAttempts; attempt++) {
    let res: Response;
    let raw: string;
    ({ res, raw } = await post(buildBody(includeReasoning)));

    if (!res.ok && includeReasoning) {
      console.warn(
        "[openrouter] Request failed with reasoning; retrying without reasoning parameter:",
        raw.slice(0, 200),
      );
      includeReasoning = false;
      ({ res, raw } = await post(buildBody(false)));
    }

    if (!res.ok) {
      throw new Error(`openrouter_http_${res.status}: ${raw.slice(0, 900)}`);
    }

    try {
      data = JSON.parse(raw) as typeof data;
      break;
    } catch {
      const snippet = raw.slice(0, 400).replace(/\s+/g, " ").trim();
      if (attempt + 1 < maxJsonAttempts) {
        console.warn(
          `[openrouter] Invalid JSON envelope (attempt ${attempt + 1}/${maxJsonAttempts}), retrying:`,
          snippet,
        );
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      console.error("[openrouter] Invalid JSON envelope after retries:", snippet);
      throw new Error("openrouter_invalid_json_response");
    }
  }

  if (!data) {
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
  const tokens_used =
    typeof u?.total_tokens === "number" ? u.total_tokens : prompt_tokens + completion_tokens;

  logOpenRouterPrefixCacheMetrics({
    cached_tokens,
    prompt_tokens,
    session_id: options.session_id,
    call_type: options.call_type,
    phase_name: options.phase_name,
    provider,
  });
  logOpenRouterProviderServed({
    provider,
    finish_reason,
    cached_tokens,
    call_type: options.call_type,
    phase_name: options.phase_name,
  });

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
    finish_reason,
    provider,
    reasoning,
    reasoning_details: message?.reasoning_details,
  };
}
