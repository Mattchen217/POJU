import type { SyncroLlmHoursInput } from "@/lib/syncro/syncro-llm-batch-core";
import { runStreamHours } from "@/lib/syncro/streaming-hours-runner";
import type { StreamHourCallbacks, StreamErrorPayload } from "@/lib/syncro/streaming-runner";
import type { StreamHourAdviceByKey } from "@/lib/syncro/streaming-runner";

const MAX_ATTEMPTS = 3;

export interface RunStreamHoursWithRetryResult {
  success: boolean;
  advice?: StreamHourAdviceByKey;
  fromCache?: boolean;
  attempts: number;
  lastError?: string;
}

export async function runStreamHoursWithRetry(
  body: SyncroLlmHoursInput,
  callbacks: StreamHourCallbacks,
  options: {
    signal?: AbortSignal;
    onAttemptStart?: (attempt: number, maxAttempts: number) => void;
    maxAttempts?: number;
  } = {},
): Promise<RunStreamHoursWithRetryResult> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  let lastError = "";
  let lastErrorRetryable = true;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.signal?.aborted) {
      return { success: false, attempts: attempt - 1, lastError: "aborted" };
    }

    options.onAttemptStart?.(attempt, maxAttempts);

    let advice: StreamHourAdviceByKey | undefined;
    let fromCache = false;
    let completed = false;
    const attemptState: { error: StreamErrorPayload | null } = { error: null };

    await runStreamHours(body, {
      onProgress: callbacks.onProgress,
      onReasoningChunk: callbacks.onReasoningChunk,
      onContentChunk: callbacks.onContentChunk,
      onComplete: (a, fc) => {
        advice = a;
        fromCache = fc;
        completed = true;
        callbacks.onComplete?.(a, fc);
      },
      onError: (err) => {
        attemptState.error = err;
      },
    }, { signal: options.signal });

    if (completed && advice) {
      return { success: true, advice, fromCache, attempts: attempt };
    }

    const attemptError = attemptState.error;
    if (attemptError) {
      lastError = attemptError.error || "unknown";
      lastErrorRetryable = Boolean(attemptError.retryable);
      if (!lastErrorRetryable) {
        callbacks.onError?.(attemptError);
        return { success: false, attempts: attempt, lastError };
      }
    } else {
      lastError = "unknown_no_result";
    }

    if (attempt < maxAttempts) {
      const waitMs = 1500 * Math.pow(2, attempt - 1);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, waitMs);
        options.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
      if (options.signal?.aborted) {
        return { success: false, attempts: attempt, lastError: "aborted" };
      }
    }
  }

  callbacks.onError?.({
    error: lastError,
    retryable: lastErrorRetryable,
    detail: `Failed after ${maxAttempts} attempts`,
  });

  return { success: false, attempts: maxAttempts, lastError };
}
