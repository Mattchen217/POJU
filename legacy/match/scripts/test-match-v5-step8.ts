/**
 * Match v5 Step 8 — report UI static checks.
 * Run: pnpm exec tsx scripts/test-match-v5-step8.ts
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

const report = read("components/match/MatchReport.tsx");
const card = read("components/match/MatchReportCard.tsx");
const result = read("components/match/MatchResultPage.tsx");
const css = read("styles/match.css");

assert(report.includes("MatchReportCard"), "uses cards");
assert(report.includes("SYNERGY_TYPES"), "synergy signal panel");
assert(report.includes("synergy-signal-track"), "signal track bars");
assert(report.includes("ActionItem"), "action items");
assert(report.includes("/archive"), "archive link");

assert(card.includes("aria-expanded"), "a11y expand");
assert(card.includes("expanded"), "expand state");

assert(result.includes("loadMatchSession"), "loads session");

assert(css.includes(".match-report"), "report styles");
assert(css.includes(".match-report-card"), "card styles");

for (const loc of locales) {
  const json = JSON.parse(read(`messages/${loc}.json`)) as {
    match?: { report?: Record<string, string>; result?: Record<string, string> };
  };
  assert(Boolean(json.match?.report?.new_match), `${loc}: new_match`);
  assert(Boolean(json.match?.result?.not_found), `${loc}: not_found`);
}

console.log("Match v5 Step 8: static checks passed.");
