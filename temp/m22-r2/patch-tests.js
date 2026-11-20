const fs = require("fs");
const path = "scripts/test-m2-2-freeze-report-binding.ts";
let s = fs.readFileSync(path, "utf8");

if (s.includes("M2.2-R2-C1")) {
  console.log("R2 tests already present");
  process.exit(0);
}

const anchor = `  console.log(\`\\nM2.2 results: \${passed} passed, \${failed} failed\`);`;
const anchorAlt = '  console.log(`\\nM2.2 results: ${passed} passed, ${failed} failed`);';

let idx = s.lastIndexOf("console.log(`\nM2.2 results:");
if (idx < 0) idx = s.lastIndexOf("console.log(`\\nM2.2 results:");
if (idx < 0) {
  // find by unique string
  idx = s.lastIndexOf("M2.2 results:");
  // walk back to console.log
  idx = s.lastIndexOf("console.log", idx);
}
if (idx < 0) throw new Error("results log not found");

const tests = `
  // ---------- M2.2-R2 production lifecycle ----------
  await check("M2.2-R2-C1 Token CAS: stale owner cannot release newer claim", async () => {
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const sharedKv = new MemoryKv();
    const claimOps = __createClaimOpsForTests(sharedKv);
    const key = "poju-m22:freeze-report-claim:cas-test:ctx@v1:m2.2-eight-page-v1";
    const stale = "stale_token_aaa";
    const newer = "newer_token_bbb";
    assert.equal(await claimOps.tryAcquire(key, stale, 120), true);
    // Simulate lease recovery: force-drop then new owner acquires (TTL expiry path).
    await claimOps.forceRelease(key);
    assert.equal(await claimOps.tryAcquire(key, newer, 120), true);
    const releasedByStale = await claimOps.release(key, stale);
    assert.equal(releasedByStale, false, "stale owner must not CAS-delete newer claim");
    const stillHeld = await claimOps.load!(key);
    assert.ok(stillHeld, "newer claim must remain");
    assert.equal(stillHeld!.token, newer);
    const releasedByOwner = await claimOps.release(key, newer);
    assert.equal(releasedByOwner, true);
    assert.equal(await claimOps.load!(key), null);
  });

  await check("M2.2-R2-C2 Production prepare claim: exactly one generator owner", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const {
      prepareFreezeBoundFinalDelivery,
      releaseFreezeBoundReportClaim,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const frozen = await freezeSession("m22_r2_c2");
    const sharedKv = new MemoryKv();
    const claimOps = __createClaimOpsForTests(sharedKv);

    const makeDeps = () => ({
      ...persistDeps(),
      claimOps,
      claimTtlSec: 120,
      loadSession: async (sid: string) => loadPOJUSession(sid),
    });

    const [a, b] = await Promise.all([
      prepareFreezeBoundFinalDelivery({
        session: frozen.session,
        freezeId: frozen.freezeId,
        expected_hash: frozen.contentHash,
        acquireGenerationClaim: true,
        deps: makeDeps(),
      }),
      prepareFreezeBoundFinalDelivery({
        session: frozen.session,
        freezeId: frozen.freezeId,
        expected_hash: frozen.contentHash,
        acquireGenerationClaim: true,
        deps: makeDeps(),
      }),
    ]);

    const winners = [a, b].filter((r) => r.ok && (r as { claimHeld?: boolean }).claimHeld);
    const busy = [a, b].filter((r) => !r.ok && r.code === "GENERATION_IN_PROGRESS");
    const completedReuse = [a, b].filter(
      (r) => r.ok && (r as { reusedCompleted?: boolean }).reusedCompleted,
    );
    assert.equal(winners.length, 1, \`expected exactly one claim holder, got \${winners.length}\`);
    assert.ok(
      busy.length + completedReuse.length === 1 || winners.length === 1,
      "loser must be in-progress or completed-reuse",
    );
    assert.equal(busy.length, 1, "competing prepare must not start another generator");

    const winner = winners[0]!;
    if (!winner.ok) return;
    assert.equal(winner.job.binding.freezeId, frozen.freezeId);
    assert.equal(winner.job.binding.contentHash, frozen.contentHash);
    assert.ok(winner.claimToken);
    assert.ok(winner.claimKey);

    // Release so later tests are not blocked on process-local residue.
    await releaseFreezeBoundReportClaim({
      claimKey: winner.claimKey!,
      claimToken: winner.claimToken!,
      deps: { claimOps },
    });
  });

  await check("M2.2-R2-C3 Production-shaped success write-back + retrieval", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const {
      prepareFreezeBoundFinalDelivery,
      completeFreezeBoundReportFromDeliveryPages,
      releaseFreezeBoundReportClaim,
      getCompletedFreezeBoundReport: getCompleted,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const frozen = await freezeSession("m22_r2_c3");
    const sharedKv = new MemoryKv();
    const claimOps = __createClaimOpsForTests(sharedKv);

    const prepared = await prepareFreezeBoundFinalDelivery({
      session: frozen.session,
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      acquireGenerationClaim: true,
      deps: {
        ...persistDeps(),
        claimOps,
        claimTtlSec: 120,
        loadSession: async (sid: string) => loadPOJUSession(sid),
      },
    });
    assert.equal(prepared.ok, true, !prepared.ok ? prepared.error : "");
    if (!prepared.ok) return;
    assert.equal(prepared.claimHeld, true);
    const originalJobId = prepared.job.job_id;
    const originalFreezeId = prepared.job.binding.freezeId;
    const originalHash = prepared.job.binding.contentHash;

    const pages = DECISION_PAGE_IDS.map((pageId) => ({
      pageId,
      content: \`prod-shaped \${pageId} \${prepared.snapshot.contentHash}\`,
    }));
    const completed = await completeFreezeBoundReportFromDeliveryPages({
      session: prepared.session,
      snapshot: prepared.snapshot,
      jobId: originalJobId,
      pages,
      deps: persistDeps(),
    });
    assert.equal(completed.ok, true);
    if (!completed.ok) return;
    assert.equal(completed.job.job_id, originalJobId);
    assert.equal(completed.job.binding.freezeId, originalFreezeId);
    assert.equal(completed.job.binding.contentHash, originalHash);
    assert.equal(completed.job.status, "completed");

    const retrieved = getCompleted(
      await durable(frozen.session.session_id),
      { freezeId: originalFreezeId },
    );
    assert.ok(retrieved);
    assert.equal(retrieved!.job_id, originalJobId);
    assert.equal(retrieved!.pages.length, 8);
    assert.equal(retrieved!.binding.freezeId, originalFreezeId);

    await releaseFreezeBoundReportClaim({
      claimKey: prepared.claimKey!,
      claimToken: prepared.claimToken!,
      deps: { claimOps },
    });
  });

  await check("M2.2-R2-C4 Tampered client snapshot cannot replace server Freeze", async () => {
    const frozen = await freezeSession("m22_r2_c4");
    const session = await durable(frozen.session.session_id);
    const loaded = loadAuthoritativeFreeze(session, { freezeId: frozen.freezeId });
    const serverSnap = createFrozenReportSnapshot({
      sessionId: session.session_id,
      frozen: loaded.frozen,
      binding: loaded.binding,
    });

    // Tamper: mutate a fact statement while keeping binding triple fields.
    const tampered = JSON.parse(JSON.stringify(serverSnap.decisionContext)) as DecisionContext;
    assert.ok(tampered.reality_facts[0]);
    tampered.reality_facts[0]!.statement = "TAMPERED_CLIENT_SNAPSHOT";
    const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
    const tamperedHash = computeContentHash(tampered);
    assert.notEqual(tamperedHash, serverSnap.contentHash);

    // Server authority still loads the original Freeze.
    const reloaded = loadAuthoritativeFreeze(session, {
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
    });
    assert.equal(reloaded.binding.context_hash, frozen.contentHash);
    assert.equal(
      JSON.stringify(reloaded.frozen).includes("TAMPERED_CLIENT_SNAPSHOT"),
      false,
    );

    // Comparing tampered client hash against server must fail closed.
    assert.notEqual(tamperedHash, reloaded.binding.context_hash);
  });

  await check("M2.2-R2-C5 Retry preserves original Freeze binding under claim recovery", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const {
      prepareFreezeBoundFinalDelivery,
      failFreezeBoundReportJob,
      releaseFreezeBoundReportClaim,
      retryFreezeBoundEightPageReport,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const frozen = await freezeSession("m22_r2_c5");
    const sharedKv = new MemoryKv();
    const claimOps = __createClaimOpsForTests(sharedKv);
    const deps = {
      ...persistDeps(),
      claimOps,
      claimTtlSec: 120,
      loadSession: async (sid: string) => loadPOJUSession(sid),
      generatePage: async (snapshot: FrozenReportSnapshot, pageId: DecisionPageId) =>
        \`retry \${pageId} \${snapshot.contentHash}\`,
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
    const originalBinding = { ...prepared.job.binding };

    // Simulate production failure: mark failed/retryable, release claim (lease recovery).
    const failed = await failFreezeBoundReportJob({
      session: prepared.session,
      jobId: prepared.job.job_id,
      error: "simulated_transport_fail",
      deps,
    });
    assert.equal(failed.job?.status, "failed");
    assert.notEqual(failed.job?.status, "completed");
    await releaseFreezeBoundReportClaim({
      claimKey: prepared.claimKey!,
      claimToken: prepared.claimToken!,
      deps: { claimOps },
    });

    const retried = await retryFreezeBoundEightPageReport({
      session: failed.session,
      jobId: prepared.job.job_id,
      deps,
    });
    assert.equal(retried.ok, true, !retried.ok ? retried.error : "");
    if (!retried.ok) return;
    assert.equal(retried.job.binding.freezeId, originalBinding.freezeId);
    assert.equal(retried.job.binding.contentHash, originalBinding.contentHash);
    assert.equal(retried.job.binding.reportSchemaVersion, originalBinding.reportSchemaVersion);
    assert.equal(retried.job.binding.decisionContextVersion, originalBinding.decisionContextVersion);
    assert.equal(retried.job.status, "completed");
  });

`;

s = s.slice(0, idx) + tests + "\n" + s.slice(idx);
fs.writeFileSync(path, s);
console.log("R2 tests inserted");
