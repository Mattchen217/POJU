/**
 * Block 97 — silent infra auto-retry ×3 (client) + transient slug same-slug backoff
 *
 *   pnpm exec tsx scripts/test-poju-block97-silent-infra-retry.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  callWithRetryAndFallback,
  resetOpenRouterModelResolverForTests,
} from "@/lib/llm/openrouter-model-resolver";
import { OpenRouterProviderQueueError } from "@/lib/llm/openrouter-retry";

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
  console.log("\n========== POJU Block 97 · Silent infra retry ==========\n");

  const ui = read("components/poju/POJUChatUI.tsx");
  const route = read("app/api/poju/chat/route.ts");
  const agent = read("lib/poju/agent.ts");
  const resolver = read("lib/llm/openrouter-model-resolver.ts");

  assert("UI MAX_SILENT_INFRA_RETRIES = 3", ui.includes("MAX_SILENT_INFRA_RETRIES = 3"));
  assert("UI silent retry count ref", ui.includes("silentRetryCountRef"));
  assert("UI soft infra silent retry", ui.includes("soft infra failure — silent retry"));
  assert("chat route returns 503 for provider queue", route.includes('error: "openrouter_provider_queue"') && route.includes("status: 503"));
  assert("agent maps 503 → provider_queue throw", agent.includes('data.error === "openrouter_provider_queue"'));
  assert("resolver retries same-slug no-endpoints", resolver.includes("同 slug 重试耗尽，切换候选") || resolver.includes("kind=${kind}"));
  assert("resolver no instant kill of no-endpoints", !resolver.includes("404 no-endpoints — 标记 slug 失效并切换候选"));

  resetOpenRouterModelResolverForTests();
  let calls = 0;
  const out = await callWithRetryAndFallback(async (model) => {
    calls++;
    if (calls < 2) {
      throw new Error("openrouter_http_404: No endpoints found for deepseek/deepseek-v4-pro");
    }
    return model;
  });
  assert("transient 404 recovers on same slug", calls === 2 && typeof out === "string");

  resetOpenRouterModelResolverForTests();
  let exhausted = false;
  try {
    await callWithRetryAndFallback(
      async () => {
        throw new Error("openrouter_http_404: No endpoints found for provider");
      },
      { maxAttempts: 2 },
    );
  } catch (e) {
    exhausted = e instanceof OpenRouterProviderQueueError;
  }
  assert("exhausted transient → OpenRouterProviderQueueError", exhausted);

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
