/**
 * Match v5 Step 2 — home page + i18n static checks.
 * Run: pnpm exec tsx scripts/test-match-v5-step2.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname ?? __dirname, "..");
const locales = ["en", "zh", "de", "fr", "es"] as const;

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(existsSync(join(root, "components/match/MatchHomePage.tsx")), "MatchHomePage");
assert(existsSync(join(root, "app/[locale]/(marketing)/match/payment/page.tsx")), "payment page");

const home = read("components/match/MatchHomePage.tsx");
assert(home.includes('isFirstTimeFree("match")'), "device_usage match");
assert(home.includes("match_session_type"), "session type storage");
assert(home.includes("/match/select-a"), "free → select-a");
assert(home.includes("/match/payment"), "paid → payment");

for (const loc of locales) {
  const json = JSON.parse(read(`messages/${loc}.json`)) as { match?: Record<string, string> };
  assert(Boolean(json.match?.start_free), `${loc}: match.start_free`);
  assert(Boolean(json.match?.start_paid), `${loc}: match.start_paid`);
  assert(Boolean(json.match?.use_case_4), `${loc}: match.use_case_4`);
}

const css = read("styles/match.css");
assert(css.includes(".match-home"), "match-home styles");

console.log("Match v5 Step 2: static checks passed.");
