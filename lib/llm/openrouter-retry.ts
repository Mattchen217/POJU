/** Backoff delays after each failed attempt (ms): 1s → 3s → 6s → 5s (~15s total). */
export const OPENROUTER_RETRY_DELAYS_MS = [1000, 3000, 6000, 5000] as const;

export const OPENROUTER_MAX_ATTEMPTS = OPENROUTER_RETRY_DELAYS_MS.length + 1;

/**
 * Same-slug / same-params invisible resends when the model returns billed empty content
 * (reasoning only) or an empty HTTP body. Never mark slug dead / never switch candidates.
 */
export const MAX_EMPTY_CONTENT_RESEND = 3;

export const OPENROUTER_EMPTY_RESPONSE = "openrouter_empty_response";
export const OPENROUTER_EMPTY_AFTER_RESEND = "openrouter_empty_after_resend";

/** True for empty-body / empty-content (slug is fine — do not degrade candidates). */
export function isEmptyResponseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message === OPENROUTER_EMPTY_RESPONSE ||
    error.message === OPENROUTER_EMPTY_AFTER_RESEND
  );
}

/** HTTP statuses that are always transport-retryable (supplier / edge blips). */
export function isRetryableOpenRouterHttpStatus(status: number): boolean {
  return (
    status === 408 || // request timeout
    status === 425 || // too early
    status === 429 || // rate limit
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status >= 500
  );
}

export function parseOpenRouterErrorStatus(message: string): number | null {
  const match = message.match(/^openrouter_(?:http|stream)_(\d{3}):/);
  if (!match) return null;
  const status = Number(match[1]);
  return Number.isFinite(status) ? status : null;
}

function openRouterErrorBody(error: Error): string {
  const sep = error.message.indexOf(": ");
  return (sep >= 0 ? error.message.slice(sep + 2) : error.message).toLowerCase();
}

function errorText(error: Error): string {
  const parts = [error.name, error.message];
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    parts.push(cause.name, cause.message);
    const code = (cause as Error & { code?: unknown }).code;
    if (typeof code === "string") parts.push(code);
  }
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === "string") parts.push(code);
  return parts.join(" ").toLowerCase();
}

/** Client/auth failures — retrying the same request will not help. */
export function isNonRetryableOpenRouterError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || /aborterror/i.test(error.message)) return true;
  if (error.message === "missing_openrouter_api_key") return true;

  const status = parseOpenRouterErrorStatus(error.message);
  if (status === 401 || status === 402 || status === 403) return true;

  const msg = openRouterErrorBody(error);
  return (
    msg.includes("invalid api key") ||
    msg.includes("user not found") ||
    msg.includes("insufficient credits") ||
    msg.includes("context_length_exceeded") ||
    msg.includes("context length") ||
    msg.includes("maximum context length") ||
    msg.includes("is not a valid model") ||
    msg.includes("model not found") ||
    msg.includes("invalid_model") ||
    msg.includes("string_too_long") ||
    msg.includes("payload too large") ||
    msg.includes("moderation") ||
    msg.includes("content policy")
  );
}

/** Streamlake / provider endpoint temporarily unavailable — same slug+provider retry. */
export function isTransientNoEndpoints404(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (isNonRetryableOpenRouterError(error)) return false;
  const status = parseOpenRouterErrorStatus(error.message);
  if (status !== 404) return false;
  const msg = openRouterErrorBody(error);
  return (
    msg.includes("no endpoints") ||
    msg.includes("no endpoint found") ||
    msg.includes("no allowed providers") ||
    msg.includes("provider unavailable") ||
    msg.includes("temporarily unavailable")
  );
}

/**
 * Provider/edge blips wrapped as HTTP 400 by OpenRouter.
 * Includes StreamLake `UnaccessibleUser`, gRPC Unavailable, overloaded upstream, etc.
 * Excludes clear client malformed-request 400s.
 */
export function isTransientProviderHttp400(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (isNonRetryableOpenRouterError(error)) return false;
  const status = parseOpenRouterErrorStatus(error.message);
  if (status !== 400) return false;
  const msg = openRouterErrorBody(error);

  // OpenRouter wraps many upstream failures as 400 + this phrase.
  if (msg.includes("provider returned error")) return true;

  return (
    msg.includes("unaccessibleuser") ||
    msg.includes("unaccessible user") ||
    msg.includes("inaccessibleuser") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("capacity") ||
    msg.includes("try again") ||
    msg.includes("temporarily") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("connection reset") ||
    msg.includes("connection refused") ||
    msg.includes("econnreset") ||
    msg.includes("upstream") ||
    msg.includes("rpc error") ||
    msg.includes("code = unavailable") ||
    msg.includes("internal error") ||
    msg.includes("server error") ||
    msg.includes("bad gateway") ||
    msg.includes("gateway timeout")
  );
}

/** DNS / TCP / fetch jitter outside HTTP status codes. */
export function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (isNonRetryableOpenRouterError(error)) return false;
  if (error.name === "TypeError") return true; // undici/fetch network failures often land here
  if (error.name === "ConnectTimeoutError" || error.name === "HeadersTimeoutError") return true;
  if (error.name === "TimeoutError") return true;

  const text = errorText(error);
  return (
    text.includes("fetch failed") ||
    text.includes("network") ||
    text.includes("socket") ||
    text.includes("econnreset") ||
    text.includes("econnrefused") ||
    text.includes("etimedout") ||
    text.includes("eai_again") ||
    text.includes("enotfound") ||
    text.includes("und_err") ||
    text.includes("other side closed") ||
    text.includes("socket hang up") ||
    text.includes("client network socket disconnected")
  );
}

export function isLlmTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === "llm_timeout";
}

export class OpenRouterProviderQueueError extends Error {
  constructor(message = "openrouter_provider_queue", options?: ErrorOptions) {
    super(message, options);
    this.name = "OpenRouterProviderQueueError";
  }
}

export function isRetryableOpenRouterError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (isNonRetryableOpenRouterError(error)) return false;
  if (isTransientNoEndpoints404(error)) return true;
  if (isTransientProviderHttp400(error)) return true;
  if (isTransientNetworkError(error)) return true;
  if (isLlmTimeoutError(error)) return true;
  const status = parseOpenRouterErrorStatus(error.message);
  if (status != null) return isRetryableOpenRouterHttpStatus(status);
  return false;
}

/**
 * Fast capacity/queue errors that may escalate to `openrouter_provider_queue`.
 * NEVER includes `llm_timeout` — a long stream abort must stay llm_timeout (not mislabeled queue).
 */
export function isProviderQueueClassError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (isLlmTimeoutError(error)) return false;
  if (isNonRetryableOpenRouterError(error)) return false;
  if (error instanceof OpenRouterProviderQueueError) return true;
  if (error.message === "openrouter_provider_queue") return true;
  if (isTransientNoEndpoints404(error)) return true;
  if (isTransientProviderHttp400(error)) return true;
  if (isTransientNetworkError(error)) return true;
  const status = parseOpenRouterErrorStatus(error.message);
  if (status != null) return isRetryableOpenRouterHttpStatus(status);
  return false;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error("AbortError");
      err.name = "AbortError";
      reject(err);
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      const err = new Error("AbortError");
      err.name = "AbortError";
      reject(err);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export type OpenRouterRetryInfo = {
  attempt: number;
  wait_ms: number;
  error: unknown;
};

/**
 * Retry OpenRouter calls on supplier/network blips we cannot control:
 * 408/429/5xx, transient 404 endpoints, provider-wrapped 400, fetch/DNS/TCP jitter, timeouts.
 * Does not retry auth/credits/moderation/invalid-model/context-length/user abort.
 * After backoff retries (~15s), throws {@link OpenRouterProviderQueueError}.
 */
export async function withOpenRouterExponentialBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    onRetry?: (info: OpenRouterRetryInfo) => void | Promise<void>;
    signal?: AbortSignal;
  },
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < OPENROUTER_MAX_ATTEMPTS; attempt++) {
    if (options?.signal?.aborted) {
      const err = new Error("AbortError");
      err.name = "AbortError";
      throw err;
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < OPENROUTER_RETRY_DELAYS_MS.length && isRetryableOpenRouterError(error);
      if (!canRetry) {
        if (
          attempt >= OPENROUTER_RETRY_DELAYS_MS.length &&
          isProviderQueueClassError(error)
        ) {
          throw new OpenRouterProviderQueueError(undefined, { cause: error });
        }
        throw error;
      }

      const wait_ms = OPENROUTER_RETRY_DELAYS_MS[attempt]!;
      await options?.onRetry?.({ attempt: attempt + 1, wait_ms, error });
      await sleep(wait_ms, options?.signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
