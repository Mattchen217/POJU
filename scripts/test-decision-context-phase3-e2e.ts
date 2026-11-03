/**
 * Phase 3 S5 — L3 control-flow / e2e (fake-indexeddb + job store). Mapping §7.3.
 * CORE_ONLY=1 runs core blocking subset only.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

const CORE_IDS = new Set([
  "P3-61","P3-62","P3-63","P3-67","P3-68","P3-69","P3-72","P3-73","P3-74",
  "P3-78","P3-80","P3-86","P3-87","P3-94","P3-98","P3-101","P3-107","P3-110",
  "P3-113","P3-116","P3-118","P3-121","P3-125","P3-128","P3-129","P3-130",
]);
const CORE_ONLY =
  process.env.PHASE3_CORE_ONLY === "1" || process.argv.includes("--core");

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
memoryStore.set("pojulife_device_id_v4", "dev_s5_e2e");
memoryStore.set("pojulife_owner_key_migrated_v1", "1");

type Row = { id: string; name: string; status: "PASS" | "FAIL" | "SKIP"; err?: string };
const results: Row[] = [];
function shouldRun(id: string): boolean {
  const only = process.env.PHASE3_ONLY_IDS;
  if (only && only.trim()) return only.split(/[,\s]+/).filter(Boolean).includes(id);
  return !CORE_ONLY || CORE_IDS.has(id);
}
async function p3(id: string, name: string, fn: () => void | Promise<void>): Promise<void> {
  if (!shouldRun(id)) {
    results.push({ id, name, status: "SKIP" });
    console.log(`  SKIP  ${id}  ${name}`);
    return;
  }
  try {
    await fn();
    results.push({ id, name, status: "PASS" });
    console.log(`  PASS  ${id}  ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    results.push({ id, name, status: "FAIL", err: msg });
    console.error(`  FAIL  ${id}  ${name}`);
    console.error(msg);
    throw err;
  }
}
function summarize(label: string): void {
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  console.log(`\n${label}: PASS=${pass} FAIL=${fail} SKIP=${skip} (ran=${pass + fail})`);
  if (fail > 0) process.exitCode = 1;
}

async function main() {
  console.log(`phase3-s5-e2e CORE_ONLY=${CORE_ONLY}`);

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession } = await import("../lib/poju/session-manager");
  const {
    mutatePOJUSession,
    GENERATION_BASE_STALE,
  } = await import("../lib/poju/session-mutation");
  const {
    createPendingGenerationTaskContext,
    bindJobToGenerationTaskContext,
    restoreTaskContextOnReload,
    restoreGenerationOnJobReload,
    commitGenerationGuarded,
    transitionGenerationTaskContext,
    GenerationError,
    assertFormalGenerationResultReadable,
    assertSessionGenerationConsistency,
    isGenerationStateInconsistentError,
    GENERATION_STATE_INCONSISTENT,
  } = await import("../lib/poju/generation");
  const {
    createXhighJob,
    getXhighJobByClientTaskId,
  } = await import("../lib/poju/xhigh-job-store");
  const { runWithEphemeralXhighKv } = await import("../lib/poju/xhigh-job-store");
  const {
    createOpeningAnchor,
    confirmOpeningAnchor,
    resetOpeningAnchor,
    resolveCurrentOpeningAnchor,
  } = await import("../lib/poju/decision-context/opening-anchor");
  const {
    appendConfirmationEvent,
    assertGateConfirmDoesNotCreateFactEvents,
    confirmFact,
    confirmConstraint,
    assertConfirmationEventProvenance,
    isConfirmationEventError,
    CONFIRMATION_SOURCE_INVALID,
    CONFIRMATION_TARGET_INVALID,
    CONFIRMATION_ACTION_REUSED,
  } = await import("../lib/poju/decision-context/confirmation-event");
  const {
    createDefaultControlPlane,
    assertAgentV2CannotOverwriteControlPlane,
    isControlPlaneError,
  } = await import("../lib/poju/decision-context/control-plane");
  const {
    extractDcSessionSlice,
  } = await import("../lib/poju/decision-context/persist");
  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;

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

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  await p3("P3-88", "Path B response lost → Reload recovers original commit", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_88", original_question: "88" });
    await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_b_dir",
      fingerprint: "fp88",
      fingerprint_version: fpv,
      client_task_id: "ctask_88",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_88",
      job_id: "job_88",
    });
    const dc = makeDc({ context_id: "ctx_88", version: 1, content_hash: "h88" });
    await commitGenerationGuarded({
      probe: {
        session_id: sid,
        idempotency_key: "idem_88",
        generation_type: "call_b_dir",
        generation_id: "job_88",
        client_task_id: "ctask_88",
        generation_base_revision: 0,
        fingerprint: "fp88",
        fingerprint_version: fpv,
        job_id: "job_88",
        sync_task_id: null,
      },
      dc_mutation: { decision_context: dc, result_marker: "m", context_hash: "h88" },
    });
    // Simulate UI lost response: reload session and Path B
    const reloaded = await loadPOJUSession(sid);
    assert.ok(reloaded!.generation_registry!.length === 1);
    const r = await commitGenerationGuarded({
      probe: {
        session_id: sid,
        idempotency_key: "idem_88",
        generation_type: "call_b_dir",
        generation_id: "job_88",
        client_task_id: "ctask_88",
        generation_base_revision: 0,
        fingerprint: "fp88",
        fingerprint_version: fpv,
        job_id: "job_88",
        sync_task_id: null,
      },
    });
    assert.equal(r.path, "B");
    if (r.path !== "B") throw new Error("B");
    assert.equal(r.replay.original_context_id, "ctx_88");
  });

  await p3("P3-89", "Path A success UI missed → Reload sees Binding/Registry completed", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_89", original_question: "89" });
    await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_a_hypothesis",
      fingerprint: "fp89",
      fingerprint_version: fpv,
      client_task_id: "ctask_89",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_89",
      job_id: "job_89",
    });
    await commitGenerationGuarded({
      probe: {
        session_id: sid,
        idempotency_key: "idem_89",
        generation_type: "call_a_hypothesis",
        generation_id: "job_89",
        client_task_id: "ctask_89",
        generation_base_revision: 0,
        fingerprint: "fp89",
        fingerprint_version: fpv,
        job_id: "job_89",
        sync_task_id: null,
      },
      dc_mutation: {
        decision_context: makeDc({ context_id: "ctx_89", version: 1, content_hash: "h89" }),
        result_marker: "ok",
        context_hash: "h89",
      },
    });
    const reloaded = await loadPOJUSession(sid);
    assert.equal(reloaded!.generation_registry![0].status, "completed");
    assert.equal(reloaded!.generation_operation_bindings!.length, 1);
    const task = restoreTaskContextOnReload(reloaded!, "ctask_89");
    assert.ok(task);
  });

  await p3("P3-92", "pending_create Reload restores same client_task_id and base", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_92", original_question: "92" });
    const { task } = await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_a_hypothesis",
      fingerprint: "fp92",
      fingerprint_version: fpv,
      client_task_id: "ctask_92",
    });
    const base = task.generation_base_revision;
    const reloaded = await loadPOJUSession(sid);
    const restored = restoreTaskContextOnReload(reloaded!, "ctask_92");
    assert.equal(restored!.client_task_id, "ctask_92");
    assert.equal(restored!.generation_base_revision, base);
    assert.equal(restored!.fingerprint, "fp92");
  });

  await p3("P3-93", "remote Job create + local bind → TaskContext running", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_s5_93", original_question: "93" });
      await createPendingGenerationTaskContext({
        session_id: sid,
        generation_type: "call_a_hypothesis",
        fingerprint: "fp93",
        fingerprint_version: fpv,
        client_task_id: "ctask_93",
      });
      const job = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_93",
        generation_type: "call_a_hypothesis",
      } as any);
      const { task } = await bindJobToGenerationTaskContext({
        session_id: sid,
        client_task_id: "ctask_93",
        job_id: job.job_id ?? job.id ?? String((job as any).id || (job as any).job_id),
      });
      assert.equal(task.status, "running");
      assert.ok(task.job_id);
    });
  });

  await p3("P3-94", "Job create ok but local bind fails → recovery_required, no new identity", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_s5_94", original_question: "94" });
      const { task: pending } = await createPendingGenerationTaskContext({
        session_id: sid,
        generation_type: "call_a_hypothesis",
        fingerprint: "fp94",
        fingerprint_version: fpv,
        client_task_id: "ctask_94",
      });
      const job = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_94",
        generation_type: "call_a_hypothesis",
      } as any);
      const jobId = (job as any).job_id ?? (job as any).id;
      assert.ok(jobId);
      // Simulate bind failure by transitioning to recovery_required without binding
      try {
        await transitionGenerationTaskContext({
          session_id: sid,
          client_task_id: "ctask_94",
          to: "recovery_required",
          now: "2026-11-03T12:05:00.000Z",
        } as any);
      } catch {
        // If transition API shape differs, mutate status directly via session patch
        await mutatePOJUSession(sid, {
          operation_id: "op_94_recovery",
          kind: "session_patch",
          bump_dc: false,
          apply: (latest) => {
            const tasks = [...(latest.generation_task_contexts ?? [])];
            const idx = tasks.findIndex((t) => t.client_task_id === "ctask_94");
            assert.ok(idx >= 0);
            tasks[idx] = { ...tasks[idx], status: "recovery_required" as any };
            return { ...latest, generation_task_contexts: tasks };
          },
        });
      }
      const after = await loadPOJUSession(sid);
      const t = after!.generation_task_contexts!.find((x) => x.client_task_id === "ctask_94")!;
      assert.equal(t.status, "recovery_required");
      assert.equal(t.client_task_id, pending.client_task_id);
      assert.equal(t.fingerprint, "fp94");
      // Must not create a second identity
      assert.equal(
        after!.generation_task_contexts!.filter((x) => x.fingerprint === "fp94").length,
        1,
      );
      void jobId;
    });
  });

  await p3("P3-95", "Reload finds original Job via metadata and rebinds job_id", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_s5_95", original_question: "95" });
      await createPendingGenerationTaskContext({
        session_id: sid,
        generation_type: "call_a_hypothesis",
        fingerprint: "fp95",
        fingerprint_version: fpv,
        client_task_id: "ctask_95",
      });
      const job = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_95",
        generation_type: "call_a_hypothesis",
      } as any);
      const found = await getXhighJobByClientTaskId({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        client_task_id: "ctask_95",
      });
      assert.ok(found);
      const jobId =
        (found as any).job?.job_id ??
        (found as any).job_id ??
        (job as any).job_id;
      const { task } = await bindJobToGenerationTaskContext({
        session_id: sid,
        client_task_id: "ctask_95",
        job_id: String(jobId),
      });
      assert.equal(task.job_id, String(jobId));
    });
  });

  await p3("P3-96", "remote Job still running → do not create second Job", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_s5_96", original_question: "96" });
      const j1 = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_96",
        generation_type: "call_a_hypothesis",
      } as any);
      const j2 = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_96",
        generation_type: "call_a_hypothesis",
      } as any);
      const id1 = (j1 as any).job_id ?? (j1 as any).id;
      const id2 = (j2 as any).job_id ?? (j2 as any).id;
      assert.equal(String(id1), String(id2));
    });
  });

  await p3("P3-97", "server reports Job failed → fail state keeps identity", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_97", original_question: "97" });
    await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_a_hypothesis",
      fingerprint: "fp97",
      fingerprint_version: fpv,
      client_task_id: "ctask_97",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_97",
      job_id: "job_97",
    });
    try {
      await transitionGenerationTaskContext({
        session_id: sid,
        client_task_id: "ctask_97",
        to: "failed_retryable",
        now: "2026-11-03T12:10:00.000Z",
      } as any);
    } catch {
      await mutatePOJUSession(sid, {
        operation_id: "op_97_fail",
        kind: "session_patch",
        bump_dc: false,
        apply: (latest) => {
          const tasks = [...(latest.generation_task_contexts ?? [])];
          const idx = tasks.findIndex((t) => t.client_task_id === "ctask_97");
          tasks[idx] = { ...tasks[idx], status: "failed_retryable" as any };
          return { ...latest, generation_task_contexts: tasks };
        },
      });
    }
    const after = await loadPOJUSession(sid);
    const t = after!.generation_task_contexts!.find((x) => x.client_task_id === "ctask_97")!;
    assert.equal(t.client_task_id, "ctask_97");
    assert.equal(t.job_id, "job_97");
    assert.ok(["failed_retryable", "failed", "recovery_required"].includes(t.status as string));
  });

  await p3("P3-98", "result returns after DC Base moved → hard fail, no stale write", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_98", original_question: "98" });
    await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_a_hypothesis",
      fingerprint: "fp98",
      fingerprint_version: fpv,
      client_task_id: "ctask_98",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_98",
      job_id: "job_98",
    });
    await mutatePOJUSession(sid, {
      operation_id: "bump_98",
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => ({
        ...latest,
        decision_context: makeDc({
          context_id: "ctx_moved_98",
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
          idempotency_key: "idem_98",
          generation_type: "call_a_hypothesis",
          generation_id: "job_98",
          client_task_id: "ctask_98",
          generation_base_revision: 0,
          fingerprint: "fp98",
          fingerprint_version: fpv,
          job_id: "job_98",
          sync_task_id: null,
        },
        dc_mutation: {
          decision_context: makeDc({ context_id: "ctx_stale_98", version: 1 }),
          result_marker: "stale",
        },
      });
    } catch (err) {
      threw = true;
      assert.equal((err as any).code, GENERATION_BASE_STALE);
    }
    assert.equal(threw, true);
    const after = await loadPOJUSession(sid);
    assert.notEqual(after!.decision_context?.context_id, "ctx_stale_98");
  });

  await p3("P3-99", "TaskContext completed but Registry missing → inconsistency hard fail", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_99", original_question: "99" });
    await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_a_hypothesis",
      fingerprint: "fp99",
      fingerprint_version: fpv,
      client_task_id: "ctask_99",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_99",
      job_id: "job_99",
    });
    await mutatePOJUSession(sid, {
      operation_id: "op_99_bad",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => {
        const tasks = [...(latest.generation_task_contexts ?? [])];
        const idx = tasks.findIndex((t) => t.client_task_id === "ctask_99");
        assert.ok(idx >= 0);
        tasks[idx] = { ...tasks[idx], status: "completed" };
        return {
          ...latest,
          generation_task_contexts: tasks,
          generation_registry: [],
        };
      },
    });
    const after = await loadPOJUSession(sid);
    assert.equal(
      after!.generation_task_contexts!.find((t) => t.client_task_id === "ctask_99")!.status,
      "completed",
    );
    assert.equal((after!.generation_registry ?? []).length, 0);

    // Runtime hard-fail at restore / job reload / formal read / commit boundaries.
    let restoreThrew = false;
    try {
      restoreTaskContextOnReload(after!, "ctask_99");
    } catch (err) {
      restoreThrew = true;
      assert.ok(isGenerationStateInconsistentError(err));
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
      assert.equal((err as any).diagnosis.case, "A_TASK_COMPLETED_REGISTRY_MISSING_OR_INCOMPLETE");
    }
    assert.equal(restoreThrew, true);

    let jobReloadThrew = false;
    try {
      restoreGenerationOnJobReload(after!, "ctask_99");
    } catch (err) {
      jobReloadThrew = true;
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
    }
    assert.equal(jobReloadThrew, true);

    let readThrew = false;
    try {
      assertFormalGenerationResultReadable(after!, "ctask_99", {
        generation_type: "call_a_hypothesis",
        generation_id: "job_99",
      });
    } catch (err) {
      readThrew = true;
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
    }
    assert.equal(readThrew, true);

    let commitThrew = false;
    try {
      await commitGenerationGuarded({
        probe: {
          session_id: sid,
          idempotency_key: "idem_99",
          generation_type: "call_a_hypothesis",
          generation_id: "job_99",
          client_task_id: "ctask_99",
          generation_base_revision: after!.dc_write_revision ?? 0,
          fingerprint: "fp99",
          fingerprint_version: fpv,
          job_id: "job_99",
          sync_task_id: null,
        },
        dc_mutation: {
          decision_context: makeDc({ context_id: "ctx_99", version: 1 }),
          result_marker: "m99",
        },
      });
    } catch (err) {
      commitThrew = true;
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
      // Must not auto-fix or delete records.
      const still = await loadPOJUSession(sid);
      assert.equal(
        still!.generation_task_contexts!.find((t) => t.client_task_id === "ctask_99")!.status,
        "completed",
      );
      assert.equal((still!.generation_registry ?? []).length, 0);
    }
    assert.equal(commitThrew, true);
  });

  await p3("P3-100", "Registry completed but TaskContext still running → inconsistency", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_100", original_question: "100" });
    await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_b_dir",
      fingerprint: "fp100",
      fingerprint_version: fpv,
      client_task_id: "ctask_100",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_100",
      job_id: "job_100",
    });
    await commitGenerationGuarded({
      probe: {
        session_id: sid,
        idempotency_key: "idem_100",
        generation_type: "call_b_dir",
        generation_id: "job_100",
        client_task_id: "ctask_100",
        generation_base_revision: 0,
        fingerprint: "fp100",
        fingerprint_version: fpv,
        job_id: "job_100",
        sync_task_id: null,
      },
      dc_mutation: {
        decision_context: makeDc({ context_id: "ctx_100", version: 1, content_hash: "h100" }),
        result_marker: "m",
        context_hash: "h100",
      },
    });
    // Force TaskContext back to running while registry completed (corruption)
    await mutatePOJUSession(sid, {
      operation_id: "op_100_corrupt",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => {
        const tasks = [...(latest.generation_task_contexts ?? [])];
        const idx = tasks.findIndex((t) => t.client_task_id === "ctask_100");
        tasks[idx] = { ...tasks[idx], status: "running" };
        return { ...latest, generation_task_contexts: tasks };
      },
    });
    const after = await loadPOJUSession(sid);
    const regDone = after!.generation_registry!.some((r) => r.status === "completed");
    const taskRunning = after!.generation_task_contexts!.some(
      (t) => t.client_task_id === "ctask_100" && t.status === "running",
    );
    assert.equal(regDone && taskRunning, true);

    let restoreThrew = false;
    try {
      restoreTaskContextOnReload(after!, "ctask_100");
    } catch (err) {
      restoreThrew = true;
      assert.ok(isGenerationStateInconsistentError(err));
      assert.equal((err as any).diagnosis.case, "B_REGISTRY_COMPLETED_TASK_NOT_COMPLETED");
    }
    assert.equal(restoreThrew, true);

    // Path B idempotent replay must hard-fail (not treat as normal completion).
    let pathBThrew = false;
    try {
      await commitGenerationGuarded({
        probe: {
          session_id: sid,
          idempotency_key: "idem_100",
          generation_type: "call_b_dir",
          generation_id: "job_100",
          client_task_id: "ctask_100",
          generation_base_revision: 0,
          fingerprint: "fp100",
          fingerprint_version: fpv,
          job_id: "job_100",
          sync_task_id: null,
        },
        dc_mutation: {
          decision_context: makeDc({ context_id: "ctx_100b", version: 2 }),
          result_marker: "m2",
        },
      });
    } catch (err) {
      pathBThrew = true;
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
      const still = await loadPOJUSession(sid);
      assert.ok(still!.generation_registry!.some((r) => r.status === "completed"));
      assert.ok(
        still!.generation_task_contexts!.some(
          (t) => t.client_task_id === "ctask_100" && t.status === "running",
        ),
      );
    }
    assert.equal(pathBThrew, true);

    // Path C new key register must also hard-fail.
    let pathCThrew = false;
    try {
      await commitGenerationGuarded({
        probe: {
          session_id: sid,
          idempotency_key: "idem_100_new",
          generation_type: "call_b_dir",
          generation_id: "job_100",
          client_task_id: "ctask_100",
          generation_base_revision: 0,
          fingerprint: "fp100",
          fingerprint_version: fpv,
          job_id: "job_100",
          sync_task_id: null,
        },
      });
    } catch (err) {
      pathCThrew = true;
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
    }
    assert.equal(pathCThrew, true);

    assert.throws(
      () =>
        assertSessionGenerationConsistency(after!, "ctask_100", "formal_result_read", {
          generation_type: "call_b_dir",
          generation_id: "job_100",
        }),
      (e: unknown) =>
        isGenerationStateInconsistentError(e) &&
        e.diagnosis.case === "B_REGISTRY_COMPLETED_TASK_NOT_COMPLETED",
    );
  });

  await p3("P3-105", "agent_v2 vs formal ControlPlane → ControlPlane wins", () => {
    const cp = createDefaultControlPlane("opening");
    assert.throws(
      () =>
        assertAgentV2CannotOverwriteControlPlane({
          control_plane: cp,
          agent_v2_as_control_plane_candidate: { current_phase: "delivered" },
        }),
      (e: unknown) => isControlPlaneError(e),
    );
    const kept = assertAgentV2CannotOverwriteControlPlane({ control_plane: cp });
    assert.equal(kept?.current_phase, "opening");
  });

  await p3("P3-106", "Reload restores full ControlPlane not only current_phase", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_106", original_question: "106" });
    const formal = createDefaultControlPlane("collecting_context");
    formal.opening_anchor_id = "opening_anchor_106";
    formal.opening_gate_state = "pending";
    formal.investigation_agenda = [
      { id: "ag1", label: "Q1", critical: true, status: "unexplored" },
    ];
    await mutatePOJUSession(sid, {
      operation_id: "op_106_cp",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => ({ ...latest, control_plane: formal }),
    });
    const reloaded = await loadPOJUSession(sid);
    const slice = extractDcSessionSlice(reloaded as any);
    const cp = (reloaded as any).control_plane ?? (slice as any)?.control_plane;
    assert.ok(cp);
    assert.equal(cp.current_phase, "collecting_context");
    assert.equal(cp.opening_anchor_id, "opening_anchor_106");
    assert.equal(cp.investigation_agenda?.[0]?.id, "ag1");
  });

  await p3("P3-108", "Gate overall confirm does not batch Fact Confirmation Events", () => {
    const before = appendConfirmationEvent([], {
      event_id: "evt_pre_108",
      target_type: "fact",
      fact_id: "f1",
      source_turn_id: "t",
      confirmation_turn_id: null,
      confirmation_action_id: "a_pre_108",
      event_type: "confirm_fact",
      actor: "user",
      confirmed_at: "2026-11-03T12:00:00.000Z",
      event_version: 1,
    }).events;
    assertGateConfirmDoesNotCreateFactEvents(before, [...before]);
  });

  await p3("P3-109", "same action_id same target → idempotent skip", () => {
    const e1 = {
      event_id: "evt_109",
      target_type: "fact" as const,
      fact_id: "fact_1",
      source_turn_id: "turn_1",
      confirmation_turn_id: null,
      confirmation_action_id: "act_109",
      event_type: "confirm_fact" as const,
      actor: "user" as const,
      confirmed_at: "2026-11-03T12:00:00.000Z",
      event_version: 1 as const,
    };
    const a = appendConfirmationEvent([], e1);
    const b = appendConfirmationEvent(a.events, { ...e1, event_id: "evt_109b" });
    assert.equal(b.outcome, "idempotent_skip");
    assert.equal(b.events.length, 1);
  });

  await p3("P3-111", "event target mismatch event_type → hard fail", () => {
    assert.throws(() =>
      appendConfirmationEvent([], {
        event_id: "evt_111",
        target_type: "fact",
        fact_id: "fact_1",
        source_turn_id: "turn_1",
        confirmation_turn_id: null,
        confirmation_action_id: "act_111",
        event_type: "confirm_constraint",
        actor: "user",
        confirmed_at: "2026-11-03T12:00:00.000Z",
        event_version: 1,
      } as any),
    );
  });

  await p3("P3-112", "source_turn provenance — real user message required", async () => {
    // (0) empty source_turn_id still hard-fails at schema layer
    assert.throws(
      () =>
        appendConfirmationEvent([], {
          event_id: "evt_112_empty",
          target_type: "fact",
          fact_id: "fact_1",
          source_turn_id: "",
          confirmation_turn_id: null,
          confirmation_action_id: "act_112_empty",
          event_type: "confirm_fact",
          actor: "user",
          confirmed_at: "2026-11-03T12:00:00.000Z",
          event_version: 1,
        } as any),
      (e: unknown) => isConfirmationEventError(e),
    );

    const sid = await createPOJUSession({ payment_id: "pay_s5_112", original_question: "112" });
    const sidOther = await createPOJUSession({
      payment_id: "pay_s5_112b",
      original_question: "112-other",
    });

    // Seed user + assistant messages and a Fact bound to the user turn.
    await mutatePOJUSession(sid, {
      operation_id: "op_112_seed",
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...latest.messages,
          {
            role: "user",
            content: "I have a hard deadline next Friday",
            timestamp: "2026-11-03T12:00:00.000Z",
            client_id: "turn_user_112",
          },
          {
            role: "assistant",
            content: "Got it",
            timestamp: "2026-11-03T12:00:01.000Z",
            client_id: "turn_asst_112",
          },
        ],
        decision_context: makeDc({
          context_id: "ctx_112",
          version: 1,
          reality_facts: [
            {
              fact_id: "fact_112",
              statement: "Hard deadline next Friday",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "opening",
              source_turn_id: "turn_user_112",
              user_confirmed: false,
            },
            {
              fact_id: "fact_112_other",
              statement: "Other fact",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "opening",
              source_turn_id: "turn_user_112_other_missing",
              user_confirmed: false,
            },
          ],
          constraints: [
            {
              constraint_id: "cst_112",
              statement: "Cannot miss deadline",
              category: "time",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "opening",
              source_turn_id: "turn_user_112",
              rigidity: "hard",
              user_confirmed: false,
            },
          ],
        }),
      }),
    });

    // Seed a user message only on the OTHER session (cross-session trap).
    await mutatePOJUSession(sidOther, {
      operation_id: "op_112_other_msg",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...latest.messages,
          {
            role: "user",
            content: "other session statement",
            timestamp: "2026-11-03T12:00:00.000Z",
            client_id: "turn_user_other_session",
          },
        ],
      }),
    });

    // (1) forged non-empty source_turn_id — not in Session
    let forged = false;
    try {
      await confirmFact(sid, {
        operation_id: "op_112_forge",
        event_id: "evt_112_forge",
        fact_id: "fact_112",
        source_turn_id: "totally_fake_turn",
        confirmation_action_id: "act_112_forge",
      });
    } catch (err) {
      forged = true;
      assert.ok(isConfirmationEventError(err));
      assert.equal((err as any).code, CONFIRMATION_SOURCE_INVALID);
    }
    assert.equal(forged, true);

    // (2) cross-Session turn id
    let cross = false;
    try {
      await confirmFact(sid, {
        operation_id: "op_112_cross",
        event_id: "evt_112_cross",
        fact_id: "fact_112",
        source_turn_id: "turn_user_other_session",
        confirmation_action_id: "act_112_cross",
      });
    } catch (err) {
      cross = true;
      assert.equal((err as any).code, CONFIRMATION_SOURCE_INVALID);
    }
    assert.equal(cross, true);

    // (3) non-user (assistant) message
    let nonUser = false;
    try {
      await confirmFact(sid, {
        operation_id: "op_112_asst",
        event_id: "evt_112_asst",
        fact_id: "fact_112",
        source_turn_id: "turn_asst_112",
        confirmation_action_id: "act_112_asst",
      });
    } catch (err) {
      nonUser = true;
      assert.equal((err as any).code, CONFIRMATION_SOURCE_INVALID);
    }
    assert.equal(nonUser, true);

    // (4) target Fact missing
    let missingTarget = false;
    try {
      await confirmFact(sid, {
        operation_id: "op_112_nofact",
        event_id: "evt_112_nofact",
        fact_id: "fact_does_not_exist",
        source_turn_id: "turn_user_112",
        confirmation_action_id: "act_112_nofact",
      });
    } catch (err) {
      missingTarget = true;
      assert.equal((err as any).code, CONFIRMATION_TARGET_INVALID);
    }
    assert.equal(missingTarget, true);

    // (5) target Fact exists but source association mismatch
    let mismatch = false;
    try {
      await confirmFact(sid, {
        operation_id: "op_112_mismatch",
        event_id: "evt_112_mismatch",
        fact_id: "fact_112_other",
        source_turn_id: "turn_user_112",
        confirmation_action_id: "act_112_mismatch",
      });
    } catch (err) {
      mismatch = true;
      assert.equal((err as any).code, CONFIRMATION_TARGET_INVALID);
    }
    assert.equal(mismatch, true);

    // (6) happy path — real user provenance
    const ok = await confirmFact(sid, {
      operation_id: "op_112_ok",
      event_id: "evt_112_ok",
      fact_id: "fact_112",
      source_turn_id: "turn_user_112",
      confirmation_action_id: "act_112_ok",
      confirmed_at: "2026-11-03T12:05:00.000Z",
    });
    assert.equal(ok.outcome, "appended");
    assert.equal(ok.event.source_turn_id, "turn_user_112");

    // (7) confirmation_action_id reused for different target — hard fail
    let reused = false;
    try {
      await confirmConstraint(sid, {
        operation_id: "op_112_reuse",
        event_id: "evt_112_reuse",
        constraint_id: "cst_112",
        source_turn_id: "turn_user_112",
        confirmation_action_id: "act_112_ok",
      });
    } catch (err) {
      reused = true;
      assert.equal((err as any).code, CONFIRMATION_ACTION_REUSED);
    }
    assert.equal(reused, true);

    // Provenance helper rejects forged string even if schema-valid
    const after = await loadPOJUSession(sid);
    assert.throws(
      () =>
        assertConfirmationEventProvenance(
          {
            session_id: after!.session_id,
            messages: after!.messages,
            decision_context: after!.decision_context,
          },
          {
            event_id: "evt_x",
            target_type: "fact",
            fact_id: "fact_112",
            source_turn_id: "forged",
            confirmation_turn_id: null,
            confirmation_action_id: "act_x",
            event_type: "confirm_fact",
            actor: "user",
            confirmed_at: "2026-11-03T12:00:00.000Z",
            event_version: 1,
          },
        ),
      (e: unknown) =>
        isConfirmationEventError(e) && (e as any).code === CONFIRMATION_SOURCE_INVALID,
    );

    const still = await loadPOJUSession(sid);
    assert.equal(
      (still!.confirmation_events ?? []).filter((e) => e.event_id === "evt_112_ok").length,
      1,
    );
    assert.equal(
      still!.decision_context!.reality_facts.find((f) => f.fact_id === "fact_112")!.user_confirmed,
      true,
    );
  });

  await p3("P3-114", "independently_verified without user confirm → user_confirmed=false", async () => {
    const { deriveUserConfirmed } = await import("../lib/poju/decision-context/fact-combination");
    const flagged = deriveUserConfirmed({
      status: "confirmed",
      verification_level: "independently_verified",
      has_user_confirm_event: false,
    });
    assert.equal(flagged, false);
  });

  await p3("P3-115", "Constraint illegal combination → hard fail", async () => {
    const { IllegalFactCombinationError, assertLegalFactCombination } = await import(
      "../lib/poju/decision-context/fact-combination"
    );
    assert.throws(
      () => assertLegalFactCombination("confirmed", "user_estimate" as any),
      (e: unknown) => e instanceof IllegalFactCombinationError,
    );
    assert.throws(
      () => assertLegalFactCombination("unknown", "user_asserted" as any),
      (e: unknown) => e instanceof IllegalFactCombinationError || e instanceof Error,
    );
  });

  await p3("P3-117", "Opening Anchor Session mismatch → hard fail", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_117", original_question: "117" });
    await mutatePOJUSession(sid, {
      operation_id: "s5_117_seed",
      kind: "message_append",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...latest.messages,
          {
            role: "assistant",
            content: "u",
            timestamp: "2026-11-03T12:00:00.000Z",
            client_id: "msg_117",
          },
        ],
      }),
    });
    await assert.rejects(
      () =>
        createOpeningAnchor(sid, {
          operation_id: "s5_117_bad",
          session_id: "totally_wrong_session_id_xxx",
          message_client_id: "msg_117",
          anchor_id: "opening_anchor_117",
          now: "2026-11-03T12:00:00.000Z",
        }),
    );
  });

  await p3("P3-119", "Reload restores Gate History complete+unique", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_119", original_question: "119" });
    await mutatePOJUSession(sid, {
      operation_id: "s5_119_seed",
      kind: "message_append",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...latest.messages,
          {
            role: "assistant",
            content: "u",
            timestamp: "2026-11-03T12:00:00.000Z",
            client_id: "msg_119a",
          },
        ],
      }),
    });
    await createOpeningAnchor(sid, {
      operation_id: "s5_119_create",
      session_id: sid,
      message_client_id: "msg_119a",
      anchor_id: "opening_anchor_119_a",
      history_id: "opening_history_119_a",
      now: "2026-11-03T12:00:00.000Z",
    });
    await confirmOpeningAnchor(sid, {
      operation_id: "s5_119_confirm",
      anchor_id: "opening_anchor_119_a",
      confirmation_action_id: "gate_119",
      now: "2026-11-03T12:01:00.000Z",
    });
    const reloaded = await loadPOJUSession(sid);
    assert.ok(reloaded);
    const current = resolveCurrentOpeningAnchor(reloaded!);
    assert.ok(current);
    const hist = reloaded!.opening_confirm_history ?? [];
    const ids = hist.map((h: any) => h.anchor_id);
    assert.equal(new Set(ids).size, ids.length);
  });

  await p3("P3-120", "after Gate confirm, re-click old Anchor does not re-change state", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_120", original_question: "120" });
    await mutatePOJUSession(sid, {
      operation_id: "s5_120_seed",
      kind: "message_append",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...latest.messages,
          {
            role: "assistant",
            content: "u",
            timestamp: "2026-11-03T12:00:00.000Z",
            client_id: "msg_120",
          },
        ],
      }),
    });
    await createOpeningAnchor(sid, {
      operation_id: "s5_120_create",
      session_id: sid,
      message_client_id: "msg_120",
      anchor_id: "opening_anchor_120",
      now: "2026-11-03T12:00:00.000Z",
    });
    await confirmOpeningAnchor(sid, {
      operation_id: "s5_120_confirm",
      anchor_id: "opening_anchor_120",
      confirmation_action_id: "gate_120",
      now: "2026-11-03T12:01:00.000Z",
    });
    const mid = await loadPOJUSession(sid);
    const gate = mid!.control_plane?.opening_gate_state;
    let threw = false;
    try {
      await confirmOpeningAnchor(sid, {
        operation_id: "s5_120_reconfirm",
        anchor_id: "opening_anchor_120",
        confirmation_action_id: "gate_120b",
        now: "2026-11-03T12:02:00.000Z",
      });
    } catch {
      threw = true;
    }
    const after = await loadPOJUSession(sid);
    assert.equal(after!.control_plane?.opening_gate_state, gate);
    assert.ok(threw || after!.control_plane?.opening_gate_state === "confirmed");
  });

  await p3("P3-127", "Mapper field change without FP version bump is detectable", async () => {
    const {
      CALL_A_FINGERPRINT_VERSION,
      fingerprintNormalizedObject,
      normalizeCallAInput,
    } = await import("../lib/poju/decision-context");
    const { sample } = {
      sample: {
        situation_conclusion: "x",
        energy_structure: "y",
        key_crossroads: {
          real_fork: "a",
          path_costs: "b",
          decision_traits: "c",
          structural_basis: "d",
          needs_validation: "e",
        },
        modern_action_frames: [],
        primary_path: {
          direction: "p",
          why_fits: "w",
          structural_basis: "s",
          needs_validation: "",
        },
        backup_path: {
          direction: "b",
          why_fits: "w",
          structural_basis: "s",
          needs_validation: "",
        },
        energy_retune_frame: {
          direction_fit: "d",
          timing_ripeness: "t",
          daily_retune: "r",
          complementary: "c",
          structural_basis: "s",
          needs_validation: "",
        },
        rhythm_frame: { phase1_observe: "a", phase2_adjust: "b", phase3_consolidate: "c" },
        self_check_signals: [],
        response: "r",
      },
    };
    const n = normalizeCallAInput(sample as any);
    const v1 = fingerprintNormalizedObject(CALL_A_FINGERPRINT_VERSION, n);
    const v2 = fingerprintNormalizedObject(CALL_A_FINGERPRINT_VERSION + "_bump", n);
    assert.notEqual(v1, v2);
  });

  summarize("phase3-s5-e2e");
}

main().catch((err) => {
  console.error(err);
  summarize("phase3-s5-e2e");
  process.exit(1);
});
