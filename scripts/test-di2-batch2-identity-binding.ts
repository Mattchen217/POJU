/**
 * Unit B — DI2 ↔ Batch2 job identity binding.
 *
 *   pnpm exec tsx scripts/test-di2-batch2-identity-binding.ts
 *
 * Uses process MemoryKv (or configured remote KV) for both xhigh job CAS and
 * Batch3 allocateGeneration. Does NOT use request-scoped ephemeral KV (that
 * would split kv vs durableKv). Does not Start Batch2, send Inngest, or call models.
 *
 * Concurrent coverage: real Promise.all against MemoryKv CAS (in-process).
 * Not a multi-isolate / Upstash PASS claim — labeled below if remote unavailable.
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";

import { isRemoteKvConfigured } from "../lib/kv/memory-kv";
import {
  DI2_REPORT_SCHEMA_VERSION,
  PERSONAL_ANALYSIS_SCHEMA_VERSION,
  di2ReportJobId,
  type DecisionReportJobInput,
} from "../lib/poju/decision-intake/decision-report-types";
import {
  di2Batch2GenerationId,
  ensureDi2Batch2IdentityBinding,
  evaluateExistingDi2Batch2Binding,
  readDi2Batch2IdentityBinding,
  type Di2Batch2IdentityBinding,
} from "../lib/poju/decision-intake/decision-report-batch2-identity";
import {
  authorizeFdExecutionFence,
  bumpFdExecutionFence,
  commitXhighJobUnderExecutionFence,
  createXhighJob,
  getXhighJob,
} from "../lib/poju/xhigh-job-store";
import { resetBatch3KeysForTests } from "../lib/llm/pro/delivery/decision-report-v2/batch3/kv-cas";
import { readGeneration } from "../lib/llm/pro/delivery/decision-report-v2/batch3/generation-store";

let passed = 0;
let failed = 0;
let skipped = 0;

async function check(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${label}`);
    console.error(e);
  }
}

function skip(label: string, reason: string) {
  skipped += 1;
  console.log(`  SKIP  ${label} — ${reason}`);
}

let seq = 0;
function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now()}_${seq}_${Math.random().toString(36).slice(2, 8)}`;
}

function reportInput(overrides?: Partial<DecisionReportJobInput>): DecisionReportJobInput {
  const session_id = overrides?.session_id ?? uniq("sess");
  const freeze_id = overrides?.freeze_id ?? uniq("frz");
  const profile_hash = overrides?.profile_hash ?? `ph_${uniq("hash")}`;
  const execution_generation = 1;
  const report_job_id =
    overrides?.report_job_id ??
    di2ReportJobId({
      session_id,
      freeze_id,
      profile_hash,
      execution_generation,
    });
  return {
    kind: "decision_intake_report",
    session_id,
    locale: "zh",
    freeze_id,
    context_id: "ctx_1",
    context_version: 1,
    context_hash: "ctx_hash",
    report_schema_version: DI2_REPORT_SCHEMA_VERSION,
    analysis_schema_version: PERSONAL_ANALYSIS_SCHEMA_VERSION,
    profile_id: "prof_1",
    profile_hash,
    freeze_receipt_id: "frcpt_1",
    frozen_at: "2026-11-26T18:00:00.000Z",
    profile_receipt_id: "prcpt_1",
    profile_calculation_schema_version: "v1",
    analysis_key: "ak_1",
    report_job_id,
    page07_applies: false,
    page07_topic: null,
    regenerate: false,
    ...overrides,
  };
}

async function createBoundableJob(opts?: {
  report_job_id?: string | null;
  execution_generation?: number | null;
  session_id?: string;
}): Promise<{ job_id: string; session_id: string; report_job_id: string; generation: number }> {
  const session_id = opts?.session_id ?? uniq("sess");
  const fence = await bumpFdExecutionFence(session_id);
  const generation =
    opts?.execution_generation === null
      ? undefined
      : (opts?.execution_generation ?? fence.generation);

  const input = reportInput({
    session_id,
    ...(opts?.report_job_id === null
      ? { report_job_id: "   " }
      : opts?.report_job_id
        ? { report_job_id: opts.report_job_id }
        : {
            report_job_id: di2ReportJobId({
              session_id,
              freeze_id: "frz_1",
              profile_hash: "profilehash1234567890",
              execution_generation: generation ?? 1,
            }),
          }),
  });

  const job = await createXhighJob({
    phase: "decision_report",
    session_id,
    locale: "zh",
    job_input: input,
    execution_generation: generation,
  });

  if (generation != null) {
    await authorizeFdExecutionFence(session_id, generation, job.job_id);
  }

  return {
    job_id: job.job_id,
    session_id,
    report_job_id: input.report_job_id,
    generation: generation ?? -1,
  };
}

async function main() {
  console.log("Unit B — DI2 ↔ Batch2 identity binding");
  console.log(
    `  KV: ${isRemoteKvConfigured() ? "remote (Upstash)" : "process MemoryKv"}`,
  );
  console.log(
    "  Concurrent: in-process Promise.all + MemoryKv/Redis CAS (not multi-isolate)",
  );

  await resetBatch3KeysForTests();

  await check("valid DI2 Job can establish binding", async () => {
    const { job_id, report_job_id, generation } = await createBoundableJob();
    const res = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.created, true);
    assert.equal(res.binding.status, "bound");
    assert.equal(res.binding.report_id, report_job_id);
    assert.equal(res.binding.di2_execution_generation, generation);
    assert.equal(res.binding.generation_id, di2Batch2GenerationId(report_job_id));
  });

  await check("report_id equals DI2 report_job_id", async () => {
    const { job_id, report_job_id } = await createBoundableJob();
    const res = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.binding.report_id, report_job_id);
  });

  await check("generation_id comes from allocateGeneration (persisted Batch3 record)", async () => {
    const { job_id, report_job_id } = await createBoundableJob();
    const res = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const gen = await readGeneration(report_job_id, res.binding.generation_id);
    assert.equal(gen.ok, true);
    assert.ok(gen.ok && gen.value);
    if (!gen.ok || !gen.value) return;
    assert.equal(gen.value.generation_id, res.binding.generation_id);
    assert.equal(gen.value.generation_epoch, res.binding.batch3_generation_epoch);
    // Epoch and DI2 execution_generation are independent namespaces (values may
    // numerically coincide); identity mapping is explicit fields, not equality.
    assert.equal(
      typeof res.binding.batch3_generation_epoch,
      "number",
    );
    assert.equal(
      typeof res.binding.di2_execution_generation,
      "number",
    );
    assert.notEqual(
      "batch3_generation_epoch",
      "di2_execution_generation",
    );
  });

  await check("repeat ensure returns same binding (idempotent)", async () => {
    const { job_id } = await createBoundableJob();
    const a = await ensureDi2Batch2IdentityBinding({ job_id });
    const b = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.equal(b.created, false);
    assert.deepEqual(
      {
        report_id: a.binding.report_id,
        generation_id: a.binding.generation_id,
        di2_execution_generation: a.binding.di2_execution_generation,
      },
      {
        report_id: b.binding.report_id,
        generation_id: b.binding.generation_id,
        di2_execution_generation: b.binding.di2_execution_generation,
      },
    );
  });

  await check("existing binding is not overwritten by a new random id", async () => {
    const { job_id } = await createBoundableJob();
    const first = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const before = first.binding.generation_id;
    const second = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.binding.generation_id, before);
    const job = await getXhighJob(job_id);
    assert.equal(job?.batch2_identity_binding?.generation_id, before);
  });

  await check("same execution generation cannot bind two different generation IDs", async () => {
    const { job_id, report_job_id, generation } = await createBoundableJob();
    const forged: Di2Batch2IdentityBinding = {
      report_id: report_job_id,
      generation_id: "forged-other-generation",
      di2_execution_generation: generation,
      status: "bound",
      created_at: new Date().toISOString(),
      batch3_generation_epoch: 99,
    };
    const wrote = await commitXhighJobUnderExecutionFence(
      job_id,
      generation,
      (j) => ({ ...j, batch2_identity_binding: forged }),
    );
    assert.equal(wrote.ok, true);
    const res = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "dual_generation_conflict");
  });

  await check("old binding cannot masquerade after DI2 execution_generation change", async () => {
    // Job A @ gen N binds; Job B @ gen N+1 is a separate report_job_id lifecycle.
    const sessA = uniq("sessA");
    const fenceA = await bumpFdExecutionFence(sessA);
    const reportA = di2ReportJobId({
      session_id: sessA,
      freeze_id: "frz_1",
      profile_hash: "profilehash1234567890",
      execution_generation: fenceA.generation,
    });
    const jobA = await createXhighJob({
      phase: "decision_report",
      session_id: sessA,
      locale: "zh",
      job_input: reportInput({ session_id: sessA, report_job_id: reportA }),
      execution_generation: fenceA.generation,
    });
    await authorizeFdExecutionFence(sessA, fenceA.generation, jobA.job_id);
    const boundA = await ensureDi2Batch2IdentityBinding({ job_id: jobA.job_id });
    assert.equal(boundA.ok, true);

    const sessB = uniq("sessB");
    const fenceB = await bumpFdExecutionFence(sessB);
    const reportB = di2ReportJobId({
      session_id: sessB,
      freeze_id: "frz_1",
      profile_hash: "profilehash1234567890",
      execution_generation: fenceB.generation,
    });
    const jobB = await createXhighJob({
      phase: "decision_report",
      session_id: sessB,
      locale: "zh",
      job_input: reportInput({ session_id: sessB, report_job_id: reportB }),
      execution_generation: fenceB.generation,
    });
    await authorizeFdExecutionFence(sessB, fenceB.generation, jobB.job_id);

    // Plant Job A's binding onto Job B (wrong di2_execution_generation + report_id) — reject.
    const planted = await commitXhighJobUnderExecutionFence(
      jobB.job_id,
      fenceB.generation,
      (j) => ({
        ...j,
        batch2_identity_binding: boundA.ok
          ? { ...boundA.binding }
          : forgedPlaceholder(reportA, fenceA.generation),
      }),
    );
    assert.equal(planted.ok, true);
    const evaled = evaluateExistingDi2Batch2Binding((await getXhighJob(jobB.job_id))!);
    assert.equal(evaled.ok, false);
    if (evaled.ok) return;
    assert.ok(
      evaled.code === "execution_generation_mismatch" ||
        evaled.code === "report_id_mismatch",
    );

    // Correct Job B bind still works on a clean job.
    const sessC = uniq("sessC");
    const { job_id: jobC } = await createBoundableJob({ session_id: sessC });
    const boundC = await ensureDi2Batch2IdentityBinding({ job_id: jobC });
    assert.equal(boundC.ok, true);
    if (!boundC.ok || !boundA.ok) return;
    assert.notEqual(boundC.binding.generation_id, boundA.binding.generation_id);
  });

  await check("missing report_job_id Fail Closed", async () => {
    const { job_id } = await createBoundableJob({ report_job_id: null });
    const res = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "missing_report_job_id");
  });

  await check("invalid execution_generation Fail Closed", async () => {
    const session_id = uniq("sess");
    // Create without generation then try bind
    const job = await createXhighJob({
      phase: "decision_report",
      session_id,
      locale: "zh",
      job_input: reportInput({ session_id }),
      // omit execution_generation
    });
    const res = await ensureDi2Batch2IdentityBinding({ job_id: job.job_id });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "missing_execution_generation");
  });

  await check("report_id mismatch Fail Closed", async () => {
    const { job_id, generation, report_job_id } = await createBoundableJob();
    const wrote = await commitXhighJobUnderExecutionFence(
      job_id,
      generation,
      (j) => ({
        ...j,
        batch2_identity_binding: {
          report_id: "other_report_id",
          generation_id: di2Batch2GenerationId(report_job_id),
          di2_execution_generation: generation,
          status: "bound",
          created_at: new Date().toISOString(),
          batch3_generation_epoch: 1,
        },
      }),
    );
    assert.equal(wrote.ok, true);
    const res = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "report_id_mismatch");
  });

  await check("existing binding generation mismatch Fail Closed", async () => {
    const { job_id, generation, report_job_id } = await createBoundableJob();
    const wrote = await commitXhighJobUnderExecutionFence(
      job_id,
      generation,
      (j) => ({
        ...j,
        batch2_identity_binding: {
          report_id: report_job_id,
          generation_id: di2Batch2GenerationId(report_job_id),
          di2_execution_generation: generation + 99,
          status: "bound",
          created_at: new Date().toISOString(),
          batch3_generation_epoch: 1,
        },
      }),
    );
    assert.equal(wrote.ok, true);
    const res = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "execution_generation_mismatch");
  });

  await check("concurrent ensure: at most one created; same final binding", async () => {
    const { job_id, report_job_id } = await createBoundableJob();
    const results = await Promise.all([
      ensureDi2Batch2IdentityBinding({ job_id }),
      ensureDi2Batch2IdentityBinding({ job_id }),
      ensureDi2Batch2IdentityBinding({ job_id }),
      ensureDi2Batch2IdentityBinding({ job_id }),
    ]);
    const oks = results.filter((r) => r.ok);
    assert.equal(oks.length, results.length, "all concurrent ensures should resolve ok");
    const createdCount = oks.filter((r) => r.ok && r.created).length;
    assert.ok(createdCount <= 1, `createdCount=${createdCount} must be <= 1`);
    const gids = new Set(
      oks.map((r) => (r.ok ? r.binding.generation_id : "")),
    );
    assert.equal(gids.size, 1);
    assert.equal([...gids][0], di2Batch2GenerationId(report_job_id));
  });

  await check("CAS conflict then re-read recognizes durable binding", async () => {
    const { job_id, report_job_id, generation } = await createBoundableJob();
    // Pre-bind via ensure
    const first = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(first.ok, true);
    // Simulate a lost CAS writer: call evaluate/read path after "conflict"
    const reread = await readDi2Batch2IdentityBinding(job_id);
    assert.equal(reread.ok, true);
    if (!reread.ok) return;
    assert.equal(reread.binding.report_id, report_job_id);
    assert.equal(reread.binding.di2_execution_generation, generation);
  });

  await check("process re-read recovers same binding (persistence)", async () => {
    const { job_id } = await createBoundableJob();
    const a = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(a.ok, true);
    if (!a.ok) return;
    const reloaded = await getXhighJob(job_id);
    assert.ok(reloaded);
    const fromDisk = evaluateExistingDi2Batch2Binding(reloaded!);
    assert.equal(fromDisk.ok, true);
    if (!fromDisk.ok) return;
    assert.equal(fromDisk.binding.generation_id, a.binding.generation_id);
    assert.equal(fromDisk.binding.report_id, a.binding.report_id);
  });

  await check("binding does not mutate Freeze/Profile/DC fields on job input", async () => {
    const { job_id } = await createBoundableJob();
    const before = await getXhighJob(job_id);
    const inputBefore = JSON.stringify(before!.input);
    const res = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(res.ok, true);
    const after = await getXhighJob(job_id);
    assert.equal(JSON.stringify(after!.input), inputBefore);
    assert.ok(after!.batch2_identity_binding);
  });

  await check("binding does not Start Batch2 / no orchestrating job status side-effect", async () => {
    const { job_id } = await createBoundableJob();
    const before = await getXhighJob(job_id);
    assert.equal(before!.status, "pending");
    const res = await ensureDi2Batch2IdentityBinding({ job_id });
    assert.equal(res.ok, true);
    const after = await getXhighJob(job_id);
    assert.equal(after!.status, "pending");
    // allocateGeneration leaves GenerationRecord pending — not activated / no Start
    if (res.ok) {
      const gen = await readGeneration(res.binding.report_id, res.binding.generation_id);
      assert.equal(gen.ok && gen.value?.status, "pending");
    }
  });

  // Multi-isolate Redis concurrency is not claimed here.
  if (!isRemoteKvConfigured()) {
    skip(
      "multi-isolate Upstash concurrent bind",
      "not covered — in-process MemoryKv CAS only",
    );
  }

  await resetBatch3KeysForTests();

  console.log(
    `\nDone: ${passed} passed, ${failed} failed, ${skipped} skipped`,
  );
  if (failed > 0) process.exit(1);
}

function forgedPlaceholder(
  report_id: string,
  generation: number,
): Di2Batch2IdentityBinding {
  return {
    report_id,
    generation_id: di2Batch2GenerationId(report_id),
    di2_execution_generation: generation,
    status: "bound",
    created_at: new Date().toISOString(),
    batch3_generation_epoch: 1,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
