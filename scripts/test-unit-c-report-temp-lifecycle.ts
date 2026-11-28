/**
 * Unit C — temporary cloud storage + TTL for background report jobs.
 *
 *   pnpm test:unit-c-report-temp-lifecycle
 */
import assert from "node:assert/strict";

import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { KV_TTL } from "../lib/kv/client";
import { bindBrowserTaskCredential, generateBrowserTaskCredential } from "../lib/poju/decision-intake/browser-task-credential";
import {
  ensureReportLifecycleStarted,
  isReportLifecycleContentExpired,
  loadReportLifecycle,
  markReportLifecycleCompleted,
  purgeReportPersonalContent,
  REPORT_COMPLETED_UNACKED_TTL_SECONDS,
  REPORT_JOB_ABSOLUTE_TTL_SECONDS,
  REPORT_LIFECYCLE_PLATFORM_LIMITS,
  reportAbsoluteTtlSeconds,
  reportCompletedContentTtlSeconds,
} from "../lib/poju/decision-intake/report-data-lifecycle";
import { durableKv } from "../lib/kv/client";
import { di2CompletedReportKey } from "../lib/poju/decision-intake/decision-report-store";

installIntakeR6TestGlobals("dev_unit_c_lifecycle");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "unit-c-lifecycle-test-secret";
}

const asyncTest = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`PASS ${name}`);
};

async function main() {
  console.log("Unit C report temporary lifecycle tests starting");

  await asyncTest("1. TTL constants: 14d absolute, 7d completed-unacked (not 60d)", async () => {
    assert.equal(REPORT_JOB_ABSOLUTE_TTL_SECONDS, 60 * 60 * 24 * 14);
    assert.equal(REPORT_COMPLETED_UNACKED_TTL_SECONDS, 60 * 60 * 24 * 7);
    assert.equal(reportAbsoluteTtlSeconds(), REPORT_JOB_ABSOLUTE_TTL_SECONDS);
    assert.equal(reportCompletedContentTtlSeconds(), REPORT_COMPLETED_UNACKED_TTL_SECONDS);
    assert.equal(KV_TTL.DECISION_AUTHORITY_RETENTION, REPORT_COMPLETED_UNACKED_TTL_SECONDS);
    assert.equal(KV_TTL.REPORT_JOB_ABSOLUTE, REPORT_JOB_ABSOLUTE_TTL_SECONDS);
    assert.ok(KV_TTL.REPORT_BATCH2_JOB < REPORT_JOB_ABSOLUTE_TTL_SECONDS);
    assert.ok(REPORT_LIFECYCLE_PLATFORM_LIMITS.inngest_step_output_retention.length > 0);
  });

  await asyncTest("2. Lifecycle starts on credential bind; absolute expiry does not extend on read", async () => {
    const job_id = "job_c_life_1";
    const session_id = "sess_c_life_1";
    const credential = generateBrowserTaskCredential();
    const now = "2026-11-01T00:00:00.000Z";
    await bindBrowserTaskCredential({ job_id, session_id, credential, now });
    const life = await loadReportLifecycle(job_id);
    assert.ok(life);
    assert.equal(life!.state, "running");
    assert.equal(life!.created_at, now);
    assert.equal(life!.absolute_expires_at, "2026-11-15T00:00:00.000Z");
    // Re-read / re-bind must not extend absolute clock.
    await bindBrowserTaskCredential({
      job_id,
      session_id,
      credential,
      now: "2026-11-10T00:00:00.000Z",
    });
    const again = await loadReportLifecycle(job_id);
    assert.equal(again!.absolute_expires_at, "2026-11-15T00:00:00.000Z");
  });

  await asyncTest("3. Completed-unacked starts 7-day content clock", async () => {
    const job_id = "job_c_life_2";
    const session_id = "sess_c_life_2";
    await ensureReportLifecycleStarted({
      job_id,
      session_id,
      now: "2026-11-01T00:00:00.000Z",
    });
    const completed = await markReportLifecycleCompleted({
      job_id,
      now: "2026-11-02T12:00:00.000Z",
    });
    assert.ok(completed);
    assert.equal(completed!.state, "completed_unacked");
    assert.equal(completed!.completed_at, "2026-11-02T12:00:00.000Z");
    assert.equal(completed!.content_expires_at, "2026-11-09T12:00:00.000Z");
  });

  await asyncTest("4. TTL / absolute expiry detection + purge removes personal content keys", async () => {
    const job_id = "job_c_purge_1";
    const session_id = "sess_c_purge_1";
    await ensureReportLifecycleStarted({
      job_id,
      session_id,
      now: "2026-01-01T00:00:00.000Z",
    });
    await markReportLifecycleCompleted({ job_id, now: "2026-01-01T01:00:00.000Z" });
    const life = await loadReportLifecycle(job_id);
    assert.ok(life);
    assert.equal(isReportLifecycleContentExpired(life!, Date.parse("2026-01-10T02:00:00.000Z")), true);

    await durableKv().set(
      di2CompletedReportKey(session_id, job_id),
      { job_id, session_id, full_text: "SECRET REPORT BODY" },
      { ex: 3600 },
    );
    const before = await durableKv().get(di2CompletedReportKey(session_id, job_id));
    assert.ok(before);

    const purged = await purgeReportPersonalContent({
      job_id,
      session_id,
      reason: "ttl",
      now: "2026-01-10T02:00:00.000Z",
    });
    assert.ok(purged.purged_keys.includes(di2CompletedReportKey(session_id, job_id)));
    const after = await durableKv().get(di2CompletedReportKey(session_id, job_id));
    assert.equal(after, null);
    const tomb = await loadReportLifecycle(job_id);
    assert.equal(tomb!.state, "purged");
    assert.ok(tomb!.last_purge_at);
  });

  await asyncTest("5. Inngest / Batch2 platform limits are documented; execution TTL stays short", async () => {
    assert.equal(KV_TTL.REPORT_BATCH2_JOB, 60 * 60 * 2);
    assert.equal(KV_TTL.POJU_XHIGH_JOB, 60 * 60 * 2);
    assert.match(REPORT_LIFECYCLE_PLATFORM_LIMITS.note, /identity-only/i);
  });

  console.log("Unit C report temporary lifecycle tests complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
