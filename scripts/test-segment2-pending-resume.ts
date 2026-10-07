/**
 * Segment-2 pending job id persist / clear (refresh resume).
 * Run: pnpm exec tsx scripts/test-segment2-pending-resume.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  clearPendingSegment2Job,
  withPendingSegment2Job,
} from "../lib/poju/phases/segment2/control";
import type { POJUSessionState } from "../lib/poju/types";

const base = {
  session_id: "s_test",
  pending_segment2_job_id: null,
  pending_segment2_stage: null,
} as unknown as POJUSessionState;

const withA = withPendingSegment2Job(base, "s2a_abc", "report");
assert.equal(withA.pending_segment2_job_id, "s2a_abc");
assert.equal(withA.pending_segment2_stage, "report");

const withB = withPendingSegment2Job(withA, "s2b_xyz", "agenda");
assert.equal(withB.pending_segment2_job_id, "s2b_xyz");
assert.equal(withB.pending_segment2_stage, "agenda");

const cleared = clearPendingSegment2Job(withB);
assert.equal(cleared.pending_segment2_job_id, null);
assert.equal(cleared.pending_segment2_stage, null);

const types = readFileSync(resolve(__dirname, "../lib/poju/types.ts"), "utf8");
assert.ok(types.includes("pending_segment2_job_id"));
assert.ok(types.includes("pending_segment2_stage"));

const ui = readFileSync(resolve(__dirname, "../components/poju/POJUChatUI.tsx"), "utf8");
assert.ok(ui.includes("resume pending job after remount"));
assert.ok(ui.includes("persistPendingSegment2Job"));
assert.ok(ui.includes("KV probe Call A"));

const control = readFileSync(
  resolve(__dirname, "../lib/poju/phases/segment2/control.ts"),
  "utf8",
);
assert.ok(control.includes("withPendingSegment2Job(sessionPending"));
assert.ok(control.includes("clearPendingSegment2Job"));

console.log("ok: segment2 pending resume wiring");
