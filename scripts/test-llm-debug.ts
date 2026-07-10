/**
 * LLM debug payload builder smoke test.
 *
 *   pnpm exec tsx scripts/test-llm-debug.ts
 */
import {
  buildLlmDebug,
  effortRatio,
  expectedEffortForCall,
  isEffortBelowExpected,
  reasoningBudget,
} from "@/lib/llm/llm-debug";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n=== llm-debug ===\n");

  assert("xhigh ratio", effortRatio("xhigh") === 0.95);
  assert("high ratio", effortRatio("high") === 0.8);
  assert("xhigh budget 16000", reasoningBudget(16_000, "xhigh") === 15_200);

  const debug = buildLlmDebug({
    phase: "final_delivery",
    requested_effort: "xhigh",
    max_tokens: 16_000,
    model: "deepseek/deepseek-v4-pro",
    served_provider: "StreamLake",
    finish_reason: "stop",
    prompt_tokens: 21_973,
    cached_tokens: 3_840,
    completion_tokens: 562,
    reasoning_tokens: 232,
    latency_ms: 2700,
    generation_id: "gen-test-1",
  });

  assert("cache ratio computed", Math.abs(debug.cache_ratio - 3840 / 21973) < 0.001);
  assert("reasoning used ratio", debug.reasoning_used_ratio > 0);
  assert("final_delivery expects xhigh", expectedEffortForCall("main_delivery") === "xhigh");
  assert("medium below xhigh", isEffortBelowExpected("medium", "xhigh"));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All llm-debug checks passed.\n");
}

main();
