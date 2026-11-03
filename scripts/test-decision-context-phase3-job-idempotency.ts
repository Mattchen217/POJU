/**
 * Phase 3 Remediation ITEM 6 — Job unique create + index recovery tests.
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
memoryStore.set("pojulife_device_id_v4", "dev_s5_job");
memoryStore.set("pojulife_owner_key_migrated_v1", "1");

type Row = { id: string; name: string; status: "PASS" | "FAIL" | "SKIP"; err?: string };
const results: Row[] = [];
const only = process.env.PHASE3_ONLY_IDS;

async function p3(id: string, name: string, fn: () => void | Promise<void>): Promise<void> {
  if (only && only.trim() && !only.split(/[,\s]+/).filter(Boolean).includes(id)) {
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

function summarize(): void {
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  console.log(`\nphase3-job-idempotency: PASS=${pass} FAIL=${fail} SKIP=${skip}`);
  if (fail > 0) process.exitCode = 1;
}

function seg2Input(sid: string, q: string) {
  return {
    session_id: sid,
    original_question: q,
    locale: "en",
    profile_id: null,
    agent_v2: null,
    base_analysis: {},
  };
}

async function main() {
  console.log("phase3-job-idempotency");
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession } = await import("../lib/poju/session-manager");
  const {
    createPendingGenerationTaskContext,
    bindJobToGenerationTaskContext,
  } = await import("../lib/poju/generation");
  const {
    createXhighJob,
    getXhighJobByClientTaskId,
    runWithEphemeralXhighKv,
  } = await import("../lib/poju/xhigh-job-store");
  const fpv = "poju-generation-fp-v1";

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  await p3("P3-96", "concurrent + response-lost retry → one Job", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_job_96", original_question: "96" });
      const base = {
        phase: "segment2_breakthrough_core" as const,
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_96",
        generation_type: "call_a_hypothesis" as const,
        job_input: seg2Input(sid, "96"),
      };
      const j1 = await createXhighJob(base);
      const j2 = await createXhighJob(base);
      assert.equal(j1.job_id, j2.job_id);

      const sidC = await createPOJUSession({ payment_id: "pay_job_96c", original_question: "96c" });
      const baseC = {
        phase: "segment2_breakthrough_core" as const,
        session_id: sidC,
        locale: "en",
        client_task_id: "ctask_96c",
        generation_type: "call_a_hypothesis" as const,
        job_input: seg2Input(sidC, "96c"),
      };
      const [c1, c2] = await Promise.all([createXhighJob(baseC), createXhighJob(baseC)]);
      assert.equal(c1.job_id, c2.job_id);
    });
  });

  await p3("P3-131", "Job write OK index missing → Reload recovers original Job", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_job_131", original_question: "131" });
      const job = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_131",
        generation_type: "call_a_hypothesis",
        job_input: seg2Input(sid, "131"),
        __test_delete_index_after_create: true,
      });
      const recovered = await getXhighJobByClientTaskId({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        client_task_id: "ctask_131",
        generation_type: "call_a_hypothesis",
        consult_latest_candidate: true,
      });
      assert.equal(recovered.status, "found");
      if (recovered.status !== "found") throw new Error("expected found");
      assert.equal(recovered.job.job_id, job.job_id);
      const again = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_131",
        generation_type: "call_a_hypothesis",
        job_input: seg2Input(sid, "131"),
      });
      assert.equal(again.job_id, job.job_id);
    });
  });

  await p3("P3-132", "Job create OK Session Binding fails → recover binds original Job", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_job_132", original_question: "132" });
      await createPendingGenerationTaskContext({
        session_id: sid,
        generation_type: "call_a_hypothesis",
        fingerprint: "fp132",
        fingerprint_version: fpv,
        client_task_id: "ctask_132",
      });
      const job = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_132",
        generation_type: "call_a_hypothesis",
        job_input: seg2Input(sid, "132"),
      });
      const mid = await loadPOJUSession(sid);
      assert.equal(
        mid!.generation_task_contexts!.find((t) => t.client_task_id === "ctask_132")!.job_id,
        null,
      );
      const found = await getXhighJobByClientTaskId({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        client_task_id: "ctask_132",
      });
      assert.equal(found.status, "found");
      if (found.status !== "found") throw new Error("expected found");
      const { task } = await bindJobToGenerationTaskContext({
        session_id: sid,
        client_task_id: "ctask_132",
        job_id: found.job.job_id,
      });
      assert.equal(task.job_id, job.job_id);
      assert.equal(task.status, "running");
    });
  });

  await p3("P3-133", "same Session different Generation must not mis-bind", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_job_133", original_question: "133" });
      const jobA = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_133_a",
        generation_type: "call_a_hypothesis",
        job_input: seg2Input(sid, "133a"),
      });
      const jobB = await createXhighJob({
        phase: "segment2_agenda_bridge",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_133_b",
        generation_type: "call_b_dir",
        job_input: {
          session_id: sid,
          locale: "en",
          original_question: "133b",
          breakthrough_core: {} as any,
        },
      });
      assert.notEqual(jobA.job_id, jobB.job_id);
      const cross = await getXhighJobByClientTaskId({
        phase: "segment2_agenda_bridge",
        session_id: sid,
        client_task_id: "ctask_133_a",
      });
      assert.equal(cross.status, "missing");
    });
  });

  await p3("P3-134", "different Sessions same client_task_id must not cross-contaminate", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid1 = await createPOJUSession({ payment_id: "pay_job_134a", original_question: "134a" });
      const sid2 = await createPOJUSession({ payment_id: "pay_job_134b", original_question: "134b" });
      const shared = "ctask_shared_134";
      const j1 = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid1,
        locale: "en",
        client_task_id: shared,
        generation_type: "call_a_hypothesis",
        job_input: seg2Input(sid1, "134a"),
      });
      const j2 = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid2,
        locale: "en",
        client_task_id: shared,
        generation_type: "call_a_hypothesis",
        job_input: seg2Input(sid2, "134b"),
      });
      assert.notEqual(j1.job_id, j2.job_id);
      const f1 = await getXhighJobByClientTaskId({
        phase: "segment2_breakthrough_core",
        session_id: sid1,
        client_task_id: shared,
      });
      const f2 = await getXhighJobByClientTaskId({
        phase: "segment2_breakthrough_core",
        session_id: sid2,
        client_task_id: shared,
      });
      assert.equal(f1.status, "found");
      assert.equal(f2.status, "found");
      if (f1.status === "found" && f2.status === "found") {
        assert.equal(f1.job.job_id, j1.job_id);
        assert.equal(f2.job.job_id, j2.job_id);
      }
    });
  });

  await p3("P3-135", "Lab/Synthesis/Final Delivery shared store must not identity-collide", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_job_135", original_question: "135" });
      const ctid = "ctask_shared_caller_135";
      const poju = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: ctid,
        generation_type: "call_a_hypothesis",
        job_input: seg2Input(sid, "135"),
      });
      const syn = await createXhighJob({
        phase: "synthesis",
        session_id: sid,
        locale: "en",
        client_task_id: ctid,
        job_input: {
          kind: "synthesis",
          multi_dimension_reckoning: [],
          desired_outcome: "x",
          original_question: "135",
          question_category: "unknown",
          covered_agenda: [],
          structured_inventory: "",
        },
      });
      const fd = await createXhighJob({
        phase: "final_delivery",
        session_id: sid,
        locale: "en",
        client_task_id: ctid,
        job_input: {
          kind: "final_delivery",
          session_id: sid,
          locale: "en",
          agent_v2: {} as any,
          breakthrough_core: null,
          covered_agenda: [],
          base_analysis: {},
          delivery_mode: "full",
        },
      });
      assert.notEqual(poju.job_id, syn.job_id);
      assert.notEqual(poju.job_id, fd.job_id);
      assert.notEqual(syn.job_id, fd.job_id);
    });
  });

  summarize();
}

main().catch((err) => {
  console.error(err);
  summarize();
  process.exit(1);
});
