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
import { calculateCompatibilityMatrix } from "@/lib/compatibility/calculate-compatibility";
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
  console.log(`  [${mark}] ${name}${detail ? ` â€?${detail}` : ""}`);
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
    bazi: { yearPillar: "ä¸å·³", monthPillar: "ç™¸ä¸‘", dayPillar: "ä¹™å­", hourPillar: "æˆŠå¯…" },
    diagnosis: { dayMaster: "ä¹™æœ¨", favorableElements: ["æ°?], challengingElements: [], patternSummary: "test" },
  }),
  base_analysis: {
    content: {
      bazi: {
        year_stem: "ä¸?,
        year_branch: "å·?,
        month_stem: "ç™?,
        month_branch: "ä¸?,
        day_stem: "ä¹?,
        day_branch: "å­?,
        hour_stem: "æˆ?,
        hour_branch: "å¯?,
      },
      gender: "M" as const,
      yong_shen: { primary_element: "æ°? as const },
      wuxing_distribution: { æœ? 2, ç? 1, åœ? 2, é‡? 0, æ°? 2 },
      da_yun: { current: { stem: "è¾?, branch: "äº?, is_favorable: true } },
    },
  },
};

const profileB = {
  user_profile: testProfile({
    id: "rec-title-b",
    birth: { year: 1988, month: 2, day: 22, hour_period: "wei", gender: "F", timezone: "Asia/Shanghai" },
    bazi: { yearPillar: "æˆŠåˆ", monthPillar: "ç”²å¯…", dayPillar: "åºšä¸‘", hourPillar: "ä¸äº¥" },
    diagnosis: { dayMaster: "åºšé‡‘", favorableElements: ["æœ?], challengingElements: [], patternSummary: "test" },
  }),
  base_analysis: {
    content: {
      bazi: {
        year_stem: "æˆ?,
        year_branch: "å?,
        month_stem: "ç”?,
        month_branch: "å¯?,
        day_stem: "åº?,
        day_branch: "ä¸?,
        hour_stem: "ä¸?,
        hour_branch: "äº?,
      },
      gender: "F" as const,
      yong_shen: { primary_element: "æœ? as const },
      wuxing_distribution: { æœ? 2, ç? 2, åœ? 2, é‡? 1, æ°? 1 },
      da_yun: { current: { stem: "ä¸?, branch: "å·?, is_favorable: true } },
    },
  },
};

function runUnitTests(): void {
  console.log("\n=== recommendations title guard (unit) ===\n");

  assert("detect Four Steps", extractMentionedActionCount("Four Steps to Better Collaboration") === 4);
  assert("detect 5 Ways", extractMentionedActionCount("5 Ways to Grow Together") === 5);
  assert("detect ä¸‰æ­¥", extractMentionedActionCount("ä¸‰æ­¥æŠŠå¥½å…¼å®¹æ€§å˜æˆå¥½åä½œ") === 3);
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

  const ruleSnippet = "recommendations.title ç¦æ­¢å†™æ­»æ­¥éª¤æ•?;
  assert("match-base branding rule", MATCH_OUTPUT_BRANDING.includes(ruleSnippet));
  assert("match-base actions.length rule", MATCH_OUTPUT_BRANDING.includes("actions æ•°ç»„å®é™…é•¿åº¦"));

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
  assert("deepseek key rules #9", system.includes("è‹¥æåŠæ•°é‡å¿…é¡?=== actions.length"));
}

async function runLiveCheck(): Promise<void> {
  console.log("\n=== live Match (recommendations title) ===\n");
  loadEnvLocal();

  if (!isOpenRouterConfigured()) {
    console.log("  SKIP live â€?OPENROUTER_API_KEY not set");
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
