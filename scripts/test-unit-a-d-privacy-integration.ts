/**
 * A–D integration smoke — Local-First privacy lifecycle boundaries.
 *
 *   pnpm test:unit-a-d-privacy-integration
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";

import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { __resetPojuDbForTests } from "../lib/db/poju-db";
import { sessionHasLocalPrivateContent, hasMeaningfulValue } from "../lib/poju/session-authority/privacy-boundary";
import type { POJUSessionState } from "../lib/poju/types";
import {
  bindBrowserTaskCredential,
  generateBrowserTaskCredential,
  assertBrowserTaskCredential,
} from "../lib/poju/decision-intake/browser-task-credential";
import {
  persistCredentialAfterStart,
  resolveCredentialForReportStart,
  loadReportTaskCredential,
} from "../lib/poju/decision-intake/browser-task-credential-client";
import {
  ensureReportLifecycleStarted,
  markReportLifecycleCompleted,
  purgeReportPersonalContent,
  REPORT_COMPLETED_UNACKED_TTL_SECONDS,
  REPORT_JOB_ABSOLUTE_TTL_SECONDS,
} from "../lib/poju/decision-intake/report-data-lifecycle";
import { persistLocalDeliveryReport } from "../lib/poju/decision-intake/delivery-ack-client";
import { acknowledgeReportDelivery } from "../lib/poju/decision-intake/delivery-ack";
import { durableKv } from "../lib/kv/client";
import { di2CompletedReportKey } from "../lib/poju/decision-intake/decision-report-store";
import { deliveryAckKey } from "../lib/poju/decision-intake/delivery-ack";

installIntakeR6TestGlobals("dev_unit_ad_integration");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "unit-ad-integration-secret";
}

const asyncTest = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`PASS ${name}`);
};

async function main() {
  console.log("A–D privacy integration smoke starting");
  await __resetPojuDbForTests();

  await asyncTest("A: private local session detected; numbers meaningful", async () => {
    assert.equal(hasMeaningfulValue(0), true);
    const local = {
      session_id: "ad_sess",
      device_id: "browser-a",
      original_question: "",
      messages: [],
      context_collected: { n: 0 },
      has_profile: false,
      profile_skipped: false,
      actions: [],
      main_delivery_done: false,
      main_delivery: null,
      tokens_used: 0,
      abuse_metrics: { long_input_count: 0, jailbreak_attempts: 0, duplicate_attempts: 0 },
      created_at: "2026-11-28T00:00:00.000Z",
      last_interaction_at: "2026-11-28T00:00:00.000Z",
      expires_at: "2026-12-28T00:00:00.000Z",
    } as POJUSessionState;
    assert.equal(sessionHasLocalPrivateContent(local), true);
  });

  await asyncTest("B→C→D: credential bind → lifecycle → local persist → ACK purge", async () => {
    const session_id = "ad_flow_sess";
    const job_id = "ad_flow_job";
    const credential = await resolveCredentialForReportStart({ session_id });
    await persistCredentialAfterStart({ session_id, job_id, credential });
    assert.equal(await loadReportTaskCredential(session_id, job_id), credential);

    const bound = await bindBrowserTaskCredential({ job_id, session_id, credential });
    assert.equal(bound.ok, true);
    const gate = await assertBrowserTaskCredential({ job_id, session_id, credential });
    assert.equal(gate.ok, true);

    await ensureReportLifecycleStarted({ job_id, session_id });
    await markReportLifecycleCompleted({ job_id });
    assert.equal(REPORT_JOB_ABSOLUTE_TTL_SECONDS, 60 * 60 * 24 * 14);
    assert.equal(REPORT_COMPLETED_UNACKED_TTL_SECONDS, 60 * 60 * 24 * 7);

    const full_text = "# AD report\n\nsecret";
    const committed_at = "2026-11-28T12:00:00.000Z";
    const report_job_id = "rj_ad";
    const local = await persistLocalDeliveryReport({
      session_id,
      job_id,
      report_job_id,
      committed_at,
      full_text,
    });
    assert.equal(local.ok, true);
    if (!local.ok) return;

    // Cross-browser credential must fail.
    const other = generateBrowserTaskCredential();
    const cross = await assertBrowserTaskCredential({
      job_id,
      session_id,
      credential: other,
    });
    assert.equal(cross.ok, false);

    // Without CompletedReport, ACK stays incomplete — then simulate prior ACK+purge path.
    const incomplete = await acknowledgeReportDelivery({
      session_id,
      job_id,
      browser_task_credential: credential,
      content_integrity: local.content_integrity,
      local_persisted: true,
    });
    assert.equal(incomplete.ok, false);

    const reportKey = di2CompletedReportKey(session_id, job_id);
    await durableKv().set(reportKey, { body: "cloud copy" }, { ex: 60 });
    await durableKv().set(
      deliveryAckKey(job_id),
      {
        v: 1,
        job_id,
        session_id,
        content_integrity: local.content_integrity,
        acked_at: committed_at,
        purge_attempted_at: null,
        purge_completed_at: null,
      },
      { ex: 60 },
    );
    const ack = await acknowledgeReportDelivery({
      session_id,
      job_id,
      browser_task_credential: credential,
      content_integrity: local.content_integrity,
      local_persisted: true,
    });
    assert.equal(ack.ok, true);
    assert.equal(await durableKv().get(reportKey), null);

    // Local copy remains.
    const { loadLocalDeliveryReport } = await import(
      "../lib/poju/decision-intake/delivery-ack-client"
    );
    const kept = await loadLocalDeliveryReport(session_id, job_id);
    assert.equal(kept?.full_text, full_text);

    // Extra purge is safe.
    await purgeReportPersonalContent({ job_id, session_id, reason: "ack" });
    assert.equal(await durableKv().get(reportKey), null);
  });

  console.log("A–D privacy integration smoke complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
