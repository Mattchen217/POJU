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
  const agent = read("lib/poju/agent.ts");
  const collecting = read("lib/poju/collecting-focus-reply.ts");
  const ui = read("components/poju/POJUChatUI.tsx");
  const agentState = read("lib/poju/agent-state.ts");
  const types = read("lib/poju/types.ts");

  assert("route maxDuration 300", route.includes("maxDuration = 300"));
  assert("route timeout 90s", route.includes("timeout_ms: 90_000"));
  assert("route max_tokens initial 12000", route.includes("CORE_MAX_TOKENS_INITIAL = 12_000"));
  assert("route max_tokens retry 16000", route.includes("CORE_MAX_TOKENS_RETRY = 16_000"));
  assert("no 180_000 route timeout", !route.includes("180_000"));
  assert("no 24000 retry tokens", !route.includes("24_000"));

  assert("agent no staying in opening on core fail", !agent.includes("staying in opening"));
  assert("agent keeps confirmed understanding", agent.includes("keeping confirmed understanding"));
  assert("agent core_generation_failed flag", agent.includes("core_generation_failed: true"));
  assert("agent stays collecting_context on fail", agent.includes('current_phase: "collecting_context"'));
  assert("handleRegenerateBreakthroughCore exported", agent.includes("export async function handleRegenerateBreakthroughCore"));
  assert("segment2 failed message not retry hint on gate", agent.includes("segment2CoreGenerationFailedMessage"));

  assert("failed message copy", collecting.includes("深度分析这次没能生成完"));
  assert("regenerate button label helper", collecting.includes("segment2RegenerateButtonLabel"));

  assert("agent state core_generation_failed field", agentState.includes("core_generation_failed?: boolean"));
  assert("message meta core_generation_failed", types.includes("core_generation_failed?: boolean"));

  assert("RegenerateAnalysisAction in UI", ui.includes("RegenerateAnalysisAction"));
  assert("handleRegenerateAnalysisClick", ui.includes("handleRegenerateAnalysisClick"));
  assert("handleRegenerateBreakthroughCore import", ui.includes("handleRegenerateBreakthroughCore"));

  console.log("\n" + (failures.length === 0 ? "✅ All checks passed." : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
