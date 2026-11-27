/**
 * Unit D — DI2 Continue / Recovery → Batch2/3.
 *
 *   pnpm exec tsx scripts/test-di2-batch2-continue-integration.ts
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";

import type { ProfileStructured } from "../lib/calculations/build-profile-structured";
import { birthInputHash } from "../lib/poju/decision-authority/server/profile-authority";
import type {
  FreezeRecord,
  ProfileRecord,
} from "../lib/poju/decision-authority/types";
import {
  FREEZE_RECORD_SCHEMA_VERSION,
  PROFILE_CALC_SCHEMA_VERSION,
  PROFILE_RECORD_SCHEMA_VERSION,
} from "../lib/poju/decision-authority/types";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import {
  startDi2Batch2Production,
} from "../lib/poju/decision-intake/decision-report-batch2-start";
import {
  __di2Batch2ContinueSideEffectCountsForTests,
  __resetDi2Batch2ContinueSideEffectCountsForTests,
  __setDi2Batch2ContinueLeaseProbeForTests,
  continueDi2Batch2Production,
  validateDi2Batch2ContinueIdentity,
} from "../lib/poju/decision-intake/decision-report-batch2-continue";
import {
  di2Batch2GenerationId,
  evaluateExistingDi2Batch2Binding,
} from "../lib/poju/decision-intake/decision-report-batch2-identity";
import {
  newReportLockOwner,
  readReportSessionLock,
  releaseOwnedReportLock,
  takeOverReportLock,
  tryCreateReportLock,
  type ReportLockOwner,
} from "../lib/poju/decision-intake/decision-report-lock";
import {
  DI2_REPORT_SCHEMA_VERSION,
  PERSONAL_ANALYSIS_SCHEMA_VERSION,
  di2ReportJobId,
  type DecisionReportJobInput,
} from "../lib/poju/decision-intake/decision-report-types";
import { supersedeFinalDeliveryJobForRegenerate } from "../lib/poju/final-delivery-execution-authority";
import {
  authorizeFdExecutionFence,
  bumpFdExecutionFence,
  createXhighJob,
  getXhighJob,
} from "../lib/poju/xhigh-job-store";
import {
  loadJobRawBlobs,
  resetBatch2JobStoreForTests,
  updateJobStatus,
} from "../lib/llm/pro/delivery/decision-report-v2/batch2/job-store";
import {
  setReportBatch2EventSenderForTests,
} from "../lib/llm/pro/delivery/decision-report-v2/batch2/dispatch";
import { REPORT_BATCH2_EVENTS } from "../lib/llm/pro/delivery/decision-report-v2/batch2/events";
import {
  readGeneration,
  resetBatch3KeysForTests,
  transitionGenerationStatus,
} from "../lib/llm/pro/delivery/decision-report-v2/batch3";
import type { BirthInfo } from "../lib/profile/types";

let passed = 0;
let failed = 0;

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

const NOW = "2026-11-26T21:00:00.000Z";
const GOLDEN_BIRTH: BirthInfo = {
  year: 2000,
  month: 8,
  day: 16,
  hour: 4,
  minute: 30,
  hour_period: "yin",
  gender: "F",
  timezone: "Asia/Shanghai",
};

let seq = 0;
function uniq(p: string): string {
  seq += 1;
  return `${p}_${Date.now()}_${seq}_${Math.random().toString(36).slice(2, 7)}`;
}

type SentEvent = { name: string; data: Record<string, unknown> };
let sentEvents: SentEvent[] = [];

function installEventSender() {
  sentEvents = [];
  setReportBatch2EventSenderForTests({
    async send(events) {
      for (const e of events) sentEvents.push({ name: e.name, data: e.data });
      return { ok: true };
    },
  });
}

function structured(): ProfileStructured {
  return {
    day_master: "甲木",
    pattern: "正官格",
    yong_shen: "水",
    xi_shen: ["水"],
    ji_shen: ["金"],
    strength: "balanced",
    four_pillars: { year: "甲子", month: "丙寅", day: "戊午", hour: "癸亥" },
    da_yun: [],
    data_availability: {
      pillars_detail: false,
      da_yun: false,
      bazi_enrichment: false,
    },
  };
}

function draftDc(): DecisionContext {
  return {
    dc_version: "v1",
    status: "final",
    schema_version: 1,
    context_id: "ctx_1",
    version: 3,
    content_hash: "ctx_hash_abc",
    definition: {
      decision_question: "是否接受新工作",
      decision_target: "job_choice",
      concrete_event: null,
      stakes: null,
      desired_outcome: null,
      goal_priorities: [],
      unacceptable_outcomes: [],
    },
    dirs: [],
    reality_facts: [],
    constraints: [],
    conflicts: [],
    hypotheses: [],
  } as DecisionContext;
}

function freezeRec(session_id: string, freeze_id: string, dc: DecisionContext): FreezeRecord {
  return {
    schema_version: FREEZE_RECORD_SCHEMA_VERSION,
    session_id,
    freeze_id,
    context_id: dc.context_id,
    context_version: dc.version,
    context_hash: dc.content_hash,
    frozen_at: NOW,
    frozen_dc: dc,
    blueprint_hash: null,
    blueprint: null,
    source_commit_version: 1,
    source_entry_hash: "entry_1",
    freeze_commit_version: 2,
    profile_hash: "prof_hash_1",
    receipt: {
      schema_version: FREEZE_RECORD_SCHEMA_VERSION,
      receipt_id: "frcpt_1",
      freeze_id,
      session_id,
      context_id: dc.context_id,
      context_version: dc.version,
      context_hash: dc.content_hash,
      blueprint_hash: null,
      frozen_at: NOW,
      ledger_commit_version: 2,
      signature: "sig",
      key_id: "k1",
    },
  };
}

function profileRec(session_id: string, freeze_id: string): ProfileRecord {
  return {
    schema_version: PROFILE_RECORD_SCHEMA_VERSION,
    session_id,
    freeze_id,
    profile_id: "prof_1",
    profile_hash: "prof_hash_1",
    calculation_schema_version: PROFILE_CALC_SCHEMA_VERSION,
    calculation_timestamp: NOW,
    chart_structure: structured(),
    ziwei_closed_set: null,
    source: {
      kind: "server_recompute_from_birth",
      birth_input_hash: birthInputHash(GOLDEN_BIRTH),
      bazi_engine: "shunshi-bazi-core",
      ziwei_engine: "iztro",
      used_true_solar_time: true,
      ziwei_status: "not_available",
    },
    registered_at: NOW,
    receipt: {
      schema_version: PROFILE_RECORD_SCHEMA_VERSION,
      receipt_id: "prcpt_1",
      freeze_id,
      session_id,
      profile_id: "prof_1",
      profile_hash: "prof_hash_1",
      calculation_schema_version: PROFILE_CALC_SCHEMA_VERSION,
      calculation_timestamp: NOW,
      signature: "sig",
      key_id: "k1",
    },
  };
}

async function createDi2Job(): Promise<{
  job_id: string;
  session_id: string;
  freeze: FreezeRecord;
  profile: ProfileRecord;
  report_job_id: string;
  generation: number;
}> {
  const session_id = uniq("sess");
  const freeze_id = uniq("frz");
  const dc = draftDc();
  const freeze = freezeRec(session_id, freeze_id, dc);
  const profile = profileRec(session_id, freeze_id);
  const fence = await bumpFdExecutionFence(session_id);
  const report_job_id = di2ReportJobId({
    session_id,
    freeze_id,
    profile_hash: profile.profile_hash,
    execution_generation: fence.generation,
  });
  const job_input: DecisionReportJobInput = {
    kind: "decision_intake_report",
    session_id,
    locale: "zh",
    freeze_id,
    context_id: dc.context_id,
    context_version: dc.version,
    context_hash: dc.content_hash,
    report_schema_version: DI2_REPORT_SCHEMA_VERSION,
    analysis_schema_version: PERSONAL_ANALYSIS_SCHEMA_VERSION,
    profile_id: profile.profile_id,
    profile_hash: profile.profile_hash,
    freeze_receipt_id: freeze.receipt.receipt_id,
    frozen_at: freeze.frozen_at,
    profile_receipt_id: profile.receipt.receipt_id,
    profile_calculation_schema_version: PROFILE_CALC_SCHEMA_VERSION,
    analysis_key: "ak_1",
    report_job_id,
    page07_applies: false,
    page07_topic: null,
    regenerate: false,
  };
  const job = await createXhighJob({
    phase: "decision_report",
    session_id,
    locale: "zh",
    job_input,
    execution_generation: fence.generation,
  });
  await authorizeFdExecutionFence(session_id, fence.generation, job.job_id);
  return {
    job_id: job.job_id,
    session_id,
    freeze,
    profile,
    report_job_id,
    generation: fence.generation,
  };
}

async function acquireStartLock(
  session_id: string,
  job_id: string | null,
): Promise<ReportLockOwner> {
  const owner = newReportLockOwner(session_id);
  const lock = await tryCreateReportLock(owner, "start", job_id);
  assert.ok(lock);
  return owner;
}

async function startThen(ctx: {
  job_id: string;
  session_id: string;
  freeze: FreezeRecord;
  profile: ProfileRecord;
}) {
  const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
  try {
    const res = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile: ctx.profile,
      lock_owner: owner,
    });
    assert.equal(res.ok, true);
    return res;
  } finally {
    await releaseOwnedReportLock(owner).catch(() => undefined);
  }
}

async function continueWithLock(ctx: {
  job_id: string;
  session_id: string;
}) {
  const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
  try {
    return await continueDi2Batch2Production({
      job_id: ctx.job_id,
      lock_owner: owner,
    });
  } finally {
    await releaseOwnedReportLock(owner).catch(() => undefined);
  }
}

async function main() {
  console.log("Unit D — DI2 Continue / Recovery → Batch2/3");
  installEventSender();
  __resetDi2Batch2ContinueSideEffectCountsForTests();
  __setDi2Batch2ContinueLeaseProbeForTests(null);
  await resetBatch3KeysForTests();
  await resetBatch2JobStoreForTests();

  await check("binding + active gen + job → recover same ids, no ORCHESTRATE", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const orchBefore = sentEvents.filter((e) => e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE).length;
    assert.equal(orchBefore, 1);

    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, true);
    if (!cont.ok) return;
    assert.equal(cont.binding.report_id, ctx.report_job_id);
    assert.equal(cont.binding.generation_id, di2Batch2GenerationId(ctx.report_job_id));
    assert.equal(cont.binding.generation_id, started.binding.generation_id);
    assert.equal(cont.recover_sent, true);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.recover_send, 1);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.orchestrate_send, 0);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.allocate_generation, 0);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.ensure_binding, 0);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.create_job, 0);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.old_runner_dispatch, 0);
    const orchAfter = sentEvents.filter((e) => e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE).length;
    assert.equal(orchAfter, 1);
    assert.ok(sentEvents.some((e) => e.name === REPORT_BATCH2_EVENTS.RECOVER));
  });

  await check("partial pages / incomplete job → RECOVER only, same Generation", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const gid = started.binding.generation_id;
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, true);
    if (!cont.ok) return;
    assert.equal(cont.binding.generation_id, gid);
    const blob = await loadJobRawBlobs(ctx.report_job_id, gid);
    assert.equal(blob.ok && blob.value?.meta.generation_id, gid);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.create_job, 0);
  });

  await check("Generation completed → ready_for_delivery, no RECOVER / page gen", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    const toFinalizing = await transitionGenerationStatus({
      report_id: b.report_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      to: "finalizing",
    });
    assert.equal(toFinalizing.ok, true);
    const toCompleted = await transitionGenerationStatus({
      report_id: b.report_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      to: "completed",
    });
    assert.equal(toCompleted.ok, true);
    sentEvents = [];
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, true);
    if (!cont.ok) return;
    assert.equal(cont.outcome, "ready_for_delivery");
    assert.equal(cont.recover_sent, false);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.recover_send, 0);
    assert.equal(sentEvents.length, 0);
  });

  await check("binding missing → fail closed, no allocate / old runner", async () => {
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    const eval0 = evaluateExistingDi2Batch2Binding(job!);
    assert.equal(eval0.ok, false);
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, false);
    if (!cont.ok) assert.equal(cont.code, "binding_missing");
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.ensure_binding, 0);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.allocate_generation, 0);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.old_runner_dispatch, 0);
  });

  await check("execution_generation mismatch → fail closed", async () => {
    const ctx = await createDi2Job();
    await startThen(ctx);
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job?.batch2_identity_binding);
    const binding = {
      ...job!.batch2_identity_binding!,
      di2_execution_generation: job!.execution_generation! + 99,
    };
    const id = validateDi2Batch2ContinueIdentity({ job: job!, binding });
    assert.equal(id.ok, false);
    if (!id.ok) assert.equal(id.code, "identity_mismatch");
  });

  await check("Generation missing → no create replacement", async () => {
    const ctx = await createDi2Job();
    await startThen(ctx);
    await resetBatch3KeysForTests();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, false);
    if (!cont.ok) assert.equal(cont.code, "generation_missing");
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.allocate_generation, 0);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.create_job, 0);
  });

  await check("Generation superseded → refuse, no page recover", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    await transitionGenerationStatus({
      report_id: b.report_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      to: "superseded",
    });
    sentEvents = [];
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, false);
    if (!cont.ok) assert.equal(cont.code, "generation_stale");
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.recover_send, 0);
    assert.equal(sentEvents.length, 0);
  });

  await check("Batch2 Job missing → fail closed, no rebuild", async () => {
    const ctx = await createDi2Job();
    await startThen(ctx);
    await resetBatch2JobStoreForTests();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, false);
    if (!cont.ok) assert.equal(cont.code, "batch2_job_missing");
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.create_job, 0);
  });

  await check("Batch2 Job failed → unrecoverable", async () => {
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    await updateJobStatus(
      started.binding.report_id,
      started.binding.generation_id,
      "failed",
    );
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, false);
    if (!cont.ok) assert.equal(cont.code, "batch2_job_unrecoverable");
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.recover_send, 0);
  });

  await check("repeat Continue → idempotent RECOVER, same Generation", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const a = await continueWithLock(ctx);
    const b = await continueWithLock(ctx);
    assert.equal(a.ok && b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.equal(a.binding.generation_id, b.binding.generation_id);
    assert.equal(
      sentEvents.filter((e) => e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE).length,
      1,
    );
  });

  await check("two Continues compete → lock mutual exclusion", async () => {
    const ctx = await createDi2Job();
    await startThen(ctx);
    const ownerA = await acquireStartLock(ctx.session_id, ctx.job_id);
    const ownerB = newReportLockOwner(ctx.session_id);
    const cur = await readReportSessionLock(ctx.session_id);
    assert.equal(cur.kind, "owned");
    if (cur.kind !== "owned") return;
    // While A holds start lock (not idle), B cannot take over with fresh raw after A refresh...
    // Concurrent: B tries takeOver with same raw A holds — one wins.
    const [contA, stolen] = await Promise.all([
      continueDi2Batch2Production({ job_id: ctx.job_id, lock_owner: ownerA }),
      takeOverReportLock(cur.raw, ownerB, "start", ctx.job_id),
    ]);
    const aOk = contA.ok;
    const bTook = stolen != null;
    // If B stole mid-flight, A must Fail Closed; if A kept lock, B failed takeOver.
    if (bTook) {
      assert.equal(aOk, false);
      if (!contA.ok) assert.equal(contA.code, "session_lock_lost");
      await releaseOwnedReportLock(ownerB).catch(() => undefined);
    } else {
      assert.equal(aOk, true);
    }
    await releaseOwnedReportLock(ownerA).catch(() => undefined);
  });

  await check("lease lost before RECOVER → no recover send", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    await startThen(ctx);
    const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
    __setDi2Batch2ContinueLeaseProbeForTests(async ({ phase }) => {
      if (phase !== "before_recover") return;
      const cur = await readReportSessionLock(ctx.session_id);
      if (cur.kind !== "owned") return;
      const thief = newReportLockOwner(ctx.session_id);
      await takeOverReportLock(cur.raw, thief, "start", null);
    });
    try {
      const cont = await continueDi2Batch2Production({
        job_id: ctx.job_id,
        lock_owner: owner,
      });
      assert.equal(cont.ok, false);
      if (!cont.ok) assert.equal(cont.code, "session_lock_lost");
      assert.equal(__di2Batch2ContinueSideEffectCountsForTests.recover_send, 0);
    } finally {
      __setDi2Batch2ContinueLeaseProbeForTests(null);
      await releaseOwnedReportLock(owner).catch(() => undefined);
    }
  });

  await check("revoked DI2 job → Continue refuse", async () => {
    const ctx = await createDi2Job();
    await startThen(ctx);
    await supersedeFinalDeliveryJobForRegenerate(ctx.job_id);
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, false);
    if (!cont.ok) assert.equal(cont.code, "job_revoked");
  });

  await check("completed Generation path does not trigger page generate side effects", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: started.binding.report_id,
          generation_id: started.binding.generation_id,
          generation_epoch: started.binding.batch3_generation_epoch,
          to: "finalizing",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: started.binding.report_id,
          generation_id: started.binding.generation_id,
          generation_epoch: started.binding.batch3_generation_epoch,
          to: "completed",
        })
      ).ok,
      true,
    );
    const gen = await readGeneration(
      started.binding.report_id,
      started.binding.generation_id,
    );
    assert.equal(gen.ok && gen.value?.status, "completed");
    sentEvents = [];
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, true);
    if (!cont.ok) return;
    assert.equal(cont.outcome, "ready_for_delivery");
    assert.ok(!sentEvents.some((e) => e.name.includes("generate")));
    assert.ok(!sentEvents.some((e) => e.name.includes("repair")));
    assert.ok(!sentEvents.some((e) => e.name === REPORT_BATCH2_EVENTS.RECOVER));
  });

  __setDi2Batch2ContinueLeaseProbeForTests(null);
  await resetBatch3KeysForTests();
  await resetBatch2JobStoreForTests();
  setReportBatch2EventSenderForTests(null);

  console.log(`\nDone: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
