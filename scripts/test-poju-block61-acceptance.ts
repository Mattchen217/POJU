/**
 * Block 61 — 集外直接剥离(不赌重试) + 命理选择纪律(针对性+轮换)
 *
 *   pnpm exec tsx scripts/test-poju-block61-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { buildDirectedDynamicRelationInventoryBlock, getCurrentLiunian } from "@/lib/calculations/relation-engine";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildBreakthroughCorePrompt } from "@/lib/llm/deepseek/breakthrough-core";
import { READING_LAYOUT_CONTRACT } from "@/lib/llm/prompts/reading-layout";
import { generateWithClosedSetGuard } from "@/lib/llm/sanitize/closed-set-circuit-breaker";

const ROOT = path.join(__dirname, "..");

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function makeStructured(): ProfileStructured {
  const pillar = (gz: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god: "七杀",
    hidden_stems: [] as string[],
    shen_sha: ["华盖"] as string[],
  });
  return {
    day_master: "甲",
    pattern: "偏印格",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "weak",
    four_pillars: { year: "丙寅", month: "辛巳", day: "甲寅", hour: "丙寅" },
    pillars_detail: {
      year: pillar("丙寅"),
      month: pillar("辛巳"),
      day: pillar("甲寅"),
      hour: pillar("丙寅"),
    },
    da_yun: [{ ganzhi: "癸酉", start_age: 3, start_year: 1993 }],
    data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: true },
  };
}

console.log("\n=== Block 61 acceptance ===\n");

async function main(): Promise<void> {
// Part 1 — strip on hit, no retry
const breakerSrc = read("lib/llm/sanitize/closed-set-circuit-breaker.ts");
assert("no retry loop in breaker", !breakerSrc.includes("for (let attempt"));
assert("direct strip log", breakerSrc.includes("集外命中，直接剥离"));
assert("no 熔断重试 log string", !breakerSrc.includes("熔断重试"));

let attempts = 0;
const out = await generateWithClosedSetGuard({
  label: "block61-test",
  locale: "zh",
  structured: null,
  generate: async () => {
    attempts++;
    return "命带空亡与元辰，大凶。";
  },
});
assert("single generate call on dirty output", attempts === 1);
assert("stripped forbidden shen_sha", !out.includes("空亡") && !out.includes("元辰"));

// Part 2 — selection discipline + priority directed block
assert(
  "READING_LAYOUT §7 selection discipline",
  READING_LAYOUT_CONTRACT.includes("命理事实的选择纪律"),
);
assert(
  "READING_LAYOUT mentions 轮换",
  READING_LAYOUT_CONTRACT.includes("轮换递进"),
);

const structured = makeStructured();
const directedBlock = buildDirectedDynamicRelationInventoryBlock(
  structured,
  getCurrentLiunian(),
  "career",
);
assert("directed block has 优先锚定", directedBlock.includes("优先锚定这些"));
assert("directed block discourages generic repeat", directedBlock.includes("勿每轮复读"));

const v6Ctx = read("lib/llm/phases/oriental-prompt-context-v6.ts");
const directedIdx = v6Ctx.indexOf("directedInventoryBlock");
const inventoryIdx = v6Ctx.indexOf("buildStructuredInstanceInventory(structured)");
assert("v6 dataPlane: directed before inventory", directedIdx > 0 && directedIdx < inventoryIdx);

const coreTs = read("lib/llm/deepseek/breakthrough-core.ts");
const coreDirectedIdx = coreTs.indexOf("directedInventoryBlock");
const coreInvIdx = coreTs.indexOf("buildStructuredInstanceInventory(structured)");
assert("breakthrough-core: directed before inventory", coreDirectedIdx < coreInvIdx);

const { system } = buildBreakthroughCorePrompt({
  base_analysis: { structured, display_text: "base" },
  agent_v2: { question_category: "career", context_collected: {} } as never,
  original_question: "该不该跳槽",
  locale: "zh",
});
const sysDirected = system.indexOf("优先锚定");
const sysInventory = system.indexOf("structured 实例闭集");
assert("core system puts priority directed before instance inventory", sysDirected < sysInventory);

console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
