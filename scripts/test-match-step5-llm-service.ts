/**
 * Match Calculation Engine — Step 5 (prompt + service wiring).
 * Run: pnpm test:match-step5
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { calculateCompatibilityMatrix } from "../lib/match/calculate-compatibility";
import { buildMatchPrompt } from "../lib/llm/prompts/match-deepseek-prompt";

const root = join(import.meta.dirname ?? __dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const promptSrc = read("lib/llm/prompts/match-deepseek-prompt.ts");
const serviceSrc = read("lib/llm/services/match-analysis-service.ts");

assert(promptSrc.includes("compatibilityMatrix"), "prompt requires matrix");
assert(promptSrc.includes("绝不能"), "prompt forbids overriding level");
assert(promptSrc.includes("已计算的系统动力学矩阵"), "matrix injected in prompt");
assert(promptSrc.includes("MATCH_BAZI_HEPAN_IDENTITY"), "match identity");

assert(serviceSrc.includes("calculateCompatibilityMatrix"), "service computes locally");
assert(serviceSrc.includes("synergy_type = computedSynergyType"), "force override synergy type");
assert(serviceSrc.includes("thinking_effort: \"medium\""), "medium thinking");
assert(serviceSrc.includes("computation_meta"), "computation_meta in report");
assert(serviceSrc.includes("local_computation: true"), "meta local_computation");

const profileA = {
  base_analysis: {
    content: {
      bazi: {
        year_stem: "丁", year_branch: "巳",
        month_stem: "癸", month_branch: "丑",
        day_stem: "乙", day_branch: "子",
        hour_stem: "戊", hour_branch: "寅",
      },
      gender: "M",
      yong_shen: { primary_element: "水" },
      wuxing_distribution: { '木': 2, '火': 1, '土': 2, '金': 0, '水': 2 },
    },
  },
};

const profileB = {
  base_analysis: {
    content: {
      bazi: {
        year_stem: "戊", year_branch: "午",
        month_stem: "甲", month_branch: "寅",
        day_stem: "庚", day_branch: "丑",
        hour_stem: "丁", hour_branch: "亥",
      },
      gender: "F",
      yong_shen: { primary_element: "木" },
      wuxing_distribution: { '木': 2, '火': 2, '土': 2, '金': 1, '水': 1 },
    },
  },
};

const matrix = calculateCompatibilityMatrix({ profileA, profileB });
const { system, user, detected_language } = buildMatchPrompt({
  a_profile: null,
  a_base_analysis: profileA.base_analysis.content,
  b_profile: null,
  b_base_analysis: profileB.base_analysis.content,
  relationship_description: "We're getting engaged next month",
  locale: "en",
  compatibilityMatrix: matrix,
});

assert(system.includes(matrix.synergy_type), "system embeds computed synergy type");
assert(system.includes("resonance_index"), "system embeds matrix JSON");
assert(system.includes("day_master_interaction"), "matrix dimensions in prompt");
assert(user.includes(matrix.synergy_type), "user message locks synergy type");
assert(detected_language === "English", "English relationship text");

const zh = buildMatchPrompt({
  a_profile: null,
  a_base_analysis: profileA.base_analysis.content,
  b_profile: null,
  b_base_analysis: profileB.base_analysis.content,
  relationship_description: "我和未婚妻交往三年了，准备结婚",
  locale: "en",
  compatibilityMatrix: matrix,
});
assert(zh.detected_language.includes("Chinese"), "Chinese detection");

console.log("✓ Step 5 static: prompt + service wired");
console.log("✓ Matrix type:", matrix.synergy_type, "index:", matrix.resonance_index);
console.log("✓ Prompt length:", system.length, "chars");
console.log("\nMatch Step 5 — all checks passed.");
