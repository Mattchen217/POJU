/**
 * Block 98 — empty content ≠ slug failure; same-param invisible resend
 *
 *   pnpm exec tsx scripts/test-poju-block98-empty-content-resend.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  callWithRetryAndFallback,
  isEmptyResponseError,
  resetOpenRouterModelResolverForTests,
  resolveOpenRouterCandidateOrder,
} from "@/lib/llm/openrouter-model-resolver";
import {
  MAX_EMPTY_CONTENT_RESEND,
  OPENROUTER_EMPTY_AFTER_RESEND,
  OPENROUTER_EMPTY_RESPONSE,
} from "@/lib/llm/openrouter-retry";

const ROOT = process.cwd();
const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

async function main(): Promise<void> {
  console.log("\n========== POJU Block 98 · Empty content same-param resend ==========\n");

  const shared = read("lib/llm/openrouter-shared.ts");
  const resolver = read("lib/llm/openrouter-model-resolver.ts");
  const transport = read("lib/poju/shared/transport.ts");

  assert("MAX_EMPTY_CONTENT_RESEND = 3", MAX_EMPTY_CONTENT_RESEND === 3);
  assert("shared loops empty content same params", shared.includes("empty content, invisible resend"));
  assert("shared throws empty_after_resend", shared.includes("OPENROUTER_EMPTY_AFTER_RESEND"));
  assert("resolver excludes empty from slug-dead", resolver.includes("isEmptyResponseError"));
  assert("resolver never marks dead for empty", resolver.includes("not a slug failure"));
  assert("transport MAX_EMPTY_TRANSPORT_RESEND = 3", transport.includes("MAX_EMPTY_TRANSPORT_RESEND = 3"));
  assert("transport empty resend uses same params (no ignore)", transport.includes("invisible same-param resend"));
  assert(
    "isEmptyResponseError covers both codes",
    isEmptyResponseError(new Error(OPENROUTER_EMPTY_RESPONSE)) &&
      isEmptyResponseError(new Error(OPENROUTER_EMPTY_AFTER_RESEND)),
  );

  resetOpenRouterModelResolverForTests();
  let emptyThrows = false;
  try {
    await callWithRetryAndFallback(async () => {
      // Simulate: empty after Fix1 already exhausted — must not kill slug / switch candidates.
      throw new Error(OPENROUTER_EMPTY_AFTER_RESEND);
    });
  } catch (e) {
    emptyThrows = isEmptyResponseError(e);
  }
  assert("empty_after_resend rethrows as empty error", emptyThrows);
  assert(
    "empty does not remove slug from candidate order",
    resolveOpenRouterCandidateOrder().includes("deepseek/deepseek-v4-pro"),
  );

  resetOpenRouterModelResolverForTests();
  let triedSlug: string[] = [];
  try {
    await callWithRetryAndFallback(async (model) => {
      triedSlug.push(model);
      throw new Error(OPENROUTER_EMPTY_AFTER_RESEND);
    });
  } catch {
    // expected
  }
  assert(
    "empty never walks to next candidate (single slug attempt)",
    triedSlug.length === 1,
  );

  // Smoke: makeCall recovers on 2nd attempt after pretending first emptiness handled inside.
  resetOpenRouterModelResolverForTests();
  let calls = 0;
  const out = await callWithRetryAndFallback(async (model) => {
    calls++;
    if (calls === 1) throw new Error("openrouter_http_503: busy");
    return { ok: true, model };
  });
  assert("non-empty success path still works", (out as { ok: boolean }).ok === true && calls === 2);

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
