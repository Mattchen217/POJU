import {
  runStreamHour,
  type StreamHourAdviceByKey,
  type StreamHourBody,
  type StreamHourCallbacks,
  type StreamErrorPayload,
} from "./streaming-runner";

const MAX_ATTEMPTS = 3;

export interface RunWithRetryOptions {
  maxAttempts?: number;
  signal?: AbortSignal;
  onAttemptStart?: (attempt: number, maxAttempts: number) => void;
}

export interface RunWithRetryResult {
  success: boolean;
  advice?: StreamHourAdviceByKey;
  fromCache?: boolean;
  attempts: number;
  lastError?: string;
}

type AttemptOutcome = {
  advice?: StreamHourAdviceByKey;
  fromCache: boolean;
  error: StreamErrorPayload | null;
};

/**
 * Wraps runStreamHour with exponential backoff retries (default 3 attempts).
 * Server-side output cache may short-circuit on later attempts (fromCache=true).
 */
export async function runStreamHourWithRetry(
  body: StreamHourBody,
  callbacks: StreamHourCallbacks,
  options: RunWithRetryOptions = {},
): Promise<RunWithRetryResult> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;

  let lastError = "";
  let lastErrorRetryable = true;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.signal?.aborted) {
      return {
        success: false,
        attempts: attempt - 1,
        lastError: "aborted",
      };
    }

    options.onAttemptStart?.(attempt, maxAttempts);
    console.log(`[syncro-stream-runner] ${body.hour_id} attempt ${attempt}/${maxAttempts}`);

    const outcome: AttemptOutcome = { fromCache: false, error: null };

    await runStreamHour(
      body,
      {
        onProgress: callbacks.onProgress,
        onReasoningChunk: callbacks.onReasoningChunk,
        onContentChunk: callbacks.onContentChunk,
        onComplete: (a, fc) => {
          outcome.advice = a;
          outcome.fromCache = fc;
          callbacks.onComplete?.(a, fc);
        },
        onError: (err) => {
          outcome.error = err;
        },
      },
      { signal: options.signal },
    );

    if (outcome.advice) {
      console.log(`[syncro-stream-runner] ✅ ${body.hour_id} success on attempt ${attempt}`);
      return {
        success: true,
        advice: outcome.advice,
        fromCache: outcome.fromCache,
        attempts: attempt,
      };
    }

    const attemptError = outcome.error;
    if (attemptError) {
      lastError = attemptError.error || "unknown";
      lastErrorRetryable = Boolean(attemptError.retryable);

      console.warn(
        `[syncro-stream-runner] ⚠️ ${body.hour_id} attempt ${attempt} failed:`,
        lastError,
      );

      if (!lastErrorRetryable) {
        console.error(`[syncro-stream-runner] ❌ ${body.hour_id} non-retryable, stopping`);
        callbacks.onError?.(attemptError);
        return {
          success: false,
          attempts: attempt,
          lastError,
        };
      }
    } else {
      lastError = "unknown_no_result";
      lastErrorRetryable = true;
      console.warn(
        `[syncro-stream-runner] ⚠️ ${body.hour_id} attempt ${attempt} ended without result`,
      );
    }

    if (attempt < maxAttempts) {
      const waitMs = 1500 * Math.pow(2, attempt - 1);
      console.log(`[syncro-stream-runner] ${body.hour_id} waiting ${waitMs}ms before retry`);

      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, waitMs);
        options.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });

      if (options.signal?.aborted) {
        return {
          success: false,
          attempts: attempt,
          lastError: "aborted",
        };
      }
    }
  }

  console.error(
    `[syncro-stream-runner] ❌❌ ${body.hour_id} all ${maxAttempts} attempts failed: ${lastError}`,
  );
  callbacks.onError?.({
    error: lastError,
    retryable: lastErrorRetryable,
    detail: `Failed after ${maxAttempts} attempts`,
  });

  return {
    success: false,
    attempts: maxAttempts,
    lastError,
  };
}
