/**
 * Block 36 — unified Master System Prompt (chat core + delivery task tail)
 * Run: pnpm exec tsx scripts/test-poju-block36-master-prompt.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { buildFinalDeliveryPrompt } from "@/lib/llm/pro/final-delivery";
import { buildPojuChatCoreSections } from "@/lib/llm/prompts/poju-base";

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
  console.log("\n========== POJU Block 36 · Master Prompt ==========\n");

  const finalTs = read("lib/llm/pro/final-delivery.ts");
  const pojuBase = read("lib/llm/prompts/poju-base.ts");
  const route = read("app/api/poju/final-delivery/route.ts");
  const sanitize = read("lib/llm/sanitize/compliance-terms.ts");

  console.log("=== Single master system ===\n");
  assert("final-delivery uses buildPojuChatCoreSections", finalTs.includes("buildPojuChatCoreSections"));
  assert("no buildPojuDeliveryCoreSections in final-delivery", !finalTs.includes("buildPojuDeliveryCoreSections("));
  assert("delivery core deprecated alias only", pojuBase.includes("已废除"));

  console.log("\n=== Closed-set parity with chat ===\n");
  assert("structured inventory in user", finalTs.includes("buildStructuredInstanceInventory"));
  assert("term binding in user", finalTs.includes("buildDeliveryTermBindingBlock"));
  assert("term marking in user prefix", finalTs.includes("buildTermMarkingPromptBlock(outLoc)"));
  assert("output red lines in system", finalTs.includes("buildOutputRedLinesBlock"));

  console.log("\n=== Delivery task tail (dynamic plug-in) ===\n");
  assert("READING_LAYOUT in task tail", finalTs.includes("READING_LAYOUT_CONTRACT"));
  assert("BAZI deep method in task tail", finalTs.includes("POJU_BAZI_DEEP_METHOD"));
  assert("action design in task tail", finalTs.includes("POJU_ACTION_DESIGN_PRINCIPLES"));
  assert("breakthrough spine in materials", finalTs.includes("推理脊柱"));

  const chatCore = buildPojuChatCoreSections("zh").join("\n");
  const { system, user } = buildFinalDeliveryPrompt({
    base_analysis: {
      structured: {
        day_master: { stem: "乙", element: "木" },
        strength: "weak",
        yong_shen: "水",
        pattern: "七杀",
        pillars_detail: {
          year: { ten_god: "正印", shen_sha: ["天乙贵人"], life_stage_han: "沐浴", hidden_stems: [] },
          month: { ten_god: "比肩", shen_sha: [], life_stage_han: "临官", hidden_stems: [] },
          day: { ten_god: "日主", shen_sha: [], life_stage_han: "帝旺", hidden_stems: [] },
          hour: { ten_god: "食神", shen_sha: [], life_stage_han: "衰", hidden_stems: [] },
        },
        da_yun: [{ ganzhi: "丁酉", start_age: 32 }],
        data_availability: { pillars_detail: true, da_yun: true },
      },
    },
    breakthrough_core: {
      relationship_conclusion: "RC-UNIFIED",
      breakthrough_directions: [
        { direction: "D1", structural_basis: "s", what_would_confirm: "c", status: "selected" },
      ],
      generated_at: new Date().toISOString(),
    },
    covered_agenda: [{ label: "agenda" }],
    agent_v2: createInitialAgentState({ original_question: "何时再婚" }),
    locale: "zh-CN",
  });

  assert("system contains chat STATEMACHINE contract", system.includes("状态机协同"));
  assert("system contains chat OUTPUT_FORMAT", system.includes("输出契约"));
  assert("user contains instance inventory", user.includes("本次 structured 实例闭集"));
  assert("user contains term binding", user.includes("术语绑定"));
  assert("user contains RC-UNIFIED spine", user.includes("RC-UNIFIED"));
  assert("user contains READING_LAYOUT", user.includes("降维排版"));
  assert("chat core bytes in delivery system", system.includes(chatCore.slice(0, 80)));

  console.log("\n=== 422 patch code removed ===\n");
  assert("no grounding-only bypass", !route.includes("isOnlyGroundingLowFailure"));
  assert("no fillMissing in sanitizeDeliveryText", !sanitize.includes("fillMissingMarkerPlain"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 36 master-prompt checks passed.\n");
}

main();
