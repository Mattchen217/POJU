/**
 * Mid-stream slow-throughput detector for delivery OpenRouter streams.
 * Abort early so the same invoke (or next DAG attempt) can provider-escape
 * instead of burning the full 270s wall at ~10 tok/s.
 */

/** Wait this long before judging speed (avoid false abort on cold start). */
export const SLOW_STREAM_MIN_ELAPSED_MS = 60_000;

/** Need enough visible content before measuring rate. */
export const SLOW_STREAM_MIN_CONTENT_CHARS = 80;

/**
 * Floor on streamed content chars/sec.
 * CJK delivery JSON ≈ 1 char ≈ 1 token order-of-magnitude;
 * 15 chars/s ≈ healthy floor above the ~10 tok/s stall class.
 */
export const SLOW_STREAM_MIN_CHARS_PER_SEC = 15;

export function shouldAbortSlowStream(input: {
  elapsed_ms: number;
  content_chars: number;
  min_elapsed_ms?: number;
  min_chars?: number;
  min_chars_per_sec?: number;
}): boolean {
  const minElapsed = input.min_elapsed_ms ?? SLOW_STREAM_MIN_ELAPSED_MS;
  const minChars = input.min_chars ?? SLOW_STREAM_MIN_CONTENT_CHARS;
  const minCps = input.min_chars_per_sec ?? SLOW_STREAM_MIN_CHARS_PER_SEC;
  if (input.elapsed_ms < minElapsed) return false;
  if (input.content_chars < minChars) return false;
  const cps = input.content_chars / (input.elapsed_ms / 1000);
  return cps < minCps;
}
