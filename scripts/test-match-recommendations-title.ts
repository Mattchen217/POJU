/**
 * Verify Match recommendations.title prompt rules + optional live LLM check.
 *
 *   pnpm exec tsx scripts/test-match-recommendations-title.ts
 *   pnpm exec tsx scripts/test-match-recommendations-title.ts --live
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { generateMatchAnalysis } from "@/lib/llm/services/match-analysis-service";
import { MATCH_OUTPUT_BRANDING } from "@/lib/llm/prompts/match-base";
import { buildMatchPrompt } from "@/lib/llm/prompts/match-deepseek-prompt";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import {
  extractMentionedActionCount,
  recommendationsTitleCountMismatch,
  recommendationsTitleHasHardcodedCount,
} from "@/lib/match/recommendations-title-guard";
import { calculateCompatibilityMatrix } from "@/lib/match/calculate-compatibility";
import type { UserProfile } from "@/lib/profile/types";

const ROOT = resolve(__dirname, "..");
const LIVE = process.argv.includes("--live");
const failures: string[] = [];

function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function assert(name: string, ok: boolean, detail = ""): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

function testProfile(partial: Partial<UserProfile> & Pick<UserProfile, "id" | "birth" | "bazi" | "diagnosis">): UserProfile {
  return {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "test",
    ...partial,
  } as UserProfile;
}

const profileA = {
  user_profile: testProfile({
    id: "rec-title-a",
    birth: { year: 1985, month: 12, day: 15, hour_period: "yin", gender: "M", timezone: "Asia/Shanghai" },
    bazi: { yearPillar: "丁巳", monthPillar: "癸丑", dayPillar: "乙子", hourPillar: "戊寅" },
    diagnosis: { dayMaster: "乙木", favorableElements: ["水"], challengingElements: [], patternSummary: "test" },
  }),
  base_analysis: {
    content: {
      bazi: {
        year_stem: "丁",
        year_branch: "巳",
        month_stem: "癸",
        month_branch: "丑",
        day_stem: "乙",
        day_branch: "子",
        hour_stem: "戊",
        hour_branch: "寅",
      },
      gender: "M" as const,
      yong_shen: { primary_element: "水" as const },
      wuxing_distribution: { 木: 2, 火: 1, 土: 2, 金: 0, 水: 2 },
      da_yun: { current: { stem: "辛", branch: "亥", is_favorable: true } },
    },
  },
};

const profileB = {
  user_profile: testProfile({
    id: "rec-title-b",
    birth: { year: 1988, month: 2, day: 22, hour_period: "wei", gender: "F", timezone: "Asia/Shanghai" },
    bazi: { yearPillar: "戊午", monthPillar: "甲寅", dayPillar: "庚丑", hourPillar: "丁亥" },
    diagnosis: { dayMaster: "庚金", favorableElements: ["木"], challengingElements: [], patternSummary: "test" },
  }),
  base_analysis: {
    content: {
      bazi: {
        year_stem: "戊",
        year_branch: "午",
        month_stem: "甲",
        month_branch: "寅",
        day_stem: "庚",
        day_branch: "丑",
        hour_stem: "丁",
        hour_branch: "亥",
      },
      gender: "F" as const,
      yong_shen: { primary_element: "木" as const },
      wuxing_distribution: { 木: 2, 火: 2, 土: 2, 金: 1, 水: 1 },
      da_yun: { current: { stem: "丁", branch: "巳", is_favorable: true } },
    },
  },
};

function runUnitTests(): void {
  console.log("\n=== recommendations title guard (unit) ===\n");

  assert("detect Four Steps", extractMentionedActionCount("Four Steps to Better Collaboration") === 4);
  assert("detect 5 Ways", extractMentionedActionCount("5 Ways to Grow Together") === 5);
  assert("detect 三步", extractMentionedActionCount("三步把好兼容性变成好协作") === 3);
  assert("no count in neutral title", extractMentionedActionCount("How to Turn Good Compatibility into Great Collaboration") === null);
  assert(
    "mismatch Four vs 5 actions",
    recommendationsTitleCountMismatch("Four Steps to Better Collaboration", 5),
  );
  assert(
    "match Five vs 5 actions",
    !recommendationsTitleCountMismatch("Five Steps to Better Collaboration", 5),
  );
}

function runPromptChecks(): void {
  console.log("\n=== prompt rule presence ===\n");

  const ruleSnippet = "recommendations.title 禁止写死步骤数";
  assert("match-base branding rule", MATCH_OUTPUT_BRANDING.includes(ruleSnippet));
  assert("match-base actions.length rule", MATCH_OUTPUT_BRANDING.includes("actions 数组实际长度"));

  const matrix = calculateCompatibilityMatrix({
    profileA: profileA as never,
    profileB: profileB as never,
  });
  const { system } = buildMatchPrompt({
    a_profile: profileA.user_profile,
    a_base_analysis: profileA.base_analysis.content,
    b_profile: profileB.user_profile,
    b_base_analysis: profileB.base_analysis.content,
    compatibilityMatrix: matrix,
    relationship_description:
      "We have been dating for two years and wonder if we are ready to move in together.",
    locale: "en",
  });
  assert("deepseek recommendations section rule", system.includes(ruleSnippet));
  assert("deepseek key rules #9", system.includes("若提及数量必须 === actions.length"));
}

async function runLiveCheck(): Promise<void> {
  console.log("\n=== live Match (recommendations title) ===\n");
  loadEnvLocal();

  if (!isOpenRouterConfigured()) {
    console.log("  SKIP live — OPENROUTER_API_KEY not set");
    return;
  }

  const relationship =
    "We have been together for three years and want five concrete ways to improve how we handle money, boundaries, and long-term planning before moving in.";
  const result = await generateMatchAnalysis({
    a_profile_id: profileA.user_profile.id,
    b_profile_id: profileB.user_profile.id,
    relationship_description: relationship,
    locale: "en",
    a_user_profile: profileA.user_profile,
    a_base_analysis: profileA.base_analysis.content,
    b_user_profile: profileB.user_profile,
    b_base_analysis: profileB.base_analysis.content,
  });

  const { title } = result.report.recommendations;
  const actionCount = result.report.recommendations.actions.length;

  console.log(`  actions: ${actionCount}`);
  console.log(`  title: ${title}`);

  assert("live actions 4-6", actionCount >= 4 && actionCount <= 6, String(actionCount));
  assert(
    "live title has no hardcoded step count",
    !recommendationsTitleHasHardcodedCount(title),
    title,
  );
  assert(
    "live title count matches actions (if any)",
    !recommendationsTitleCountMismatch(title, actionCount),
    `mentioned=${extractMentionedActionCount(title)} actions=${actionCount}`,
  );

  if (actionCount === 5) {
    assert("sample produced 5 actions", true);
  } else {
    console.log(`  NOTE: got ${actionCount} actions (wanted 5 for sample; title rules still checked)`);
  }
}

async function main(): Promise<void> {
  runUnitTests();
  runPromptChecks();
  if (LIVE) {
    await runLiveCheck();
  } else {
    console.log("\n  (Run with --live to call LLM and verify output title)\n");
  }

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`, failures.join(", "));
    process.exit(1);
  }
  console.log("\nAll checks passed.\n");
}

void main();
