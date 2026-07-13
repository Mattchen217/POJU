/**
 * Block 68 — OpenRouter multi-slug 404 auto-fallback
 *
 *   pnpm exec tsx scripts/test-poju-block68-openrouter-fallback.ts
 */
import {
  callWithOpenRouterModelFallback,
  getOpenRouterDefaultModel,
  getOpenRouterPreferredModel,
  isOpenRouterModelNotFoundError,
  markOpenRouterSlugDead,
  markOpenRouterSlugPreferred,
  OPENROUTER_MODEL_CANDIDATES_BUILTIN,
  resetOpenRouterModelResolverForTests,
  resolveOpenRouterCandidateOrder,
} from "@/lib/llm/openrouter-model-resolver";

const ENV_FALLBACK = "deepseek/deepseek-v4-pro-env-fallback-test";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main(): Promise<void> {
  console.log("\n=== Block 68 — OpenRouter model fallback ===\n");

  const prevEnv = process.env.OPENROUTER_MODEL;
  process.env.OPENROUTER_MODEL = ENV_FALLBACK;

  try {
    resetOpenRouterModelResolverForTests();

    assert("built-in has live slug", OPENROUTER_MODEL_CANDIDATES_BUILTIN[0] === "deepseek/deepseek-v4-pro");
    assert(
      "resolve order includes env + built-in",
      resolveOpenRouterCandidateOrder().includes(ENV_FALLBACK) &&
        resolveOpenRouterCandidateOrder().includes(OPENROUTER_MODEL_CANDIDATES_BUILTIN[0]!),
    );
    assert(
      "getOpenRouterDefaultModel is first candidate",
      getOpenRouterDefaultModel() === resolveOpenRouterCandidateOrder()[0],
    );

    const errSlug = new Error("openrouter_http_404: model not found for slug");
    assert("detects slug 404 error", isOpenRouterModelNotFoundError(errSlug));
    assert(
      "no-endpoints 404 not slug error",
      !isOpenRouterModelNotFoundError(
        new Error("openrouter_http_404: No endpoints found for provider"),
      ),
    );

    let callCount = 0;
    const result = await callWithOpenRouterModelFallback(async (model) => {
      callCount++;
      if (model === ENV_FALLBACK) {
        throw errSlug;
      }
      return { ok: true, model };
    });
    assert(
      "fallback to built-in candidate",
      callCount === 2 && (result as { model: string }).model === OPENROUTER_MODEL_CANDIDATES_BUILTIN[0],
    );
    assert(
      "preferred set after success",
      getOpenRouterPreferredModel() === OPENROUTER_MODEL_CANDIDATES_BUILTIN[0],
    );

    resetOpenRouterModelResolverForTests();
    process.env.OPENROUTER_MODEL = ENV_FALLBACK;
    markOpenRouterSlugPreferred(OPENROUTER_MODEL_CANDIDATES_BUILTIN[0]!);
    assert(
      "preferred slug ordered first",
      resolveOpenRouterCandidateOrder()[0] === OPENROUTER_MODEL_CANDIDATES_BUILTIN[0],
    );

    resetOpenRouterModelResolverForTests();
    process.env.OPENROUTER_MODEL = ENV_FALLBACK;
    markOpenRouterSlugDead(ENV_FALLBACK);
    const order = resolveOpenRouterCandidateOrder();
    assert("dead env slug skipped in order", !order.includes(ENV_FALLBACK), order.join(","));
  } finally {
    if (prevEnv === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = prevEnv;
    resetOpenRouterModelResolverForTests();
  }

  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
