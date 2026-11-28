/**
 * Unit D — local delivery ACK + cloud personal-content cleanup.
 *
 *   pnpm test:unit-d-delivery-ack-cleanup
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";

import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { __resetPojuDbForTests } from "../lib/db/poju-db";
import { durableKv } from "../lib/kv/client";
import {
  bindBrowserTaskCredential,
  generateBrowserTaskCredential,
} from "../lib/poju/decision-intake/browser-task-credential";
import {
  acknowledgeReportDelivery,
  computeDeliveryContentIntegrity,
  deliveryAckKey,
  loadDeliveryAck,
} from "../lib/poju/decision-intake/delivery-ack";
import {
  loadLocalDeliveryReport,
  persistLocalDeliveryReport,
} from "../lib/poju/decision-intake/delivery-ack-client";
import { handleDecisionReportAction } from "../lib/poju/decision-intake/decision-report-api";
import { di2CompletedReportKey } from "../lib/poju/decision-intake/decision-report-store";
import {
  ensureReportLifecycleStarted,
  loadReportLifecycle,
  markReportLifecycleCompleted,
  purgeReportPersonalContent,
} from "../lib/poju/decision-intake/report-data-lifecycle";

installIntakeR6TestGlobals("dev_unit_d_ack");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "unit-d-ack-test-secret";
}

const asyncTest = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`PASS ${name}`);
};

async function main() {
  console.log("Unit D delivery ACK cleanup tests starting");
  await __resetPojuDbForTests();

  await asyncTest("1. Local IndexedDB persist + re-read integrity required before ACK", async () => {
    const session_id = "sess_d_local";
    const job_id = "job_d_local";
    const full_text = "# Local report\n\nbody";
    const committed_at = "2026-11-28T12:00:00.000Z";
    const report_job_id = "rj_d_local";
    const integrity = computeDeliveryContentIntegrity({ report_job_id, full_text, committed_at });

    const saved = await persistLocalDeliveryReport({
      session_id,
      job_id,
      report_job_id,
      committed_at,
      full_text,
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.content_integrity, integrity);

    const loaded = await loadLocalDeliveryReport(session_id, job_id);
    assert.ok(loaded);
    assert.equal(loaded!.full_text, full_text);
    assert.ok(loaded!.verified_at > 0);

    const empty = await persistLocalDeliveryReport({
      session_id,
      job_id: "job_empty",
      report_job_id,
      committed_at,
      full_text: "   ",
    });
    assert.equal(empty.ok, false);
  });

  await asyncTest("2. ACK refuses without local_persisted / credential / incomplete report", async () => {
    const session_id = "sess_d_gate";
    const job_id = "job_d_gate";
    const credential = generateBrowserTaskCredential();
    await bindBrowserTaskCredential({ job_id, session_id, credential });

    const noLocal = await acknowledgeReportDelivery({
      session_id,
      job_id,
      browser_task_credential: credential,
      content_integrity: "a".repeat(64),
      local_persisted: false,
    });
    assert.equal(noLocal.ok, false);
    if (!noLocal.ok) assert.equal(noLocal.code, "LOCAL_PERSIST_REQUIRED");

    const noCred = await acknowledgeReportDelivery({
      session_id,
      job_id,
      browser_task_credential: null,
      content_integrity: "a".repeat(64),
      local_persisted: true,
    });
    assert.equal(noCred.ok, false);
    if (!noCred.ok) assert.equal(noCred.code, "TASK_CREDENTIAL_REQUIRED");

    const incomplete = await acknowledgeReportDelivery({
      session_id,
      job_id,
      browser_task_credential: credential,
      content_integrity: "b".repeat(64),
      local_persisted: true,
    });
    assert.equal(incomplete.ok, false);
    if (!incomplete.ok) assert.equal(incomplete.code, "REPORT_NOT_COMPLETE");
  });

  await asyncTest("3. API ack action requires credential; wrong credential refused", async () => {
    const session_id = "sess_d_api";
    const job_id = "job_d_api";
    const credential = generateBrowserTaskCredential();
    await bindBrowserTaskCredential({ job_id, session_id, credential });
    const deps = {
      background: () => undefined,
      charge: async () => {
        throw new Error("no charge");
      },
      modelConfigured: () => true,
    };
    const denied = await handleDecisionReportAction(
      {
        action: "ack",
        session_id,
        job_id,
        local_persisted: true,
        content_integrity: "c".repeat(64),
      },
      deps,
    );
    assert.equal(denied.kind, "json");
    if (denied.kind === "json") {
      assert.equal(denied.status, 401);
      assert.equal(denied.body.code, "TASK_CREDENTIAL_REQUIRED");
    }
  });

  await asyncTest("4. ACK tombstone + purge is idempotent; content cannot resurrect", async () => {
    const session_id = "sess_d_purge";
    const job_id = "job_d_purge";
    const credential = generateBrowserTaskCredential();
    const bound = await bindBrowserTaskCredential({ job_id, session_id, credential });
    assert.equal(bound.ok, true, JSON.stringify(bound));
    await ensureReportLifecycleStarted({ job_id, session_id });
    await markReportLifecycleCompleted({ job_id });

    const reportKey = di2CompletedReportKey(session_id, job_id);
    await durableKv().set(reportKey, { secret: "REPORT_BODY" }, { ex: 3600 });
    assert.ok(await durableKv().get(reportKey));

    // Simulate ACK record already present (content purged path without full CompletedReport seal).
    const integrity = "d".repeat(64);
    await durableKv().set(
      deliveryAckKey(job_id),
      {
        v: 1,
        job_id,
        session_id,
        content_integrity: integrity,
        acked_at: "2026-11-28T12:00:00.000Z",
        purge_attempted_at: null,
        purge_completed_at: null,
      },
      { ex: 3600 },
    );

    const storedAck = await loadDeliveryAck(job_id);
    assert.ok(storedAck, "ACK record must be readable before acknowledge()");

    const first = await acknowledgeReportDelivery({
      session_id,
      job_id,
      browser_task_credential: credential,
      content_integrity: integrity,
      local_persisted: true,
    });
    assert.equal(first.ok, true, JSON.stringify(first));
    if (!first.ok) return;
    assert.equal(first.outcome, "already_acked");
    assert.equal(first.purged, true);
    assert.equal(await durableKv().get(reportKey), null);

    // After purge, credential binding is gone — re-bind for idempotent second ACK path
    // that still holds the durable ACK tombstone.
    const rebound = await bindBrowserTaskCredential({ job_id, session_id, credential });
    assert.equal(rebound.ok, true, JSON.stringify(rebound));

    const second = await acknowledgeReportDelivery({
      session_id,
      job_id,
      browser_task_credential: credential,
      content_integrity: integrity,
      local_persisted: true,
    });
    assert.equal(second.ok, true, JSON.stringify(second));
    if (!second.ok) return;
    assert.equal(second.outcome, "already_acked");

    // Conflict integrity on already-acked job.
    const conflict = await acknowledgeReportDelivery({
      session_id,
      job_id,
      browser_task_credential: credential,
      content_integrity: "e".repeat(64),
      local_persisted: true,
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.code, "ACK_INTEGRITY_CONFLICT");

    const ack = await loadDeliveryAck(job_id);
    assert.ok(ack?.purge_completed_at);
  });

  await asyncTest("5. TTL purge and ACK purge share the same cleanup helper", async () => {
    const session_id = "sess_d_shared";
    const job_id = "job_d_shared";
    await ensureReportLifecycleStarted({ job_id, session_id });
    const key = di2CompletedReportKey(session_id, job_id);
    await durableKv().set(key, { body: "x" }, { ex: 60 });
    const purged = await purgeReportPersonalContent({
      job_id,
      session_id,
      reason: "ttl",
    });
    assert.ok(purged.purged_keys.includes(key));
    assert.equal(await durableKv().get(key), null);
    assert.equal((await loadReportLifecycle(job_id))?.state, "purged");
  });

  console.log("Unit D delivery ACK cleanup tests complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
