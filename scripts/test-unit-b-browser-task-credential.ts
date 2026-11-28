/**
 * Unit B — browser-exclusive report task credential.
 *
 *   pnpm test:unit-b-browser-task-credential
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";

import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import {
  assertBrowserTaskCredential,
  bindBrowserTaskCredential,
  browserTaskCredentialLogFingerprint,
  generateBrowserTaskCredential,
  isBrowserTaskCredentialFormat,
  issueBrowserTaskCredentialVerifier,
  loadBrowserTaskCredentialRecord,
  verifyBrowserTaskCredentialMaterial,
  BROWSER_TASK_CREDENTIAL_BYTES,
} from "../lib/poju/decision-intake/browser-task-credential";
import {
  generateBrowserTaskCredentialClient,
  loadReportTaskCredential,
  persistCredentialAfterStart,
  resolveCredentialForReportStart,
  saveReportTaskCredential,
} from "../lib/poju/decision-intake/browser-task-credential-client";
import { handleDecisionReportAction } from "../lib/poju/decision-intake/decision-report-api";
import { __resetPojuDbForTests } from "../lib/db/poju-db";

installIntakeR6TestGlobals("dev_unit_b_credential");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "unit-b-credential-test-secret";
}

const asyncTest = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`PASS ${name}`);
};

async function main() {
  console.log("Unit B browser task credential tests starting");
  await __resetPojuDbForTests();

  await asyncTest("1. Credential entropy and format (256-bit)", async () => {
    const a = generateBrowserTaskCredential();
    const b = generateBrowserTaskCredential();
    assert.ok(isBrowserTaskCredentialFormat(a));
    assert.ok(isBrowserTaskCredentialFormat(b));
    assert.notEqual(a, b);
    // base64url of 32 bytes → 43 chars
    assert.ok(a.length >= 40);
    const client = generateBrowserTaskCredentialClient();
    assert.ok(isBrowserTaskCredentialFormat(client));
    assert.equal(BROWSER_TASK_CREDENTIAL_BYTES, 32);
  });

  await asyncTest("2. Server stores verifier only; raw credential never persisted", async () => {
    const job_id = "job_btc_1";
    const session_id = "sess_btc_1";
    const credential = generateBrowserTaskCredential();
    const bound = await bindBrowserTaskCredential({ job_id, session_id, credential });
    assert.equal(bound.ok, true);
    if (!bound.ok) return;
    const rec = await loadBrowserTaskCredentialRecord(job_id);
    assert.ok(rec);
    assert.equal(rec!.job_id, job_id);
    assert.equal(rec!.session_id, session_id);
    assert.ok(rec!.verifier.length > 20);
    assert.equal(JSON.stringify(rec).includes(credential), false);
    const fp = browserTaskCredentialLogFingerprint(credential);
    assert.equal(fp.includes(credential), false);
    assert.ok(
      verifyBrowserTaskCredentialMaterial(job_id, session_id, credential, rec!.verifier),
    );
    assert.equal(
      verifyBrowserTaskCredentialMaterial(job_id, session_id, generateBrowserTaskCredential(), rec!.verifier),
      false,
    );
  });

  await asyncTest("3. IndexedDB stores raw credential only on originating browser", async () => {
    const session_id = "sess_btc_idb";
    const job_id = "job_btc_idb";
    const credential = await resolveCredentialForReportStart({ session_id });
    await persistCredentialAfterStart({ session_id, job_id, credential });
    const loaded = await loadReportTaskCredential(session_id, job_id);
    assert.equal(loaded, credential);
    assert.equal(await loadReportTaskCredential(session_id, "other_job"), null);
  });

  await asyncTest("4. Gate: missing / wrong / mismatched job credentials refuse", async () => {
    const job_id = "job_btc_gate";
    const session_id = "sess_btc_gate";
    const credential = generateBrowserTaskCredential();
    await bindBrowserTaskCredential({ job_id, session_id, credential });

    const missing = await assertBrowserTaskCredential({
      job_id,
      session_id,
      credential: null,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, "TASK_CREDENTIAL_REQUIRED");

    const wrong = await assertBrowserTaskCredential({
      job_id,
      session_id,
      credential: generateBrowserTaskCredential(),
    });
    assert.equal(wrong.ok, false);
    if (!wrong.ok) assert.equal(wrong.code, "TASK_CREDENTIAL_MISMATCH");

    const otherSession = await assertBrowserTaskCredential({
      job_id,
      session_id: "sess_other",
      credential,
    });
    assert.equal(otherSession.ok, false);

    const unbound = await assertBrowserTaskCredential({
      job_id: "job_never_bound",
      session_id,
      credential,
    });
    assert.equal(unbound.ok, false);
    if (!unbound.ok) assert.equal(unbound.code, "TASK_CREDENTIAL_MISSING_BINDING");

    const ok = await assertBrowserTaskCredential({ job_id, session_id, credential });
    assert.equal(ok.ok, true);
  });

  await asyncTest("5. Status / Continue / Claim require credential (API surface)", async () => {
    const session_id = "sess_btc_api";
    const job_id = "job_btc_api";
    const credential = generateBrowserTaskCredential();
    await bindBrowserTaskCredential({ job_id, session_id, credential });

    const deps = {
      background: () => undefined,
      charge: async () => {
        throw new Error("charge must not run in Unit B gate tests");
      },
      modelConfigured: () => true,
    };

    const statusDenied = await handleDecisionReportAction(
      { action: "status", session_id, job_id },
      deps,
    );
    assert.equal(statusDenied.kind, "json");
    if (statusDenied.kind === "json") {
      assert.equal(statusDenied.status, 401);
      assert.equal(statusDenied.body.code, "TASK_CREDENTIAL_REQUIRED");
    }

    const statusWrong = await handleDecisionReportAction(
      {
        action: "status",
        session_id,
        job_id,
        browser_task_credential: generateBrowserTaskCredential(),
      },
      deps,
    );
    assert.equal(statusWrong.kind, "json");
    if (statusWrong.kind === "json") {
      assert.equal(statusWrong.status, 403);
      assert.equal(statusWrong.body.code, "TASK_CREDENTIAL_MISMATCH");
    }

    const continueDenied = await handleDecisionReportAction(
      { action: "continue", session_id, job_id },
      deps,
    );
    assert.equal(continueDenied.kind, "json");
    if (continueDenied.kind === "json") {
      assert.equal(continueDenied.status, 401);
      assert.equal(continueDenied.body.code, "TASK_CREDENTIAL_REQUIRED");
    }

    const claimDenied = await handleDecisionReportAction(
      { action: "claim", session_id, job_id, browser_task_credential: generateBrowserTaskCredential() },
      deps,
    );
    assert.equal(claimDenied.kind, "json");
    if (claimDenied.kind === "json") {
      assert.equal(claimDenied.status, 403);
      assert.equal(claimDenied.body.code, "TASK_CREDENTIAL_MISMATCH");
    }

    // Correct credential reaches claim handler (404 without completed report — not 401).
    const claimOkGate = await handleDecisionReportAction(
      { action: "claim", session_id, job_id, browser_task_credential: credential },
      deps,
    );
    assert.equal(claimOkGate.kind, "json");
    if (claimOkGate.kind === "json") {
      assert.equal(claimOkGate.status, 404);
      assert.equal(claimOkGate.body.code, "REPORT_NOT_READY");
    }
  });

  await asyncTest("6. job_id / session_id alone cannot bypass; writer_token is not a substitute", async () => {
    const job_id = "job_btc_bypass";
    const session_id = "sess_btc_bypass";
    const credential = generateBrowserTaskCredential();
    await bindBrowserTaskCredential({ job_id, session_id, credential });

    const deps = {
      background: () => undefined,
      charge: async () => {
        throw new Error("charge must not run");
      },
      modelConfigured: () => true,
    };

    const withWriterOnly = await handleDecisionReportAction(
      {
        action: "status",
        session_id,
        job_id,
        writer_token: issueBrowserTaskCredentialVerifier(job_id, session_id, "not-a-credential"),
      },
      deps,
    );
    assert.equal(withWriterOnly.kind, "json");
    if (withWriterOnly.kind === "json") {
      assert.equal(withWriterOnly.status, 401);
      assert.equal(withWriterOnly.body.code, "TASK_CREDENTIAL_REQUIRED");
    }

    // Cross-browser: same account session id, wrong device credential → refuse.
    await saveReportTaskCredential({
      session_id,
      job_id,
      credential: generateBrowserTaskCredential(),
    });
    const otherDeviceCred = await loadReportTaskCredential(session_id, job_id);
    assert.ok(otherDeviceCred);
    const cross = await assertBrowserTaskCredential({
      job_id,
      session_id,
      credential: otherDeviceCred,
    });
    assert.equal(cross.ok, false);
  });

  console.log("Unit B browser task credential tests complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
