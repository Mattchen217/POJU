/**
 * Block 56 — delivery system 100% v6-aligned; no strip/degrade on audit exhaust
 *
 *   pnpm exec tsx scripts/test-poju-block56-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { buildFinalDeliveryPrompt } from "@/lib/llm/pro/final-delivery";
import { buildPojuSystemPromptV6Sync } from "@/lib/llm/phases/oriental-prompt-context-v6";
import { POJU_V6_STATIC_SYSTEM } from "@/lib/llm/prompts/poju-base-v6";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
import { POJU_OUTPUT_FORMAT } from "@/lib/llm/prompts/poju-base";

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
  console.log("\n=== Block 56 acceptance ===\n");

  const finalTs = read("lib/llm/pro/final-delivery.ts");
  const route = read("app/api/poju/final-delivery/route.ts");
  const termMarking = read("lib/llm/sanitize/term-marking.ts");

  console.log("=== Fix 1 · delivery system v6 + fact guard ===\n");
  assert("final-delivery uses buildPojuSystemPromptV6Sync", finalTs.includes("buildPojuSystemPromptV6Sync"));
  assert("final-delivery no buildPojuChatCoreSections", !finalTs.includes("buildPojuChatCoreSections"));
  assert("final-delivery includes buildChatFactGuardBlock", finalTs.includes("buildChatFactGuardBlock"));
  assert("final-delivery uses computeDirectedDynamicRelations", finalTs.includes("computeDirectedDynamicRelations"));
  assert(
    "final-delivery uses buildDirectedDynamicRelationInventoryBlock",
    finalTs.includes("buildDirectedDynamicRelationInventoryBlock"),
  );
  assert("final-delivery no buildOutputRedLinesBlock import", !finalTs.includes("buildOutputRedLinesBlock"));

  const v6System = buildPojuSystemPromptV6Sync();
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
          year: { ganzhi: "甲子", stem: "甲", branch: "子", ten_god: "正印", shen_sha: ["天乙贵人"], hidden_stems: [], life_stage_han: "沐浴" },
          month: { ganzhi: "丙午", stem: "丙", branch: "午", ten_god: "比肩", shen_sha: [], hidden_stems: [], life_stage_han: "临官" },
          day: { ganzhi: "戊辰", stem: "戊", branch: "辰", ten_god: "日主", shen_sha: [], hidden_stems: [], life_stage_han: "帝旺" },
          hour: { ganzhi: "甲寅", stem: "甲", branch: "寅", ten_god: "食神", shen_sha: [], hidden_stems: [], life_stage_han: "衰" },
        },
        da_yun: [{ ganzhi: "丁酉", start_age: 32 }],
        data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: false },
      },
    },
    breakthrough_core: {
      relationship_conclusion: "RC-B56",
      breakthrough_directions: [
        { direction: "D1", structural_basis: "s", what_would_confirm: "c", status: "selected" },
      ],
      generated_at: new Date().toISOString(),
    },
    covered_agenda: [{ label: "agenda" }],
    agent_v2: createInitialAgentState({ original_question: "事业方向" }),
    locale: "zh-CN",
  });

  assert("delivery system starts with v6 static system", system.startsWith(v6System.slice(0, 40)));
  assert("delivery system includes fact guard block", system.includes("硬约束"));
  assert("delivery system includes v6 identity", system.includes(POJU_V6_STATIC_SYSTEM.slice(0, 30)));
  assert("delivery user has instance inventory", user.includes("本次 structured 实例闭集") || user.includes("structured"));
  assert("delivery user has directed dynamic block", user.includes("本盘动态关系实例") || user.includes("流年/定向"));

  console.log("\n=== Fix 3 · single-pass sanitizer (Block 58) ===\n");
  assert("route single LLM call", route.includes("await callLLM") && !route.includes("for (let attempt"));
  assert("route no delivery_audit_exhausted", !route.includes("delivery_audit_exhausted"));
  assert("route no stripOutOfSetFactTerms (Block 62)", !route.includes("stripOutOfSetFactTerms"));
  assert("route no circuit-breaker retry log", !route.includes("熔断重试"));

  console.log("\n=== Fix 4 · marking density unified ===\n");
  assert(
    "term-marking no every-occurrence rule",
    !termMarking.includes("body 里每一次出现都要套"),
  );
  assert(
    "term-marking has per-paragraph cap",
    termMarking.includes("每段金字 ≤2 为硬约束"),
  );
  assert(
    "poju-base OUTPUT_FORMAT density aligned",
    POJU_OUTPUT_FORMAT.includes("每段金字 ≤2") && !POJU_OUTPUT_FORMAT.includes("每一次出现都要套"),
  );
  const deliveryMarking = buildTermMarkingPromptBlock("zh");
  assert("delivery marking block density aligned", deliveryMarking.includes("每段金字 ≤2 为硬约束"));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 56 checks passed.\n");
}

main();
