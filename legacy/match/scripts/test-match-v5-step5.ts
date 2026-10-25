/**
 * Match v5 Step 5 — relationship input static checks.
 * Run: pnpm exec tsx scripts/test-match-v5-step5.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname ?? __dirname, "..");
const locales = ["en", "zh", "de", "fr", "es"] as const;

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const page = read("components/match/MatchRelationshipPage.tsx");
const input = read("components/match/RelationshipInput.tsx");

assert(page.includes("match_relationship"), "stores relationship");
assert(page.includes("/match/analyzing"), "navigates to analyzing");
assert(input.includes("MATCH_RELATIONSHIP_MIN_LEN"), "min length constant");
assert(input.includes("MATCH_RELATIONSHIP_MAX_LEN"), "max length constant");
assert(input.includes("language_hint"), "language hint shown");

for (const loc of locales) {
  const json = JSON.parse(read(`messages/${loc}.json`)) as {
    match?: { relationship?: Record<string, string> };
  };
  assert(Boolean(json.match?.relationship?.analyze_button), `${loc}: analyze_button`);
  assert(Boolean(json.match?.relationship?.language_hint), `${loc}: language_hint`);
}

console.log("Match v5 Step 5: static checks passed.");
