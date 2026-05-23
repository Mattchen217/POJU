/**
 * Match v5 Step 7 — analyzing page static checks.
 * Run: pnpm exec tsx scripts/test-match-v5-step7.ts
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

const page = read("components/match/MatchAnalyzingPage.tsx");
const archive = read("lib/archive/archive-service.ts");

assert(page.includes("/api/match/analyze"), "calls analyze API");
assert(page.includes("createMatchSession"), "creates session");
assert(page.includes("recordUsage(\"match\""), "device_usage");
assert(page.includes("saveMatchToArchive"), "archive save");
assert(page.includes("match_relationship"), "reads relationship");
assert(page.includes("/match/result/"), "navigates to result");

assert(archive.includes("saveMatchToArchive"), "archive service");
assert(archive.includes("match_session"), "match_session type");

for (const loc of locales) {
  const json = JSON.parse(read(`messages/${loc}.json`)) as {
    match?: { analyzing?: Record<string, string> };
  };
  assert(Boolean(json.match?.analyzing?.step_7), `${loc}: step_7`);
  assert(Boolean(json.match?.analyzing?.hint), `${loc}: hint`);
}

console.log("Match v5 Step 7: static checks passed.");
