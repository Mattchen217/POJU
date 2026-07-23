/**
 * Block 28 — one turn = one settlement (no post-turn double refresh / phantom activity)
 * Run: pnpm exec tsx scripts/test-poju-block28-acceptance.ts
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

function postTurnOrchestrationBody(source: string): string {
  const m = source.match(
    /export async function runPostTurnOrchestration[\s\S]*?(?=\nexport async function|\n\/\*\* After user confirms)/,
  );
  return m?.[0] ?? "";
}

function main(): void {
  console.log("\n========== POJU Block 28 Acceptance ==========\n");

  console.log("=== Fix A · single turn path ===\n");
  const ui = read("components/poju/POJUChatUI.tsx");
  const orch = read("lib/poju/agent-orchestrator.ts");
  assert(
    "runUserTurn no runPostTurnOrchestration",
    !/async function runUserTurn[\s\S]*runPostTurnOrchestration/.test(ui),
  );
  assert(
    "handleSummaryAddMore no post-turn orchestration",
    !/handleSummaryAddMore[\s\S]*runPostTurnOrchestration/.test(ui),
  );
  assert(
    "post-turn no per-turn ensureBaseAnalysis",
    !postTurnOrchestrationBody(orch).includes("ensureBaseAnalysis"),
  );
  assert("UI waits Layer1 before segment2", ui.includes("waitLayer1ForSegment2"));

  console.log("\n=== Fix B · no phantom deep_reckoning trailing ===\n");
  assert("no trailingActivity state", !ui.includes("trailingActivity"));
  assert("no setTrailingActivity deep_reckoning", !ui.includes('setTrailingActivity("deep_reckoning")'));

  console.log("\n=== Fix C · breakthrough-core graceful degrade ===\n");
  const agent = read("lib/poju/agent.ts");
  assert(
    "try/catch on trigger_breakthrough_core keeps confirmed understanding",
    /trigger_breakthrough_core[\s\S]*try[\s\S]*catch \(e\)[\s\S]*keeping confirmed understanding/.test(agent),
  );

  console.log("\n=== Fix D · agenda anchors core question ===\n");
  const bt = read("lib/llm/deepseek/breakthrough-core.ts");
  assert("agenda core-question anchor section", bt.includes("锚定用户核心诉求"));
  assert("anti career/skills drift examples", bt.includes("工作核心技能、学习兴趣"));

  console.log("\n=== Degraded delivery explicit path ===\n");
  assert("runDegradedDeliveryPipeline imported in UI", ui.includes("runDegradedDeliveryPipeline"));
  assert("willRunDegradedDelivery still used", ui.includes("willRunDegradedDelivery(toPersist)"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 28 acceptance checks passed.\n");
}

main();
