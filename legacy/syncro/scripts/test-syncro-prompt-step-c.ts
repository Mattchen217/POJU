/**
 * Step C — Syncro prompt modularization verification + sample dump.
 *
 *   pnpm exec tsx scripts/test-syncro-prompt-step-c.ts
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateProfile } from "@/lib/calculations";
import { buildSyncroPrompt } from "@/lib/llm/prompts/syncro-deepseek-prompt";
import { calculateSyncroMatrix } from "@/lib/syncro/calculate-matrix";
import {
  SYNCRO_OUTPUT_BRANDING,
  SYNCRO_QIMEN_DUNJIA_IDENTITY,
  SYNCRO_QIMEN_INTERPRETATION_METHOD,
  SYNCRO_TIMESPACE_FRAMEWORK,
  buildSyncroCorePromptSections,
} from "@/lib/llm/prompts/syncro-base";
import type { BirthInfo } from "@/lib/profile/types";

const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, ".data", "syncro-step-c-prompt-sample.txt");
const failures: string[] = [];

function assert(name: string, ok: boolean): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) failures.push(name);
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

async function main(): Promise<void> {
  const deep = read("lib/llm/prompts/syncro-deepseek-prompt.ts");

  console.log("\n=== Step C: Syncro modularization static checks ===\n");

  assert("syncro-base.ts exists", existsSync(resolve(ROOT, "lib/llm/prompts/syncro-base.ts")));
  assert("4+ core exports", buildSyncroCorePromptSections().length >= 4);
  assert("output framing export", existsSync(resolve(ROOT, "lib/llm/prompts/syncro-base.ts")) && read("lib/llm/prompts/syncro-base.ts").includes("SYNCRO_OUTPUT_FRAMING"));

  assert("identity 奇门遁甲", SYNCRO_QIMEN_DUNJIA_IDENTITY.includes("奇门遁甲"));
  assert("identity 何时去何方", SYNCRO_QIMEN_DUNJIA_IDENTITY.includes("何时"));
  assert("identity 不是 POJU", SYNCRO_QIMEN_DUNJIA_IDENTITY.includes("POJU"));
  assert("identity 不是 Glyph", SYNCRO_QIMEN_DUNJIA_IDENTITY.includes("Glyph"));
  assert("identity 不是 Match", SYNCRO_QIMEN_DUNJIA_IDENTITY.includes("Match"));

  assert("method 九宫八门", SYNCRO_QIMEN_INTERPRETATION_METHOD.includes("八门"));
  assert("method 用神", SYNCRO_QIMEN_INTERPRETATION_METHOD.includes("用神"));
  assert("method 推演步骤", SYNCRO_QIMEN_INTERPRETATION_METHOD.includes("推演步骤"));
  assert("method 禁奇门暴露", SYNCRO_QIMEN_INTERPRETATION_METHOD.includes("奇门遁甲"));

  assert("framework Open Current", SYNCRO_TIMESPACE_FRAMEWORK.includes("open_current"));
  assert("framework 三者全顺", SYNCRO_TIMESPACE_FRAMEWORK.includes("三者全顺"));
  assert("framework undertow", SYNCRO_TIMESPACE_FRAMEWORK.includes("undertow"));

  assert("branding Current 等级", SYNCRO_OUTPUT_BRANDING.includes("Current"));
  assert("branding 禁八门", SYNCRO_OUTPUT_BRANDING.includes("八门"));
  assert("branding 禁吉凶", SYNCRO_OUTPUT_BRANDING.includes("吉"));
  assert("branding compliance 翻译", SYNCRO_OUTPUT_BRANDING.includes("核心特质"));

  assert("deepseek uses syncro-base", deep.includes("buildSyncroFullPromptSections"));
  assert("deepseek uses stitchPromptSections", deep.includes("stitchPromptSections"));
  assert("deepseek NOT ORIENTAL_COUNSELOR_BASE", !deep.includes("ORIENTAL_COUNSELOR_BASE"));

  const birth: BirthInfo = {
    year: 1992,
    month: 3,
    day: 8,
    hour_period: "chen",
    gender: "M",
    timezone: "America/Los_Angeles",
  };
  const profile = await calculateProfile(birth);
  profile.id = "syncro-step-c-test";

  const base_analysis = {
    bazi: { day_master: "丙" },
    yong_shen: { primary_element: "木" },
    current_major_luck: { period: "2018-2028", theme: "食神生财，创意变现" },
  };
  const task_description =
    "我要今天下午去和客户谈合同签约，该往哪个方向走、什么时辰最合适？";
  const current_time = new Date("2026-05-18T14:30:00-07:00");

  const { matrix, metadata } = calculateSyncroMatrix({
    profile: { base_analysis: { content: base_analysis }, user_profile: profile },
    taskDescription: task_description,
    startTime: current_time,
    userTimezone: "America/Los_Angeles",
    userLongitude: -118.24,
    userLatitude: 34.05,
  });

  const { system, user } = buildSyncroPrompt({
    profile,
    base_analysis,
    task_description,
    user_location: { latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles" },
    locale: "zh",
    current_time,
    matrix,
    true_solar: metadata,
  });

  assert("system has 时空顾问", system.includes("时空顾问"));
  assert("system has 96 key rule", system.includes("96"));
  assert("system has precomputed matrix block", system.includes("矩阵已经计算好了"));
  assert("system forbids changing level", system.includes("绝不能"));
  assert("system embeds matrix JSON", system.includes("zi__") || system.includes("__N"));
  assert("system copy-only JSON schema", system.includes("short_advice"));
  assert("system NO ORIENTAL_COUNSELOR monolith", !system.includes("精通中国传统智慧的东方破局顾问"));

  const sample = [
    "========== SYNCRO STEP C — SYSTEM (head) ==========",
    system.slice(0, 3200),
    "\n...[middle omitted]...\n",
    "========== SYNCRO STEP C — SYSTEM (tail: task + JSON schema) ==========",
    system.slice(-2800),
    "\n========== USER PROMPT ==========\n",
    user,
  ].join("\n");

  if (!existsSync(resolve(ROOT, ".data"))) mkdirSync(resolve(ROOT, ".data"));
  writeFileSync(OUT, sample, "utf8");

  console.log(`\nPrompt sample: ${OUT}`);
  console.log(`System length: ${system.length} chars`);

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll Step C static checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
