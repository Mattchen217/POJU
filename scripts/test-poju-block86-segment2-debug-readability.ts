/**
 * Block 86 — segment 2 llm_debug + readability prompt rules
 *
 *   pnpm exec tsx scripts/test-poju-block86-segment2-debug-readability.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 86 · Segment 2 debug + readability ==========\n");

  const route = read("app/api/poju/breakthrough-core/route.ts");
  const corePrompt = read("lib/llm/deepseek/breakthrough-core.ts");
  const agent = read("lib/poju/agent.ts");
  const orch = read("lib/poju/agent-orchestrator.ts");
  const llmDebug = read("lib/llm/llm-debug.ts");

  assert("route returns llm_debug in JSON", route.includes("llm_debug: fetched.llm_debug"));
  assert("route sets phase segment2_breakthrough_core", route.includes('phase: "segment2_breakthrough_core"'));
  assert("route thinking_effort xhigh", route.includes('reasoning_effort: "xhigh"'));
  assert("route passes phase_name", route.includes('phase_name: "segment2_breakthrough_core"'));

  assert("client requestBreakthroughCore returns llm_debug", corePrompt.includes("llm_debug: payload.llm_debug"));
  assert("orchestrator ensureBreakthroughCore passes llm_debug", orch.includes("llm_debug: out.llm_debug"));

  assert("agent runSegment2 returns segment2_llm_debug", agent.includes("segment2_llm_debug"));
  assert("gate confirm attaches llm_debug to assistant meta", agent.includes("llm_debug: segment2LlmDebug"));
  assert("handleUserMessage prefers segment2 debug when justConverted", agent.includes("justConverted && segment2LlmDebug"));

  assert("readability hard rule in prompt", corePrompt.includes("可读性硬要求"));
  assert("first-tag-only降噪 rule", corePrompt.includes("术语降噪") && corePrompt.includes("首次出现"));
  assert("situational gloss rule", corePrompt.includes("情景白话") && corePrompt.includes("贴他这件事"));
  assert("paragraph term density cap", corePrompt.includes("一段话里打标术语控制在 1-2 个"));

  assert("expectedEffort includes segment2_breakthrough_core", llmDebug.includes("segment2_breakthrough_core"));

  console.log("\n" + (failures.length === 0 ? "✅ All checks passed." : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
