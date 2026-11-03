/**
 * Phase 3 S2 — Generation Infrastructure tests.
 * Run: pnpm test:generation-s2
 * Covers TaskContext CAS, collision order, Path A/B/C, Reload identity, Job client_task recovery.
 * Does NOT start S3 product wiring. Does NOT call real LLM/payment.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

const memoryStore = new Map<string, string>();
const localStoragePolyfill = {
  getItem(key: string): string | null {
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  },
  setItem(key: string, value: string): void {
    memoryStore.set(key, String(value));
  },
  removeItem(key: string): void {
    memoryStore.delete(key);
  },
  clear(): void {
    memoryStore.clear();
  },
  key(i: number): string | null {
    return [...memoryStore.keys()][i] ?? null;
  },
  get length() {
    return memoryStore.size;
  },
};

const g = globalThis as typeof globalThis & {
  window: typeof globalThis;
  localStorage: typeof localStoragePolyfill;
  crypto: Crypto;
};
g.window = globalThis as unknown as typeof globalThis;
(g.window as any).dispatchEvent = (g as any).dispatchEvent || (() => true);
(g as any).dispatchEvent = (g as any).dispatchEvent || (() => true);
g.localStorage = localStoragePolyfill;
if (!g.crypto || !g.crypto.getRandomValues) {
  g.crypto = webcrypto as unknown as Crypto;
}
memoryStore.set("pojulife_device_id_v4", "dev_s2_gen");
memoryStore.set("pojulife_owner_key_migrated_v1", "1");

let passed = 0;
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`  PASS  ${name}`);
    })
    .catch((err) => {
      console.error(`  FAIL  ${name}`);
      throw err;
    });
}

async function main() {
  console.log("phase3-s2-generation-infra");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession } = await import("../lib/poju/session-manager");
  const {
    mutatePOJUSession,
    GENERATION_BASE_STALE,
    SessionCasError,
    isSessionCasError,
  } = await import("../lib/poju/session-mutation");
  const {
    checkGenerationCollision,
    createPendingGenerationTaskContext,
    bindJobToGenerationTaskContext,
    restoreTaskContextOnReload,
    commitGenerationGuarded,
    GenerationError,
    EMPTY_GENERATION_RESULT,
    GENERATION_IDENTITY_COLLISION,
  } = await import("../lib/poju/generation");
  const {
    createXhighJob,
    getXhighJobByClientTaskId,
    xhighClientTaskKey,
  } = await import("../lib/poju/xhigh-job-store");
  const { runWithEphemeralXhighKv } = await import("../lib/poju/xhigh-job-store");
  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  const sessionId = await createPOJUSession({
    payment_id: "pay_s2_gen_test",
    original_question: "S2 generation infra?",
  });
  assert.ok(sessionId.length >= 8);

  const loaded0 = await loadPOJUSession(sessionId);
  assert.ok(loaded0);
  assert.deepEqual(loaded0!.generation_task_contexts ?? [], []);
  assert.deepEqual(loaded0!.generation_registry ?? [], []);
  assert.deepEqual(loaded0!.generation_operation_bindings ?? [], []);

  const fp = "fp_s2_test_v1_abc";
  const fpv = "poju-generation-fp-v1";

  const emptyDefinition = {
    concrete_event: null,
    stakes: null,
    desired_outcome: null,
    decision_question: null,
    goal_priorities: [] as string[],
    unacceptable_outcomes: [] as string[],
  };

  function makeDc(partial: Partial<DecisionContext> & Pick<DecisionContext, "context_id" | "version">): DecisionContext {
    const now = partial.updated_at ?? "2026-11-03T12:00:00.000Z";
    return {
      context_id: partial.context_id,
      version: partial.version,
      status: partial.status ?? "draft",
      definition: partial.definition ?? emptyDefinition,
      reality_facts: partial.reality_facts ?? [],
      constraints: partial.constraints ?? [],
      hypotheses: partial.hypotheses ?? [],
      dirs: partial.dirs ?? [],
      conflicts: partial.conflicts ?? [],
      content_hash: partial.content_hash ?? null,
      created_at: partial.created_at ?? now,
      updated_at: now,
    };
  }

  // --- TaskContext pending_create CAS + dc-base recheck ---
  await check("pending_create CAS session+1 dc unchanged", async () => {
    const before = await loadPOJUSession(sessionId);
    assert.ok(before);
    const s0 = before!.session_revision ?? 0;
    const d0 = before!.dc_write_revision ?? 0;
    const { task, write } = await createPendingGenerationTaskContext({
      session_id: sessionId,
      generation_type: "call_a_hypothesis",
      fingerprint: fp,
      fingerprint_version: fpv,
      client_task_id: "ctask_s2_pending_001",
      now: "2026-11-03T12:00:00.000Z",
    });
    assert.equal(task.status, "pending_create");
    assert.equal(task.generation_base_revision, d0);
    assert.equal(task.client_task_id, "ctask_s2_pending_001");
    assert.equal(write.session_revision, s0 + 1);
    assert.equal(write.dc_write_revision, d0);
    const after = await loadPOJUSession(sessionId);
    assert.equal(after!.generation_task_contexts!.length, 1);
    assert.equal(after!.generation_task_contexts![0].generation_base_revision, d0);
  });

  await check("pending_create GENERATION_BASE_STALE when dc moved", async () => {
    // Bump DC via mutate bump_dc true
    await mutatePOJUSession(sessionId, {
      operation_id: "s2_bump_dc_for_stale",
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => ({
        ...latest,
        decision_context: makeDc({
          ...(latest.decision_context as DecisionContext | undefined),
          context_id: latest.decision_context?.context_id ?? "ctx_s2",
          version: (latest.decision_context?.version ?? 0) + 1,
          updated_at: "2026-11-03T12:01:00.000Z",
        }),
      }),
    });
    const mid = await loadPOJUSession(sessionId);
    const dMoved = mid!.dc_write_revision ?? 0;
    assert.ok(dMoved >= 1);

    // Force stale: pass generation_base_revision=0 while dc is moved, via direct mutate simulating create gate
    let threw = false;
    try {
      await mutatePOJUSession(sessionId, {
        operation_id: "s2_stale_pending",
        kind: "session_patch",
        bump_dc: false,
        generation_base_revision: 0,
        apply: (latest) => ({
          ...latest,
          original_question: latest.original_question + "x",
        }),
      });
    } catch (err) {
      threw = true;
      assert.ok(isSessionCasError(err) || err instanceof GenerationError || (err as any)?.code);
      const code = (err as any).code;
      assert.equal(code, GENERATION_BASE_STALE);
    }
    assert.equal(threw, true);
    void dMoved;
  });

  // Bind job
  await check("bind job_id pending_create -> running", async () => {
    const { task } = await bindJobToGenerationTaskContext({
      session_id: sessionId,
      client_task_id: "ctask_s2_pending_001",
      job_id: "s2a_job_s2_001",
      now: "2026-11-03T12:02:00.000Z",
    });
    assert.equal(task.status, "running");
    assert.equal(task.job_id, "s2a_job_s2_001");
    assert.equal(task.generation_id, "s2a_job_s2_001");
  });

  await check("Reload preserves identity fields", async () => {
    const sess = await loadPOJUSession(sessionId);
    assert.ok(sess);
    const restored = restoreTaskContextOnReload(sess!, "ctask_s2_pending_001");
    assert.ok(restored);
    assert.equal(restored!.client_task_id, "ctask_s2_pending_001");
    assert.equal(restored!.job_id, "s2a_job_s2_001");
    assert.equal(restored!.fingerprint, fp);
    assert.equal(restored!.fingerprint_version, fpv);
    // base must be original (0) even though dc may have moved later for other ops
    assert.equal(restored!.generation_base_revision, 0);
  });

  // Collision order
  await check("collision order steps 1-9 before path", () => {
    const r = checkGenerationCollision({
      probe: {
        session_id: sessionId,
        idempotency_key: "idem_path_a_1",
        generation_type: "call_a_hypothesis",
        generation_id: "s2a_job_s2_001",
        client_task_id: "ctask_s2_pending_001",
        generation_base_revision: 0,
        fingerprint: fp,
        fingerprint_version: fpv,
        job_id: "s2a_job_s2_001",
        sync_task_id: null,
      },
      registry: [],
      bindings: [],
    });
    assert.equal(r.path, "A");
    assert.deepEqual(r.steps, [
      "1_session_identity",
      "2_field_completeness",
      "3_read_registry",
      "4_generation_id_collision",
      "5_client_task_id_consistency",
      "6_fingerprint_version",
      "7_generation_base_revision",
      "8_operation_binding",
      "9_path_abc",
    ]);
  });

  await check("collision hard-fail different client_task_id same generation_id", () => {
    let threw = false;
    try {
      checkGenerationCollision({
        probe: {
          session_id: sessionId,
          idempotency_key: "idem_x",
          generation_type: "call_a_hypothesis",
          generation_id: "gen_shared",
          client_task_id: "ctask_b",
          generation_base_revision: 0,
          fingerprint: fp,
          fingerprint_version: fpv,
          job_id: "job_x",
          sync_task_id: null,
        },
        registry: [
          {
            session_id: sessionId,
            generation_type: "call_a_hypothesis",
            generation_id: "gen_shared",
            client_task_id: "ctask_a",
            generation_base_revision: 0,
            fingerprint: fp,
            fingerprint_version: fpv,
            job_id: "job_x",
            sync_task_id: null,
            status: "completed",
            result_marker: "m",
            committed_session_revision: 1,
            committed_dc_write_revision: 1,
            committed_context_id: "ctx",
            committed_context_version: 1,
            committed_context_hash: null,
            completed_at: "2026-11-03T12:00:00.000Z",
          },
        ],
        bindings: [],
      });
    } catch (err) {
      threw = true;
      assert.equal((err as GenerationError).code, GENERATION_IDENTITY_COLLISION);
    }
    assert.equal(threw, true);
  });

  // Fresh session for Path A success (dc base aligned)
  const sessionId2 = await createPOJUSession({
    payment_id: "pay_s2_gen_path",
    original_question: "Path A/B/C?",
  });

  await check("Path A success commits registry+binding+task+dc bump", async () => {
    const { task } = await createPendingGenerationTaskContext({
      session_id: sessionId2,
      generation_type: "call_b_dir",
      fingerprint: "fp_path_a",
      fingerprint_version: fpv,
      client_task_id: "ctask_path_a_1",
    });
    assert.equal(task.generation_base_revision, 0);
    await bindJobToGenerationTaskContext({
      session_id: sessionId2,
      client_task_id: "ctask_path_a_1",
      job_id: "s2b_job_path_a",
    });
    // Move to result_received via transition helper would need statuses; Path A drives machine.
    const before = await loadPOJUSession(sessionId2);
    const sBefore = before!.session_revision ?? 0;
    const dBefore = before!.dc_write_revision ?? 0;

    const dc: DecisionContext = makeDc({
      context_id: "ctx_path_a",
      version: 1,
      dirs: [{ dir_id: "d1", text: "dir", status: "proposed" } as any],
      updated_at: "2026-11-03T13:00:00.000Z",
    });

    const result = await commitGenerationGuarded({
      probe: {
        session_id: sessionId2,
        idempotency_key: "idem_path_a_ok",
        generation_type: "call_b_dir",
        generation_id: "s2b_job_path_a",
        client_task_id: "ctask_path_a_1",
        generation_base_revision: 0,
        fingerprint: "fp_path_a",
        fingerprint_version: fpv,
        job_id: "s2b_job_path_a",
        sync_task_id: null,
      },
      dc_mutation: {
        decision_context: dc,
        decision_context_versions: [dc],
        result_marker: "call_b:dir:d1",
        context_hash: "hash_a",
      },
      now: "2026-11-03T13:00:00.000Z",
    });
    assert.equal(result.path, "A");
    if (result.path !== "A") throw new Error("expected A");
    assert.equal(result.write.dc_write_revision, dBefore + 1);
    assert.equal(result.write.session_revision, sBefore + 1);
    assert.equal(result.registry_entry.status, "completed");
    const after = await loadPOJUSession(sessionId2);
    assert.equal(after!.generation_registry!.length, 1);
    assert.equal(after!.generation_operation_bindings!.length, 1);
    assert.ok(after!.decision_context_idempotency_keys!.includes("idem_path_a_ok"));
    assert.equal(after!.decision_context?.context_id, "ctx_path_a");
  });

  await check("Path A EMPTY_GENERATION_RESULT does not fake completed", async () => {
    const sid = await createPOJUSession({
      payment_id: "pay_s2_empty",
      original_question: "empty?",
    });
    await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_a_hypothesis",
      fingerprint: "fp_empty",
      fingerprint_version: fpv,
      client_task_id: "ctask_empty",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_empty",
      job_id: "job_empty",
    });
    let threw = false;
    try {
      await commitGenerationGuarded({
        probe: {
          session_id: sid,
          idempotency_key: "idem_empty",
          generation_type: "call_a_hypothesis",
          generation_id: "job_empty",
          client_task_id: "ctask_empty",
          generation_base_revision: 0,
          fingerprint: "fp_empty",
          fingerprint_version: fpv,
          job_id: "job_empty",
          sync_task_id: null,
        },
        empty_result: true,
      });
    } catch (err) {
      threw = true;
      assert.equal((err as GenerationError).code, EMPTY_GENERATION_RESULT);
    }
    assert.equal(threw, true);
    const after = await loadPOJUSession(sid);
    assert.equal((after!.generation_registry ?? []).length, 0);
  });

  await check("Path A GENERATION_BASE_STALE when dc moved after pending", async () => {
    const sid = await createPOJUSession({
      payment_id: "pay_s2_stale_a",
      original_question: "stale A?",
    });
    await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_a_hypothesis",
      fingerprint: "fp_stale_a",
      fingerprint_version: fpv,
      client_task_id: "ctask_stale_a",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_stale_a",
      job_id: "job_stale_a",
    });
    await mutatePOJUSession(sid, {
      operation_id: "bump_dc_stale_a",
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => ({
        ...latest,
        decision_context: makeDc({
          context_id: "ctx_moved",
          version: 1,
          updated_at: "2026-11-03T14:00:00.000Z",
        }),
      }),
    });
    let threw = false;
    try {
      await commitGenerationGuarded({
        probe: {
          session_id: sid,
          idempotency_key: "idem_stale_a",
          generation_type: "call_a_hypothesis",
          generation_id: "job_stale_a",
          client_task_id: "ctask_stale_a",
          generation_base_revision: 0,
          fingerprint: "fp_stale_a",
          fingerprint_version: fpv,
          job_id: "job_stale_a",
          sync_task_id: null,
        },
        dc_mutation: {
          decision_context: makeDc({
            context_id: "ctx_stale",
            version: 1,
            updated_at: "2026-11-03T14:01:00.000Z",
          }),
          result_marker: "stale",
        },
      });
    } catch (err) {
      threw = true;
      const code = (err as any).code;
      assert.equal(code, GENERATION_BASE_STALE);
    }
    assert.equal(threw, true);
  });

  await check("Path B replay no double write / no rev bump", async () => {
    const before = await loadPOJUSession(sessionId2);
    const s0 = before!.session_revision ?? 0;
    const d0 = before!.dc_write_revision ?? 0;
    const regLen = before!.generation_registry!.length;
    const result = await commitGenerationGuarded({
      probe: {
        session_id: sessionId2,
        idempotency_key: "idem_path_a_ok",
        generation_type: "call_b_dir",
        generation_id: "s2b_job_path_a",
        client_task_id: "ctask_path_a_1",
        generation_base_revision: 0,
        fingerprint: "fp_path_a",
        fingerprint_version: fpv,
        job_id: "s2b_job_path_a",
        sync_task_id: null,
      },
      dc_mutation: {
        decision_context: before!.decision_context as DecisionContext,
        result_marker: "should_not_apply",
      },
    });
    assert.equal(result.path, "B");
    if (result.path !== "B") throw new Error("expected B");
    assert.equal(result.replay.outcome, "already_committed");
    const after = await loadPOJUSession(sessionId2);
    assert.equal(after!.session_revision, s0);
    assert.equal(after!.dc_write_revision, d0);
    assert.equal(after!.generation_registry!.length, regLen);
  });

  await check("Path C new key no DC bump, no duplicate registry", async () => {
    const before = await loadPOJUSession(sessionId2);
    const s0 = before!.session_revision ?? 0;
    const d0 = before!.dc_write_revision ?? 0;
    const regLen = before!.generation_registry!.length;
    const bindLen = before!.generation_operation_bindings!.length;
    const result = await commitGenerationGuarded({
      probe: {
        session_id: sessionId2,
        idempotency_key: "idem_path_c_new",
        generation_type: "call_b_dir",
        generation_id: "s2b_job_path_a",
        client_task_id: "ctask_path_a_1",
        generation_base_revision: 0,
        fingerprint: "fp_path_a",
        fingerprint_version: fpv,
        job_id: "s2b_job_path_a",
        sync_task_id: null,
      },
    });
    assert.equal(result.path, "C");
    if (result.path !== "C") throw new Error("expected C");
    assert.equal(result.dc_mutation_applied, false);
    assert.equal(result.write.dc_write_revision, d0);
    assert.equal(result.write.session_revision, s0 + 1);
    const after = await loadPOJUSession(sessionId2);
    assert.equal(after!.generation_registry!.length, regLen);
    assert.equal(after!.generation_operation_bindings!.length, bindLen + 1);
    assert.ok(after!.decision_context_idempotency_keys!.includes("idem_path_c_new"));
  });

  // Job store client_task recovery
  await check("Job create idempotent by client_task_id + getXhighJobByClientTaskId", async () => {
    await runWithEphemeralXhighKv(async () => {
      const job1 = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: "sess_job_s2_aaaa",
        locale: "en",
        client_task_id: "ctask_job_idem_1",
        generation_type: "call_a_hypothesis",
        fingerprint: "fp_job",
        fingerprint_version: fpv,
        job_input: { kind: "segment2" } as any,
      });
      const job2 = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: "sess_job_s2_aaaa",
        locale: "en",
        client_task_id: "ctask_job_idem_1",
        generation_type: "call_a_hypothesis",
        fingerprint: "fp_job",
        fingerprint_version: fpv,
        job_input: { kind: "segment2" } as any,
      });
      assert.equal(job1.job_id, job2.job_id);
      assert.equal(job1.client_task_id, "ctask_job_idem_1");
      const found = await getXhighJobByClientTaskId({
        phase: "segment2_breakthrough_core",
        session_id: "sess_job_s2_aaaa",
        client_task_id: "ctask_job_idem_1",
      });
      assert.equal(found.status, "found");
      if (found.status === "found") {
        assert.equal(found.job.job_id, job1.job_id);
      }
      assert.equal(
        xhighClientTaskKey("segment2_breakthrough_core", "sess_job_s2_aaaa", "ctask_job_idem_1"),
        "poju-xhigh:client_task:segment2_breakthrough_core:sess_job_s2_aaaa:ctask_job_idem_1",
      );
    });
  });

  // generation_guarded vs idempotent_first on persist begin/commit
  await check("persist generation_guarded skips key-only early return", async () => {
    const persist = await import("../lib/poju/decision-context/persist");
    const {
      beginPersistTransaction,
      commitPersistTransaction,
      applyDcToWorking,
      hydratePersistIdempotencyFromKeys,
    } = persist;
    const resetFn =
      (persist as { __resetPersistIdempotencyForTests?: () => void })
        .__resetPersistIdempotencyForTests;
    if (typeof resetFn === "function") resetFn();
    const slice = {
      session_id: "sess_persist_guard_1",
      decision_context_idempotency_keys: ["key_done"],
      decision_context: makeDc({
        context_id: "c1",
        version: 1,
        updated_at: "2026-11-03T15:00:00.000Z",
      }),
      control_plane: { current_phase: "test" },
    };
    hydratePersistIdempotencyFromKeys("sess_persist_guard_1", ["key_done"]);
    const early = beginPersistTransaction(slice, { idempotency_key: "key_done" });
    assert.equal(early, null); // idempotent_first
    const guarded = beginPersistTransaction(slice, {
      idempotency_key: "key_done",
      mode: "generation_guarded",
    });
    assert.ok(guarded);
    applyDcToWorking(guarded!, slice.decision_context!);
    let wrote = false;
    const commitSkip = await commitPersistTransaction(
      beginPersistTransaction(
        { ...slice, decision_context_idempotency_keys: ["key_done"] },
        { idempotency_key: "key_done" },
      ) as any,
      async () => {
        wrote = true;
      },
    ).catch(() => null);
    // begin returned null above for idempotent_first — exercise commit path with guarded
    const tx2 = beginPersistTransaction(
      { ...slice, decision_context_idempotency_keys: [] },
      { idempotency_key: "key_done", mode: "generation_guarded" },
    );
    assert.ok(tx2);
    // stamp durable manually to simulate key present on snapshot for commit early-return test
    tx2!.snapshot.session.decision_context_idempotency_keys = ["key_done"];
    hydratePersistIdempotencyFromKeys("sess_persist_guard_1", ["key_done"]);
    const skip = await commitPersistTransaction(tx2!, async () => {
      wrote = true;
    });
    assert.equal(skip.error, "idempotent_skip");
    assert.equal(wrote, false);

    const tx3 = beginPersistTransaction(
      { ...slice, decision_context_idempotency_keys: ["key_done"] },
      { idempotency_key: "key_done", mode: "generation_guarded" },
    );
    assert.ok(tx3);
    applyDcToWorking(tx3!, {
      ...slice.decision_context!,
      version: 2,
    });
    const ok = await commitPersistTransaction(
      tx3!,
      async () => {
        wrote = true;
      },
      { mode: "generation_guarded", require_control_plane: false },
    );
    assert.equal(ok.committed, true);
    assert.equal(wrote, true);
    void commitSkip;
  });

  console.log(`\nOK ${passed} checks`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
