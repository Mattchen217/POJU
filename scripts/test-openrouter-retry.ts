/**
 * OpenRouter exponential backoff retry helper.
 *
 *   pnpm exec tsx scripts/test-openrouter-retry.ts
 */
import {
  OPENROUTER_MAX_ATTEMPTS,
  OPENROUTER_RETRY_DELAYS_MS,
  OpenRouterProviderQueueError,
  isNonRetryableOpenRouterError,
  isRetryableOpenRouterError,
  isRetryableOpenRouterHttpStatus,
  isTransientNetworkError,
  isTransientProviderHttp400,
  withOpenRouterExponentialBackoff,
} from "@/lib/llm/openrouter-retry";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

console.log("\n=== OpenRouter retry helper ===\n");

assert("429 retryable", isRetryableOpenRouterHttpStatus(429));
assert("408 retryable", isRetryableOpenRouterHttpStatus(408));
assert("503 retryable", isRetryableOpenRouterHttpStatus(503));
assert("502 retryable", isRetryableOpenRouterHttpStatus(502));
assert("400 status alone not retryable", !isRetryableOpenRouterHttpStatus(400));
assert("delays 1s/3s/6s/5s", OPENROUTER_RETRY_DELAYS_MS.join(",") === "1000,3000,6000,5000");
assert("5 total attempts", OPENROUTER_MAX_ATTEMPTS === 5);
assert(
  "transient no-endpoints 404 retryable",
  isRetryableOpenRouterError(new Error("openrouter_http_404: No endpoints found")),
);
assert(
  "model not found 404 not retryable",
  !isRetryableOpenRouterError(new Error("openrouter_http_404: model not found")),
);
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
  "generic 400 not retryable",
  !isRetryableOpenRouterError(new Error("openrouter_http_400: bad request")),
);
assert(
  "Provider returned error 400 retryable",
  isTransientProviderHttp400(
    new Error('openrouter_http_400: {"error":{"message":"Provider returned error","code":400}}'),
  ),
);
assert(
  "UnaccessibleUser 400 retryable",
  isRetryableOpenRouterError(
    new Error(
      "openrouter_http_400: Provider returned error UnaccessibleUser code = Unavailable",
    ),
  ),
);
assert(
  "overloaded 400 retryable",
  isRetryableOpenRouterError(new Error("openrouter_http_400: upstream overloaded, try again")),
);
assert(
  "fetch failed network retryable",
  isTransientNetworkError(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } })),
);
assert(
  "econnreset message retryable",
  isRetryableOpenRouterError(new Error("read ECONNRESET")),
);
assert(
  "401 not retryable",
  isNonRetryableOpenRouterError(new Error("openrouter_http_401: Invalid credentials")),
);
assert(
  "402 not retryable",
  !isRetryableOpenRouterError(new Error("openrouter_http_402: insufficient credits")),
);
assert(
  "context length not retryable",
  !isRetryableOpenRouterError(
    new Error("openrouter_http_400: context_length_exceeded this model's maximum context length"),
  ),
);
assert(
  "AbortError not retryable",
  !isRetryableOpenRouterError(Object.assign(new Error("Aborted"), { name: "AbortError" })),
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
  assert("called 5 times", calls === 5);
  assert("backoff waits", retries.join(",") === "1000,3000,6000,5000");

  let uaCalls = 0;
  try {
    await withOpenRouterExponentialBackoff(async () => {
      uaCalls++;
      if (uaCalls < 3) {
        throw new Error(
          "openrouter_http_400: Provider returned error UnaccessibleUser Unavailable",
        );
      }
      return "ok";
    });
    assert("UnaccessibleUser recovers after retry", uaCalls === 3);
  } catch {
    assert("UnaccessibleUser recovers after retry", false);
  }

  let netCalls = 0;
  try {
    await withOpenRouterExponentialBackoff(async () => {
      netCalls++;
      if (netCalls < 2) throw new TypeError("fetch failed");
      return "ok";
    });
    assert("network jitter recovers after retry", netCalls === 2);
  } catch {
    assert("network jitter recovers after retry", false);
  }
})().then(() => {
  console.log(process.exitCode === 1 ? "\nSome checks failed.\n" : "\nAll checks passed.\n");
});
