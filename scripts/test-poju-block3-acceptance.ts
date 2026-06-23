/**
 * Block 3 总验收清单 — 脊柱共享件 + 确认深总结 + 追踪动态陪伴（无 LLM live）。
 *
 *   pnpm exec tsx scripts/test-poju-block3-acceptance.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createInitialAgentState,
  mergeBreakthroughCoreUpdates,
  parseBreakthroughCoreUpdatesFromLlm,
  type BreakthroughCore,
} from "@/lib/poju/agent-state";
import { buildSpineBlock } from "@/lib/llm/phases/spine-block";

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

function countBuildSpineBlockDefs(): number {
  const phasesDir = resolve(ROOT, "lib/llm/phases");
  const files = [
    "spine-block.ts",
    "collecting-phase.ts",
    "confirmation-phase.ts",
    "tracking-phase.ts",
  ];
  let count = 0;
  for (const f of files) {
    const src = readFileSync(resolve(phasesDir, f), "utf8");
    const matches = src.match(/function buildSpineBlock/g);
    count += matches?.length ?? 0;
  }
  return count;
}

function spineSharedTests(): void {
  console.log("\n=== 1. 共享脊柱件 spine-block.ts ===\n");

  fileExists("lib/llm/phases/spine-block.ts");
  assert("single buildSpineBlock definition across phases", countBuildSpineBlockDefs() === 1);

  const collecting = read("lib/llm/phases/collecting-phase.ts");
  const confirmation = read("lib/llm/phases/confirmation-phase.ts");
  const tracking = read("lib/llm/phases/tracking-phase.ts");

  assert("collecting imports spine-block", collecting.includes('from "./spine-block"') || collecting.includes('from "@/lib/llm/phases/spine-block"'));
  assert("confirmation imports spine-block", confirmation.includes("spine-block"));
  assert("tracking imports spine-block", tracking.includes("spine-block"));
  assert("collecting no local buildSpineBlock def", !collecting.includes("function buildSpineBlock"));

  const agent = createInitialAgentState({ original_question: "test" });
  assert("null core returns empty string", buildSpineBlock(agent) === "");

  agent.breakthrough_core = {
    relationship_conclusion: "七杀透月，压力与突破并存",
    breakthrough_directions: [
      {
        direction: "顺势试探",
        structural_basis: "month.ten_god=七杀",
        what_would_confirm: "offer",
        status: "hypothesis",
      },
    ],
    generated_at: "2026-01-01T00:00:00.000Z",
  };
  const block = buildSpineBlock(agent);
  assert("spine block has private header", block.includes("你的破局脊柱（私有"));
  assert("spine block includes relationship_conclusion", block.includes("七杀透月"));
  assert("spine block includes direction line", block.includes("顺势试探"));
}

function confirmationDeepSummaryTests(): void {
  console.log("\n=== 2. 确认相 · 深度总结 ===\n");

  const confirmation = read("lib/llm/phases/confirmation-phase.ts");

  assert("buildSummaryTaskBlock uses buildSpineBlock", confirmation.includes("buildSpineBlock(agent)"));
  assert("deep summary task title", confirmation.includes("深度总结 + 确认"));
  assert("deep thinking instruction", confirmation.includes("深度思考下的总结"));
  assert("spineBlock in task block", confirmation.includes("${spineBlock}"));
  assert("current_summary still produced", confirmation.includes("current_summary"));
  assert("consent question rules", confirmation.includes("TRANSITION_CONSENT_RULES"));
  assert("no full 3-action red line", confirmation.includes("不在此给完整 3 条行动"));

  assert("confirmation explicit xhigh in generateSummaryPhase", confirmation.includes('thinking_effort: "xhigh"'));
  assert("confirmation max_tokens 7000 in generateSummaryPhase", confirmation.includes("max_tokens: 7000"));
}

function trackingDynamicTests(): void {
  console.log("\n=== 3. 追踪相 · 动态破局陪伴 ===\n");

  const tracking = read("lib/llm/phases/tracking-phase.ts");

  assert("tracking task uses buildSpineBlock", tracking.includes("buildSpineBlock(agent)"));
  assert("spineBlock in tracking task", tracking.includes("${spineBlock}"));
  assert("interpret progress on spine", tracking.includes("在脊柱上解读进展"));
  assert("next layer micro action", tracking.includes("下一层"));
  assert("breakthrough_core_updates in task", tracking.includes("breakthrough_core_updates"));
  assert("parseBreakthroughCoreUpdatesFromLlm wired", tracking.includes("parseBreakthroughCoreUpdatesFromLlm"));
  assert("returns breakthrough_core_updates", tracking.includes("breakthrough_core_updates,"));

  assert("tracking explicit xhigh", tracking.includes('thinking_effort: "xhigh"'));
  assert("tracking max_tokens 7000", tracking.includes("max_tokens: 7000"));
}

function persistenceMergeTests(): void {
  console.log("\n=== 4. 追踪脊柱演进持久化（merge） ===\n");

  const base: BreakthroughCore = {
    relationship_conclusion: "原关系结论",
    breakthrough_directions: [
      {
        direction: "顺势试探",
        structural_basis: "month.ten_god=七杀",
        what_would_confirm: "offer",
        status: "hypothesis",
      },
      {
        direction: "稳住收入",
        structural_basis: "strength=weak",
        what_would_confirm: "savings",
        status: "hypothesis",
      },
    ],
    generated_at: "2026-01-01T00:00:00.000Z",
  };

  const updates = parseBreakthroughCoreUpdatesFromLlm({
    breakthrough_directions: [
      { direction: "顺势试探", status: "reinforced", structural_basis: "month.ten_god=七杀", what_would_confirm: "offer" },
    ],
  });
  assert("parse tracking updates", updates !== null && updates.breakthrough_directions?.length === 1);

  const merged = mergeBreakthroughCoreUpdates(base, updates!);
  assert("merge sets evolved_at", Boolean(merged.evolved_at));
  assert(
    "merge updates direction status to reinforced",
    merged.breakthrough_directions[0]?.status === "reinforced",
  );
  assert(
    "unchanged direction stays hypothesis",
    merged.breakthrough_directions[1]?.status === "hypothesis",
  );

  const agent = read("lib/poju/agent.ts");
  assert("finalizeAgentV2 merges breakthrough_core_updates", agent.includes("mergeBreakthroughCoreUpdates"));
}

function fileExists(rel: string): void {
  assert(`file: ${rel}`, existsSync(resolve(ROOT, rel)));
}

async function main(): Promise<void> {
  console.log("\n========== POJU Block 3 Acceptance ==========\n");

  spineSharedTests();
  confirmationDeepSummaryTests();
  trackingDynamicTests();
  persistenceMergeTests();

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`${failures.length} check(s) FAILED:\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("All Block 3 acceptance checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
