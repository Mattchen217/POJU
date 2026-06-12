/**
 * Step D — Match prompt modularization verification + sample dump.
 *
 *   pnpm exec tsx scripts/test-match-prompt-step-d.ts
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateProfile } from "@/lib/calculations";
import { buildMatchPrompt } from "@/lib/llm/prompts/match-deepseek-prompt";
import { calculateCompatibilityMatrix } from "@/lib/match/calculate-compatibility";
import {
  MATCH_BAZI_HEPAN_IDENTITY,
  MATCH_HEPAN_METHOD,
  MATCH_OUTPUT_BRANDING,
  MATCH_RELATIONSHIP_FRAMEWORK,
  buildMatchCorePromptSections,
} from "@/lib/llm/prompts/match-base";
import type { BirthInfo } from "@/lib/profile/types";

const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, ".data/match-step-d-prompt-sample.txt");
const failures: string[] = [];

function assert(name: string, ok: boolean): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) failures.push(name);
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

async function main(): Promise<void> {
  const deep = read("lib/llm/prompts/match-deepseek-prompt.ts");

  console.log("\n=== Step D: Match modularization static checks ===\n");

  assert("match-base.ts exists", existsSync(resolve(ROOT, "lib/llm/prompts/match-base.ts")));
  assert("4 core exports", buildMatchCorePromptSections().length === 4);

  assert("identity 合盘顾问", MATCH_BAZI_HEPAN_IDENTITY.includes("合盘顾问"));
  assert("identity 两个命局", MATCH_BAZI_HEPAN_IDENTITY.includes("两个命局"));
  assert("identity 不是 POJU", MATCH_BAZI_HEPAN_IDENTITY.includes("POJU"));
  assert("identity 不是 Syncro", MATCH_BAZI_HEPAN_IDENTITY.includes("Syncro"));
  assert("identity 不是 Glyph", MATCH_BAZI_HEPAN_IDENTITY.includes("Glyph"));

  assert("method 十神互看", MATCH_HEPAN_METHOD.includes("十神互看"));
  assert("method 六冲", MATCH_HEPAN_METHOD.includes("六冲"));
  assert("method 六合", MATCH_HEPAN_METHOD.includes("六合"));
  assert("method 大运同频", MATCH_HEPAN_METHOD.includes("大运同频"));
  assert("method 配偶星", MATCH_HEPAN_METHOD.includes("配偶星"));

  assert("framework full_resonance", MATCH_RELATIONSHIP_FRAMEWORK.includes("full_resonance"));
  assert("framework 权重 30%", MATCH_RELATIONSHIP_FRAMEWORK.includes("30%"));
  assert("framework 天作之合", MATCH_RELATIONSHIP_FRAMEWORK.includes("天作之合"));

  assert("branding 5 段卡片", MATCH_OUTPUT_BRANDING.includes("5 段"));
  assert("branding 禁 POJU/Glyph/Syncro", MATCH_OUTPUT_BRANDING.includes("POJU"));
  assert("branding combined 十神", MATCH_OUTPUT_BRANDING.includes("combined"));

  assert("deepseek uses match-base identity", deep.includes("MATCH_BAZI_HEPAN_IDENTITY"));
  assert("deepseek uses stitchPromptSections", deep.includes("stitchPromptSections"));
  assert("deepseek uses compatibilityMatrix", deep.includes("compatibilityMatrix"));
  assert("deepseek injects computed matrix", deep.includes("已计算的契合度矩阵"));

  const birthA: BirthInfo = {
    year: 1988,
    month: 7,
    day: 12,
    hour_period: "wu",
    gender: "M",
    timezone: "Asia/Shanghai",
  };
  const birthB: BirthInfo = {
    year: 1990,
    month: 11,
    day: 3,
    hour_period: "zi_early",
    gender: "F",
    timezone: "Asia/Shanghai",
  };
  const aProfile = await calculateProfile(birthA);
  const bProfile = await calculateProfile(birthB);
  aProfile.id = "match-a-step-d";
  bProfile.id = "match-b-step-d";

  const sampleMatrix = calculateCompatibilityMatrix({
    profileA: {
      base_analysis: {
        content: {
          bazi: {
            day_stem: "戊",
            day_branch: "午",
            year_stem: "戊",
            year_branch: "辰",
            month_stem: "己",
            month_branch: "未",
            hour_stem: "壬",
            hour_branch: "子",
          },
          gender: "M",
          yong_shen: { primary_element: "火" },
        },
      },
    },
    profileB: {
      base_analysis: {
        content: {
          bazi: {
            day_stem: "庚",
            day_branch: "申",
            year_stem: "庚",
            year_branch: "午",
            month_stem: "丙",
            month_branch: "戌",
            hour_stem: "甲",
            hour_branch: "子",
          },
          gender: "F",
          yong_shen: { primary_element: "水" },
        },
      },
    },
  });

  const { system, user, detected_language } = buildMatchPrompt({
    a_profile: aProfile,
    a_base_analysis: {
      day_master: { stem: "戊", element: "土" },
      current_major_luck: { theme: "七杀运，压力与突破" },
      useful_god: { primary: "火" },
    },
    b_profile: bProfile,
    b_base_analysis: {
      day_master: { stem: "庚", element: "金" },
      current_major_luck: { theme: "食神运，表达与创造" },
      useful_god: { primary: "水" },
    },
    relationship_description: "我们在考虑结婚，交往两年，家人对彩礼和定居城市有分歧，想知道长期是否契合。",
    compatibilityMatrix: sampleMatrix,
    locale: "en",
  });

  assert("detected Chinese from relationship text", detected_language.includes("Chinese"));
  assert("system has 合盘", system.includes("合盘"));
  assert("system has analysis_a/b keys", system.includes("analysis_a") && system.includes("analysis_b"));
  assert("system has synergy_type", system.includes("synergy_type"));
  assert("system has five_elements_interaction", system.includes("five_elements_interaction"));
  assert("system has 十神", system.includes("十神"));
  assert("system has both profiles", system.includes("命主 A") && system.includes("命主 B"));
  assert("system NO POJU monolith", !system.includes("精通中国传统智慧的东方破局顾问"));

  const sample = [
    "========== MATCH STEP D — SYSTEM (head) ==========",
    system.slice(0, 3200),
    "\n...[middle omitted]...\n",
    "========== MATCH STEP D — SYSTEM (tail: JSON schema) ==========",
    system.slice(-2800),
    "\n========== USER PROMPT ==========\n",
    user,
    `\nDetected language: ${detected_language}`,
  ].join("\n");

  if (!existsSync(resolve(ROOT, ".data"))) mkdirSync(resolve(ROOT, ".data"));
  writeFileSync(OUT, sample, "utf8");

  console.log(`\nPrompt sample: ${OUT}`);
  console.log(`System length: ${system.length} chars`);

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll Step D static checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
