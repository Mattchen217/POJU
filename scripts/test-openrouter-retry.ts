/**
 * OpenRouter exponential backoff retry helper + queue/degrade classifier.
 *
 *   pnpm exec tsx scripts/test-openrouter-retry.ts
 */
import {
  OPENROUTER_MAX_ATTEMPTS,
  OPENROUTER_RETRY_AFTER_CAP_MS,
  OPENROUTER_RETRY_DELAYS_MS,
  OpenRouterHttpError,
  OpenRouterProviderQueueError,
  computeOpenRouterBackoffMs,
  decideOpenRouterDegrade,
  isNonRetryableOpenRouterError,
  isProviderQueueClassError,
  isRetryableOpenRouterError,
  isRetryableOpenRouterHttpStatus,
  isTransientNetworkError,
  isTransientProviderHttp400,
  parseRetryAfterMs,
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

console.log("\n=== Retry-After / backoff ===\n");

assert("parseRetryAfter seconds", parseRetryAfterMs("12") === 12_000);
assert("parseRetryAfter empty null", parseRetryAfterMs("") == null);
assert("parseRetryAfter junk null", parseRetryAfterMs("nope") == null);

const http429 = new OpenRouterHttpError("http", 429, "rate limit", { retryAfterMs: 8_000 });
assert("OpenRouterHttpError message parseable", http429.message.startsWith("openrouter_http_429:"));
assert(
  "backoff respects Retry-After over schedule",
  computeOpenRouterBackoffMs(0, http429) === 8_000,
);
const huge = new OpenRouterHttpError("stream", 429, "busy", { retryAfterMs: 120_000 });
assert(
  "backoff caps Retry-After",
  computeOpenRouterBackoffMs(0, huge) === OPENROUTER_RETRY_AFTER_CAP_MS,
);
const tiny = new OpenRouterHttpError("http", 503, "busy", { retryAfterMs: 50 });
assert(
  "backoff floors tiny Retry-After via schedule",
  computeOpenRouterBackoffMs(0, tiny) === OPENROUTER_RETRY_DELAYS_MS[0],
);
const plain429 = new Error("openrouter_http_429: rate limit");
assert(
  "429 without Retry-After gets mild bump",
  computeOpenRouterBackoffMs(0, plain429) === Math.round(OPENROUTER_RETRY_DELAYS_MS[0]! * 1.5),
);
assert(
  "503 is queue-class",
  isProviderQueueClassError(new OpenRouterHttpError("http", 503, "unavailable")),
);

console.log("\n=== Degrade decision ===\n");

const retryDec = decideOpenRouterDegrade({
  error: new OpenRouterHttpError("http", 429, "busy", { retryAfterMs: 5_000 }),
  attemptIndex: 0,
  maxAttempts: 2,
  hasNextCandidate: true,
});
assert("decide retry on first 429", retryDec.action === "retry");
if (retryDec.action === "retry") {
  assert("decide retry wait uses Retry-After", retryDec.wait_ms === 5_000);
}

const fallbackDec = decideOpenRouterDegrade({
  error: new OpenRouterHttpError("http", 429, "busy"),
  attemptIndex: 1,
  maxAttempts: 2,
  hasNextCandidate: true,
});
assert("decide fallback_model after slug budget", fallbackDec.action === "fallback_model");
if (fallbackDec.action === "fallback_model") {
  assert(
    "fallback reason queue_exhausted",
    fallbackDec.reason === "queue_exhausted_try_next_slug",
  );
}

const queueDec = decideOpenRouterDegrade({
  error: new OpenRouterHttpError("http", 503, "busy"),
  attemptIndex: 1,
  maxAttempts: 2,
  hasNextCandidate: false,
});
assert("decide throw_queue when no candidates", queueDec.action === "throw_queue");

const permDec = decideOpenRouterDegrade({
  error: new Error("openrouter_http_401: Invalid credentials"),
  attemptIndex: 0,
  maxAttempts: 5,
  hasNextCandidate: true,
});
assert("decide throw on permanent auth", permDec.action === "throw");

const timeoutDec = decideOpenRouterDegrade({
  error: new Error("llm_timeout"),
  attemptIndex: 0,
  maxAttempts: 5,
  hasNextCandidate: true,
});
assert("decide throw on llm_timeout (never queue)", timeoutDec.action === "throw");

const noEp = decideOpenRouterDegrade({
  error: new Error("openrouter_http_404: No endpoints found"),
  attemptIndex: 4,
  maxAttempts: 5,
  hasNextCandidate: true,
});
assert("decide fallback on no-endpoints exhausted", noEp.action === "fallback_model");
if (noEp.action === "fallback_model") {
  assert("no-endpoints reason", noEp.reason === "no_endpoints_exhausted");
}

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
  // 503 gets 1.5x schedule bump when no Retry-After
  const expected = OPENROUTER_RETRY_DELAYS_MS.map((d) => Math.round(d * 1.5));
  assert("backoff waits (503 bump)", retries.join(",") === expected.join(","));

  let raCalls = 0;
  const raWaits: number[] = [];
  try {
    await withOpenRouterExponentialBackoff(
      async () => {
        raCalls++;
        if (raCalls < 2) {
          throw new OpenRouterHttpError("http", 429, "rate limit", { retryAfterMs: 2_500 });
        }
        return "ok";
      },
      {
        onRetry: (info) => {
          raWaits.push(info.wait_ms);
        },
      },
    );
    assert("Retry-After recovers", raCalls === 2);
    assert("Retry-After wait used", raWaits[0] === Math.max(OPENROUTER_RETRY_DELAYS_MS[0]!, 2_500));
  } catch {
    assert("Retry-After recovers", false);
  }

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
