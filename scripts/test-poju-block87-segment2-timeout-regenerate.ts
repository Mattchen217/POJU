/**
 * Block 87 — segment 2 timeout budget + failure retention + regenerate button
 *
 *   pnpm exec tsx scripts/test-poju-block87-segment2-timeout-regenerate.ts
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
  console.log("\n========== POJU Block 87 · Segment 2 timeout + regenerate ==========\n");

  const route = read("app/api/poju/breakthrough-core/route.ts");
  const runner = read("lib/poju/xhigh-job-runner.ts");
  const control = read("lib/poju/phases/segment2/control.ts");
  const display = read("lib/poju/phases/segment2/display.ts");
  const ui = read("components/poju/POJUChatUI.tsx");
  const agentState = read("lib/poju/agent-state.ts");
  const types = read("lib/poju/types.ts");

  assert("route maxDuration 300", route.includes("maxDuration = 300"));
  assert("runner timeout 270s", runner.includes("SEGMENT2_XHIGH_TIMEOUT_MS = 270_000"));
  assert("runner max_tokens 26000", runner.includes("SEGMENT2_XHIGH_MAX_TOKENS = 26_000"));
  assert("runner max_attempts 1", runner.includes("max_attempts: 1"));
  assert("route async job create", route.includes("createXhighJob"));
  assert("route provider_busy via job fail", runner.includes('failure_reason: "provider_busy"'));
  assert("no 90s route timeout", !route.includes("timeout_ms: 90_000"));

  assert("segment2 keeps collecting on fail", control.includes('current_phase: "collecting_context"'));
  assert("segment2 core_generation_failed flag", control.includes("core_generation_failed: true"));
  assert("startSegment2Regenerate exported", control.includes("export async function startSegment2Regenerate"));
  assert("failed message via display", display.includes("深度分析这次没能生成完"));
  assert("timeout message via display", display.includes("这次分析用时过长"));
  assert("regenerate button label helper", display.includes("segment2RegenerateButtonLabel"));

  assert("agent state core_generation_failed field", agentState.includes("core_generation_failed?: boolean"));
  assert("message meta core_generation_failed", types.includes("core_generation_failed?: boolean"));

  assert("RegenerateAnalysisAction in UI", ui.includes("RegenerateAnalysisAction"));
  assert("handleRegenerateAnalysisClick", ui.includes("handleRegenerateAnalysisClick"));
  assert("UI startSegment2Regenerate", ui.includes("startSegment2Regenerate"));
  const retry = read("lib/llm/openrouter-retry.ts");
  assert("openrouter empty response error", retry.includes("OPENROUTER_EMPTY_RESPONSE"));

  console.log("\n" + (failures.length === 0 ? "✅ All checks passed." : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
