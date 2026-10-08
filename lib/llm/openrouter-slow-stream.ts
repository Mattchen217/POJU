/**
 * Mid-stream slow-throughput detector for delivery OpenRouter streams.
 * Abort early so the same invoke (or next DAG attempt) can provider-escape
 * instead of burning the full wall at ~10 tok/s.
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

/** Need this much reasoning before judging a stuck loop. */
export const REASONING_LOOP_MIN_CHARS = 400;

/** Same trailing unit must repeat at least this many times consecutively. */
export const REASONING_LOOP_MIN_CONSECUTIVE = 6;

/**
 * Detect reasoning death-spirals (e.g. repeating「用「被」，一个字。」for thousands of tokens).
 * Not a provider outage — model CoT stuck — but same ops response: abort → supply escape / new invoke.
 */
export function shouldAbortReasoningLoop(
  reasoning: string,
  opts?: { min_chars?: number; min_consecutive?: number },
): boolean {
  const minChars = opts?.min_chars ?? REASONING_LOOP_MIN_CHARS;
  const minConsecutive = opts?.min_consecutive ?? REASONING_LOOP_MIN_CONSECUTIVE;
  if (reasoning.length < minChars) return false;
  const tail = reasoning.slice(-Math.min(1200, reasoning.length));
  for (let len = 8; len <= 64; len++) {
    if (tail.length < len * minConsecutive) continue;
    const unit = tail.slice(-len);
    if (unit.trim().length < 6) continue;
    let count = 1;
    let pos = tail.length - len;
    while (pos - len >= 0 && tail.slice(pos - len, pos) === unit) {
      count += 1;
      pos -= len;
      if (count >= minConsecutive) return true;
    }
  }
  return false;
}
