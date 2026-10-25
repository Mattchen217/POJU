/**
 * Match v5 Step 1 — static scaffold + type checks.
 * Run: pnpm exec tsx scripts/test-match-v5-step1.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SYNERGY_TYPES } from "../lib/match/types";

const root = join(import.meta.dirname ?? __dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const required = [
  "lib/match/types.ts",
  "lib/match/match-session.ts",
  "lib/db/poju-db.ts",
  "app/[locale]/(marketing)/match/page.tsx",
  "app/[locale]/(marketing)/match/select-a/page.tsx",
  "app/[locale]/(marketing)/match/select-b/page.tsx",
  "app/[locale]/(marketing)/match/relationship/page.tsx",
  "app/[locale]/(marketing)/match/analyzing/page.tsx",
  "app/[locale]/(marketing)/match/result/[id]/page.tsx",
  "app/api/match/analyze/route.ts",
  "components/match/MatchProfileSelector.tsx",
  "components/match/RelationshipInput.tsx",
  "components/match/MatchAnalyzingLoader.tsx",
  "components/match/MatchReport.tsx",
  "components/match/MatchReportCard.tsx",
  "lib/llm/prompts/match-deepseek-prompt.ts",
  "lib/llm/services/match-analysis-service.ts",
  "styles/match.css",
  "messages/en/match.json",
  "messages/zh/match.json",
  "messages/de/match.json",
  "messages/fr/match.json",
  "messages/es/match.json",
];

for (const rel of required) {
  assert(existsSync(join(root, rel)), `missing ${rel}`);
}

assert(Object.keys(SYNERGY_TYPES).length === 5, "5 synergy types");

console.log("Match v5 Step 1: static checks passed.");
console.log("SYNERGY_TYPES:", Object.keys(SYNERGY_TYPES).join(", "));
