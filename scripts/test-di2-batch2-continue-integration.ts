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
  __setDi2Batch2ContinueAuthoritySnapshotForTests,
  __setDi2Batch2ContinueLeaseProbeForTests,
  continueDi2Batch2Production,
  validateDi2Batch2ContinueIdentity,
} from "../lib/poju/decision-intake/decision-report-batch2-continue";
import {
  __setStatusDeliveryVerifyForTests,
  buildDecisionReportStatus,
} from "../lib/poju/decision-intake/decision-report-service";
import {
  di2ChargeAuthorizationKey,
  di2DeliveryAuthorizationKey,
  grantDecisionReportDelivery,
  revokeDecisionReportDelivery,
  type ChargeAuthorization,
} from "../lib/poju/decision-intake/decision-report-charge";
import { kv } from "../lib/kv/client";
import { xhighJobKey } from "../lib/poju/xhigh-job-types";
import type { PojuXhighJob } from "../lib/poju/xhigh-job-types";
import {
  loadJob,
  pageBlobKey,
} from "../lib/llm/pro/delivery/decision-report-v2/batch2/job-store";
import {
  __di2Batch2StatusSideEffectCountsForTests,
  __resetDi2Batch2StatusSideEffectCountsForTests,
  __setDi2Batch2StatusActivePageGateProbeForTests,
} from "../lib/poju/decision-intake/decision-report-batch2-status";
import {
  di2Batch2GenerationId,
  evaluateExistingDi2Batch2Binding,
} from "../lib/poju/decision-intake/decision-report-batch2-identity";
import {
  authOutputKey,
  commitPageResult,
  ensurePageFence,
  fenceAndClaimPageTask,
  invalidatePageAuthority,
  readGeneration,
  readPageProvenance,
  resetBatch3KeysForTests,
  runReportBatch3Recovery,
  transitionGenerationStatus,
  writePageProvenance,
} from "../lib/llm/pro/delivery/decision-report-v2/batch3";
import {
  hashCanonicalPayload,
  reportPageDefinition,
} from "../lib/llm/pro/delivery/decision-report-v2/orchestration";
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
  isDecisionReportJobInput,
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

function installAuthoritySnapshot(ctx: {
  freeze: FreezeRecord;
  profile: ProfileRecord;
}) {
  __setDi2Batch2ContinueAuthoritySnapshotForTests({
    freeze: {
      session_id: ctx.freeze.session_id,
      freeze_id: ctx.freeze.freeze_id,
      context_id: ctx.freeze.context_id,
      context_version: ctx.freeze.context_version,
      context_hash: ctx.freeze.context_hash,
      profile_hash: ctx.freeze.profile_hash ?? ctx.profile.profile_hash,
    },
    profile: {
      session_id: ctx.profile.session_id,
      freeze_id: ctx.profile.freeze_id,
      profile_id: ctx.profile.profile_id,
      profile_hash: ctx.profile.profile_hash,
    },
  });
}

async function grantDeliveryForTests(job: PojuXhighJob): Promise<void> {
  const charge_ref = `charge_${job.session_id}`;
  const now = Date.now();
  const auth: ChargeAuthorization = {
    version: 1,
    session_id: job.session_id,
    state: "authorized",
    charge_ref,
    joint_pass_ref: null,
    question: "unit-d-r3",
    attempt_id: `att_${job.job_id}`,
    claimed_at: now,
    attempts: 1,
    reason: null,
    updated_at: now,
    authorized_at: now,
  };
  await kv.set(di2ChargeAuthorizationKey(job.session_id), auth, { ex: 60 * 60 });
  const granted = await grantDecisionReportDelivery(job, auth);
  assert.equal(granted.ok, true, JSON.stringify(granted));
}

async function startThen(ctx: {
  job_id: string;
  session_id: string;
  freeze: FreezeRecord;
  profile: ProfileRecord;
}) {
  installAuthoritySnapshot(ctx);
  const owner = await acquireStartLock(ctx.session_id, ctx.job_id);
  try {
    const res = await startDi2Batch2Production({
      job_id: ctx.job_id,
      freeze: ctx.freeze,
      profile: ctx.profile,
      lock_owner: owner,
    });
    assert.equal(res.ok, true);
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    await grantDeliveryForTests(job!);
    return res;
  } finally {
    await releaseOwnedReportLock(owner).catch(() => undefined);
  }
}

async function commitPage01(ctx: {
  report_job_id: string;
  generation_id: string;
  generation_epoch: number;
  body?: string;
}): Promise<{ output_fingerprint: string; out: { page: string; body: string } }> {
  const page_id = "01" as const;
  const def = reportPageDefinition(page_id);
  const input_fingerprint = `fp_r3_${ctx.body ?? "page01"}`;
  await ensurePageFence({
    report_id: ctx.report_job_id,
    generation_id: ctx.generation_id,
    generation_epoch: ctx.generation_epoch,
    page_id,
  });
  const claimed = await fenceAndClaimPageTask({
    report_id: ctx.report_job_id,
    generation_id: ctx.generation_id,
    generation_epoch: ctx.generation_epoch,
    page_id,
    task_type: "generate",
    input_fingerprint,
    upstream_output_fingerprints: {},
    worker_id: "w_unit_d_r3",
  });
  assert.equal(claimed.ok, true, JSON.stringify(claimed));
  if (!claimed.ok) throw new Error("claim failed");
  const out = { page: "01", body: ctx.body ?? "r3_page01" };
  const output_fingerprint = hashCanonicalPayload(out);
  const committed = await commitPageResult({
    report_id: ctx.report_job_id,
    generation_id: ctx.generation_id,
    generation_epoch: ctx.generation_epoch,
    page_id,
    attempt_id: claimed.value.attempt_id,
    task_key: claimed.value.task_key,
    output: out,
    output_fingerprint,
    state_patch: { outcome: "completed", input_fingerprint },
    provenance: {
      report_id: ctx.report_job_id,
      generation_id: ctx.generation_id,
      generation_epoch: ctx.generation_epoch,
      page_id,
      input_fingerprint,
      upstream_output_fingerprints: {},
      page_contract_version: def.production_version,
      prompt_version: def.prompt_version,
      validator_version: def.validator_version,
      output_fingerprint,
      attempt_id: claimed.value.attempt_id,
      task_key: claimed.value.task_key,
      validity_rev: claimed.value.validity_rev,
    },
  });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  return { output_fingerprint, out };
}

async function patchBatch2MetaEpoch(
  report_id: string,
  generation_id: string,
  epoch: unknown,
): Promise<void> {
  const key = `report-batch2:${report_id.trim()}:${generation_id.trim()}:meta`;
  const meta = await kv.get<Record<string, unknown>>(key);
  assert.ok(meta);
  const next = { ...meta };
  if (epoch === undefined) {
    delete next.generation_epoch;
  } else {
    next.generation_epoch = epoch as never;
  }
  await kv.set(key, next, { ex: 60 * 60 });
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
  console.log("Unit D / R5 — Continue/Recovery + Batch2 Status single-snapshot Authority");
  installEventSender();
  __resetDi2Batch2ContinueSideEffectCountsForTests();
  __setDi2Batch2ContinueLeaseProbeForTests(null);
  __setDi2Batch2ContinueAuthoritySnapshotForTests(null);
  __setStatusDeliveryVerifyForTests(null);
  __resetDi2Batch2StatusSideEffectCountsForTests();
  __setDi2Batch2StatusActivePageGateProbeForTests(null);
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

  await check("partial pages: completed page survives Continue RECOVER", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const gid = started.binding.generation_id;
    const gen = await readGeneration(ctx.report_job_id, gid);
    assert.equal(gen.ok && Boolean(gen.value), true);
    if (!gen.ok || !gen.value) return;
    const generation_epoch = gen.value.generation_epoch;
    const page_id = "01" as const;
    const def = reportPageDefinition(page_id);
    const input_fingerprint = "fp_partial_page01";

    await ensurePageFence({
      report_id: ctx.report_job_id,
      generation_id: gid,
      generation_epoch,
      page_id,
    });
    const claimed = await fenceAndClaimPageTask({
      report_id: ctx.report_job_id,
      generation_id: gid,
      generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint,
      upstream_output_fingerprints: {},
      worker_id: "w_unit_d_r1_partial",
    });
    assert.equal(claimed.ok, true, JSON.stringify(claimed));
    if (!claimed.ok) return;
    const out = { page: "01", body: "partial_done" };
    const output_fingerprint = hashCanonicalPayload(out);
    const committed = await commitPageResult({
      report_id: ctx.report_job_id,
      generation_id: gid,
      generation_epoch,
      page_id,
      attempt_id: claimed.value.attempt_id,
      task_key: claimed.value.task_key,
      output: out,
      output_fingerprint,
      state_patch: { outcome: "completed", input_fingerprint },
      provenance: {
        report_id: ctx.report_job_id,
        generation_id: gid,
        generation_epoch,
        page_id,
        input_fingerprint,
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint,
        attempt_id: claimed.value.attempt_id,
        task_key: claimed.value.task_key,
        validity_rev: claimed.value.validity_rev,
      },
    });
    assert.equal(committed.ok, true, JSON.stringify(committed));

    const before = await loadJob(ctx.report_job_id, gid);
    assert.equal(before.ok, true);
    if (!before.ok || !before.value) return;
    const page01Before = before.value.page_states.find((p) => p.page_id === "01");
    assert.equal(page01Before?.outcome, "completed");
    assert.equal(page01Before?.output_fingerprint, output_fingerprint);
    assert.ok(before.value.page_outputs["01"]);
    const page02Before = before.value.page_states.find((p) => p.page_id === "02");
    assert.notEqual(page02Before?.outcome, "completed");

    sentEvents = [];
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, true);
    if (!cont.ok) return;
    assert.equal(cont.binding.generation_id, gid);
    assert.equal(cont.recover_sent, true);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.create_job, 0);
    assert.ok(sentEvents.some((e) => e.name === REPORT_BATCH2_EVENTS.RECOVER));
    assert.equal(
      sentEvents.filter((e) => e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE).length,
      0,
    );

    // Drive RECOVER: completed page must be skipped, not regenerated.
    sentEvents = [];
    const recovered = await runReportBatch3Recovery({
      report_id: ctx.report_job_id,
      generation_id: gid,
      generation_epoch,
      locale: "zh",
    });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    if (!recovered.ok) return;
    assert.ok(
      recovered.value.actions.some(
        (a) => a.kind === "skipped_completed" && a.page_id === "01",
      ),
      JSON.stringify(recovered.value.actions),
    );
    assert.equal(
      sentEvents.filter(
        (e) => e.name === REPORT_BATCH2_EVENTS.GENERATE && e.data.page_id === "01",
      ).length,
      0,
    );

    const after = await loadJob(ctx.report_job_id, gid);
    assert.equal(after.ok, true);
    if (!after.ok || !after.value) return;
    const page01After = after.value.page_states.find((p) => p.page_id === "01");
    assert.equal(page01After?.outcome, "completed");
    assert.equal(page01After?.output_fingerprint, output_fingerprint);
    assert.deepEqual(after.value.page_outputs["01"], out);
    const page02 = after.value.page_states.find((p) => p.page_id === "02");
    assert.ok(page02);
    assert.notEqual(page02?.outcome, "completed");
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

  await check("R2: Status Batch2 active + aged DI2 + no lease → Batch2 running, no mutate", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job?.batch2_identity_binding);
    const beforeJson = JSON.stringify(job);
    const aged = {
      ...job!,
      status: "running" as const,
      updated_at: Date.now() - 7 * 60_000,
    };
    await kv.set(xhighJobKey(ctx.job_id), aged, { ex: 60 * 60 });
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.status, "running");
    assert.notEqual(status.failure_reason, "interrupted");
    assert.ok(status.batch2_production);
    assert.equal(status.batch2_production!.source, "batch2");
    assert.equal(status.batch2_production!.generation_id, started.binding.generation_id);
    assert.equal(status.batch2_production!.generation_status, "active");
    assert.equal(status.batch2_production!.pages_available, true);
    assert.equal(status.batch2_production!.pages_authority, "validated");
    assert.ok(
      status.current_stage === "batch2_producing" ||
        status.current_stage === "batch2_pending" ||
        status.current_stage === "batch2_orchestrating",
    );
    assert.equal(status.worker, null);
    assert.equal(sentEvents.length, 0);
    const again = await getXhighJob(ctx.job_id);
    assert.ok(again);
    assert.notEqual(again!.failure_reason, "interrupted");
    assert.ok(again!.status === "pending" || again!.status === "running");
    // Status must not mutate DI2 job fields beyond the aged write we did.
    assert.equal(again!.batch2_identity_binding?.generation_id, job!.batch2_identity_binding!.generation_id);
    assert.equal(again!.execution_generation, job!.execution_generation);
    void beforeJson;
  });

  await check("R2: Status partial pages → real Batch2 page outcomes, no events", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const gid = started.binding.generation_id;
    const committed = await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: gid,
      generation_epoch: started.binding.batch3_generation_epoch,
      body: "r2_status_partial",
    });

    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.status, "running");
    assert.ok(status.batch2_production);
    assert.equal(status.batch2_production!.pages_available, true);
    assert.equal(status.batch2_production!.pages_authority, "validated");
    const page01 = status.batch2_production!.page_outcomes.find((p) => p.page_id === "01");
    assert.equal(page01?.outcome, "completed");
    assert.equal(page01?.authority_verdict, "valid");
    assert.equal(page01?.output_fingerprint, committed.output_fingerprint);
    assert.equal(
      status.pages.find((p) => p.page_id === "01")?.status,
      "completed",
    );
    const page02 = status.batch2_production!.page_outcomes.find((p) => p.page_id === "02");
    assert.notEqual(page02?.outcome, "completed");
    assert.equal(sentEvents.length, 0);
  });

  await check("R2: Status Generation completed → ready_for_delivery, no gen / no report store", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "finalizing",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "completed",
        })
      ).ok,
      true,
    );
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.status, "running");
    assert.equal(status.current_stage, "ready_for_delivery");
    assert.equal(status.result, null);
    assert.ok(status.batch2_production);
    assert.equal(status.batch2_production!.generation_status, "completed");
    assert.equal(status.batch2_production!.pages_available, true);
    assert.equal(status.batch2_production!.pages_authority, "validated");
    assert.equal(sentEvents.length, 0);
    const di2 = await getXhighJob(ctx.job_id);
    assert.ok(di2);
    assert.notEqual(di2!.status, "completed");
  });

  await check("R2: Status corrupted binding → identity error, no stale fail / no mutate", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    await startThen(ctx);
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    const corrupted = {
      ...job!,
      status: "running" as const,
      updated_at: Date.now() - 7 * 60_000,
      batch2_identity_binding: {
        status: "bound",
        report_id: "wrong_report_id",
        generation_id: "wrong_gid",
        di2_execution_generation: job!.execution_generation!,
        created_at: new Date().toISOString(),
        batch3_generation_epoch: 1,
      },
    };
    await kv.set(xhighJobKey(ctx.job_id), corrupted, { ex: 60 * 60 });
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, false);
    assert.equal(status.status, "failed");
    assert.equal(status.failure_reason, "batch2_identity_error");
    assert.notEqual(status.failure_reason, "interrupted");
    assert.equal(status.worker, null);
    assert.equal(sentEvents.length, 0);
    const again = await getXhighJob(ctx.job_id);
    assert.ok(again);
    assert.notEqual(again!.failure_reason, "interrupted");
    assert.ok(again!.status === "pending" || again!.status === "running");
  });

  await check("R2: Status Generation missing → error, no allocate", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    await startThen(ctx);
    await resetBatch3KeysForTests();
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, false);
    assert.equal(status.failure_reason, "batch2_generation_missing");
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.allocate_generation, 0);
    assert.equal(sentEvents.length, 0);
  });

  await check("R2: Status Batch2 Job missing → error, no rebuild", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    await startThen(ctx);
    await resetBatch2JobStoreForTests();
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, false);
    assert.equal(status.failure_reason, "batch2_job_missing");
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.create_job, 0);
    assert.equal(sentEvents.length, 0);
  });

  await check("R2: Status generation_epoch mismatch → fail closed, no mutate", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    await startThen(ctx);
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job?.batch2_identity_binding);
    const drifted = {
      ...job!,
      batch2_identity_binding: {
        ...job!.batch2_identity_binding!,
        batch3_generation_epoch: job!.batch2_identity_binding!.batch3_generation_epoch + 99,
      },
    };
    await kv.set(xhighJobKey(ctx.job_id), drifted, { ex: 60 * 60 });
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, false);
    assert.equal(status.failure_reason, "batch2_identity_error");
    assert.match(String(status.error), /generation_epoch mismatch/i);
    assert.equal(sentEvents.length, 0);
    const again = await getXhighJob(ctx.job_id);
    assert.equal(again!.status, drifted.status);
    assert.notEqual(again!.failure_reason, "interrupted");
  });

  await check("R2: legacy Status without Batch2 binding still uses DI2 lease stale fail", async () => {
    const ctx = await createDi2Job();
    // No Start → no binding. Age past stale window with no lease.
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    assert.equal(job!.batch2_identity_binding, undefined);
    const aged = {
      ...job!,
      status: "running" as const,
      updated_at: Date.now() - 7 * 60_000,
    };
    await kv.set(xhighJobKey(ctx.job_id), aged, { ex: 60 * 60 });
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.status, "failed");
    assert.equal(status.failure_reason, "interrupted");
    const again = await getXhighJob(ctx.job_id);
    assert.equal(again!.status, "failed");
    assert.equal(again!.failure_reason, "interrupted");
  });

  await check("R3: Status auth granted → Batch2-authoritative Status", async () => {
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.status, "running");
    assert.ok(status.batch2_production);
    assert.equal(status.batch2_production!.pages_available, true);
    assert.notEqual(status.failure_reason, "delivery_not_authorized");
  });

  await check("R3: Status auth revoked → deliveryDenied, no Batch2 pages", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    await revokeDecisionReportDelivery({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
      execution_generation: job!.execution_generation ?? null,
      charge_ref: `charge_${ctx.session_id}`,
      reason: "unit_d_r3_test_revoke",
    });
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, false);
    assert.equal(status.status, "failed");
    assert.equal(status.failure_reason, "charge_refused");
    assert.equal(status.pages.length, 0);
    assert.equal(status.batch2_production ?? null, null);
    assert.equal(sentEvents.length, 0);
  });

  await check("R3: Status auth unreadable → delivery_unconfirmed, no Batch2 pages", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    __setStatusDeliveryVerifyForTests(async () => ({
      ok: false,
      reason: "delivery_unreadable",
      unreadable: true,
      revoked: false,
    }));
    try {
      sentEvents = [];
      const status = await buildDecisionReportStatus({
        job_id: ctx.job_id,
        session_id: ctx.session_id,
      });
      assert.equal(status.ok, false);
      assert.equal(status.failure_reason, "delivery_unconfirmed");
      assert.equal(status.retryable, true);
      assert.equal(status.pages.length, 0);
      assert.equal(status.batch2_production ?? null, null);
      assert.equal(sentEvents.length, 0);
    } finally {
      __setStatusDeliveryVerifyForTests(null);
    }
  });

  await check("R3: Status auth missing → delivery_not_authorized, no Batch2 pages", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    // Drop delivery + charge records so verify fails closed without Batch2 exposure.
    await kv.del(di2DeliveryAuthorizationKey(ctx.job_id));
    await kv.del(di2ChargeAuthorizationKey(ctx.session_id));
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, false);
    assert.equal(status.failure_reason, "delivery_not_authorized");
    assert.equal(status.pages.length, 0);
    assert.equal(status.batch2_production ?? null, null);
    assert.equal(sentEvents.length, 0);
  });

  await check("R3: Status Batch2 epoch correct / missing / string / NaN / mismatch", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const rid = started.binding.report_id;
    const gid = started.binding.generation_id;
    const epoch = started.binding.batch3_generation_epoch;

    sentEvents = [];
    const okStatus = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(okStatus.ok, true);
    assert.equal(okStatus.batch2_production?.generation_epoch, epoch);
    assert.equal(sentEvents.length, 0);

    const cases: Array<{ label: string; value: unknown }> = [
      { label: "missing", value: undefined },
      { label: "string", value: String(epoch) },
      { label: "NaN", value: Number.NaN },
      { label: "Infinity", value: Number.POSITIVE_INFINITY },
      { label: "mismatch", value: epoch + 99 },
    ];
    for (const c of cases) {
      await patchBatch2MetaEpoch(rid, gid, c.value);
      sentEvents = [];
      __resetDi2Batch2ContinueSideEffectCountsForTests();
      const status = await buildDecisionReportStatus({
        job_id: ctx.job_id,
        session_id: ctx.session_id,
      });
      assert.equal(status.ok, false, c.label);
      assert.equal(status.failure_reason, "batch2_identity_error", c.label);
      assert.equal(sentEvents.length, 0, c.label);
      assert.equal(__di2Batch2ContinueSideEffectCountsForTests.create_job, 0, c.label);
      assert.equal(__di2Batch2ContinueSideEffectCountsForTests.allocate_generation, 0, c.label);
      const di2 = await getXhighJob(ctx.job_id);
      assert.notEqual(di2!.failure_reason, "interrupted", c.label);
    }

    // Restore valid epoch for cleanup safety.
    await patchBatch2MetaEpoch(rid, gid, epoch);
  });

  await check("R3: Status Generation completed + pages → real page records", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    const committed = await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      body: "r3_completed_pages",
    });
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "finalizing",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "completed",
        })
      ).ok,
      true,
    );
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.current_stage, "ready_for_delivery");
    assert.ok(status.batch2_production);
    assert.equal(status.batch2_production!.pages_available, true);
    assert.equal(
      status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")?.outcome,
      "completed",
    );
    assert.equal(
      status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")
        ?.output_fingerprint,
      committed.output_fingerprint,
    );
    assert.equal(status.pages.find((p) => p.page_id === "01")?.status, "completed");
    assert.equal(sentEvents.length, 0);
  });

  await check("R3: Status Generation finalizing + partial pages → real page records", async () => {
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      body: "r3_finalizing_partial",
    });
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "finalizing",
        })
      ).ok,
      true,
    );
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.current_stage, "batch2_finalizing");
    assert.equal(status.batch2_production!.pages_available, true);
    assert.equal(
      status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")?.outcome,
      "completed",
    );
    assert.notEqual(
      status.batch2_production!.page_outcomes.find((p) => p.page_id === "02")?.outcome,
      "completed",
    );
  });

  await check("R3: Status Generation superseded + readable Job → terminal + pages", async () => {
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      body: "r3_superseded_pages",
    });
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "superseded",
        })
      ).ok,
      true,
    );
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, false);
    assert.equal(status.failure_reason, "batch2_generation_terminal");
    assert.equal(status.current_stage, "batch2_superseded");
    assert.equal(status.batch2_production!.pages_available, true);
    assert.equal(
      status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")?.outcome,
      "completed",
    );
  });

  await check("R3: Status Generation completed + Job missing → ready_for_delivery, pages unavailable", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "finalizing",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "completed",
        })
      ).ok,
      true,
    );
    await resetBatch2JobStoreForTests();
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.current_stage, "ready_for_delivery");
    assert.ok(status.batch2_production);
    assert.equal(status.batch2_production!.generation_status, "completed");
    assert.equal(status.batch2_production!.pages_available, false);
    assert.equal(status.batch2_production!.pages_authority, "unavailable");
    assert.equal(status.batch2_production!.page_outcomes.length, 0);
    assert.equal(status.pages.length, 0);
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.create_job, 0);
    assert.equal(sentEvents.length, 0);
  });

  await check("R4: Active + valid Authority Page → Status completed", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const committed = await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: started.binding.generation_id,
      generation_epoch: started.binding.batch3_generation_epoch,
      body: "r4_active_valid",
    });
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.batch2_production!.pages_authority, "validated");
    const page01 = status.batch2_production!.page_outcomes.find((p) => p.page_id === "01");
    assert.equal(page01?.outcome, "completed");
    assert.equal(page01?.authority_verdict, "valid");
    assert.equal(page01?.output_fingerprint, committed.output_fingerprint);
    assert.equal(status.pages.find((p) => p.page_id === "01")?.status, "completed");
    assert.equal(sentEvents.length, 0);
  });

  await check("R4: Active + fence stale → Status must not return completed", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      body: "r4_fence_stale",
    });
    const inv = await invalidatePageAuthority({
      report_id: b.report_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      page_id: "01",
      reason: "unit_d_r4_fence_stale",
    });
    assert.equal(inv.ok, true, JSON.stringify(inv));
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.batch2_production!.pages_authority, "validated");
    const page01 = status.batch2_production!.page_outcomes.find((p) => p.page_id === "01");
    assert.notEqual(page01?.outcome, "completed");
    assert.notEqual(status.pages.find((p) => p.page_id === "01")?.status, "completed");
    assert.equal(sentEvents.length, 0);
  });

  await check("R4: Active + provenance mismatch → Status must not return completed", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      body: "r4_prov_mismatch",
    });
    const prov = await readPageProvenance(b.report_id, b.generation_id, "01");
    assert.equal(prov.ok && Boolean(prov.value), true);
    if (!prov.ok || !prov.value) return;
    const written = await writePageProvenance({
      ...prov.value,
      output_fingerprint: "tampered_provenance_fingerprint",
      stale: false,
    });
    assert.equal(written.ok, true, JSON.stringify(written));
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    // Status fail-closes on authority mismatch (not demote-as-completed).
    assert.equal(status.ok, false);
    assert.equal(status.failure_reason, "batch2_job_unreadable");
    assert.equal(status.batch2_production ?? null, null);
    assert.equal(sentEvents.length, 0);
  });

  await check("R4: Active + authority output missing → fail closed", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      body: "r4_auth_missing",
    });
    await kv.del(authOutputKey(b.report_id, b.generation_id, "01"));
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, false);
    assert.equal(status.failure_reason, "batch2_job_unreadable");
    assert.match(String(status.error), /authority/i);
    assert.equal(status.batch2_production ?? null, null);
    assert.equal(sentEvents.length, 0);
  });

  await check("R4: Terminal + valid historical page → retain completed", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    const committed = await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      body: "r4_terminal_valid",
    });
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "finalizing",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "completed",
        })
      ).ok,
      true,
    );
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.current_stage, "ready_for_delivery");
    assert.equal(status.batch2_production!.pages_authority, "validated");
    assert.equal(
      status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")?.outcome,
      "completed",
    );
    assert.equal(
      status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")
        ?.output_fingerprint,
      committed.output_fingerprint,
    );
    assert.equal(sentEvents.length, 0);
  });

  await check("R4: Terminal + invalid historical page → not valid completed", async () => {
    installEventSender();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      body: "r4_terminal_invalid",
    });
    const inv = await invalidatePageAuthority({
      report_id: b.report_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      page_id: "01",
      reason: "unit_d_r4_terminal_invalid",
    });
    assert.equal(inv.ok, true, JSON.stringify(inv));
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "finalizing",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "completed",
        })
      ).ok,
      true,
    );
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.current_stage, "ready_for_delivery");
    assert.equal(status.batch2_production!.pages_authority, "validated");
    const page01 = status.batch2_production!.page_outcomes.find((p) => p.page_id === "01");
    assert.notEqual(page01?.outcome, "completed");
    assert.ok(
      page01?.authority_verdict === "stale" ||
        page01?.authority_verdict === "demoted" ||
        page01?.authority_verdict === "mismatch" ||
        page01?.authority_verdict === "missing",
    );
    assert.equal(sentEvents.length, 0);
  });

  await check("R4: Terminal + Job missing → pages_available false, no create", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "finalizing",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "completed",
        })
      ).ok,
      true,
    );
    await resetBatch2JobStoreForTests();
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.current_stage, "ready_for_delivery");
    assert.equal(status.batch2_production!.pages_available, false);
    assert.equal(status.batch2_production!.pages_authority, "unavailable");
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.create_job, 0);
    assert.equal(sentEvents.length, 0);
  });

  await check("R5: Active single snapshot — one raw load; KV mutate mid-gate does not split snapshot", async () => {
    installEventSender();
    __resetDi2Batch2StatusSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    const committed = await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      body: "r5_single_snapshot",
    });

    let mutated = false;
    __setDi2Batch2StatusActivePageGateProbeForTests(
      async ({ page_id, verdict, report_id, generation_id }) => {
        if (page_id !== "01" || verdict !== "valid" || mutated) return;
        mutated = true;
        // Mutate durable KV after Authority on the in-memory snapshot succeeded.
        // A second independent re-read would see pending; single-snapshot must not.
        const key = pageBlobKey(report_id, generation_id, "01");
        const cur = await kv.get<{
          rev: number;
          state: { page_id: string; outcome: string; output_fingerprint?: string };
          output?: unknown;
        }>(key);
        assert.ok(cur);
        await kv.set(
          key,
          {
            ...cur!,
            state: {
              page_id: "01",
              outcome: "pending",
              output_fingerprint: undefined,
            },
            output: undefined,
          },
          { ex: 60 * 60 },
        );
      },
    );

    try {
      sentEvents = [];
      __resetDi2Batch2StatusSideEffectCountsForTests();
      const status = await buildDecisionReportStatus({
        job_id: ctx.job_id,
        session_id: ctx.session_id,
      });
      assert.equal(status.ok, true);
      assert.equal(__di2Batch2StatusSideEffectCountsForTests.active_raw_job_loads, 1);
      assert.equal(__di2Batch2StatusSideEffectCountsForTests.historical_raw_job_loads, 0);
      assert.equal(mutated, true);
      const page01 = status.batch2_production!.page_outcomes.find((p) => p.page_id === "01");
      assert.equal(page01?.outcome, "completed");
      assert.equal(page01?.authority_verdict, "valid");
      assert.equal(page01?.output_fingerprint, committed.output_fingerprint);
      assert.equal(status.pages.find((p) => p.page_id === "01")?.status, "completed");
      assert.equal(sentEvents.length, 0);
    } finally {
      __setDi2Batch2StatusActivePageGateProbeForTests(null);
    }
  });

  await check("R5: Active + valid / stale / missing still match R4 semantics", async () => {
    // Valid completed (single snapshot).
    {
      __resetDi2Batch2StatusSideEffectCountsForTests();
      const ctx = await createDi2Job();
      const started = await startThen(ctx);
      assert.equal(started.ok, true);
      if (!started.ok) return;
      await commitPage01({
        report_job_id: ctx.report_job_id,
        generation_id: started.binding.generation_id,
        generation_epoch: started.binding.batch3_generation_epoch,
        body: "r5_valid",
      });
      const status = await buildDecisionReportStatus({
        job_id: ctx.job_id,
        session_id: ctx.session_id,
      });
      assert.equal(status.ok, true);
      assert.equal(__di2Batch2StatusSideEffectCountsForTests.active_raw_job_loads, 1);
      assert.equal(
        status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")?.outcome,
        "completed",
      );
      assert.equal(
        status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")
          ?.authority_verdict,
        "valid",
      );
    }
    // Stale fence → pending, not completed.
    {
      const ctx = await createDi2Job();
      const started = await startThen(ctx);
      assert.equal(started.ok, true);
      if (!started.ok) return;
      const b = started.binding;
      await commitPage01({
        report_job_id: ctx.report_job_id,
        generation_id: b.generation_id,
        generation_epoch: b.batch3_generation_epoch,
        body: "r5_stale",
      });
      assert.equal(
        (
          await invalidatePageAuthority({
            report_id: b.report_id,
            generation_id: b.generation_id,
            generation_epoch: b.batch3_generation_epoch,
            page_id: "01",
            reason: "unit_d_r5_stale",
          })
        ).ok,
        true,
      );
      const status = await buildDecisionReportStatus({
        job_id: ctx.job_id,
        session_id: ctx.session_id,
      });
      assert.equal(status.ok, true);
      assert.notEqual(
        status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")?.outcome,
        "completed",
      );
    }
    // Authority output missing → fail closed.
    {
      const ctx = await createDi2Job();
      const started = await startThen(ctx);
      assert.equal(started.ok, true);
      if (!started.ok) return;
      const b = started.binding;
      await commitPage01({
        report_job_id: ctx.report_job_id,
        generation_id: b.generation_id,
        generation_epoch: b.batch3_generation_epoch,
        body: "r5_auth_missing",
      });
      await kv.del(authOutputKey(b.report_id, b.generation_id, "01"));
      const status = await buildDecisionReportStatus({
        job_id: ctx.job_id,
        session_id: ctx.session_id,
      });
      assert.equal(status.ok, false);
      assert.equal(status.failure_reason, "batch2_job_unreadable");
      assert.equal(status.batch2_production ?? null, null);
    }
  });

  await check("R5: Terminal historical Authority behavior unchanged", async () => {
    installEventSender();
    __resetDi2Batch2StatusSideEffectCountsForTests();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const b = started.binding;
    const committed = await commitPage01({
      report_job_id: ctx.report_job_id,
      generation_id: b.generation_id,
      generation_epoch: b.batch3_generation_epoch,
      body: "r5_terminal_hist",
    });
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "finalizing",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: b.report_id,
          generation_id: b.generation_id,
          generation_epoch: b.batch3_generation_epoch,
          to: "completed",
        })
      ).ok,
      true,
    );
    sentEvents = [];
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.ok, true);
    assert.equal(status.current_stage, "ready_for_delivery");
    assert.equal(__di2Batch2StatusSideEffectCountsForTests.active_raw_job_loads, 0);
    assert.equal(__di2Batch2StatusSideEffectCountsForTests.historical_raw_job_loads, 1);
    assert.equal(
      status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")?.outcome,
      "completed",
    );
    assert.equal(
      status.batch2_production!.page_outcomes.find((p) => p.page_id === "01")
        ?.output_fingerprint,
      committed.output_fingerprint,
    );
    assert.equal(sentEvents.length, 0);
  });

  await check("R1: recomputed report_job_id mismatch → no RECOVER", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    await startThen(ctx);
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job && isDecisionReportJobInput(job.input));
    const tampered = {
      ...job!,
      input: {
        ...(job!.input as DecisionReportJobInput),
        // Tamper a field that feeds di2ReportJobId without updating report_job_id.
        profile_hash: "tampered_profile_hash_xxxxx",
      },
    };
    await kv.set(xhighJobKey(ctx.job_id), tampered, { ex: 60 * 60 });
    const id = validateDi2Batch2ContinueIdentity({
      job: tampered,
      binding: job!.batch2_identity_binding!,
    });
    assert.equal(id.ok, false);
    if (!id.ok) assert.equal(id.code, "identity_mismatch");
    sentEvents = [];
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, false);
    if (!cont.ok) {
      assert.ok(
        cont.code === "identity_mismatch" || cont.code === "identity_unverified",
      );
    }
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.recover_send, 0);
    assert.equal(sentEvents.length, 0);
  });

  await check("R1: Freeze context mismatch vs authority → no RECOVER", async () => {
    installEventSender();
    __resetDi2Batch2ContinueSideEffectCountsForTests();
    const ctx = await createDi2Job();
    await startThen(ctx);
    // Authority snapshot still has original context; job input context_hash differs.
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job && isDecisionReportJobInput(job.input));
    const ji = job!.input as DecisionReportJobInput;
    const tampered = {
      ...job!,
      input: {
        ...ji,
        context_hash: "tampered_context_hash",
        // Keep report_job_id valid (context not in di2ReportJobId).
      },
    };
    await kv.set(xhighJobKey(ctx.job_id), tampered, { ex: 60 * 60 });
    installAuthoritySnapshot(ctx); // original freeze context
    sentEvents = [];
    const cont = await continueWithLock({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(cont.ok, false);
    if (!cont.ok) assert.equal(cont.code, "identity_mismatch");
    assert.equal(__di2Batch2ContinueSideEffectCountsForTests.recover_send, 0);
    assert.equal(sentEvents.length, 0);
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
  __setDi2Batch2ContinueAuthoritySnapshotForTests(null);
  __setStatusDeliveryVerifyForTests(null);
  __setDi2Batch2StatusActivePageGateProbeForTests(null);
  __resetDi2Batch2StatusSideEffectCountsForTests();
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
