/**
 * Block 6 热修复验收 — 脊柱取盘与聊天统一（无 LLM live）。
 *
 *   pnpm exec tsx scripts/test-poju-block6-acceptance.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { resolveBaseAnalysisForBreakthrough } from "@/lib/llm/deepseek/breakthrough-core";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import type { POJUSessionState } from "@/lib/poju/types";

const ROOT = resolve(__dirname, "..");
const failures: string[] = [];

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function assert(name: string, ok: boolean, detail = ""): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

function orchestratorTests(): void {
  console.log("\n=== 1. agent-orchestrator 取盘统一 ===\n");

  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("imports loadSessionProfileBundle", orch.includes("loadSessionProfileBundle"));
  assert(
    "ensureBreakthroughCore passes base_analysis to requestBreakthroughCore",
    orch.includes("requestBreakthroughCore(session, locale, { base_analysis })"),
  );
  assert(
    "ensureBreakthroughCore uses loadSessionProfileBundle",
    /ensureBreakthroughCore[\s\S]*loadSessionProfileBundle/.test(orch),
  );
  assert(
    "ensureBreakthroughCore no early has_base_analysis gate",
    !orch.match(/ensureBreakthroughCore[\s\S]*if \(!agent\.has_base_analysis\)/),
  );
  assert(
    "breakthrough trigger uses resolveSessionHasProfile",
    orch.includes("breakthrough_core == null") && orch.includes("resolveSessionHasProfile(s)"),
  );
  assert(
    "ensureBaseAnalysis outer gate uses resolveSessionHasProfile only",
    orch.includes("resolveSessionHasProfile(s) && !s.agent_v2?.has_base_analysis"),
  );
  assert(
    "ensureBaseAnalysis marks ready via loadSessionProfileBundle",
    /ensureBaseAnalysis[\s\S]*loadSessionProfileBundle[\s\S]*has_base_analysis: true/.test(orch),
  );
  assert(
    "runConfirmationPipeline passes base_analysis",
    orch.includes("requestBreakthroughCore(s, locale, { base_analysis })"),
  );
  assert("runDegradedDeliveryPipeline intact", orch.includes("runDegradedDeliveryPipeline"));
}

function breakthroughCoreTests(): void {
  console.log("\n=== 2. resolveBaseAnalysisForBreakthrough 回退 ===\n");

  const bt = read("lib/llm/deepseek/breakthrough-core.ts");
  assert("imports loadSessionProfileBundle", bt.includes("loadSessionProfileBundle"));
  assert("fallback to loadSessionProfileBundle", bt.includes("await loadSessionProfileBundle(session)"));
  assert("Block 5 hard error retained", bt.includes("命主基础分析缺失，无法锚定深测算"));
  assert("structured guard retained", bt.includes("structured 命盘为空，拒绝生成脊柱"));
}

async function noProfileSafeExitTests(): Promise<void> {
  console.log("\n=== 3. 真无盘安全早退 ===\n");

  const session = {
    session_id: "b6-no-profile",
    original_question: "test",
    messages: [],
    selected_stored_profile_id: null,
    has_profile: false,
    profile_skipped: false,
    birth_submitted_in_session: false,
    main_delivery_done: false,
    tokens_used: 0,
    context_collected: createInitialAgentState({ original_question: "test" }).context_collected,
    agent_v2: createInitialAgentState({ original_question: "test" }),
  } as unknown as POJUSessionState;

  assert("mock session has no profile", !resolveSessionHasProfile(session));
  const resolved = await resolveBaseAnalysisForBreakthrough(session);
  assert("resolveBaseAnalysisForBreakthrough returns null without profile", resolved === null);
}

function situationAnalysisCleanupNote(): void {
  console.log("\n=== 4. situation-analysis 清理检查 ===\n");

  const ui = read("components/poju/POJUChatUI.tsx");
  const hasRef = ui.includes("situation-analysis") || ui.includes("requestSituationAnalysis");
  assert(
    "situation-analysis still referenced (skip delete)",
    hasRef,
    "POJUChatUI still imports requestSituationAnalysis — Fix 4 deferred",
  );
}

async function main(): Promise<void> {
  console.log("\n========== POJU Block 6 Acceptance ==========\n");

  orchestratorTests();
  breakthroughCoreTests();
  await noProfileSafeExitTests();
  situationAnalysisCleanupNote();

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`${failures.length} check(s) FAILED:\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("All Block 6 acceptance checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
