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

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main(): Promise<void> {
  console.log("\n=== Block 68 — OpenRouter model fallback ===\n");

  resetOpenRouterModelResolverForTests();

  assert("built-in candidates >= 2", OPENROUTER_MODEL_CANDIDATES_BUILTIN.length >= 2);
  assert(
    "resolve order includes built-ins",
    OPENROUTER_MODEL_CANDIDATES_BUILTIN.every((c) => resolveOpenRouterCandidateOrder().includes(c)),
  );
  assert(
    "getOpenRouterDefaultModel is first candidate",
    getOpenRouterDefaultModel() === resolveOpenRouterCandidateOrder()[0],
  );

  const err404 = new Error("openrouter_http_404: No endpoint found for model");
  assert("detects http 404 slug error", isOpenRouterModelNotFoundError(err404));

  let callCount = 0;
  const result = await callWithOpenRouterModelFallback(async (model) => {
    callCount++;
    if (model === OPENROUTER_MODEL_CANDIDATES_BUILTIN[0]) {
      throw err404;
    }
    return { ok: true, model };
  });
  assert(
    "fallback to second candidate",
    callCount === 2 && (result as { model: string }).model === OPENROUTER_MODEL_CANDIDATES_BUILTIN[1],
  );
  assert(
    "preferred set after success",
    getOpenRouterPreferredModel() === OPENROUTER_MODEL_CANDIDATES_BUILTIN[1],
  );

  resetOpenRouterModelResolverForTests();
  markOpenRouterSlugPreferred(OPENROUTER_MODEL_CANDIDATES_BUILTIN[1]!);
  assert(
    "preferred slug ordered first",
    resolveOpenRouterCandidateOrder()[0] === OPENROUTER_MODEL_CANDIDATES_BUILTIN[1],
  );

  resetOpenRouterModelResolverForTests();
  markOpenRouterSlugDead(OPENROUTER_MODEL_CANDIDATES_BUILTIN[0]!);
  const order = resolveOpenRouterCandidateOrder();
  assert(
    "dead slug skipped in order",
    !order.includes(OPENROUTER_MODEL_CANDIDATES_BUILTIN[0]!),
    order.join(","),
  );

  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
