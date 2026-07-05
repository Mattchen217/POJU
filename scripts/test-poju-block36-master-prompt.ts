/**
 * Block 36 — unified Master System Prompt (chat core + delivery task tail)
 * Run: pnpm exec tsx scripts/test-poju-block36-master-prompt.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { buildFinalDeliveryPrompt } from "@/lib/llm/pro/final-delivery";
import { buildPojuSystemPromptV6Sync } from "@/lib/llm/phases/oriental-prompt-context-v6";
import { POJU_V6_STATIC_SYSTEM } from "@/lib/llm/prompts/poju-base-v6";

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

  console.log("=== Single master system (v6-aligned delivery) ===\n");
  assert("final-delivery uses buildPojuSystemPromptV6Sync", finalTs.includes("buildPojuSystemPromptV6Sync"));
  assert("final-delivery includes buildChatFactGuardBlock", finalTs.includes("buildChatFactGuardBlock"));
  assert("no buildPojuDeliveryCoreSections in final-delivery", !finalTs.includes("buildPojuDeliveryCoreSections("));
  assert("delivery core deprecated alias only", pojuBase.includes("已废除"));

  console.log("\n=== Closed-set parity with chat v6 ===\n");
  assert("structured inventory in user", finalTs.includes("buildStructuredInstanceInventory"));
  assert("term binding in user", finalTs.includes("buildDeliveryTermBindingBlock"));
  assert("term marking in user prefix", finalTs.includes("buildTermMarkingPromptBlock(outLoc)"));
  assert("v6 system in delivery", finalTs.includes("buildPojuSystemPromptV6Sync"));

  console.log("\n=== Delivery task tail (dynamic plug-in) ===\n");
  assert("READING_LAYOUT in task tail", finalTs.includes("READING_LAYOUT_CONTRACT"));
  assert("BAZI deep method in task tail", finalTs.includes("POJU_BAZI_DEEP_METHOD"));
  assert("action design in task tail", finalTs.includes("POJU_ACTION_DESIGN_PRINCIPLES"));
  assert("breakthrough spine in materials", finalTs.includes("推理脊柱"));

  const v6Core = buildPojuSystemPromptV6Sync();
  const { system, user } = buildFinalDeliveryPrompt({
    base_analysis: {
      structured: {
        day_master: "乙",
        pattern: "七杀",
        yong_shen: "水",
        xi_shen: [],
        ji_shen: [],
        strength: "weak",
        four_pillars: { year: "甲子", month: "丙午", day: "戊辰", hour: "甲寅" },
        pillars_detail: {
          year: { ganzhi: "甲子", stem: "甲", branch: "子", ten_god: "正印", shen_sha: ["天乙贵人"], life_stage_han: "沐浴", hidden_stems: [] },
          month: { ganzhi: "丙午", stem: "丙", branch: "午", ten_god: "比肩", shen_sha: [], life_stage_han: "临官", hidden_stems: [] },
          day: { ganzhi: "戊辰", stem: "戊", branch: "辰", ten_god: "日主", shen_sha: [], life_stage_han: "帝旺", hidden_stems: [] },
          hour: { ganzhi: "甲寅", stem: "甲", branch: "寅", ten_god: "食神", shen_sha: [], life_stage_han: "衰", hidden_stems: [] },
        },
        da_yun: [{ ganzhi: "丁酉", start_age: 32 }],
        data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: false },
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

  assert("system contains v6 identity", system.includes(POJU_V6_STATIC_SYSTEM.slice(0, 24)));
  assert("system contains fact guard", system.includes("硬约束") || system.includes("闭集"));
  assert("user contains instance inventory", user.includes("本次 structured 实例闭集") || user.includes("structured"));
  assert("user contains term binding", user.includes("术语绑定"));
  assert("user contains RC-UNIFIED spine", user.includes("RC-UNIFIED"));
  assert("user contains READING_LAYOUT", user.includes("降维排版"));
  assert("v6 core bytes in delivery system", system.includes(v6Core.slice(0, 80)));

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
