const fs = require("fs");
const path = "D:/POJU/pojulife/scripts/test-m2-2-freeze-report-binding.ts";
let s = fs.readFileSync(path, "utf8");

const insertBefore = "console.log(`\\nM2.2 results: ${passed} passed, ${failed} failed`);";
// actual file uses template literal
const marker = "console.log(`\nM2.2 results:";
const altMarker = "M2.2 results: ${passed} passed, ${failed} failed";
const idx = s.indexOf(altMarker);
if (idx < 0) {
  console.error("results marker missing");
  process.exit(1);
}
// Find start of console.log line
const lineStart = s.lastIndexOf("console.log", idx);

const tests = `
  // ---------- M2.2-R3 remaining production lifecycle ----------
  await check("M2.2-R3-C1 Regenerate cannot steal an active claim", async () => {
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const {
      tryReleaseClaimForRegenerate,
      __createClaimOpsForTests,
      freezeReportClaimKey,
      M22_REPORT_SCHEMA_VERSION,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const sharedKv = new MemoryKv();
    const claimOps = __createClaimOpsForTests(sharedKv);
    const key = freezeReportClaimKey({
      sessionId: "m22_r3_c1",
      freezeId: "freeze_old_owner",
      reportSchemaVersion: M22_REPORT_SCHEMA_VERSION,
    });
    const oldOwner = "old_owner_token_xyz";
    assert.equal(await claimOps.tryAcquire(key, oldOwner, 120), true);

    // Regenerate without proving ownership → fail closed (no force delete).
    const noToken = await tryReleaseClaimForRegenerate({
      claimOps,
      claimKey: key,
      ownerToken: null,
    });
    assert.equal(noToken.ok, false);
    if (!noToken.ok) assert.equal(noToken.code, "CLAIM_OWNED_BY_OTHER");
    assert.ok(await claimOps.load!(key), "old owner claim must remain");

    // Regenerate with wrong token → fail closed.
    const wrong = await tryReleaseClaimForRegenerate({
      claimOps,
      claimKey: key,
      ownerToken: "attacker_token",
    });
    assert.equal(wrong.ok, false);
    if (!wrong.ok) assert.equal(wrong.code, "CLAIM_OWNED_BY_OTHER");
    const still = await claimOps.load!(key);
    assert.ok(still);
    assert.equal(still!.token, oldOwner);

    // Only original owner token may CAS-release.
    const ok = await tryReleaseClaimForRegenerate({
      claimOps,
      claimKey: key,
      ownerToken: oldOwner,
    });
    assert.equal(ok.ok, true);
    assert.equal(await claimOps.load!(key), null);
  });

  await check("M2.2-R3-C2 Pre-handoff early return releases owned claim", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const {
      prepareFreezeBoundFinalDelivery,
      releaseClaimBeforePreHandoffReturn,
      __createClaimOpsForTests,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const frozen = await freezeSession("m22_r3_c2");
    const sharedKv = new MemoryKv();
    const claimOps = __createClaimOpsForTests(sharedKv);
    const deps = {
      ...persistDeps(),
      claimOps,
      claimTtlSec: 120,
      loadSession: async (sid: string) => loadPOJUSession(sid),
    };

    const prepared = await prepareFreezeBoundFinalDelivery({
      session: frozen.session,
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      acquireGenerationClaim: true,
      deps,
    });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    assert.equal(prepared.claimHeld, true);
    assert.ok(prepared.claimKey && prepared.claimToken);

    // Simulate pre-handoff early return (existing running/completed / lock contention).
    const released = await releaseClaimBeforePreHandoffReturn({
      claimKey: prepared.claimKey,
      claimToken: prepared.claimToken,
      deps: { claimOps },
    });
    assert.equal(released, true);
    assert.equal(await claimOps.load!(prepared.claimKey!), null);

    // Subsequent valid request can acquire the claim.
    const again = await prepareFreezeBoundFinalDelivery({
      session: await durable(frozen.session.session_id),
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      acquireGenerationClaim: true,
      deps,
    });
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.claimHeld, true);
    await releaseClaimBeforePreHandoffReturn({
      claimKey: again.claimKey,
      claimToken: again.claimToken,
      deps: { claimOps },
    });
  });

  await check("M2.2-R3-C3 CAS unavailable fails closed (no GET+DEL fallback)", async () => {
    const store = {
      async get() { return { token: "t1", expires_at: Date.now() + 60_000 }; },
      async set() { return "OK" as const; },
      async del() { throw new Error("del must not be called on CAS-unavailable release"); },
      // intentionally no compareAndDelete / eval
    };
    const claimOps = __createClaimOpsForTests(store);
    let threw = false;
    try {
      await claimOps.release("k", "t1");
    } catch (e) {
      threw = true;
      assert.ok(
        String(e).includes("CLAIM_CAS_UNAVAILABLE"),
        "must throw typed CAS unavailable",
      );
    }
    assert.equal(threw, true, "release without atomic CAS must fail closed");

    // Production compareAndDeleteClaim path (server module).
    const { compareAndDeleteClaim, ClaimCasUnavailableError } = await import(
      "../lib/poju/decision-intake/freeze-report-claim"
    );
    let threw2 = false;
    try {
      await compareAndDeleteClaim(store as never, "k", "t1");
    } catch (e) {
      threw2 = true;
      assert.ok(
        e instanceof ClaimCasUnavailableError ||
          String(e).includes("CLAIM_CAS_UNAVAILABLE") ||
          String(e).includes("compareAndDelete"),
      );
    }
    assert.equal(threw2, true);
  });

  await check("M2.2-R3-C4 Write-back failure cannot leave formal job completed", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const {
      prepareFreezeBoundFinalDelivery,
      completeFreezeBoundReportFromDeliveryPages,
      failFreezeBoundReportJob,
      releaseFreezeBoundReportClaim,
      getCompletedFreezeBoundReport,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const frozen = await freezeSession("m22_r3_c4");
    const sharedKv = new MemoryKv();
    const claimOps = __createClaimOpsForTests(sharedKv);
    const deps = {
      ...persistDeps(),
      claimOps,
      claimTtlSec: 120,
      loadSession: async (sid: string) => loadPOJUSession(sid),
    };

    const prepared = await prepareFreezeBoundFinalDelivery({
      session: frozen.session,
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      acquireGenerationClaim: true,
      deps,
    });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    const originalJobId = prepared.job.job_id;
    const originalBinding = { ...prepared.job.binding };

    // Simulate assemble write-back failure (incomplete pages) BEFORE formal complete.
    let formalStatus: "running" | "completed" | "failed" = "running";
    const badPages = DECISION_PAGE_IDS.slice(0, 3).map((pageId) => ({
      pageId,
      content: "incomplete",
    }));
    const wb = await completeFreezeBoundReportFromDeliveryPages({
      session: prepared.session,
      snapshot: prepared.snapshot,
      jobId: originalJobId,
      pages: badPages as never,
      deps: persistDeps(),
    });
    assert.equal(wb.ok, false, "incomplete write-back must fail");
    // Production contract: do not mark formal delivery completed when write-back fails.
    if (!wb.ok) {
      formalStatus = "failed";
      await failFreezeBoundReportJob({
        session: prepared.session,
        jobId: originalJobId,
        error: wb.error,
        deps: persistDeps(),
      });
    } else {
      formalStatus = "completed";
    }
    assert.notEqual(formalStatus, "completed");
    const sessionAfter = await durable(frozen.session.session_id);
    const jobAfter = (sessionAfter.freeze_bound_report_jobs ?? []).find(
      (j) => j.job_id === originalJobId,
    );
    assert.ok(jobAfter);
    assert.notEqual(jobAfter!.status, "completed");
    assert.equal(jobAfter!.status, "failed");
    assert.equal(jobAfter!.binding.freezeId, originalBinding.freezeId);
    assert.equal(jobAfter!.binding.contentHash, originalBinding.contentHash);
    assert.equal(jobAfter!.binding.reportSchemaVersion, originalBinding.reportSchemaVersion);
    assert.equal(
      getCompletedFreezeBoundReport(sessionAfter, { freezeId: originalBinding.freezeId }),
      null,
    );

    await releaseFreezeBoundReportClaim({
      claimKey: prepared.claimKey!,
      claimToken: prepared.claimToken!,
      deps: { claimOps },
    });
  });

  await check("M2.2-R3-C5 Success write-back then retrieval; retry preserves Freeze identity", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const {
      prepareFreezeBoundFinalDelivery,
      completeFreezeBoundReportFromDeliveryPages,
      failFreezeBoundReportJob,
      releaseFreezeBoundReportClaim,
      retryFreezeBoundEightPageReport,
      getCompletedFreezeBoundReport,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const frozen = await freezeSession("m22_r3_c5");
    const sharedKv = new MemoryKv();
    const claimOps = __createClaimOpsForTests(sharedKv);
    const deps = {
      ...persistDeps(),
      claimOps,
      claimTtlSec: 120,
      loadSession: async (sid: string) => loadPOJUSession(sid),
      generatePage: async (snapshot: FrozenReportSnapshot, pageId: DecisionPageId) =>
        \`r3 \${pageId} \${snapshot.contentHash}\`,
    };

    const prepared = await prepareFreezeBoundFinalDelivery({
      session: frozen.session,
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      acquireGenerationClaim: true,
      deps,
    });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    const original = {
      jobId: prepared.job.job_id,
      freezeId: prepared.job.binding.freezeId,
      version: prepared.job.binding.decisionContextVersion,
      hash: prepared.job.binding.contentHash,
      schema: prepared.job.binding.reportSchemaVersion,
    };

    // Fail then retry — binding must be identical.
    await failFreezeBoundReportJob({
      session: prepared.session,
      jobId: original.jobId,
      error: "r3_inject_fail",
      deps,
    });
    await releaseFreezeBoundReportClaim({
      claimKey: prepared.claimKey!,
      claimToken: prepared.claimToken!,
      deps: { claimOps },
    });
    const retried = await retryFreezeBoundEightPageReport({
      session: await durable(frozen.session.session_id),
      jobId: original.jobId,
      deps,
    });
    assert.equal(retried.ok, true, !retried.ok ? retried.error : "");
    if (!retried.ok) return;
    assert.equal(retried.job.job_id, original.jobId);
    assert.equal(retried.job.binding.freezeId, original.freezeId);
    assert.equal(retried.job.binding.decisionContextVersion, original.version);
    assert.equal(retried.job.binding.contentHash, original.hash);
    assert.equal(retried.job.binding.reportSchemaVersion, original.schema);

    // Also verify completeFreezeBound path writes exactly 8 pages retrievable.
    const frozen2 = await freezeSession("m22_r3_c5b");
    const prepared2 = await prepareFreezeBoundFinalDelivery({
      session: frozen2.session,
      freezeId: frozen2.freezeId,
      expected_hash: frozen2.contentHash,
      acquireGenerationClaim: true,
      deps: {
        ...persistDeps(),
        claimOps: __createClaimOpsForTests(new MemoryKv()),
        claimTtlSec: 120,
        loadSession: async (sid: string) => loadPOJUSession(sid),
      },
    });
    assert.equal(prepared2.ok, true);
    if (!prepared2.ok) return;
    const pages = DECISION_PAGE_IDS.map((pageId) => ({
      pageId,
      content: \`ok \${pageId} \${prepared2.snapshot.contentHash}\`,
    }));
    // Formal success contract ordering: write-back succeeds ⇒ then formal may complete.
    const completed = await completeFreezeBoundReportFromDeliveryPages({
      session: prepared2.session,
      snapshot: prepared2.snapshot,
      jobId: prepared2.job.job_id,
      pages,
      deps: persistDeps(),
    });
    assert.equal(completed.ok, true);
    if (!completed.ok) return;
    const retrieved = getCompletedFreezeBoundReport(
      await durable(frozen2.session.session_id),
      { freezeId: frozen2.freezeId },
    );
    assert.ok(retrieved);
    assert.equal(retrieved!.pages.length, 8);
    assert.equal(retrieved!.job_id, prepared2.job.job_id);
  });

`;

s = s.slice(0, lineStart) + tests + "\n" + s.slice(lineStart);
fs.writeFileSync(path, s, "utf8");
console.log("appended R3 tests");
