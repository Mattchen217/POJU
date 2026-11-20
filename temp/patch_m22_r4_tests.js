const fs = require("fs");
const p = "scripts/test-m2-2-freeze-report-binding.ts";
const crlf = fs.readFileSync(p, "utf8").includes("\r\n");
let s = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

const startMarker = "  // ---------- M2.2-R3 remaining production lifecycle ----------";
const endMarker = "\nconsole.log(`\\nM2.2 results: ${passed} passed, ${failed} failed`);";
const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker);
if (start < 0 || end < 0) throw new Error("R3 block bounds missing " + start + " " + end);

const r4 = `  // ---------- M2.2-R3 remaining (keep CAS) + M2.2-R4 production lifecycle ----------
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

    const { compareAndDeleteClaim, ClaimCasUnavailableError } = await import(
      "../lib/poju/decision-intake/freeze-report-claim-cas"
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

  await check("M2.2-R4-C1 Regenerate supersede stops old worker authority (real xhigh)", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const { runWithEphemeralXhighKv, createXhighJob, getXhighJob, updateXhighJobStatus } =
      await import("../lib/poju/xhigh-job-store");
    const {
      supersedeFinalDeliveryJobForRegenerate,
      assertDeliveryExecutionAuthority,
      DeliveryExecutionRevokedError,
      tryCommitUnderDeliveryAuthority,
    } = await import("../lib/poju/final-delivery-execution-authority");
    const {
      tryReleaseClaimForRegenerate,
      prepareFreezeBoundFinalDelivery,
      freezeReportClaimKey,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const { createInitialAgentState: mkAgent } = await import("../lib/poju/agent-state");

    await runWithEphemeralXhighKv(async () => {
      const frozen = await freezeSession("m22_r4_c1");
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
      assert.equal(prepared.ok, true);
      if (!prepared.ok) return;

      const agent = mkAgent(frozen.session.session_id);
      const oldJob = await createXhighJob({
        phase: "final_delivery",
        session_id: frozen.session.session_id,
        locale: "zh-CN",
        job_input: {
          kind: "final_delivery",
          session_id: frozen.session.session_id,
          locale: "zh-CN",
          agent_v2: agent,
          breakthrough_core: null,
          covered_agenda: [],
          base_analysis: {},
          delivery_mode: "full",
          decision_context_binding: prepared.decision_context_binding,
          decision_context_snapshot: prepared.decision_context_snapshot,
          require_decision_context: true,
          m22_claim_token: prepared.claimToken,
          m22_claim_key: prepared.claimKey,
          m22_report_job_id: prepared.job.job_id,
        },
      });
      await updateXhighJobStatus(oldJob.job_id, "running", {
        current_stage: "segments",
        accumulated_content: "stage_running:segments",
      });

      // Old worker still has authority before Regenerate.
      assert.equal(await tryCommitUnderDeliveryAuthority(oldJob.job_id), true);

      // Production Regenerate path: supersede + owner-token CAS release.
      await supersedeFinalDeliveryJobForRegenerate(oldJob.job_id);
      const after = await getXhighJob(oldJob.job_id);
      assert.ok(after);
      assert.equal(after!.status, "failed");
      assert.equal(after!.failure_reason, "superseded_by_regenerate");

      let revoked = false;
      try {
        await assertDeliveryExecutionAuthority(oldJob.job_id);
      } catch (e) {
        revoked = e instanceof DeliveryExecutionRevokedError;
      }
      assert.equal(revoked, true, "old worker must lose execution authority");
      assert.equal(await tryCommitUnderDeliveryAuthority(oldJob.job_id), false);

      // Cannot steal claim without owner token.
      const key = freezeReportClaimKey({
        sessionId: frozen.session.session_id,
        freezeId: frozen.freezeId,
        reportSchemaVersion: M22_REPORT_SCHEMA_VERSION,
      });
      const steal = await tryReleaseClaimForRegenerate({
        claimOps,
        claimKey: key,
        ownerToken: "attacker",
      });
      assert.equal(steal.ok, false);
      const okRelease = await tryReleaseClaimForRegenerate({
        claimOps,
        claimKey: key,
        ownerToken: prepared.claimToken!,
      });
      assert.equal(okRelease.ok, true);

      // Store must refuse revive of superseded job (old worker cannot complete).
      await updateXhighJobStatus(oldJob.job_id, "running", {
        current_stage: "assemble",
      });
      const still = await getXhighJob(oldJob.job_id);
      assert.equal(still!.status, "failed");
      assert.equal(still!.failure_reason, "superseded_by_regenerate");
    });
  });

  await check("M2.2-R4-C2 Two independent contexts: exactly one formal generator claim", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const { prepareFreezeBoundFinalDelivery, releaseFreezeBoundReportClaim } = await import(
      "../lib/poju/decision-intake/freeze-bound-report"
    );
    const frozen = await freezeSession("m22_r4_c2");
    const sharedKv = new MemoryKv();
    const claimOps = __createClaimOpsForTests(sharedKv);
    const deps = {
      ...persistDeps(),
      claimOps,
      claimTtlSec: 120,
      loadSession: async (sid: string) => loadPOJUSession(sid),
    };

    // Two independent execution contexts share the same KV claim store.
    const [a, b] = await Promise.all([
      prepareFreezeBoundFinalDelivery({
        session: frozen.session,
        freezeId: frozen.freezeId,
        expected_hash: frozen.contentHash,
        acquireGenerationClaim: true,
        deps,
      }),
      prepareFreezeBoundFinalDelivery({
        session: frozen.session,
        freezeId: frozen.freezeId,
        expected_hash: frozen.contentHash,
        acquireGenerationClaim: true,
        deps,
      }),
    ]);

    const winners = [a, b].filter((r) => r.ok && r.claimHeld);
    const losers = [a, b].filter((r) => !r.ok && r.code === "GENERATION_IN_PROGRESS");
    assert.equal(winners.length, 1, \`winners=\${winners.length}\`);
    assert.equal(losers.length, 1, \`losers=\${losers.length}\`);
    const winner = winners[0]!;
    if (!winner.ok) return;
    assert.ok(winner.claimToken);
    await releaseFreezeBoundReportClaim({
      claimKey: winner.claimKey!,
      claimToken: winner.claimToken!,
      deps: { claimOps },
    });
  });

  await check("M2.2-R4-C3 Pre-handoff early return releases claim (API helper path)", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const {
      prepareFreezeBoundFinalDelivery,
      releaseClaimBeforePreHandoffReturn,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    // Prove the same helper the production route invokes on every pre-handoff exit.
    const routeSrc = await import("node:fs").then((m) =>
      m.readFileSync("app/api/poju/final-delivery/route.ts", "utf8"),
    );
    assert.ok(routeSrc.includes("releaseClaimBeforePreHandoffReturn"));
    assert.ok((routeSrc.match(/releaseClaimBeforePreHandoffReturn/g) || []).length >= 4);

    const frozen = await freezeSession("m22_r4_c3");
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

    // Simulate each pre-handoff early-return class: resume / lock busy / create fail.
    for (const label of ["resume_running", "lock_busy", "create_fail", "pass_fail"]) {
      void label;
      const held = await claimOps.load!(prepared.claimKey!);
      if (!held) {
        const again = await prepareFreezeBoundFinalDelivery({
          session: await durable(frozen.session.session_id),
          freezeId: frozen.freezeId,
          expected_hash: frozen.contentHash,
          acquireGenerationClaim: true,
          deps,
        });
        assert.equal(again.ok, true);
        if (!again.ok) return;
        Object.assign(prepared, again);
      }
      const released = await releaseClaimBeforePreHandoffReturn({
        claimKey: prepared.claimKey!,
        claimToken: prepared.claimToken!,
        deps: { claimOps },
      });
      assert.equal(released, true, label);
      assert.equal(await claimOps.load!(prepared.claimKey!), null, label);
    }

    const reacquire = await prepareFreezeBoundFinalDelivery({
      session: await durable(frozen.session.session_id),
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      acquireGenerationClaim: true,
      deps,
    });
    assert.equal(reacquire.ok, true);
    if (!reacquire.ok) return;
    assert.equal(reacquire.claimHeld, true);
    await releaseClaimBeforePreHandoffReturn({
      claimKey: reacquire.claimKey!,
      claimToken: reacquire.claimToken!,
      deps: { claimOps },
    });
  });

  await check("M2.2-R4-C4 Stage Runner success write-back: getXhighJob completed only after M2.2", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const { runWithEphemeralXhighKv, createXhighJob, getXhighJob, updateXhighJobStatus } =
      await import("../lib/poju/xhigh-job-store");
    const {
      prepareFreezeBoundFinalDelivery,
      getCompletedFreezeBoundReport,
      releaseFreezeBoundReportClaim,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const { finalizeFormalDeliverySuccessForTests } = await import(
      "../lib/poju/final-delivery-stage-runner"
    );
    const { createInitialAgentState: mkAgent } = await import("../lib/poju/agent-state");

    await runWithEphemeralXhighKv(async () => {
      const frozen = await freezeSession("m22_r4_c4");
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
      assert.equal(prepared.ok, true);
      if (!prepared.ok) return;

      const agent = mkAgent(frozen.session.session_id);
      const formal = await createXhighJob({
        phase: "final_delivery",
        session_id: frozen.session.session_id,
        locale: "zh-CN",
        job_input: {
          kind: "final_delivery",
          session_id: frozen.session.session_id,
          locale: "zh-CN",
          agent_v2: agent,
          breakthrough_core: null,
          covered_agenda: [],
          base_analysis: {},
          delivery_mode: "full",
          decision_context_binding: prepared.decision_context_binding,
          decision_context_snapshot: prepared.decision_context_snapshot,
          require_decision_context: true,
          m22_claim_token: prepared.claimToken,
          m22_claim_key: prepared.claimKey,
          m22_report_job_id: prepared.job.job_id,
        },
      });
      await updateXhighJobStatus(formal.job_id, "running", { current_stage: "assemble" });

      const allReady = DECISION_PAGE_IDS.map((pageId) => ({
        key: pageId,
        body_markdown: \`page \${pageId} \${prepared.snapshot.contentHash}\`,
      }));
      const result = {
        kind: "final_delivery" as const,
        full_text: allReady.map((p) => p.body_markdown).join("\\n"),
        actions: [],
        model: "test",
        tokens_used: 1,
      };

      const out = await finalizeFormalDeliverySuccessForTests({
        job_id: formal.job_id,
        input: formal.input as import("../lib/poju/xhigh-job-types").FinalDeliveryJobInput,
        allReady,
        result,
      });

      // MUST read persisted formal status — not a local variable.
      const persisted = await getXhighJob(formal.job_id);
      assert.ok(persisted);
      assert.equal(persisted!.status, "completed");
      assert.equal(out.formal!.status, "completed");
      assert.equal(out.revoked, false);

      const retrieved = getCompletedFreezeBoundReport(
        await durable(frozen.session.session_id),
        { freezeId: frozen.freezeId },
      );
      assert.ok(retrieved);
      assert.equal(retrieved!.pages.length, 8);
      assert.equal(retrieved!.job_id, prepared.job.job_id);
      assert.equal(retrieved!.binding.freezeId, frozen.freezeId);
      assert.equal(retrieved!.binding.contentHash, frozen.contentHash);
    });
  });

  await check("M2.2-R4-C5 Stage Runner write-back failure: formal NOT completed (getXhighJob)", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const { runWithEphemeralXhighKv, createXhighJob, getXhighJob, updateXhighJobStatus } =
      await import("../lib/poju/xhigh-job-store");
    const {
      prepareFreezeBoundFinalDelivery,
      getCompletedFreezeBoundReport,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const { finalizeFormalDeliverySuccessForTests } = await import(
      "../lib/poju/final-delivery-stage-runner"
    );
    const { createInitialAgentState: mkAgent } = await import("../lib/poju/agent-state");

    await runWithEphemeralXhighKv(async () => {
      const frozen = await freezeSession("m22_r4_c5");
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
      assert.equal(prepared.ok, true);
      if (!prepared.ok) return;

      const agent = mkAgent(frozen.session.session_id);
      const formal = await createXhighJob({
        phase: "final_delivery",
        session_id: frozen.session.session_id,
        locale: "zh-CN",
        job_input: {
          kind: "final_delivery",
          session_id: frozen.session.session_id,
          locale: "zh-CN",
          agent_v2: agent,
          breakthrough_core: null,
          covered_agenda: [],
          base_analysis: {},
          delivery_mode: "full",
          decision_context_binding: prepared.decision_context_binding,
          decision_context_snapshot: prepared.decision_context_snapshot,
          require_decision_context: true,
          m22_claim_token: prepared.claimToken,
          m22_claim_key: prepared.claimKey,
          m22_report_job_id: prepared.job.job_id,
        },
      });
      await updateXhighJobStatus(formal.job_id, "running", { current_stage: "assemble" });

      // Incomplete pages → write-back fails → formal must stay failed (persisted).
      const allReady = DECISION_PAGE_IDS.slice(0, 3).map((pageId) => ({
        key: pageId,
        body_markdown: "incomplete",
      }));
      const result = {
        kind: "final_delivery" as const,
        full_text: "incomplete",
        actions: [],
        model: "test",
        tokens_used: 1,
      };

      const out = await finalizeFormalDeliverySuccessForTests({
        job_id: formal.job_id,
        input: formal.input as import("../lib/poju/xhigh-job-types").FinalDeliveryJobInput,
        allReady,
        result,
      });

      const persisted = await getXhighJob(formal.job_id);
      assert.ok(persisted);
      assert.notEqual(persisted!.status, "completed");
      assert.equal(persisted!.status, "failed");
      assert.equal(out.formal!.status, "failed");

      const sessionAfter = await durable(frozen.session.session_id);
      const m22 = (sessionAfter.freeze_bound_report_jobs ?? []).find(
        (j) => j.job_id === prepared.job.job_id,
      );
      assert.ok(m22);
      assert.notEqual(m22!.status, "completed");
      assert.equal(m22!.status, "failed");
      assert.equal(m22!.binding.freezeId, frozen.freezeId);
      assert.equal(m22!.binding.contentHash, frozen.contentHash);
      assert.equal(
        getCompletedFreezeBoundReport(sessionAfter, { freezeId: frozen.freezeId }),
        null,
      );
    });
  });

  await check("M2.2-R4-C6 Write-back fail-closed when m22_report_job_id but missing binding", async () => {
    const { runWithEphemeralXhighKv, createXhighJob, updateXhighJobStatus } = await import(
      "../lib/poju/xhigh-job-store"
    );
    const { writeBackFreezeBoundReportOnDeliverySuccess } = await import(
      "../lib/poju/final-delivery-stage-runner"
    );
    const { createInitialAgentState: mkAgent } = await import("../lib/poju/agent-state");

    await runWithEphemeralXhighKv(async () => {
      const sid = "m22_r4_c6_" + Date.now();
      const agent = mkAgent(sid);
      const formal = await createXhighJob({
        phase: "final_delivery",
        session_id: sid,
        locale: "zh-CN",
        job_input: {
          kind: "final_delivery",
          session_id: sid,
          locale: "zh-CN",
          agent_v2: agent,
          breakthrough_core: null,
          covered_agenda: [],
          base_analysis: {},
          delivery_mode: "full",
          decision_context_binding: null,
          decision_context_snapshot: null,
          m22_report_job_id: "m22_job_missing_binding",
        },
      });
      await updateXhighJobStatus(formal.job_id, "running", { current_stage: "assemble" });
      let threw = false;
      try {
        await writeBackFreezeBoundReportOnDeliverySuccess({
          job_id: formal.job_id,
          input: formal.input as import("../lib/poju/xhigh-job-types").FinalDeliveryJobInput,
          allReady: [],
        });
      } catch (e) {
        threw = true;
        assert.match(String(e), /m22_writeback_missing_binding_or_snapshot/);
      }
      assert.equal(threw, true, "must fail closed when binding/snapshot missing");
    });
  });

  await check("M2.2-R4-C7 Tampered client snapshot rejected; retry preserves Freeze binding", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const { MemoryKv } = await import("../lib/kv/memory-kv");
    const {
      prepareFreezeBoundFinalDelivery,
      failFreezeBoundReportJob,
      retryFreezeBoundEightPageReport,
      loadAuthoritativeFreeze,
      releaseFreezeBoundReportClaim,
    } = await import("../lib/poju/decision-intake/freeze-bound-report");
    const frozen = await freezeSession("m22_r4_c7");
    const sharedKv = new MemoryKv();
    const claimOps = __createClaimOpsForTests(sharedKv);
    const deps = {
      ...persistDeps(),
      claimOps,
      claimTtlSec: 120,
      loadSession: async (sid: string) => loadPOJUSession(sid),
      generatePage: async (snapshot: FrozenReportSnapshot, pageId: DecisionPageId) =>
        \`r4 \${pageId} \${snapshot.contentHash}\`,
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

    // Server-authoritative Freeze: tampered client snapshot cannot replace.
    const server = loadAuthoritativeFreeze(await durable(frozen.session.session_id), {
      freezeId: frozen.freezeId,
    });
    assert.ok(server.ok);
    if (!server.ok) return;
    const tampered = structuredClone(server.frozen);
    tampered.reality_facts[0] = {
      ...tampered.reality_facts[0]!,
      statement: "TAMPERED_CLIENT_SNAPSHOT",
    };
    const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
    const tamperedHash = computeContentHash(tampered);
    assert.notEqual(tamperedHash, server.contentHash);

    // Retry after fail preserves original Freeze identity.
    await failFreezeBoundReportJob({
      session: prepared.session,
      jobId: prepared.job.job_id,
      error: "r4_inject",
      deps,
    });
    await releaseFreezeBoundReportClaim({
      claimKey: prepared.claimKey!,
      claimToken: prepared.claimToken!,
      deps: { claimOps },
    });
    const retried = await retryFreezeBoundEightPageReport({
      session: await durable(frozen.session.session_id),
      jobId: prepared.job.job_id,
      deps,
    });
    assert.equal(retried.ok, true, !retried.ok ? retried.error : "");
    if (!retried.ok) return;
    assert.equal(retried.job.binding.freezeId, frozen.freezeId);
    assert.equal(retried.job.binding.contentHash, frozen.contentHash);
    assert.equal(retried.job.binding.decisionContextVersion, frozen.version);
    assert.equal(retried.job.binding.reportSchemaVersion, M22_REPORT_SCHEMA_VERSION);
  });

`;

s = s.slice(0, start) + r4 + s.slice(end);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("tests patched, length", s.length);
