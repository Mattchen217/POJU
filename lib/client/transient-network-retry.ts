/**
 * Bounded client retries for transient browser/network disconnects
 * (ERR_CONNECTION_CLOSED, Failed to fetch, mid-flight socket drops).
 *
 * Intentional AbortSignal cancels and permanent auth failures are not retried.
 * Callers keep local progress outside `fn` so hops / session state survive retries.
 */

export const TRANSIENT_NETWORK_MAX_ATTEMPTS = 3;

/** Backoff before attempt 2 and 3 (ms). */
export const TRANSIENT_NETWORK_BACKOFF_MS = [400, 1200] as const;

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === "string"
          ? error.cause
          : error.cause && typeof error.cause === "object" && "message" in error.cause
            ? String((error.cause as { message?: unknown }).message ?? "")
            : "";
    return `${error.name} ${error.message} ${cause}`.toLowerCase();
  }
  if (typeof error === "string") return error.toLowerCase();
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "").toLowerCase();
  }
  return "";
}

/** True when the browser aborted via AbortController (user cancel / our timeout). */
export function isIntentionalAbortError(error: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) return true;
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return true;
  const text = errorText(error);
  return text.includes("aborterror") || text.includes("the operation was aborted");
}

/**
 * Transient disconnect / fetch failure safe to retry once or twice.
 * Does not treat intentional AbortError as transient.
 */
export function isTransientNetworkDisconnect(
  error: unknown,
  signal?: AbortSignal | null,
): boolean {
  if (isIntentionalAbortError(error, signal)) return false;

  const text = errorText(error);
  if (!text && !(error instanceof TypeError)) return false;

  // Supabase AuthRetryableFetchError (status 0) and similar
  if (error && typeof error === "object") {
    const status = (error as { status?: unknown }).status;
    const name = String((error as { name?: unknown }).name ?? "");
    if (name.includes("RetryableFetch") || name.includes("AuthRetryableFetch")) return true;
    if (status === 0 && /fetch|network|connection|load failed/i.test(text || name)) return true;
  }

  if (error instanceof TypeError) {
    // Chromium / Safari: Failed to fetch, Load failed, NetworkError
    if (
      /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(
        text,
      )
    ) {
      return true;
    }
    // Bare TypeError from undici/fetch often means transport failure
    if (!text.trim() || text === "typeerror") return true;
  }

  return (
    text.includes("err_connection_closed") ||
    text.includes("err_connection_reset") ||
    text.includes("err_connection_refused") ||
    text.includes("err_network_changed") ||
    text.includes("err_internet_disconnected") ||
    text.includes("err_empty_response") ||
    text.includes("connection closed") ||
    text.includes("connection reset") ||
    text.includes("failed to fetch") ||
    text.includes("fetch failed") ||
    text.includes("networkerror") ||
    text.includes("network request failed") ||
    text.includes("load failed") ||
    text.includes("socket hang up") ||
    text.includes("econnreset") ||
    text.includes("econnrefused") ||
    text.includes("etimedout") ||
    text.includes("other side closed") ||
    text.includes("client network socket disconnected")
  );
}

export type TransientNetworkRetryOptions = {
  maxAttempts?: number;
  signal?: AbortSignal | null;
  /** Called before sleeping for the next attempt (attempt is the failed one, 1-based). */
  onRetry?: (info: {
    attempt: number;
    maxAttempts: number;
    error: unknown;
    delayMs: number;
  }) => void;
  sleep?: (ms: number, signal?: AbortSignal | null) => Promise<void>;
};

function defaultSleep(ms: number, signal?: AbortSignal | null): Promise<void> {
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

/**
 * Run `fn` with bounded retries on transient network disconnects.
 * Progress/session state must live outside `fn` so retries do not reset it.
 */
export async function withTransientNetworkRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: TransientNetworkRetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? TRANSIENT_NETWORK_MAX_ATTEMPTS);
  const signal = options.signal ?? null;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      const err = new Error("AbortError");
      err.name = "AbortError";
      throw err;
    }
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < maxAttempts && isTransientNetworkDisconnect(error, signal);
      if (!canRetry) throw error;

      const delayMs =
        TRANSIENT_NETWORK_BACKOFF_MS[
          Math.min(attempt - 1, TRANSIENT_NETWORK_BACKOFF_MS.length - 1)
        ] ?? 400;
      options.onRetry?.({ attempt, maxAttempts, error, delayMs });
      await sleep(delayMs, signal);
    }
  }
  throw lastError;
}

/**
 * Whether a Supabase auth.getUser() error result is a transient transport failure
 * (retry), vs a permanent auth outcome (session missing / invalid JWT — do not
 * hide as success).
 */
export function isTransientAuthFetchError(error: unknown): boolean {
  if (!error) return false;
  if (isTransientNetworkDisconnect(error)) return true;
  if (typeof error !== "object") return false;
  const e = error as { name?: string; status?: number; message?: string; code?: string };
  if (e.name?.includes("RetryableFetch")) return true;
  if (e.status === 0) return true;
  const msg = String(e.message ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("err_connection") ||
    msg.includes("connection closed") ||
    msg.includes("network")
  );
}
