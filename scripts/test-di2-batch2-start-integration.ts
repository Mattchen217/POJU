/**
 * Unit C — DI2 Start → Batch2 production integration (no real model / Inngest).
 *
 *   pnpm exec tsx scripts/test-di2-batch2-start-integration.ts
 *
 * Covers startDi2Batch2Production + identity/ZFP gates. Uses MemoryKv + test
 * event sender. Does not claim multi-isolate Upstash PASS.
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
  resolveTrustedZiweiFactPack,
  startDi2Batch2Production,
} from "../lib/poju/decision-intake/decision-report-batch2-start";
import {
  DI2_REPORT_SCHEMA_VERSION,
  PERSONAL_ANALYSIS_SCHEMA_VERSION,
  di2ReportJobId,
  type DecisionReportJobInput,
} from "../lib/poju/decision-intake/decision-report-types";
import { di2Batch2GenerationId } from "../lib/poju/decision-intake/decision-report-batch2-identity";
import { profileIndicatesComputedZiwei } from "../lib/poju/decision-intake/decision-report-batch2-adapter";
import {
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

async function main() {
  console.log("Unit C — DI2 Start → Batch2 production");
  installEventSender();
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
    const res = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile: ctx.profile,
      client_ziwei_fact_pack: { version: 1 },
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "ziwei_trusted_pack_required");
  });

  await check("valid Start enters Batch2 production (activate + orchestrate)", async () => {
    sentEvents = [];
    const ctx = await createDi2Job();
    const res = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile: ctx.profile,
      birth_info: GOLDEN_BIRTH,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.binding.report_id, ctx.report_job_id);
    assert.equal(res.binding.generation_id, di2Batch2GenerationId(ctx.report_job_id));
    assert.equal(res.production.generation_id, res.binding.generation_id);
    assert.notEqual(
      typeof res.production.generation_epoch,
      "undefined",
    );
    // Batch3 epoch is a separate field from DI2 execution_generation
    assert.equal(res.binding.di2_execution_generation, ctx.generation);
    assert.equal(
      typeof res.binding.batch3_generation_epoch,
      "number",
    );

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
    const res = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile: ctx.profile,
    });
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
    // Align profile ids with created job freeze
    ctx.profile = {
      ...profile,
      session_id: ctx.session_id,
      freeze_id: ctx.freeze.freeze_id,
      profile_hash: "prof_hash_1",
    };
    // Recreate with matching profile on job — simpler: start with mismatched by not passing birth
    const res = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
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
    const badFreeze = {
      ...ctx.freeze,
      freeze_id: "wrong_freeze",
    };
    const before = sentEvents.length;
    const res = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: badFreeze,
      profile: ctx.profile,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "freeze_profile_mismatch");
    assert.equal(sentEvents.length, before);
  });

  await check("identical Start retry reuses same Batch2 Job/Generation (no second gen)", async () => {
    sentEvents = [];
    const ctx = await createDi2Job();
    const first = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile: ctx.profile,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const orchCount1 = sentEvents.filter(
      (e) => e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE,
    ).length;
    assert.equal(orchCount1, 1);

    const second = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile: ctx.profile,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.binding.generation_id, first.binding.generation_id);
    assert.equal(second.production.generation_epoch, first.production.generation_epoch);
    // Second path uses RECOVER, not a new ORCHESTRATE allocation
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
    // Fix profile session/freeze after createDi2Job overwrote ids via createDi2Job internals
    const profile = {
      ...ctx.profile,
      ziwei_closed_set: "closed",
      source: {
        ...ctx.profile.source,
        ziwei_status: "ok" as const,
        birth_input_hash: birthInputHash(GOLDEN_BIRTH),
      },
    };
    const res = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile,
      birth_info: GOLDEN_BIRTH,
    });
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
    const res = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile: ctx.profile,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "dispatch_uncertain");
    // Binding may exist from ensure; generation_id must still be the single bound id
    const job = await getXhighJob(ctx.job_id);
    if (job?.batch2_identity_binding) {
      assert.equal(
        job.batch2_identity_binding.generation_id,
        di2Batch2GenerationId(ctx.report_job_id),
      );
    }
    installEventSender();
  });

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
