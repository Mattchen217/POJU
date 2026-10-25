/**
 * Match v5 Step 3 — select A + SessionPreparation match support.
 * Run: pnpm exec tsx scripts/test-match-v5-step3.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname ?? __dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const selectA = read("components/match/MatchSelectAPage.tsx");
const prep = read("components/poju/SessionPreparation.tsx");
const copy = read("lib/poju/session-prep-copy.ts");

assert(selectA.includes('productType="match"'), "SessionPreparation match");
assert(selectA.includes("match_a_profile_id"), "stores A profile id");
assert(selectA.includes("/match/select-b"), "navigates to select-b");
assert(selectA.includes("customLabel"), "customLabel prop");

assert(prep.includes('productType === "match"'), "match back link");
assert(prep.includes("customLabel"), "customLabel in SessionPreparation");
assert(prep.includes("match-brand"), "match brand class");

assert(copy.includes('"match"'), "SessionPrepProduct match");
assert(copy.includes('productType === "match"'), "match welcome text");

const en = JSON.parse(read("messages/en.json")) as { match?: Record<string, string> };
assert(en.match?.select_a_title === "Person A", "en select_a_title");

console.log("Match v5 Step 3: static checks passed.");
