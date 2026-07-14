/**
 * Block 70 — transient No-endpoints 404 retry (streamlake lock, same slug)
 *
 *   pnpm exec tsx scripts/test-poju-block70-transient-404-retry.ts
 */
import {
  callWithRetryAndFallback,
  isOpenRouterModelNotFoundError,
  isOpenRouterModelNotFoundHttpStatus,
  resetOpenRouterModelResolverForTests,
} from "@/lib/llm/openrouter-model-resolver";
import {
  OPENROUTER_MAX_ATTEMPTS,
  OPENROUTER_RETRY_DELAYS_MS,
  OpenRouterProviderQueueError,
  isRetryableOpenRouterError,
  isTransientNoEndpoints404,
  withOpenRouterExponentialBackoff,
} from "@/lib/llm/openrouter-retry";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const transient404 = new Error(
  "openrouter_http_404: No endpoints found for deepseek/deepseek-v4-pro",
);
const slug404 = new Error("openrouter_http_404: model not found for this slug");

async function main(): Promise<void> {
  console.log("\n=== Block 70 — transient 404 retry ===\n");

  assert("transient 404 detected", isTransientNoEndpoints404(transient404));
  assert("transient 404 is retryable", isRetryableOpenRouterError(transient404));
  assert("slug 404 not transient", !isTransientNoEndpoints404(slug404));
  assert("slug 404 not retryable", !isRetryableOpenRouterError(slug404));
  assert("slug 404 is model-not-found", isOpenRouterModelNotFoundError(slug404));
  assert(
    "transient 404 not model-not-found",
    !isOpenRouterModelNotFoundError(transient404),
  );
  assert(
    "http status transient no endpoints",
    !isOpenRouterModelNotFoundHttpStatus(404, "No endpoints found for provider"),
  );
  assert(
    "http status slug error",
    isOpenRouterModelNotFoundHttpStatus(404, "model not found"),
  );
  assert("5 total attempts", OPENROUTER_MAX_ATTEMPTS === 5);
  assert("delays ~15s", OPENROUTER_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) === 15000);

  let calls = 0;
  await withOpenRouterExponentialBackoff(async () => {
    calls++;
    if (calls < 3) throw transient404;
    return "ok";
  });
  assert("transient 404 retries then succeeds", calls === 3);

  let exhausted = 0;
  try {
    await withOpenRouterExponentialBackoff(async () => {
      exhausted++;
      throw transient404;
    });
  } catch (e) {
    assert("exhausted throws queue error", e instanceof OpenRouterProviderQueueError);
  }
  assert("exhausted tried all attempts", exhausted === OPENROUTER_MAX_ATTEMPTS);

  resetOpenRouterModelResolverForTests();
  const slugAttempts = new Map<string, number>();
  try {
    await callWithRetryAndFallback(async (model) => {
      slugAttempts.set(model, (slugAttempts.get(model) ?? 0) + 1);
      throw slug404;
    });
  } catch {
    // expected
  }
  const maxPerSlug = Math.max(0, ...slugAttempts.values());
  assert("slug error no retry on same slug", maxPerSlug === 1);

  resetOpenRouterModelResolverForTests();
  let sameModel = "";
  let fallbackCalls = 0;
  await callWithRetryAndFallback(async (model) => {
    sameModel = model;
    fallbackCalls++;
    if (fallbackCalls < 2) throw transient404;
    return model;
  });
  assert("same slug on retry", fallbackCalls === 2 && Boolean(sameModel));

  resetOpenRouterModelResolverForTests();
  let queueThrown = false;
  let exhaustedCalls = 0;
  try {
    await callWithRetryAndFallback(async () => {
      exhaustedCalls++;
      throw transient404;
    });
  } catch (e) {
    queueThrown = e instanceof OpenRouterProviderQueueError;
  }
  assert("transient exhaustion → provider queue", queueThrown);
  assert("transient exhaustion tried maxAttempts", exhaustedCalls === OPENROUTER_MAX_ATTEMPTS);

  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
