/**
 * Unit E — DI2 Final Delivery Adapter (Batch2/3 → DI2 Report Store).
 *
 *   pnpm exec tsx scripts/test-di2-batch2-final-delivery.ts
 *
 * Deterministic MemoryKv only — no real models / OpenRouter / Upstash / Inngest.
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
import { startDi2Batch2Production } from "../lib/poju/decision-intake/decision-report-batch2-start";
import {
  __setDi2Batch2ContinueAuthoritySnapshotForTests,
  continueDi2Batch2Production,
} from "../lib/poju/decision-intake/decision-report-batch2-continue";
import {
  __setDi2Batch2FinalDeliveryAuthoritySnapshotForTests,
  __setDi2Batch2FinalDeliveryCommitHookForTests,
  attemptDi2Batch2FinalDelivery,
} from "../lib/poju/decision-intake/decision-report-batch2-final-delivery";
import { buildDecisionReportStatus } from "../lib/poju/decision-intake/decision-report-service";
import {
  di2ChargeAuthorizationKey,
  grantDecisionReportDelivery,
  grantDecisionReportExecution,
  revokeDecisionReportDelivery,
  type ChargeAuthorization,
} from "../lib/poju/decision-intake/decision-report-charge";
import {
  loadCompletedReport,
  verifyCompletedReportRecord,
} from "../lib/poju/decision-intake/decision-report-store";
import { kv } from "../lib/kv/client";
import {
  commitPageResult,
  ensurePageFence,
  fenceAndClaimPageTask,
  resetBatch3KeysForTests,
  transitionGenerationStatus,
} from "../lib/llm/pro/delivery/decision-report-v2/batch3";
import {
  hashCanonicalPayload,
  REPORT_PAGE_IDS,
  reportPageDefinition,
} from "../lib/llm/pro/delivery/decision-report-v2/orchestration";
import {
  newReportLockOwner,
  releaseOwnedReportLock,
  tryCreateReportLock,
  type ReportLockOwner,
} from "../lib/poju/decision-intake/decision-report-lock";
import {
  DI2_REPORT_SCHEMA_VERSION,
  PERSONAL_ANALYSIS_SCHEMA_VERSION,
  di2ReportJobId,
  type DecisionReportJobInput,
} from "../lib/poju/decision-intake/decision-report-types";
import {
  authorizeFdExecutionFence,
  bumpFdExecutionFence,
  createXhighJob,
  getXhighJob,
} from "../lib/poju/xhigh-job-store";
import {
  resetBatch2JobStoreForTests,
  updateJobStatus,
} from "../lib/llm/pro/delivery/decision-report-v2/batch2/job-store";
import { setReportBatch2EventSenderForTests } from "../lib/llm/pro/delivery/decision-report-v2/batch2/dispatch";
import type { BirthInfo } from "../lib/profile/types";
import type { PojuXhighJob } from "../lib/poju/xhigh-job-types";
import { DECISION_PAGE_IDS } from "../lib/llm/pro/delivery/page-feed-matrix";

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

const NOW = "2026-11-26T23:00:00.000Z";
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

function installEventSender() {
  setReportBatch2EventSenderForTests({
    async send() {
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

async function createDi2Job() {
  const session_id = uniq("sess_e");
  const freeze_id = uniq("frz_e");
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
    analysis_key: `ak_${uniq("e")}`,
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

async function acquireStartLock(session_id: string, job_id: string | null): Promise<ReportLockOwner> {
  const owner = newReportLockOwner(session_id);
  const lock = await tryCreateReportLock(owner, "start", job_id);
  assert.ok(lock);
  return owner;
}

function installAuthoritySnapshot(ctx: { freeze: FreezeRecord; profile: ProfileRecord }) {
  const snap = {
    freeze: {
      session_id: ctx.freeze.session_id,
      freeze_id: ctx.freeze.freeze_id,
      context_id: ctx.freeze.context_id,
      context_version: ctx.freeze.context_version,
      context_hash: ctx.freeze.context_hash,
      freeze_receipt_id: ctx.freeze.receipt.receipt_id,
      decision_question: ctx.freeze.frozen_dc.definition.decision_question,
      profile_hash: ctx.freeze.profile_hash ?? ctx.profile.profile_hash,
    },
    profile: {
      session_id: ctx.profile.session_id,
      freeze_id: ctx.profile.freeze_id,
      profile_id: ctx.profile.profile_id,
      profile_hash: ctx.profile.profile_hash,
      profile_receipt_id: ctx.profile.receipt.receipt_id,
    },
  };
  __setDi2Batch2ContinueAuthoritySnapshotForTests({
    freeze: {
      session_id: snap.freeze.session_id,
      freeze_id: snap.freeze.freeze_id,
      context_id: snap.freeze.context_id,
      context_version: snap.freeze.context_version,
      context_hash: snap.freeze.context_hash,
      profile_hash: snap.freeze.profile_hash,
    },
    profile: {
      session_id: snap.profile.session_id,
      freeze_id: snap.profile.freeze_id,
      profile_id: snap.profile.profile_id,
      profile_hash: snap.profile.profile_hash,
    },
  });
  __setDi2Batch2FinalDeliveryAuthoritySnapshotForTests(snap);
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
    question: "unit-e",
    attempt_id: `att_${job.job_id}`,
    claimed_at: now,
    attempts: 1,
    reason: null,
    updated_at: now,
    authorized_at: now,
  };
  await kv.set(di2ChargeAuthorizationKey(job.session_id), auth, { ex: 60 * 60 });
  const exec = await grantDecisionReportExecution(job);
  assert.equal(exec.ok, true, JSON.stringify(exec));
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
    if (!res.ok) throw new Error("start failed");
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    await grantDeliveryForTests(job!);
    return res;
  } finally {
    await releaseOwnedReportLock(owner).catch(() => undefined);
  }
}

async function commitAuthorityPage(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: (typeof REPORT_PAGE_IDS)[number];
  body: string;
  outcome?: "completed" | "skipped_not_applicable";
}): Promise<{ output_fingerprint: string; out: unknown }> {
  const def = reportPageDefinition(input.page_id);
  const input_fingerprint = `fp_e_${input.page_id}_${input.body}`;
  await ensurePageFence({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
  });
  const claimed = await fenceAndClaimPageTask({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    task_type: "generate",
    input_fingerprint,
    upstream_output_fingerprints: {},
    worker_id: "w_unit_e",
  });
  assert.equal(claimed.ok, true, JSON.stringify(claimed));
  if (!claimed.ok) throw new Error("claim failed");

  const outcome = input.outcome ?? "completed";
  const out =
    outcome === "skipped_not_applicable"
      ? {
          page: "07",
          face: "07",
          applicability_status: "not_applicable",
          body: input.body,
        }
      : { page: input.page_id, body: input.body };
  const output_fingerprint = hashCanonicalPayload(out);
  const committed = await commitPageResult({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    attempt_id: claimed.value.attempt_id,
    task_key: claimed.value.task_key,
    output: out,
    output_fingerprint,
    state_patch: {
      outcome,
      input_fingerprint,
      ...(input.page_id === "07"
        ? {
            applicability_status:
              outcome === "skipped_not_applicable" ? "not_applicable" : "applicable",
          }
        : {}),
    },
    provenance: {
      report_id: input.report_id,
      generation_id: input.generation_id,
      generation_epoch: input.generation_epoch,
      page_id: input.page_id,
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

async function seedAllAuthorityPages(binding: {
  report_id: string;
  generation_id: string;
  batch3_generation_epoch: number;
}) {
  for (const page_id of REPORT_PAGE_IDS) {
    if (page_id === "07") {
      await commitAuthorityPage({
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: binding.batch3_generation_epoch,
        page_id,
        body: "page07_skip",
        outcome: "skipped_not_applicable",
      });
      continue;
    }
    await commitAuthorityPage({
      report_id: binding.report_id,
      generation_id: binding.generation_id,
      generation_epoch: binding.batch3_generation_epoch,
      page_id,
      body: `unit_e_page_${page_id}_body`,
    });
  }
}

async function markGenerationCompleted(binding: {
  report_id: string;
  generation_id: string;
  batch3_generation_epoch: number;
}) {
  assert.equal(
    (
      await transitionGenerationStatus({
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: binding.batch3_generation_epoch,
        to: "finalizing",
      })
    ).ok,
    true,
  );
  assert.equal(
    (
      await transitionGenerationStatus({
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: binding.batch3_generation_epoch,
        to: "completed",
      })
    ).ok,
    true,
  );
  await updateJobStatus(binding.report_id, binding.generation_id, "completed");
}

/** active → finalizing → delivery_failed (Batch3 V3 merge failed; pages may still be Authority-valid). */
async function markGenerationDeliveryFailed(binding: {
  report_id: string;
  generation_id: string;
  batch3_generation_epoch: number;
}) {
  assert.equal(
    (
      await transitionGenerationStatus({
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: binding.batch3_generation_epoch,
        to: "finalizing",
      })
    ).ok,
    true,
  );
  assert.equal(
    (
      await transitionGenerationStatus({
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: binding.batch3_generation_epoch,
        to: "delivery_failed",
      })
    ).ok,
    true,
  );
  await updateJobStatus(binding.report_id, binding.generation_id, "completed");
}

async function continueWithLock(ctx: { job_id: string; session_id: string }) {
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

async function prepareReadyJob(opts?: {
  skipPages?: boolean;
  skipGrant?: boolean;
  generation?: "completed" | "delivery_failed";
}) {
  installEventSender();
  resetBatch2JobStoreForTests();
  resetBatch3KeysForTests();
  __setDi2Batch2FinalDeliveryCommitHookForTests(null);
  const ctx = await createDi2Job();
  const started = await startThen(ctx);
  assert.equal(started.ok, true);
  if (!started.ok) throw new Error("start failed");
  const binding = started.binding;
  if (!opts?.skipPages) {
    await seedAllAuthorityPages(binding);
  }
  if (opts?.generation === "delivery_failed") {
    await markGenerationDeliveryFailed(binding);
  } else {
    await markGenerationCompleted(binding);
  }
  if (opts?.skipGrant) {
    // revoke after grant from startThen
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    await revokeDecisionReportDelivery({
      job_id: job!.job_id,
      session_id: job!.session_id,
      execution_generation: job!.execution_generation ?? null,
      charge_ref: null,
      reason: "unit_e_revoke",
    });
  }
  return { ctx, binding };
}

async function main() {
  console.log("Unit E — DI2 Final Delivery Adapter");

  await check("Authority-valid full page set → DI2 Store delivered", async () => {
    const { ctx } = await prepareReadyJob();
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, true, JSON.stringify(delivered));
    if (!delivered.ok) return;
    verifyCompletedReportRecord(delivered.record);
    assert.equal(delivered.record.pages.length, DECISION_PAGE_IDS.length);
    assert.equal(delivered.record.pages.find((p) => p.page_id === "07")?.applicability, "not_applicable");
    assert.equal(delivered.record.pages.find((p) => p.page_id === "03")?.status, "completed");
    assert.ok(delivered.record.result.full_text.trim().length > 0);
    // R1: no forged completed Personal Analysis when none was produced.
    assert.equal(delivered.record.analysis.status, "unavailable");
    assert.equal(delivered.record.analysis.analysis_result, null);
    assert.notEqual(delivered.record.analysis.model, "batch2_final_delivery_store_bound");
    const job = await getXhighJob(ctx.job_id);
    assert.equal(job?.status, "completed");
    const loaded = await loadCompletedReport(ctx.session_id, ctx.job_id);
    assert.ok(loaded);
    assert.equal(loaded!.record_hash, delivered.record.record_hash);
  });

  await check("Missing required pages → cannot deliver (stay incomplete)", async () => {
    const { ctx } = await prepareReadyJob({ skipPages: true });
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, false);
    if (delivered.ok) return;
    assert.equal(delivered.code, "page_incomplete");
    assert.equal(await loadCompletedReport(ctx.session_id, ctx.job_id), null);
    const job = await getXhighJob(ctx.job_id);
    assert.notEqual(job?.status, "completed");
  });

  await check("Pending page (one page only) → cannot deliver", async () => {
    installEventSender();
    resetBatch2JobStoreForTests();
    resetBatch3KeysForTests();
    __setDi2Batch2FinalDeliveryCommitHookForTests(null);
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const binding = started.binding;
    await commitAuthorityPage({
      report_id: binding.report_id,
      generation_id: binding.generation_id,
      generation_epoch: binding.batch3_generation_epoch,
      page_id: "01",
      body: "only_page_01",
    });
    await markGenerationCompleted(binding);
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, false);
    if (delivered.ok) return;
    assert.ok(
      delivered.code === "page_incomplete" || delivered.code === "authority_invalid",
      delivered.code,
    );
    assert.equal(await loadCompletedReport(ctx.session_id, ctx.job_id), null);
  });

  await check("Delivery Authorization revoked → cannot write Store / no page leak via Status", async () => {
    const { ctx } = await prepareReadyJob({ skipGrant: true });
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, false);
    if (delivered.ok) return;
    assert.equal(delivered.code, "delivery_denied");
    assert.equal(delivered.delivery_denied, true);
    assert.equal(await loadCompletedReport(ctx.session_id, ctx.job_id), null);

    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.result, null);
    assert.ok(status.pages.length === 0 || status.failure_reason != null || status.status !== "completed");
    assert.notEqual(status.status, "completed");
  });

  await check("Freeze/Profile snapshot mismatch → cannot write Store", async () => {
    const { ctx } = await prepareReadyJob();
    __setDi2Batch2FinalDeliveryAuthoritySnapshotForTests({
      freeze: {
        session_id: ctx.session_id,
        freeze_id: ctx.freeze.freeze_id,
        context_id: "wrong_ctx",
        context_version: 99,
        context_hash: "wrong_hash",
      },
      profile: {
        session_id: ctx.session_id,
        freeze_id: ctx.freeze.freeze_id,
        profile_id: ctx.profile.profile_id,
        profile_hash: "wrong_profile",
      },
    });
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, false);
    if (delivered.ok) return;
    assert.ok(
      delivered.code === "freeze_mismatch" || delivered.code === "profile_mismatch",
      delivered.code,
    );
    assert.equal(await loadCompletedReport(ctx.session_id, ctx.job_id), null);
  });

  await check("Generation superseded → cannot deliver", async () => {
    installEventSender();
    resetBatch2JobStoreForTests();
    resetBatch3KeysForTests();
    const ctx = await createDi2Job();
    const started = await startThen(ctx);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const binding = started.binding;
    await seedAllAuthorityPages(binding);
    // Supersede while still active (completed → superseded is not a legal transition).
    assert.equal(
      (
        await transitionGenerationStatus({
          report_id: binding.report_id,
          generation_id: binding.generation_id,
          generation_epoch: binding.batch3_generation_epoch,
          to: "superseded",
        })
      ).ok,
      true,
    );
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, false);
    if (delivered.ok) return;
    assert.equal(delivered.code, "generation_stale");
    assert.equal(await loadCompletedReport(ctx.session_id, ctx.job_id), null);
  });

  await check("Idempotent re-delivery same identity/content", async () => {
    const { ctx } = await prepareReadyJob();
    const first = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.outcome, "existing");
    assert.equal(second.record.record_hash, first.record.record_hash);
  });

  await check("Same identity different content → conflict, no overwrite", async () => {
    const { ctx } = await prepareReadyJob();
    const first = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const { record_hash: _h, record_version: _v, ...base } = first.record;
    void _h;
    void _v;
    const draft = {
      ...base,
      pages: first.record.pages.map((p) =>
        p.page_id === "01"
          ? { ...p, content_markdown: "TAMPERED_CONTENT_UNIT_E" }
          : p,
      ),
      result: {
        ...first.record.result,
        full_text: first.record.result.full_text.replace(
          /unit_e_page_01_body/,
          "TAMPERED_CONTENT_UNIT_E",
        ),
      },
      committed_at: new Date().toISOString(),
    };
    const { commitCompletedReport, DecisionReportStoreError } = await import(
      "../lib/poju/decision-intake/decision-report-store"
    );
    let threw = false;
    try {
      await commitCompletedReport(draft);
    } catch (e) {
      threw = true;
      assert.ok(e instanceof DecisionReportStoreError);
      assert.equal((e as InstanceType<typeof DecisionReportStoreError>).code, "REPORT_RECORD_CONFLICT");
    }
    assert.equal(threw, true);
    const loaded = await loadCompletedReport(ctx.session_id, ctx.job_id);
    assert.ok(loaded);
    assert.equal(loaded!.record_hash, first.record.record_hash);
    assert.ok(!loaded!.pages.find((p) => p.page_id === "01")!.content_markdown.includes("TAMPERED"));
  });

  await check("Concurrent Final Delivery → single success, no duplicate conflict", async () => {
    const { ctx } = await prepareReadyJob();
    const [a, b] = await Promise.all([
      attemptDi2Batch2FinalDelivery(ctx.job_id),
      attemptDi2Batch2FinalDelivery(ctx.job_id),
    ]);
    assert.equal(a.ok, true, JSON.stringify(a));
    assert.equal(b.ok, true, JSON.stringify(b));
    if (!a.ok || !b.ok) return;
    assert.equal(a.record.record_hash, b.record.record_hash);
    const loaded = await loadCompletedReport(ctx.session_id, ctx.job_id);
    assert.ok(loaded);
    assert.equal(loaded!.record_hash, a.record.record_hash);
  });

  await check("commit ok + verify fail → not completed / unconfirmed", async () => {
    const { ctx } = await prepareReadyJob();
    __setDi2Batch2FinalDeliveryCommitHookForTests(async () => ({
      ok: false,
      code: "REPORT_PERSIST_UNCONFIRMED",
      message: "forced unconfirmed",
    }));
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, false);
    if (delivered.ok) return;
    assert.equal(delivered.unconfirmed, true);
    assert.notEqual(
      (await getXhighJob(ctx.job_id))?.status,
      "completed",
    );
    __setDi2Batch2FinalDeliveryCommitHookForTests(null);
  });

  await check("Status triggers delivery when ready; incomplete pages stay ready_for_delivery", async () => {
    const { ctx } = await prepareReadyJob({ skipPages: true });
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.status, "running");
    assert.equal(status.current_stage, "ready_for_delivery");
    assert.equal(status.result, null);
    assert.notEqual((await getXhighJob(ctx.job_id))?.status, "completed");
  });

  await check("Status with full Authority pages → completed from Report Store", async () => {
    const { ctx } = await prepareReadyJob();
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.status, "completed");
    assert.ok(status.result);
    assert.equal(status.pages.length, DECISION_PAGE_IDS.length);
    assert.equal((await getXhighJob(ctx.job_id))?.status, "completed");
  });

  await check("Continue resumes Final Delivery only (delivered), no RECOVER", async () => {
    const { ctx } = await prepareReadyJob();
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, true, JSON.stringify(cont));
    if (!cont.ok) return;
    assert.equal(cont.outcome, "delivered");
    assert.equal(cont.recover_sent, false);
    assert.equal((await getXhighJob(ctx.job_id))?.status, "completed");
  });

  await check("Continue/Status repeat after delivery is idempotent", async () => {
    const { ctx } = await prepareReadyJob();
    const first = await continueWithLock(ctx);
    assert.equal(first.ok, true);
    const second = await continueWithLock(ctx);
    // Already completed job — Continue under lease may still attempt delivery (existing)
    // or the job is completed; either way no new conflicting record.
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.status, "completed");
    const loaded = await loadCompletedReport(ctx.session_id, ctx.job_id);
    assert.ok(loaded);
    void second;
  });

  await check("Interrupt recovery: record exists → Status completes without regenerating pages", async () => {
    const { ctx } = await prepareReadyJob();
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, true);
    if (!delivered.ok) return;
    // Simulate job still running while Store already has the record.
    const { xhighJobKey } = await import("../lib/poju/xhigh-job-types");
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    await kv.set(
      xhighJobKey(job!.job_id),
      { ...job!, status: "running", current_stage: "ready_for_delivery", result: undefined },
      { ex: 60 * 60 },
    );
    const again = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.outcome, "existing");
    assert.equal(again.record.record_hash, delivered.record.record_hash);
  });

  await check("Batch2 completed alone ≠ DI2 completed (explicit)", async () => {
    const { ctx } = await prepareReadyJob({ skipPages: true });
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    assert.ok(job!.batch2_identity_binding);
    assert.notEqual(job!.status, "completed");
    assert.equal(await loadCompletedReport(ctx.session_id, ctx.job_id), null);
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.current_stage, "ready_for_delivery");
    assert.notEqual(status.status, "completed");
  });

  await check("Page 03 follows code glossary rules (empty terms → not_applicable)", async () => {
    const { ctx } = await prepareReadyJob();
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, true);
    if (!delivered.ok) return;
    const p03 = delivered.record.pages.find((p) => p.page_id === "03");
    assert.ok(p03);
    assert.equal(p03!.status, "completed");
    // Stub bodies have no term markers → not_applicable empty appendix is valid.
    assert.equal(p03!.applicability, "not_applicable");
    assert.equal(p03!.content_markdown, "");
  });

  // ── Unit E R1 ────────────────────────────────────────────────────────────

  await check("R1: delivery_failed + Authority pages → Status completes Final Delivery", async () => {
    const { ctx } = await prepareReadyJob({ generation: "delivery_failed" });
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.status, "completed", JSON.stringify(status));
    assert.ok(status.result);
    assert.equal((await getXhighJob(ctx.job_id))?.status, "completed");
    const loaded = await loadCompletedReport(ctx.session_id, ctx.job_id);
    assert.ok(loaded);
  });

  await check("R1: delivery_failed + missing pages → Status not completed", async () => {
    const { ctx } = await prepareReadyJob({
      skipPages: true,
      generation: "delivery_failed",
    });
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.notEqual(status.status, "completed");
    assert.equal(status.current_stage, "batch2_delivery_failed");
    assert.equal(await loadCompletedReport(ctx.session_id, ctx.job_id), null);
  });

  await check("R1: delivery_failed + Authority unavailable → Status not completed", async () => {
    const { ctx, binding } = await prepareReadyJob({
      skipPages: true,
      generation: "delivery_failed",
    });
    // Leave pages absent so historical Authority cannot validate a full set.
    void binding;
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.notEqual(status.status, "completed");
    assert.equal(await loadCompletedReport(ctx.session_id, ctx.job_id), null);
  });

  await check("R1: Continue + Status reuse same DI2 Store record", async () => {
    const { ctx } = await prepareReadyJob({ generation: "delivery_failed" });
    const cont = await continueWithLock(ctx);
    assert.equal(cont.ok, true, JSON.stringify(cont));
    if (!cont.ok) return;
    assert.equal(cont.outcome, "delivered");
    const afterContinue = await loadCompletedReport(ctx.session_id, ctx.job_id);
    assert.ok(afterContinue);
    const status = await buildDecisionReportStatus({
      job_id: ctx.job_id,
      session_id: ctx.session_id,
    });
    assert.equal(status.status, "completed");
    const afterStatus = await loadCompletedReport(ctx.session_id, ctx.job_id);
    assert.ok(afterStatus);
    assert.equal(afterStatus!.record_hash, afterContinue!.record_hash);
  });

  await check("R1: superseded / failed / cancelled still refuse delivery", async () => {
    for (const to of ["superseded", "failed", "cancelled"] as const) {
      installEventSender();
      resetBatch2JobStoreForTests();
      resetBatch3KeysForTests();
      const ctx = await createDi2Job();
      const started = await startThen(ctx);
      assert.equal(started.ok, true);
      if (!started.ok) return;
      const binding = started.binding;
      await seedAllAuthorityPages(binding);
      assert.equal(
        (
          await transitionGenerationStatus({
            report_id: binding.report_id,
            generation_id: binding.generation_id,
            generation_epoch: binding.batch3_generation_epoch,
            to,
          })
        ).ok,
        true,
        to,
      );
      const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
      assert.equal(delivered.ok, false, to);
      if (delivered.ok) return;
      assert.equal(delivered.code, "generation_stale", to);
      const status = await buildDecisionReportStatus({
        job_id: ctx.job_id,
        session_id: ctx.session_id,
      });
      assert.notEqual(status.status, "completed", to);
      assert.equal(await loadCompletedReport(ctx.session_id, ctx.job_id), null, to);
    }
  });

  await check("R1: no real analysis → unavailable seal, never forged completed", async () => {
    const { ctx } = await prepareReadyJob();
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, true);
    if (!delivered.ok) return;
    assert.equal(delivered.record.analysis.status, "unavailable");
    assert.equal(delivered.record.analysis.analysis_result, null);
    assert.ok(
      (delivered.record.analysis.error ?? "").includes("not_generated") ||
        (delivered.record.analysis.error ?? "").includes("unavailable"),
    );
    // Empty section artifact must not appear as completed.
    assert.notEqual(delivered.record.analysis.status, "completed");
  });

  await check("R1: valid completed Personal Analysis is reused", async () => {
    const { ctx } = await prepareReadyJob();
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    const ji = job!.input as DecisionReportJobInput;
    const { saveAnalysis } = await import("../lib/poju/decision-intake/decision-report-store");
    const analysis_id = `pa_real_${uniq("r1")}`;
    await saveAnalysis({
      record: {
        analysis_id,
        idempotency_key: ji.analysis_key,
        session_id: ji.session_id,
        freeze_id: ji.freeze_id,
        context_id: ji.context_id,
        context_version: ji.context_version,
        context_hash: ji.context_hash,
        profile_id: ji.profile_id,
        profile_hash: ji.profile_hash,
        analysis_schema_version: ji.analysis_schema_version,
        status: "completed",
        attempts: 1,
        generated_at: NOW,
        updated_at: NOW,
        analysis_result: {
          decision_target: {
            decision_question: "是否接受新工作",
            concrete_event: null,
            desired_outcome: null,
            stakes: null,
            goal_priorities: [],
            unacceptable_outcomes: [],
          },
          personal_pattern_analysis: [
            {
              item_id: "PA-pattern-1",
              text: "真实分析条目",
              traditional_basis: "basis",
              science_note: null,
              basis_class: "pattern_judgment",
              evidence_refs: [],
            },
          ],
          personal_strengths: [],
          personal_risks: [],
          decision_tendencies: [],
          constraint_interaction: [],
          decision_path_implications: [],
          unresolved_conditions: [],
          evidence_references: [],
          confidence_and_limits: {
            overall_confidence: "medium",
            limits: ["test"],
            information_boundaries: [],
          },
        },
        error: null,
        retryable: false,
        model: "test_real_pa",
        tokens_used: 12,
      },
      projection: null,
    });
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, true, JSON.stringify(delivered));
    if (!delivered.ok) return;
    assert.equal(delivered.record.analysis.status, "completed");
    assert.equal(delivered.record.analysis.analysis_id, analysis_id);
    assert.equal(delivered.record.analysis.model, "test_real_pa");
    assert.ok(delivered.record.analysis.analysis_result?.personal_pattern_analysis.length === 1);
  });

  await check("R1: completed analysis identity mismatch → fail closed", async () => {
    const { ctx } = await prepareReadyJob();
    const job = await getXhighJob(ctx.job_id);
    assert.ok(job);
    const ji = job!.input as DecisionReportJobInput;
    const { saveAnalysis } = await import("../lib/poju/decision-intake/decision-report-store");
    await saveAnalysis({
      record: {
        analysis_id: `pa_bad_${uniq("r1")}`,
        idempotency_key: ji.analysis_key,
        session_id: ji.session_id,
        freeze_id: "WRONG_FREEZE",
        context_id: ji.context_id,
        context_version: ji.context_version,
        context_hash: "wrong_hash",
        profile_id: ji.profile_id,
        profile_hash: ji.profile_hash,
        analysis_schema_version: ji.analysis_schema_version,
        status: "completed",
        attempts: 1,
        generated_at: NOW,
        updated_at: NOW,
        analysis_result: {
          decision_target: {
            decision_question: "x",
            concrete_event: null,
            desired_outcome: null,
            stakes: null,
            goal_priorities: [],
            unacceptable_outcomes: [],
          },
          personal_pattern_analysis: [],
          personal_strengths: [],
          personal_risks: [],
          decision_tendencies: [],
          constraint_interaction: [],
          decision_path_implications: [],
          unresolved_conditions: [],
          evidence_references: [],
          confidence_and_limits: {
            overall_confidence: "low",
            limits: ["x"],
            information_boundaries: [],
          },
        },
        error: null,
        retryable: false,
        model: "bad",
        tokens_used: 0,
      },
      projection: null,
    });
    const delivered = await attemptDi2Batch2FinalDelivery(ctx.job_id);
    assert.equal(delivered.ok, false);
    if (delivered.ok) return;
    assert.equal(delivered.code, "analysis_incomplete");
    assert.equal(await loadCompletedReport(ctx.session_id, ctx.job_id), null);
  });

  console.log(`\nUnit E results: ${passed} passed, ${failed} failed`);
  __setDi2Batch2FinalDeliveryAuthoritySnapshotForTests(null);
  __setDi2Batch2FinalDeliveryCommitHookForTests(null);
  __setDi2Batch2ContinueAuthoritySnapshotForTests(null);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
