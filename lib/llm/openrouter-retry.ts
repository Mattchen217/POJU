/** Backoff delays after each failed attempt (ms): 1s → 3s → 6s → 5s (~15s total). */
export const OPENROUTER_RETRY_DELAYS_MS = [1000, 3000, 6000, 5000] as const;

export const OPENROUTER_MAX_ATTEMPTS = OPENROUTER_RETRY_DELAYS_MS.length + 1;

export function isRetryableOpenRouterHttpStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
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

/** Streamlake / provider endpoint temporarily unavailable — same slug+provider retry. */
export function isTransientNoEndpoints404(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = parseOpenRouterErrorStatus(error.message);
  if (status !== 404) return false;
  const msg = openRouterErrorBody(error);
  return (
    msg.includes("no endpoints") ||
    msg.includes("no endpoint found") ||
    msg.includes("no allowed providers")
  );
}

export function isRetryableOpenRouterError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (isTransientNoEndpoints404(error)) return true;
  if (error.message === "llm_timeout") return true;
  const status = parseOpenRouterErrorStatus(error.message);
  if (status != null) return isRetryableOpenRouterHttpStatus(status);
  if (error.name === "TypeError") return true;
  return false;
}

export class OpenRouterProviderQueueError extends Error {
  constructor(message = "openrouter_provider_queue") {
    super(message);
    this.name = "OpenRouterProviderQueueError";
  }
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
 * Retry OpenRouter calls on 429/503/5xx, transient No-endpoints 404, and network timeouts.
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
          isRetryableOpenRouterError(error)
        ) {
          throw new OpenRouterProviderQueueError();
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
