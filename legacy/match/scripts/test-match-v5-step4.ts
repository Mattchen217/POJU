/**
 * Match v5 Step 4 — select B page static checks.
 * Run: pnpm exec tsx scripts/test-match-v5-step4.ts
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

const selectB = read("components/match/MatchSelectBPage.tsx");
const copy = read("lib/poju/session-prep-copy.ts");

assert(selectB.includes("match_a_profile_id"), "requires A profile");
assert(selectB.includes("profile_id !== aId"), "filters out A from list");
assert(selectB.includes("match_b_profile_id"), "stores B profile id");
assert(selectB.includes("/match/relationship"), "navigates to relationship");
assert(selectB.includes("cannot_match_self"), "self-match guard");
assert(selectB.includes('matchPerson="b"'), "B welcome copy");

assert(copy.includes('matchPerson === "b"'), "match B welcome text");

const en = JSON.parse(read("messages/en.json")) as { match?: Record<string, string> };
assert(en.match?.select_b_title === "Person B", "en select_b_title");

console.log("Match v5 Step 4: static checks passed.");
