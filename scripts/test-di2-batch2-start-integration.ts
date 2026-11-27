/**
 * Unit C / R2+R3 — DI2 Start → Batch2 + Session Lock lease closure.
 *
 *   pnpm exec tsx scripts/test-di2-batch2-start-integration.ts
 *
 * Covers startDi2Batch2Production under DI2 Report Session Lock, ZFP trust,
 * fence revocation, concurrent Regenerate windows, and owner-checked lease
 * renewal across idle-timeout boundaries (controllable idle ms).
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
  __awaitUnderStartLeaseForTests,
  __di2Batch2StartSideEffectCountsForTests,
  __resetDi2Batch2StartSideEffectCountsForTests,
  __runWithActiveStartLeaseForTests,
  __setAwaitUnderLeasePreflightProbeForTests,
  __setDi2Batch2StartLockRaceProbeForTests,
  __setDi2Batch2StartPreIntentProbeForTests,
  __setDi2Batch2StartSideEffectProbeForTests,
  resolveTrustedZiweiFactPack,
  startDi2Batch2Production,
  type Di2Batch2StartSideEffectGate,
} from "../lib/poju/decision-intake/decision-report-batch2-start";
import {
  __setReportLockNowForTests,
  __setReportStartLockIdleMsForTests,
  __setReportStartLockRenewEveryMsForTests,
  isReportStartLockIdle,
  newReportLockOwner,
  readReportSessionLock,
  releaseOwnedReportLock,
  takeOverReportLock,
  tryCreateReportLock,
  updateOwnedReportLock,
  withOwnedReportLockLease,
  type ReportLockOwner,
} from "../lib/poju/decision-intake/decision-report-lock";
import {
  DI2_REPORT_SCHEMA_VERSION,
  PERSONAL_ANALYSIS_SCHEMA_VERSION,
  di2ReportJobId,
  type DecisionReportJobInput,
} from "../lib/poju/decision-intake/decision-report-types";
import { di2Batch2GenerationId } from "../lib/poju/decision-intake/decision-report-batch2-identity";
import { profileIndicatesComputedZiwei } from "../lib/poju/decision-intake/decision-report-batch2-adapter";
import { supersedeFinalDeliveryJobForRegenerate } from "../lib/poju/final-delivery-execution-authority";
import {
  __setCommitUnderFenceRaceProbeForTests,
  authorizeFdExecutionFence,
  bumpFdExecutionFence,
  createXhighJob,
  getXhighJob,
} from "../lib/poju/xhigh-job-store";
import {
  loadJobRawBlobs,
  resetBatch2JobStoreForTests,
} from "../lib/llm/pro/delivery/decision-report-v2/batch2/job-store";
import {
  setReportBatch2EventSenderForTests,
} from "../lib/llm/pro/delivery/decision-report-v2/batch2/dispatch";
import { REPORT_BATCH2_EVENTS } from "../lib/llm/pro/delivery/decision-report-v2/batch2/events";
import {
  readGeneration,
  resetBatch3KeysForTests,
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

const NOW = "2026-11-26T18:00:00.000Z";

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

function draftDc(session_id: string, freeze_id: string): DecisionContext {
  void freeze_id;
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

function profileRec(
  session_id: string,
  freeze_id: string,
  opts?: {
    ziwei_status?: "ok" | "failed" | "not_available";
    ziwei_closed_set?: string | null;
    birth_hash?: string;
  },
): ProfileRecord {
  const ziwei_status = opts?.ziwei_status ?? "not_available";
  return {
    schema_version: PROFILE_RECORD_SCHEMA_VERSION,
    session_id,
    freeze_id,
    profile_id: "prof_1",
    profile_hash: "prof_hash_1",
    calculation_schema_version: PROFILE_CALC_SCHEMA_VERSION,
    calculation_timestamp: NOW,
    chart_structure: structured(),
    ziwei_closed_set: opts?.ziwei_closed_set ?? null,
    source: {
      kind: "server_recompute_from_birth",
      birth_input_hash: opts?.birth_hash ?? birthInputHash(GOLDEN_BIRTH),
      bazi_engine: "shunshi-bazi-core",
      ziwei_engine: "iztro",
      used_true_solar_time: true,
      ziwei_status,
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

async function createDi2Job(opts?: {
  profile?: ProfileRecord;
}): Promise<{
  job_id: string;
  session_id: string;
  freeze: FreezeRecord;
  profile: ProfileRecord;
  report_job_id: string;
  generation: number;
}> {
  const session_id = uniq("sess");
  const freeze_id = uniq("frz");
  const dc = draftDc(session_id, freeze_id);
  const freeze = freezeRec(session_id, freeze_id, dc);
  const profile = opts?.profile ?? profileRec(session_id, freeze_id);
  profile.session_id = session_id;
  profile.freeze_id = freeze_id;
  profile.profile_hash = "prof_hash_1";

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
  job_id: string | null = null,
): Promise<ReportLockOwner> {
  const owner = newReportLockOwner(session_id);
  const lock = await tryCreateReportLock(owner, "start", job_id);
  assert.ok(lock, "expected to create start lock");
  return owner;
}

async function startWithLock(
  ctx: {
    job_id: string;
    session_id: string;
    freeze: FreezeRecord;
    profile: ProfileRecord;
  },
  extra?: { birth_info?: unknown; client_ziwei_fact_pack?: unknown },
) {
  const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
  try {
    return await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile: ctx.profile,
      lock_owner: owner,
      birth_info: extra?.birth_info,
      client_ziwei_fact_pack: extra?.client_ziwei_fact_pack,
    });
  } finally {
    await releaseOwnedReportLock(owner).catch(() => undefined);
  }
}

async function revokeAtGate(
  gate: Di2Batch2StartSideEffectGate,
  target: Di2Batch2StartSideEffectGate,
  job_id: string,
): Promise<void> {
  if (gate !== target) return;
  await supersedeFinalDeliveryJobForRegenerate(job_id);
}

async function main() {
  console.log("Unit C / R2+R3 — DI2 Start → Batch2 + Session Lock lease closure");
  installEventSender();
  __setDi2Batch2StartSideEffectProbeForTests(null);
  __setDi2Batch2StartLockRaceProbeForTests(null);
  __setCommitUnderFenceRaceProbeForTests(null);
  __setAwaitUnderLeasePreflightProbeForTests(null);
  __setDi2Batch2StartPreIntentProbeForTests(null);
  __setReportStartLockIdleMsForTests(null);
  __setReportStartLockRenewEveryMsForTests(null);
  __setReportLockNowForTests(null);
  __resetDi2Batch2StartSideEffectCountsForTests();
  await resetBatch3KeysForTests();
  await resetBatch2JobStoreForTests();

  await check("trusted ZFP: not computed → null OK", () => {
    const profile = profileRec("s", "f", { ziwei_status: "not_available" });
    assert.equal(profileIndicatesComputedZiwei(profile), false);
    const r = resolveTrustedZiweiFactPack({ profile });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.ziwei_fact_pack, null);
  });

  await check("trusted ZFP: computed without birth → Fail Closed", () => {
    const profile = profileRec("s", "f", {
      ziwei_status: "ok",
      ziwei_closed_set: "closed",
    });
    const r = resolveTrustedZiweiFactPack({ profile });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "ziwei_trusted_pack_required");
  });

  await check("trusted ZFP: birth hash mismatch → Fail Closed", () => {
    const profile = profileRec("s", "f", {
      ziwei_status: "ok",
      ziwei_closed_set: "closed",
      birth_hash: "not-the-golden-hash",
    });
    const r = resolveTrustedZiweiFactPack({
      profile,
      birth_info: GOLDEN_BIRTH,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "ziwei_birth_mismatch");
  });

  await check("trusted ZFP: matching birth rebuilds pack", () => {
    const profile = profileRec("s", "f", {
      ziwei_status: "ok",
      ziwei_closed_set: "closed",
      birth_hash: birthInputHash(GOLDEN_BIRTH),
    });
    const r = resolveTrustedZiweiFactPack({
      profile,
      birth_info: GOLDEN_BIRTH,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.ok(r.ziwei_fact_pack);
      assert.equal(r.ziwei_fact_pack!.otherChart, null);
      assert.equal(r.ziwei_fact_pack!.palaces.length, 12);
    }
  });

  await check("client-submitted ZFP rejected at Start", async () => {
    const ctx = await createDi2Job();
    const res = await startWithLock(ctx, {
      client_ziwei_fact_pack: { version: 1 },
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "ziwei_trusted_pack_required");
  });

  await check("missing lock_owner → session_lock_required", async () => {
    const ctx = await createDi2Job();
    const res = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile: ctx.profile,
      // @ts-expect-error intentional missing lock
      lock_owner: null,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "session_lock_required");
  });

  await check("valid Start enters Batch2 production (activate + orchestrate)", async () => {
    sentEvents = [];
    const ctx = await createDi2Job();
    const res = await startWithLock(ctx, { birth_info: GOLDEN_BIRTH });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.binding.report_id, ctx.report_job_id);
    assert.equal(res.binding.generation_id, di2Batch2GenerationId(ctx.report_job_id));
    assert.equal(res.production.generation_id, res.binding.generation_id);
    assert.equal(res.binding.di2_execution_generation, ctx.generation);
    assert.equal(typeof res.binding.batch3_generation_epoch, "number");

    const gen = await readGeneration(res.binding.report_id, res.binding.generation_id);
    assert.equal(gen.ok && gen.value?.status, "active");

    const jobBlob = await loadJobRawBlobs(
      res.binding.report_id,
      res.binding.generation_id,
    );
    assert.equal(jobBlob.ok && jobBlob.value?.meta.status, "orchestrating");
    assert.equal(jobBlob.ok && jobBlob.value?.meta.report_id, ctx.report_job_id);

    assert.ok(
      sentEvents.some((e) => e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE),
      "ORCHESTRATE must be sent",
    );
    const orch = sentEvents.find((e) => e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE);
    assert.equal(orch?.data.report_id, ctx.report_job_id);
    assert.equal(orch?.data.generation_id, res.binding.generation_id);

    const di2 = await getXhighJob(ctx.job_id);
    assert.ok(di2?.batch2_production_state);
    assert.equal(di2!.batch2_production_state!.generation_id, res.binding.generation_id);
  });

  await check("report_id equals DI2 report_job_id; generation matches Unit B binding", async () => {
    sentEvents = [];
    const ctx = await createDi2Job();
    const res = await startWithLock(ctx);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.binding.report_id, ctx.report_job_id);
    assert.equal(
      res.binding.generation_id,
      di2Batch2GenerationId(ctx.report_job_id),
    );
  });

  await check("ziwei computed without trusted birth → Start Fail Closed", async () => {
    const session_id = uniq("sess");
    const freeze_id = uniq("frz");
    const profile = profileRec(session_id, freeze_id, {
      ziwei_status: "ok",
      ziwei_closed_set: "closed-set",
    });
    const ctx = await createDi2Job({ profile });
    const res = await startWithLock({
      ...ctx,
      profile: {
        ...ctx.profile,
        ziwei_closed_set: "closed",
        source: {
          ...ctx.profile.source,
          ziwei_status: "ok",
        },
      },
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "ziwei_trusted_pack_required");
  });

  await check("Freeze identity mismatch → no Batch2 job", async () => {
    sentEvents = [];
    const ctx = await createDi2Job();
    const before = sentEvents.length;
    const res = await startWithLock({
      ...ctx,
      freeze: { ...ctx.freeze, freeze_id: "wrong_freeze" },
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "freeze_profile_mismatch");
    assert.equal(sentEvents.length, before);
  });

  await check("identical Start retry reuses same Batch2 Job/Generation (no second gen)", async () => {
    sentEvents = [];
    const ctx = await createDi2Job();
    const first = await startWithLock(ctx);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const orchCount1 = sentEvents.filter(
      (e) => e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE,
    ).length;
    assert.equal(orchCount1, 1);

    const second = await startWithLock(ctx);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.binding.generation_id, first.binding.generation_id);
    assert.equal(second.production.generation_epoch, first.production.generation_epoch);
    const recoverCount = sentEvents.filter(
      (e) => e.name === REPORT_BATCH2_EVENTS.RECOVER,
    ).length;
    assert.ok(recoverCount >= 1, "retry should trigger RECOVER");
    assert.equal(
      second.binding.generation_id,
      di2Batch2GenerationId(ctx.report_job_id),
    );
  });

  await check("ziwei ok + matching birth → Start with ziwei_available", async () => {
    sentEvents = [];
    const ctx = await createDi2Job({
      profile: profileRec("tmp", "tmp", {
        ziwei_status: "ok",
        ziwei_closed_set: "closed",
        birth_hash: birthInputHash(GOLDEN_BIRTH),
      }),
    });
    const profile = {
      ...ctx.profile,
      ziwei_closed_set: "closed",
      source: {
        ...ctx.profile.source,
        ziwei_status: "ok" as const,
        birth_input_hash: birthInputHash(GOLDEN_BIRTH),
      },
    };
    const res = await startWithLock(
      { ...ctx, profile },
      { birth_info: GOLDEN_BIRTH },
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const blob = await loadJobRawBlobs(
      res.binding.report_id,
      res.binding.generation_id,
    );
    assert.equal(blob.ok, true);
    if (!blob.ok || !blob.value) return;
    assert.equal(blob.value.meta.inputs.ziwei_available, true);
    assert.ok(blob.value.meta.inputs.ziwei_fact_pack);
  });

  await check("dispatch sender failure without recover success → uncertain (no second gen)", async () => {
    setReportBatch2EventSenderForTests({
      async send() {
        return { ok: false, code: "forced_fail", detail: "test" };
      },
    });
    const ctx = await createDi2Job();
    const res = await startWithLock(ctx);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "dispatch_uncertain");
    const job = await getXhighJob(ctx.job_id);
    if (job?.batch2_identity_binding) {
      assert.equal(
        job.batch2_identity_binding.generation_id,
        di2Batch2GenerationId(ctx.report_job_id),
      );
    }
    installEventSender();
  });

  // ─── Unit C R1: Execution Fence side-effect closure (still required) ─────

  await check("R1: valid Fence → Start completes activate+create+orchestrate", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    __setDi2Batch2StartSideEffectProbeForTests(null);
    const ctx = await createDi2Job();
    const res = await startWithLock(ctx);
    assert.equal(res.ok, true);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.activate, 1);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.create_job, 1);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 1);
  });

  await check("R1: Fence revoked before activate → no activate/create/dispatch", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    __setDi2Batch2StartSideEffectProbeForTests(async (gate) => {
      await revokeAtGate(gate, "before_activate", ctx.job_id);
    });
    const res = await startWithLock(ctx);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "job_revoked");
    assert.equal(__di2Batch2StartSideEffectCountsForTests.activate, 0);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.create_job, 0);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 0);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.recover_send, 0);
    assert.equal(sentEvents.length, 0);
    __setDi2Batch2StartSideEffectProbeForTests(null);
  });

  await check("R1: Fence revoked after activate before createJob → no create/dispatch", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    __setDi2Batch2StartSideEffectProbeForTests(async (gate) => {
      await revokeAtGate(gate, "before_create_job", ctx.job_id);
    });
    const res = await startWithLock(ctx);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "job_revoked");
    assert.equal(__di2Batch2StartSideEffectCountsForTests.activate, 1);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.create_job, 0);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 0);
    assert.equal(sentEvents.length, 0);
    const blob = await loadJobRawBlobs(
      ctx.report_job_id,
      di2Batch2GenerationId(ctx.report_job_id),
    );
    assert.equal(blob.ok && blob.value, null);
    __setDi2Batch2StartSideEffectProbeForTests(null);
  });

  await check("R1: Fence revoked after createJob before dispatch → no event send", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    __setDi2Batch2StartSideEffectProbeForTests(async (gate) => {
      await revokeAtGate(gate, "before_dispatch", ctx.job_id);
    });
    const res = await startWithLock(ctx);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "job_revoked");
    assert.equal(__di2Batch2StartSideEffectCountsForTests.activate, 1);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.create_job, 1);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 0);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.recover_send, 0);
    assert.equal(sentEvents.length, 0);
    __setDi2Batch2StartSideEffectProbeForTests(null);
  });

  await check("R1: regenerate mid-Start → old execution cannot dispatch", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    __setDi2Batch2StartSideEffectProbeForTests(async (gate) => {
      if (gate === "before_dispatch") {
        await supersedeFinalDeliveryJobForRegenerate(ctx.job_id);
      }
    });
    const old = await startWithLock(ctx);
    assert.equal(old.ok, false);
    if (!old.ok) assert.equal(old.code, "job_revoked");
    assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 0);
    assert.equal(sentEvents.length, 0);

    __setDi2Batch2StartSideEffectProbeForTests(null);
    const retryOld = await startWithLock(ctx);
    assert.equal(retryOld.ok, false);
    if (!retryOld.ok) assert.equal(retryOld.code, "job_revoked");
  });

  await check("R1: normal repeat Start still reuses Batch2 Job/Generation", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    __setDi2Batch2StartSideEffectProbeForTests(null);
    const ctx = await createDi2Job();
    const first = await startWithLock(ctx);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = await startWithLock(ctx);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.binding.generation_id, first.binding.generation_id);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.activate, 1);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.create_job, 1);
  });

  // ─── Unit C R2: Session Lock mutual exclusion + concurrent windows ──────

  await check("R2: Fence read → Job CAS window: regenerate → gate revoked", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    let probed = false;
    __setCommitUnderFenceRaceProbeForTests(async ({ job_id }) => {
      // Skip identity-binding commits; fire on first post-binding start_gate CAS.
      const job = await getXhighJob(job_id);
      if (!job?.batch2_identity_binding) return;
      if (probed) return;
      probed = true;
      await supersedeFinalDeliveryJobForRegenerate(job_id);
    });
    const res = await startWithLock(ctx);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "job_revoked");
    assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 0);
    assert.equal(sentEvents.length, 0);
    __setCommitUnderFenceRaceProbeForTests(null);
  });

  await check("R2: Start holds Session Lock → Regenerate takeOver with stale raw fails", async () => {
    const ctx = await createDi2Job();
    const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
    try {
      const before = await readReportSessionLock(ctx.session_id);
      assert.equal(before.kind, "owned");
      if (before.kind !== "owned") return;
      const staleRaw = before.raw;
      // Force a distinct touched_at so CAS expected JSON diverges (same-ms refresh is a no-op).
      await new Promise((r) => setTimeout(r, 5));
      const refreshed = await updateOwnedReportLock(owner);
      assert.ok(refreshed);
      const after = await readReportSessionLock(ctx.session_id);
      assert.equal(after.kind, "owned");
      if (after.kind !== "owned") return;
      assert.notEqual(
        JSON.stringify(staleRaw),
        JSON.stringify(after.lock),
        "refresh must change lock snapshot",
      );
      const thief = newReportLockOwner(ctx.session_id);
      const stolen = await takeOverReportLock(staleRaw, thief, "start", null);
      assert.equal(stolen, null, "stale takeOver must fail while Start holds lock");
      const still = await readReportSessionLock(ctx.session_id);
      assert.equal(still.kind, "owned");
      if (still.kind === "owned") {
        assert.equal(still.lock.lock_token, owner.lock_token);
        assert.equal(still.lock.holder, "start");
      }
    } finally {
      await releaseOwnedReportLock(owner).catch(() => undefined);
    }
  });

  await check("R2: lock stolen mid-Start → session_lock_lost, no dispatch", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
    __setDi2Batch2StartLockRaceProbeForTests(async ({ gate }) => {
      if (gate !== "before_activate") return;
      const cur = await readReportSessionLock(ctx.session_id);
      if (cur.kind !== "owned") return;
      const thief = newReportLockOwner(ctx.session_id);
      await takeOverReportLock(cur.raw, thief, "start", null);
      await supersedeFinalDeliveryJobForRegenerate(ctx.job_id);
    });
    try {
      const res = await startDi2Batch2Production({
        job_id: ctx.job_id,
        freeze: ctx.freeze,
        profile: ctx.profile,
        lock_owner: owner,
      });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.ok(
          res.code === "session_lock_lost" || res.code === "job_revoked",
          `expected lock_lost or revoked, got ${res.code}`,
        );
      }
      assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 0);
      assert.equal(sentEvents.length, 0);
    } finally {
      __setDi2Batch2StartLockRaceProbeForTests(null);
      await releaseOwnedReportLock(owner).catch(() => undefined);
    }
  });

  await check("R2: regenerate completed → old Start cannot continue", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    await supersedeFinalDeliveryJobForRegenerate(ctx.job_id);
    const res = await startWithLock(ctx);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "job_revoked");
    assert.equal(__di2Batch2StartSideEffectCountsForTests.activate, 0);
    assert.equal(sentEvents.length, 0);
  });

  await check("R2: revoke after activate before createJob → no Batch2 job", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    __setDi2Batch2StartLockRaceProbeForTests(async ({ gate }) => {
      if (gate !== "before_create_job") return;
      const cur = await readReportSessionLock(ctx.session_id);
      if (cur.kind === "owned") {
        const thief = newReportLockOwner(ctx.session_id);
        await takeOverReportLock(cur.raw, thief, "start", null);
      }
      await supersedeFinalDeliveryJobForRegenerate(ctx.job_id);
    });
    const res = await startWithLock(ctx);
    assert.equal(res.ok, false);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.create_job, 0);
    assert.equal(sentEvents.length, 0);
    const blob = await loadJobRawBlobs(
      ctx.report_job_id,
      di2Batch2GenerationId(ctx.report_job_id),
    );
    assert.equal(blob.ok && blob.value, null);
    __setDi2Batch2StartLockRaceProbeForTests(null);
  });

  await check("R2: revoke after createJob before dispatch → no event send", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    __setDi2Batch2StartLockRaceProbeForTests(async ({ gate }) => {
      if (gate !== "before_dispatch") return;
      const cur = await readReportSessionLock(ctx.session_id);
      if (cur.kind === "owned") {
        const thief = newReportLockOwner(ctx.session_id);
        await takeOverReportLock(cur.raw, thief, "start", null);
      }
      await supersedeFinalDeliveryJobForRegenerate(ctx.job_id);
    });
    const res = await startWithLock(ctx);
    assert.equal(res.ok, false);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.create_job, 1);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 0);
    assert.equal(sentEvents.length, 0);
    __setDi2Batch2StartLockRaceProbeForTests(null);
  });

  await check("R2: ORCHESTRATE fail then revoke before RECOVER → no recover send", async () => {
    let sends = 0;
    setReportBatch2EventSenderForTests({
      async send(events) {
        sends += 1;
        if (sends === 1) {
          return { ok: false, code: "forced_fail", detail: "orch" };
        }
        for (const e of events) sentEvents.push({ name: e.name, data: e.data });
        return { ok: true };
      },
    });
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    let revokeArmed = false;
    __setDi2Batch2StartLockRaceProbeForTests(async ({ gate }) => {
      if (gate !== "before_dispatch") return;
      if (!revokeArmed) {
        revokeArmed = true;
        return;
      }
      // Second authority check (RECOVER path): steal + supersede
      const cur = await readReportSessionLock(ctx.session_id);
      if (cur.kind === "owned") {
        const thief = newReportLockOwner(ctx.session_id);
        await takeOverReportLock(cur.raw, thief, "start", null);
      }
      await supersedeFinalDeliveryJobForRegenerate(ctx.job_id);
    });
    const res = await startWithLock(ctx);
    assert.equal(res.ok, false);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.recover_send, 0);
    assert.ok(
      !sentEvents.some((e) => e.name === REPORT_BATCH2_EVENTS.RECOVER),
    );
    __setDi2Batch2StartLockRaceProbeForTests(null);
    installEventSender();
  });

  await check("R2: releaseOwnedReportLock does not release another owner's lock", async () => {
    const session_id = uniq("sess");
    const ownerA = newReportLockOwner(session_id);
    const lockA = await tryCreateReportLock(ownerA, "start", null);
    assert.ok(lockA);
    const ownerB = newReportLockOwner(session_id);
    const cur = await readReportSessionLock(session_id);
    assert.equal(cur.kind, "owned");
    if (cur.kind !== "owned") return;
    const lockB = await takeOverReportLock(cur.raw, ownerB, "start", "job_b");
    assert.ok(lockB);
    const releaseA = await releaseOwnedReportLock(ownerA);
    assert.equal(releaseA, "not_owner");
    const still = await readReportSessionLock(session_id);
    assert.equal(still.kind, "owned");
    if (still.kind === "owned") {
      assert.equal(still.lock.lock_token, ownerB.lock_token);
    }
    const releaseB = await releaseOwnedReportLock(ownerB);
    assert.equal(releaseB, "released");
  });

  await check("R2: timeout-style recover path still idempotent under lock", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const first = await startWithLock(ctx);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = await startWithLock(ctx);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.binding.generation_id, first.binding.generation_id);
    assert.ok(
      sentEvents.some((e) => e.name === REPORT_BATCH2_EVENTS.RECOVER),
    );
  });

  // ─── Unit C R3: Session Lock lease renewal across idle window ────────────

  async function withShortIdle<T>(fn: () => Promise<T>): Promise<T> {
    __setReportStartLockIdleMsForTests(80);
    __setReportStartLockRenewEveryMsForTests(20);
    try {
      return await fn();
    } finally {
      __setReportStartLockIdleMsForTests(null);
      __setReportStartLockRenewEveryMsForTests(null);
      __setReportLockNowForTests(null);
    }
  }

  await check("R3: renew across > idle → other Start cannot take over", async () => {
    await withShortIdle(async () => {
      const session_id = uniq("sess");
      const owner = newReportLockOwner(session_id);
      assert.ok(await tryCreateReportLock(owner, "start", "job_live"));
      const before = await readReportSessionLock(session_id);
      assert.equal(before.kind, "owned");
      if (before.kind !== "owned") return;
      const staleRaw = before.raw;
      let idleAfterLease = true;
      let staleTakeover = null as Awaited<ReturnType<typeof takeOverReportLock>>;
      await withOwnedReportLockLease(owner, async () => {
        await new Promise((r) => setTimeout(r, 250)); // > 3× idle
        const cur = await readReportSessionLock(session_id);
        assert.equal(cur.kind, "owned");
        if (cur.kind !== "owned") return;
        // acquireDecisionReportStartLock refuses idle_start when not idle.
        idleAfterLease = isReportStartLockIdle(cur.lock);
        const thief = newReportLockOwner(session_id);
        // Stale snapshot from before renewals must CAS-fail.
        staleTakeover = await takeOverReportLock(staleRaw, thief, "start", null);
      });
      assert.equal(idleAfterLease, false);
      assert.equal(staleTakeover, null);
      const still = await readReportSessionLock(session_id);
      assert.equal(still.kind, "owned");
      if (still.kind === "owned") {
        assert.equal(still.lock.lock_token, owner.lock_token);
      }
      await releaseOwnedReportLock(owner);
    });
  });

  await check("R3: renew across > idle → Regenerate-style idle takeover blocked", async () => {
    await withShortIdle(async () => {
      const session_id = uniq("sess");
      const owner = newReportLockOwner(session_id);
      assert.ok(await tryCreateReportLock(owner, "start", "job_live"));
      const before = await readReportSessionLock(session_id);
      assert.equal(before.kind, "owned");
      if (before.kind !== "owned") return;
      const staleRaw = before.raw;
      await withOwnedReportLockLease(owner, async () => {
        await new Promise((r) => setTimeout(r, 250));
        const cur = await readReportSessionLock(session_id);
        assert.equal(cur.kind, "owned");
        if (cur.kind !== "owned") return;
        // Same gate acquireDecisionReportStartLock uses for holder start.
        assert.equal(isReportStartLockIdle(cur.lock), false);
        const regen = newReportLockOwner(session_id);
        const taken = await takeOverReportLock(staleRaw, regen, "start", null);
        assert.equal(taken, null);
      });
      await releaseOwnedReportLock(owner);
    });
  });

  await check("R3: truly idle (no renew) → new Start can take over", async () => {
    await withShortIdle(async () => {
      const session_id = uniq("sess");
      const owner = newReportLockOwner(session_id);
      assert.ok(await tryCreateReportLock(owner, "start", null));
      await new Promise((r) => setTimeout(r, 120)); // > idle, no renew
      const cur = await readReportSessionLock(session_id);
      assert.equal(cur.kind, "owned");
      if (cur.kind !== "owned") return;
      assert.equal(isReportStartLockIdle(cur.lock), true);
      const next = newReportLockOwner(session_id);
      const taken = await takeOverReportLock(cur.raw, next, "start", null);
      assert.ok(taken);
      assert.equal(taken.lock_token, next.lock_token);
      const releaseOld = await releaseOwnedReportLock(owner);
      assert.equal(releaseOld, "not_owner");
      await releaseOwnedReportLock(next);
    });
  });

  await check("R3: concurrent renew vs takeover → single owner", async () => {
    await withShortIdle(async () => {
      const session_id = uniq("sess");
      const owner = newReportLockOwner(session_id);
      assert.ok(await tryCreateReportLock(owner, "start", null));
      await new Promise((r) => setTimeout(r, 120)); // idle
      const cur = await readReportSessionLock(session_id);
      assert.equal(cur.kind, "owned");
      if (cur.kind !== "owned") return;
      const thief = newReportLockOwner(session_id);
      const [renewed, stolen] = await Promise.all([
        updateOwnedReportLock(owner),
        takeOverReportLock(cur.raw, thief, "start", null),
      ]);
      const winners = [renewed != null, stolen != null].filter(Boolean).length;
      assert.equal(winners, 1, "exactly one of renew/takeover must win");
      const final = await readReportSessionLock(session_id);
      assert.equal(final.kind, "owned");
      if (final.kind === "owned") {
        if (renewed) {
          assert.equal(final.lock.lock_token, owner.lock_token);
          await releaseOwnedReportLock(owner);
        } else {
          assert.equal(final.lock.lock_token, thief.lock_token);
          await releaseOwnedReportLock(thief);
        }
      }
    });
  });

  await check("R3: lease lost mid-Start → no activate/create/dispatch", async () => {
    await withShortIdle(async () => {
      installEventSender();
      __resetDi2Batch2StartSideEffectCountsForTests();
      const ctx = await createDi2Job();
      const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
      __setDi2Batch2StartLockRaceProbeForTests(async ({ gate }) => {
        if (gate !== "before_activate") return;
        // Steal lock so background renew + assertHeldStartLock Fail Closed.
        const cur = await readReportSessionLock(ctx.session_id);
        if (cur.kind !== "owned") return;
        const thief = newReportLockOwner(ctx.session_id);
        await takeOverReportLock(cur.raw, thief, "start", null);
      });
      try {
        const res = await startDi2Batch2Production({
          job_id: ctx.job_id,
          freeze: ctx.freeze,
          profile: ctx.profile,
          lock_owner: owner,
        });
        assert.equal(res.ok, false);
        if (!res.ok) assert.equal(res.code, "session_lock_lost");
        assert.equal(__di2Batch2StartSideEffectCountsForTests.activate, 0);
        assert.equal(__di2Batch2StartSideEffectCountsForTests.create_job, 0);
        assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 0);
        assert.equal(sentEvents.length, 0);
      } finally {
        __setDi2Batch2StartLockRaceProbeForTests(null);
        await releaseOwnedReportLock(owner).catch(() => undefined);
      }
    });
  });

  await check("R3: ORCHESTRATE send longer than idle still holds lock", async () => {
    await withShortIdle(async () => {
      sentEvents = [];
      __resetDi2Batch2StartSideEffectCountsForTests();
      setReportBatch2EventSenderForTests({
        async send(events) {
          await new Promise((r) => setTimeout(r, 250)); // > idle
          for (const e of events) sentEvents.push({ name: e.name, data: e.data });
          return { ok: true };
        },
      });
      const ctx = await createDi2Job();
      const res = await startWithLock(ctx);
      assert.equal(res.ok, true);
      assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 1);
      assert.ok(sentEvents.some((e) => e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE));
      installEventSender();
    });
  });

  await check("R3: ORCHESTRATE fail then long RECOVER still under same lease", async () => {
    await withShortIdle(async () => {
      sentEvents = [];
      __resetDi2Batch2StartSideEffectCountsForTests();
      let sends = 0;
      setReportBatch2EventSenderForTests({
        async send(events) {
          sends += 1;
          await new Promise((r) => setTimeout(r, 120)); // each send > idle/2
          if (sends === 1) {
            return { ok: false, code: "forced_fail", detail: "orch" };
          }
          for (const e of events) sentEvents.push({ name: e.name, data: e.data });
          return { ok: true };
        },
      });
      const ctx = await createDi2Job();
      const res = await startWithLock(ctx);
      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.equal(res.production.last_dispatch, "recover");
      assert.equal(__di2Batch2StartSideEffectCountsForTests.recover_send, 1);
      assert.ok(sentEvents.some((e) => e.name === REPORT_BATCH2_EVENTS.RECOVER));
      installEventSender();
    });
  });

  await check("R3: normal / repeat Start still idempotent with lease", async () => {
    await withShortIdle(async () => {
      installEventSender();
      __resetDi2Batch2StartSideEffectCountsForTests();
      const ctx = await createDi2Job();
      const first = await startWithLock(ctx);
      assert.equal(first.ok, true);
      if (!first.ok) return;
      const second = await startWithLock(ctx);
      assert.equal(second.ok, true);
      if (!second.ok) return;
      assert.equal(second.reused, true);
      assert.equal(second.binding.generation_id, first.binding.generation_id);
    });
  });

  __setDi2Batch2StartSideEffectProbeForTests(null);
  __setDi2Batch2StartLockRaceProbeForTests(null);
  __setCommitUnderFenceRaceProbeForTests(null);
  // ─── Unit C R4: lease preflight before side effects ──────────────────────

  await check("R4: lease already lost → awaitUnderStartLease does not call work", async () => {
    const session_id = uniq("sess");
    const owner = await acquireStartLock(session_id, null);
    try {
      await __runWithActiveStartLeaseForTests(owner, async (lease) => {
        const cur = await readReportSessionLock(session_id);
        assert.equal(cur.kind, "owned");
        if (cur.kind !== "owned") return;
        const thief = newReportLockOwner(session_id);
        assert.ok(await takeOverReportLock(cur.raw, thief, "start", null));
        assert.equal(await lease.renewNow(), false);
        assert.equal(lease.lost(), true);

        let workCalls = 0;
        const r = await __awaitUnderStartLeaseForTests(owner, async () => {
          workCalls += 1;
          return "should_not_run";
        });
        assert.equal(r.ok, false);
        if (!r.ok) assert.equal(r.code, "session_lock_lost");
        assert.equal(workCalls, 0);
      });
    } finally {
      await releaseOwnedReportLock(owner).catch(() => undefined);
    }
  });

  await check("R4: lease lost during preflight lock assert → work not called", async () => {
    const session_id = uniq("sess");
    const owner = await acquireStartLock(session_id, null);
    try {
      await __runWithActiveStartLeaseForTests(owner, async (lease) => {
        let workCalls = 0;
        __setAwaitUnderLeasePreflightProbeForTests(async () => {
          const cur = await readReportSessionLock(session_id);
          if (cur.kind !== "owned") return;
          const thief = newReportLockOwner(session_id);
          await takeOverReportLock(cur.raw, thief, "start", null);
          await lease.renewNow();
        });
        const r = await __awaitUnderStartLeaseForTests(owner, async () => {
          workCalls += 1;
          return "should_not_run";
        });
        __setAwaitUnderLeasePreflightProbeForTests(null);
        assert.equal(r.ok, false);
        if (!r.ok) assert.equal(r.code, "session_lock_lost");
        assert.equal(workCalls, 0);
      });
    } finally {
      __setAwaitUnderLeasePreflightProbeForTests(null);
      await releaseOwnedReportLock(owner).catch(() => undefined);
    }
  });

  await check("R4: lease lost before intent → no intent enqueue, no ORCHESTRATE", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
    __setDi2Batch2StartPreIntentProbeForTests(async () => {
      const cur = await readReportSessionLock(ctx.session_id);
      if (cur.kind !== "owned") return;
      const thief = newReportLockOwner(ctx.session_id);
      await takeOverReportLock(cur.raw, thief, "start", null);
    });
    try {
      const res = await startDi2Batch2Production({
        job_id: ctx.job_id,
        freeze: ctx.freeze,
        profile: ctx.profile,
        lock_owner: owner,
      });
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.code, "session_lock_lost");
      assert.equal(__di2Batch2StartSideEffectCountsForTests.intent_enqueue, 0);
      assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 0);
      assert.equal(sentEvents.length, 0);
    } finally {
      __setDi2Batch2StartPreIntentProbeForTests(null);
      await releaseOwnedReportLock(owner).catch(() => undefined);
    }
  });

  await check("R4: lease lost before RECOVER send → no recover send", async () => {
    sentEvents = [];
    __resetDi2Batch2StartSideEffectCountsForTests();
    let sends = 0;
    setReportBatch2EventSenderForTests({
      async send(events) {
        sends += 1;
        if (sends === 1) {
          return { ok: false, code: "forced_fail", detail: "orch" };
        }
        for (const e of events) sentEvents.push({ name: e.name, data: e.data });
        return { ok: true };
      },
    });
    const ctx = await createDi2Job();
    const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
    let stolenForRecover = false;
    __setAwaitUnderLeasePreflightProbeForTests(async () => {
      // Steal only on the RECOVER await (after ORCHESTRATE send was counted).
      if (stolenForRecover) return;
      if (__di2Batch2StartSideEffectCountsForTests.orchestrate_send < 1) return;
      stolenForRecover = true;
      const cur = await readReportSessionLock(ctx.session_id);
      if (cur.kind !== "owned") return;
      const thief = newReportLockOwner(ctx.session_id);
      await takeOverReportLock(cur.raw, thief, "start", null);
    });
    try {
      const res = await startDi2Batch2Production({
        job_id: ctx.job_id,
        freeze: ctx.freeze,
        profile: ctx.profile,
        lock_owner: owner,
      });
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.code, "session_lock_lost");
      assert.equal(__di2Batch2StartSideEffectCountsForTests.recover_send, 0);
      assert.ok(
        !sentEvents.some((e) => e.name === REPORT_BATCH2_EVENTS.RECOVER),
      );
    } finally {
      __setAwaitUnderLeasePreflightProbeForTests(null);
      await releaseOwnedReportLock(owner).catch(() => undefined);
      installEventSender();
    }
  });

  await check("R4: healthy lease → intent + ORCHESTRATE still run", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    __setDi2Batch2StartPreIntentProbeForTests(null);
    __setAwaitUnderLeasePreflightProbeForTests(null);
    const ctx = await createDi2Job();
    const res = await startWithLock(ctx);
    assert.equal(res.ok, true);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.activate, 1);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.create_job, 1);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.intent_enqueue, 1);
    assert.equal(__di2Batch2StartSideEffectCountsForTests.orchestrate_send, 1);
  });

  await check("R4: in-flight send then lease lost → Fail Closed, no further side effects", async () => {
    sentEvents = [];
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
    setReportBatch2EventSenderForTests({
      async send(events) {
        // Steal during in-flight ORCHESTRATE — cannot recall this send.
        const cur = await readReportSessionLock(ctx.session_id);
        if (cur.kind === "owned") {
          const thief = newReportLockOwner(ctx.session_id);
          await takeOverReportLock(cur.raw, thief, "start", null);
        }
        for (const e of events) sentEvents.push({ name: e.name, data: e.data });
        return { ok: true };
      },
    });
    try {
      const res = await startDi2Batch2Production({
        job_id: ctx.job_id,
        freeze: ctx.freeze,
        profile: ctx.profile,
        lock_owner: owner,
      });
      // Postflight Fail Closed; do not claim in-flight send was recalled.
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.code, "session_lock_lost");
      assert.equal(__di2Batch2StartSideEffectCountsForTests.recover_send, 0);
      // ORCHESTRATE may have left the sender; must not start RECOVER after loss.
      assert.ok(
        !sentEvents.some((e) => e.name === REPORT_BATCH2_EVENTS.RECOVER),
      );
    } finally {
      await releaseOwnedReportLock(owner).catch(() => undefined);
      installEventSender();
    }
  });

  await check("R4: repeat Start still idempotent after preflight fix", async () => {
    installEventSender();
    __resetDi2Batch2StartSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const first = await startWithLock(ctx);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = await startWithLock(ctx);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.binding.generation_id, first.binding.generation_id);
  });

  __setDi2Batch2StartSideEffectProbeForTests(null);
  __setDi2Batch2StartLockRaceProbeForTests(null);
  __setCommitUnderFenceRaceProbeForTests(null);
  __setAwaitUnderLeasePreflightProbeForTests(null);
  __setDi2Batch2StartPreIntentProbeForTests(null);
  __setReportStartLockIdleMsForTests(null);
  __setReportStartLockRenewEveryMsForTests(null);
  __setReportLockNowForTests(null);
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
