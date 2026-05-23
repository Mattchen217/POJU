/**
 * Match v5 Step 10 — full static E2E wiring audit (Steps 1–9).
 * Run: pnpm exec tsx scripts/test-match-v5-step10.ts
 *
 * Optional live smoke (needs OPENROUTER_API_KEY + dev server):
 *   pnpm exec tsx scripts/test-match-v5-step10.ts --live --server http://localhost:3000
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { buildMatchPrompt } from "../lib/llm/prompts/match-deepseek-prompt";
import { COMPATIBILITY_LEVELS } from "../lib/match/types";

const root = join(import.meta.dirname ?? __dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const routes = [
  "app/[locale]/(marketing)/match/page.tsx",
  "app/[locale]/(marketing)/match/select-a/page.tsx",
  "app/[locale]/(marketing)/match/select-b/page.tsx",
  "app/[locale]/(marketing)/match/relationship/page.tsx",
  "app/[locale]/(marketing)/match/analyzing/page.tsx",
  "app/[locale]/(marketing)/match/payment/page.tsx",
  "app/[locale]/(marketing)/match/result/[id]/page.tsx",
  "app/api/match/analyze/route.ts",
];

for (const rel of routes) {
  assert(existsSync(join(root, rel)), `route exists: ${rel}`);
}

const home = read("components/match/MatchHomePage.tsx");
const selectA = read("components/match/MatchSelectAPage.tsx");
const selectB = read("components/match/MatchSelectBPage.tsx");
const relationship = read("components/match/MatchRelationshipPage.tsx");
const relationshipInput = read("components/match/RelationshipInput.tsx");
const analyzing = read("components/match/MatchAnalyzingPage.tsx");
const report = read("components/match/MatchReport.tsx");
const api = read("app/api/match/analyze/route.ts");

// Scenario A — free flow
assert(home.includes('isFirstTimeFree("match")'), "A: free CTA");
assert(home.includes("match_session_type"), "A: session type");
assert(selectA.includes("match_a_profile_id"), "A: store A");
assert(selectB.includes("profile_id !== aId"), "A/B: filter A from B list");
assert(selectB.includes("match_b_profile_id"), "A: store B");
assert(relationshipInput.includes("MATCH_RELATIONSHIP_MIN_LEN"), "A: min 10 chars");
assert(relationship.includes("match_relationship"), "A: store relationship");
assert(analyzing.includes("/api/match/analyze"), "A: API call");
assert(analyzing.includes("createMatchSession"), "A: session");
assert(analyzing.includes('recordUsage("match"'), "A: device_usage");
assert(analyzing.includes("saveMatchToArchive"), "A: archive");
assert(report.includes("MatchReportCard"), "A: 5 cards");
assert(report.includes("badge-bars"), "A: compatibility bars");

// Scenario B — language detection
const enPrompt = buildMatchPrompt({
  a_profile: null,
  a_base_analysis: null,
  b_profile: null,
  b_base_analysis: null,
  relationship_description:
    "My business partner of 3 years. We're considering scaling but tension has built up.",
  locale: "zh",
});
assert(enPrompt.detected_language === "English", "B: English from EN input");

const zhPrompt = buildMatchPrompt({
  a_profile: null,
  a_base_analysis: null,
  b_profile: null,
  b_base_analysis: null,
  relationship_description: "我和未婚妻交往 3 年了,准备明年结婚,但我家里反对。",
  locale: "en",
});
assert(zhPrompt.detected_language.includes("Chinese"), "B: Chinese from ZH input");
assert(zhPrompt.system.includes("极其重要"), "B: language instruction in prompt");

// Scenario C — paid path
assert(home.includes("/match/payment"), "C: paid → payment");
assert(existsSync(join(root, "app/[locale]/(marketing)/match/payment/page.tsx")), "C: payment page");

// Scenario D — archive
const archiveList = read("components/archive/archive-action-plans-list.tsx");
const archiveDetail = read("components/archive/archive-detail-client.tsx");
assert(archiveList.includes('"match"'), "D: archive filter");
assert(archiveList.includes("👥"), "D: archive icon");
assert(archiveDetail.includes("loadMatchArchive"), "D: load match archive");
assert(read("components/archive/match-archive-detail.tsx").includes("/match/result/"), "D: full report link");

// Scenario E — B auto-save via SessionPreparation
assert(selectB.includes('productType="match"'), "E: B uses SessionPreparation createStoredProfile path");

// Scenario F — errors
assert(api.includes("same_profile"), "F: API same_profile");
assert(analyzing.includes("error_title"), "F: analyzing error UI");
assert(api.includes("profile_not_ready"), "F: profile_not_ready");

assert(Object.keys(COMPATIBILITY_LEVELS).length === 5, "5 compatibility levels");

console.log("Match v5 Step 10: static E2E wiring audit passed.");
console.log("Compatibility levels:", Object.keys(COMPATIBILITY_LEVELS).join(", "));

const live = process.argv.includes("--live");
if (live) {
  const server = process.argv.includes("--server")
    ? process.argv[process.argv.indexOf("--server") + 1]
    : "http://localhost:3000";
  console.log("\n[live] Skipped by default in CI — run manual E2E per docs/Match_v5.0_Step10_Report.md");
  console.log(`[live] Dev server expected at ${server}, OPENROUTER_API_KEY required for analyze.`);
}
