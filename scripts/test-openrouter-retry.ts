/**
 * OpenRouter exponential backoff retry helper.
 *
 *   pnpm exec tsx scripts/test-openrouter-retry.ts
 */
import {
  OPENROUTER_MAX_ATTEMPTS,
  OPENROUTER_RETRY_DELAYS_MS,
  OpenRouterProviderQueueError,
  isRetryableOpenRouterError,
  isRetryableOpenRouterHttpStatus,
  withOpenRouterExponentialBackoff,
} from "@/lib/llm/openrouter-retry";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

console.log("\n=== OpenRouter retry helper ===\n");

assert("429 retryable", isRetryableOpenRouterHttpStatus(429));
assert("503 retryable", isRetryableOpenRouterHttpStatus(503));
assert("502 retryable", isRetryableOpenRouterHttpStatus(502));
assert("400 not retryable", !isRetryableOpenRouterHttpStatus(400));
assert("delays 1s/3s/6s", OPENROUTER_RETRY_DELAYS_MS.join(",") === "1000,3000,6000");
assert("4 total attempts", OPENROUTER_MAX_ATTEMPTS === 4);
assert(
  "http error retryable",
  isRetryableOpenRouterError(new Error("openrouter_http_503: busy")),
);
assert(
  "stream error retryable",
  isRetryableOpenRouterError(new Error("openrouter_stream_429: rate limit")),
);
assert("timeout retryable", isRetryableOpenRouterError(new Error("llm_timeout")));
assert(
  "400 not retryable",
  !isRetryableOpenRouterError(new Error("openrouter_http_400: bad request")),
);

(async () => {
  let calls = 0;
  const retries: number[] = [];
  try {
    await withOpenRouterExponentialBackoff(
      async () => {
        calls++;
        throw new Error("openrouter_http_503: busy");
      },
      {
        onRetry: (info) => {
          retries.push(info.wait_ms);
        },
      },
    );
  } catch (e) {
    assert("throws queue error", e instanceof OpenRouterProviderQueueError);
  }
  assert("called 4 times", calls === 4);
  assert("backoff waits", retries.join(",") === "1000,3000,6000");
})().then(() => {
  console.log(process.exitCode === 1 ? "\nSome checks failed.\n" : "\nAll checks passed.\n");
});
