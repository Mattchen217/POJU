/**
 * Syncro v5 Step 11 — archive integration smoke tests.
 * Run: pnpm exec tsx scripts/test-syncro-v5-step11.ts
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

const archive = read("lib/archive/archive-service.ts");
const computing = read("components/syncro/SyncroComputingPage.tsx");
const detail = read("components/archive/archive-detail-client.tsx");
const syncroDetail = read("components/archive/syncro-archive-detail.tsx");

assert(archive.includes("SyncroTaskArchiveData"), "SyncroTaskArchiveData type");
assert(archive.includes("saveSyncroToArchive"), "saveSyncroToArchive");
assert(archive.includes("loadSyncroArchive"), "loadSyncroArchive");
assert(archive.includes('type: "syncro_task"'), "syncro_task archive type");
assert(archive.includes("scoreForCurrentLevel"), "score helper");

assert(computing.includes("saveSyncroToArchive"), "computing calls archive");

assert(detail.includes("loadSyncroArchive"), "detail loads syncro");
assert(detail.includes("SyncroArchiveDetail"), "SyncroArchiveDetail used");

assert(syncroDetail.includes("syncro_session_id"), "link to live session");

console.log("Syncro v5 Step 11: static archive checks passed.");
