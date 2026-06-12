/**
 * Match v5 Step 9 — archive integration static checks.
 * Run: pnpm exec tsx scripts/test-match-v5-step9.ts
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

const archive = read("lib/archive/archive-service.ts");
const list = read("components/ds/DsArchiveVaultGrid.tsx");
const detail = read("components/archive/archive-detail-client.tsx");
const matchDetail = read("components/archive/match-archive-detail.tsx");

assert(archive.includes("saveMatchToArchive"), "saveMatchToArchive");
assert(archive.includes("loadMatchArchive"), "loadMatchArchive");
assert(archive.includes('type: "match_session"'), "match_session type");

assert(list.includes('"match"'), "match filter");
assert(list.includes("matchIcon"), "match icon");

assert(detail.includes("loadMatchArchive"), "detail loads match");
assert(detail.includes("MatchArchiveDetail"), "MatchArchiveDetail");

assert(matchDetail.includes("/match/result/"), "view full report link");
assert(matchDetail.includes("COMPATIBILITY_LEVELS"), "compatibility display");

for (const loc of locales) {
  const json = JSON.parse(read(`messages/${loc}.json`)) as {
    match?: { archive?: Record<string, string> };
    archiveVault?: { empty_all?: string };
  };
  assert(Boolean(json.match?.archive?.view_full_report), `${loc}: view_full_report`);
  assert(json.archiveVault?.empty_all?.includes("Match") ?? false, `${loc}: empty_all mentions Match`);
}

console.log("Match v5 Step 9: static checks passed.");
