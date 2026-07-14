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
  const status = read("app/api/poju/breakthrough-core/status/route.ts");
  const runner = read("lib/poju/xhigh-job-runner.ts");
  const corePrompt = read("lib/llm/deepseek/breakthrough-core.ts");
  const client = read("lib/llm/deepseek/breakthrough-core.ts");
  const agent = read("lib/poju/agent.ts");
  const orch = read("lib/poju/agent-orchestrator.ts");
  const llmDebug = read("lib/llm/llm-debug.ts");

  const control = read("lib/poju/phases/segment2/control.ts");
  const ui = read("components/poju/POJUChatUI.tsx");

  assert("route returns llm_debug via job completion", status.includes("llm_debug: job.llm_debug") || client.includes("llm_debug: polled.llm_debug"));
  assert("route sets phase segment2_breakthrough_core", runner.includes('phase_name: "segment2_breakthrough_core"'));
  assert("route thinking_effort xhigh", runner.includes('reasoning_effort: "xhigh"'));
  assert("route passes phase_name", runner.includes('phase_name: "segment2_breakthrough_core"'));

  assert("client requestBreakthroughCore returns llm_debug", client.includes("llm_debug,"));
  assert("orchestrator ensureBreakthroughCore passes llm_debug", orch.includes("llm_debug: out.llm_debug"));

  assert("segment2 finalize attaches llm_debug", control.includes("llm_debug: input.llm_debug"));
  assert("UI applySegment2PollSuccess", ui.includes("applySegment2PollSuccess"));
  assert("agent skips sync justConverted path", !agent.includes("justConverted && segment2LlmDebug"));

  assert("fluency source rule in prompt", corePrompt.includes("从源头保证通顺") && corePrompt.includes("白话重组"));
  assert("fluency rewrite rule in prompt", corePrompt.includes("白话重组") && corePrompt.includes("禁止抠词替换"));
  assert("first-tag-only降噪 rule", corePrompt.includes("术语降噪") && corePrompt.includes("首次出现"));
  assert("situational gloss rule", corePrompt.includes("贴他处境的实时白话") || corePrompt.includes("贴情景白话"));
  assert("paragraph term density cap", corePrompt.includes("每一段话打标术语控制在 1–2 个") || corePrompt.includes("一段最多 1–2 个"));

  assert("expectedEffort includes segment2_breakthrough_core", llmDebug.includes("segment2_breakthrough_core"));

  console.log("\n" + (failures.length === 0 ? "✅ All checks passed." : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
