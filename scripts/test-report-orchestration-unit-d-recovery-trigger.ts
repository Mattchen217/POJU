/**
 * Unit D — Recovery Function Automatic Trigger Closure (Batch3 epoch).
 * Run: pnpm exec tsx scripts/test-report-orchestration-unit-d-recovery-trigger.ts
 *
 * MEMORY_KV only. Does not claim Redis Integration PASS or real Inngest platform retry.
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NonRetriableError } from "inngest";

import {
  assertReportBatch2FunctionRegistration,
  buildRecoverPayload,
  createJob,
  handleGenerateEvent,
  invokeBatch2HandlerAdapter,
  loadJob,
  resetBatch2InvocationRecords,
  resetBatch2JobStoreForTests,
  saveJob,
  setBatch2ModelInvokeForTests,
  setReportBatch2EventSenderForTests,
  startReportBatch2Production,
  updatePageState,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import { REPORT_BATCH2_EVENTS } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/events";
import {
  buildPageProductionPrep,
  computePageInputFingerprintForJob,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2/page-prep";
import {
  reportPageRecovery,
  runReportPageRecoveryInngestStep,
} from "@/lib/inngest/functions/report-page-recovery";
import {
  activateGeneration,
  allocateGeneration,
  commitPageResult,
  ensurePageFence,
  listPendingIntents,
  readPageFence,
  resetBatch3KeysForTests,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import { fenceAndClaimPageTask } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/worker-guard";
import {
  hashCanonicalPayload,
  reportPageDefinition,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ReportPageId } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";
import { handleOrchestrateEvent } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/handlers";

type CapturedEvent = { name: string; data: Record<string, unknown> };

function baseDc(): DecisionContext {
  return {
    context_id: "dc_unit_d_recovery",
    version: 1,
    status: "final",
    content_hash: "h",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question:
        "Should I leave the job for a startup offer this quarter?",
      concrete_event: "Received startup offer with equity cliff.",
      desired_outcome: "Preserve runway and optionality.",
      stakes: "Career and cash floor",
      goal_priorities: ["runway"],
      unacceptable_outcomes: ["resign cold"],
    },
    constraints: [],
    reality_facts: [
      {
        fact_id: "fact_runway",
        statement: "Personal runway is about 8 months.",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t1",
        user_confirmed: true,
        fact_roles: ["hard_constraint"],
        related_dir_ids: ["DIR_RUNWAY"],
      },
      {
        fact_id: "fact_offer_terms",
        statement: "Startup offer includes a salary band and equity cliff.",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t2",
        user_confirmed: true,
        fact_roles: ["job_offer"],
        related_dir_ids: ["DIR_OFFER"],
      },
    ],
    dirs: [
      {
        dir_id: "DIR_RUNWAY",
        need: "Runway",
        why: "Cash floor",
        required_fact_roles: ["hard_constraint"],
        current_state: "known",
        partial_satisfaction: false,
        agenda_item_ids: [],
        id_lifecycle: "active",
      },
    ],
    conflicts: [],
    hypotheses: [],
  } as unknown as DecisionContext;
}

function basePack(): BookJudgmentPack {
  return {
    version: 1,
    locale: "en",
    cfp_hash: "cfp_unit_d",
    zfp_hash: null,
    zfpOmitted: true,
    shot_mode: "one",
    created_at: "2026-01-01T00:00:00Z",
    units: [
      {
        id: "u_destiny_01",
        track: "destiny",
        claim: "Stable cash floor. cfp:dayMaster",
        anchors: ["cfp:dayMaster"],
        serves_face: ["01", "02", "04"],
        caveat: "Not a timing guarantee.",
        term_ids: ["day_master"],
        source_domain: "bazi",
        source_version: "cfp_unit_d",
      },
    ],
    by_face: {
      "01": ["u_destiny_01"],
      "02": ["u_destiny_01"],
      "04": ["u_destiny_01"],
    },
    pattern_hits_used: [],
    science_tags_used: [],
  } as unknown as BookJudgmentPack;
}

function inputs(report_id: string): ReportBatch2JobInputs {
  return {
    report_id,
    dc: baseDc(),
    pack: basePack(),
    chart_fact_pack: "日主甲木…",
    bazi_available: true,
  };
}

async function cleanup(): Promise<void> {
  await resetBatch2JobStoreForTests();
  await resetBatch3KeysForTests();
  setBatch2ModelInvokeForTests(null);
  setReportBatch2EventSenderForTests(null);
  resetBatch2InvocationRecords();
}

async function prepGenerate(
  report_id: string,
  generation_id: string,
): Promise<{ page_id: ReportPageId; fingerprint: string }> {
  const page_id: ReportPageId = "01";
  const job0 = await loadJob(report_id, generation_id);
  assert.ok(job0.ok && job0.value);
  const prep = buildPageProductionPrep(job0.value!, page_id);
  assert.ok(!prep.build_fail);
  const fp = computePageInputFingerprintForJob(job0.value!, page_id, prep);
  assert.ok(fp.ok);
  updatePageState(job0.value!, page_id, { outcome: "queued" });
  assert.ok((await saveJob(job0.value!)).ok);
  return { page_id, fingerprint: fp.result.fingerprint };
}

async function main(): Promise<void> {
  console.log("=== Unit D — Recovery Automatic Trigger ===");
  assertReportBatch2FunctionRegistration();
  const recoveryOpts = (reportPageRecovery as { opts?: { retries?: number } })
    .opts;
  assert.equal(recoveryOpts?.retries, 1, "recovery retries=1");

  // --- D-T1: Recovery Event Builder ---
  {
    const payload = buildRecoverPayload({
      report_id: "  rpt_d_t1  ",
      generation_id: "  g_d_t1  ",
      generation_epoch: 3,
      locale: "  en  ",
    });
    assert.equal(payload.name, REPORT_BATCH2_EVENTS.RECOVER);
    assert.equal(payload.data.report_id, "rpt_d_t1");
    assert.equal(payload.data.generation_id, "g_d_t1");
    assert.equal(payload.data.generation_epoch, 3);
    assert.equal(payload.data.locale, "en");
    assert.throws(
      () =>
        buildRecoverPayload({
          report_id: "r",
          generation_id: "g",
          generation_epoch: Number.NaN,
          locale: "en",
        }),
      /generation_epoch_required/,
    );
    assert.throws(
      () =>
        buildRecoverPayload({
          report_id: "r",
          generation_id: "g",
          // @ts-expect-error intentional invalid
          generation_epoch: undefined,
          locale: "en",
        }),
      /generation_epoch_required/,
    );
    console.log("D-T1 ok — buildRecoverPayload trims + requires epoch");
  }

  // --- D-T2: Initial ORCHESTRATE send fail → auto RECOVER ---
  {
    await cleanup();
    const report_id = "rpt_ud_t2";
    const generation_id = "g_ud_t2";
    const captured: CapturedEvent[] = [];
    let orchestrateAttempts = 0;

    setReportBatch2EventSenderForTests({
      send: async (events) => {
        for (const e of events) {
          captured.push({ name: e.name, data: e.data });
          if (e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE) {
            orchestrateAttempts += 1;
            if (orchestrateAttempts === 1) {
              return {
                ok: false,
                code: "inngest_send_failed",
                detail: "injected_orchestrate_send_fail",
              };
            }
          }
        }
        return { ok: true };
      },
    });

    const started = await startReportBatch2Production({
      report_id,
      generation_id,
      locale: "en",
      inputs: inputs(report_id),
    });
    assert.equal(started.ok, true);
    if (!started.ok) throw new Error("start");
    assert.equal(started.generation_id, generation_id);
    assert.equal(typeof started.generation_epoch, "number");

    const recoverEvents = captured.filter(
      (e) => e.name === REPORT_BATCH2_EVENTS.RECOVER,
    );
    assert.equal(recoverEvents.length, 1);
    assert.equal(recoverEvents[0]!.data.report_id, report_id);
    assert.equal(recoverEvents[0]!.data.generation_id, generation_id);
    assert.equal(
      recoverEvents[0]!.data.generation_epoch,
      started.generation_epoch,
    );

    const intents = await listPendingIntents({ report_id, generation_id });
    assert.ok(intents.ok);
    assert.ok(intents.value!.length >= 1);
    assert.ok(
      intents.value!.some(
        (i) =>
          i.event_name === REPORT_BATCH2_EVENTS.ORCHESTRATE &&
          i.status === "failed",
      ),
    );

    const job = await loadJob(report_id, generation_id);
    assert.ok(job.ok && job.value);
    assert.notEqual(job.value!.status, "failed");

    // Only one generation / job (re-read pointer identity via load).
    const jobAgain = await loadJob(report_id, generation_id);
    assert.equal(jobAgain.value?.generation_id, generation_id);

    // Run Recovery via registered adapter on captured RECOVER.
    const recoverResult = await invokeBatch2HandlerAdapter({
      name: REPORT_BATCH2_EVENTS.RECOVER,
      data: recoverEvents[0]!.data,
      adapter_invocation_id: randomUUID(),
    });
    assert.ok(recoverResult && typeof recoverResult === "object");
    const actions = (recoverResult as { actions?: { kind: string }[] }).actions;
    assert.ok(actions?.some((a) => a.kind === "resend_intent"));

    const after = await listPendingIntents({ report_id, generation_id });
    assert.ok(after.ok);
    assert.equal(
      after.value!.filter((i) => i.status === "failed").length,
      0,
      "failed ORCHESTRATE intent should be resent to sent",
    );
    console.log(
      "D-T2 ok — ORCHESTRATE send fail → RECOVER → adapter resend_intent",
    );
  }

  // --- D-T3: Generate→Repair dispatch fail → auto RECOVER ---
  {
    await cleanup();
    const report_id = "rpt_ud_t3";
    const gen = await allocateGeneration({
      report_id,
      locale: "en",
      generation_id: "g_ud_t3",
    });
    assert.ok(gen.ok);
    if (!gen.ok) throw new Error("alloc");
    await activateGeneration({ record: gen.value, job_id: report_id });
    await createJob({
      report_id,
      generation_id: gen.value.generation_id,
      locale: "en",
      inputs: inputs(report_id),
      generation_epoch: gen.value.generation_epoch,
    });
    const { page_id, fingerprint } = await prepGenerate(
      report_id,
      gen.value.generation_id,
    );

    let modelCalls = 0;
    setBatch2ModelInvokeForTests(async () => {
      modelCalls += 1;
      return {
        content: "{ not-valid-json-for-repair",
        tokens_used: 1,
        model_call_id: `mc_t3_${modelCalls}`,
      };
    });

    const captured: CapturedEvent[] = [];
    setReportBatch2EventSenderForTests({
      send: async (events) => {
        for (const e of events) {
          captured.push({ name: e.name, data: e.data });
          if (e.name === REPORT_BATCH2_EVENTS.REPAIR) {
            return {
              ok: false,
              code: "inngest_send_failed",
              detail: "injected_repair_send_fail",
            };
          }
        }
        return { ok: true };
      },
    });

    const result = await handleGenerateEvent({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id,
      locale: "en",
      input_fingerprint: fingerprint,
      upstream_output_fingerprints: {},
    });
    assert.equal(result.status, "needs_repair");
    assert.equal(modelCalls, 1);

    const recoverEvents = captured.filter(
      (e) => e.name === REPORT_BATCH2_EVENTS.RECOVER,
    );
    assert.equal(recoverEvents.length, 1);
    assert.ok(
      (await loadJob(report_id, gen.value.generation_id)).value
        ?.repair_pending[page_id],
    );
    const fence = await readPageFence(
      report_id,
      gen.value.generation_id,
      page_id,
    );
    assert.equal(fence.value?.status, "open");

    // Recovery resends REPAIR; accept REPAIR this time.
    setReportBatch2EventSenderForTests({
      send: async (events) => {
        for (const e of events) captured.push({ name: e.name, data: e.data });
        return { ok: true };
      },
    });
    const modelBefore = modelCalls;
    const recovered = await invokeBatch2HandlerAdapter({
      name: REPORT_BATCH2_EVENTS.RECOVER,
      data: recoverEvents[0]!.data,
      adapter_invocation_id: randomUUID(),
    });
    assert.equal(modelCalls, modelBefore, "Recovery must not re-Generate");
    const actions = (recovered as { actions?: { kind: string }[] }).actions;
    assert.ok(actions?.some((a) => a.kind === "dispatch_repair"));
    assert.ok(
      (await loadJob(report_id, gen.value.generation_id)).value
        ?.repair_pending[page_id],
      "Pending remains until Repair Commit",
    );
    assert.ok(
      captured.some((e) => e.name === REPORT_BATCH2_EVENTS.REPAIR),
      "REPAIR resent by Recovery",
    );
    console.log(
      "D-T3 ok — REPAIR send fail → RECOVER → dispatch_repair; Pending kept",
    );
  }

  // --- D-T4: Follow-up / tick dispatch fail → auto RECOVER; completed intact ---
  {
    await cleanup();
    const report_id = "rpt_ud_t4";
    const gen = await allocateGeneration({
      report_id,
      locale: "en",
      generation_id: "g_ud_t4",
    });
    assert.ok(gen.ok);
    if (!gen.ok) throw new Error("alloc");
    await activateGeneration({ record: gen.value, job_id: report_id });
    await createJob({
      report_id,
      generation_id: gen.value.generation_id,
      locale: "en",
      inputs: inputs(report_id),
      generation_epoch: gen.value.generation_epoch,
    });

    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    const input_fingerprint = "fp_ud_t4";
    await ensurePageFence({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id,
    });
    const claimed = await fenceAndClaimPageTask({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint,
      upstream_output_fingerprints: {},
      worker_id: "w_ud_t4",
    });
    assert.ok(claimed.ok, JSON.stringify(claimed));
    const out = { page: "01", body: "generate_ok_t4" };
    const output_fingerprint = hashCanonicalPayload(out);
    const committed = await commitPageResult({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id,
      attempt_id: claimed.value!.attempt_id,
      task_key: claimed.value!.task_key,
      output: out,
      output_fingerprint,
      state_patch: { outcome: "completed", input_fingerprint },
      provenance: {
        report_id,
        generation_id: gen.value.generation_id,
        generation_epoch: gen.value.generation_epoch,
        page_id,
        input_fingerprint,
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint,
        attempt_id: claimed.value!.attempt_id,
        task_key: claimed.value!.task_key,
        validity_rev: claimed.value!.validity_rev,
      },
    });
    assert.ok(committed.ok, JSON.stringify(committed));

    const before = await loadJob(report_id, gen.value.generation_id);
    assert.equal(
      before.value!.page_states.find((s) => s.page_id === page_id)?.outcome,
      "completed",
    );

    const captured: CapturedEvent[] = [];
    setReportBatch2EventSenderForTests({
      send: async (events) => {
        for (const e of events) {
          captured.push({ name: e.name, data: e.data });
          // Fail worker/follow-up dispatches so orchestrator tick returns ok:false.
          if (
            e.name === REPORT_BATCH2_EVENTS.GENERATE ||
            e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE ||
            e.name === REPORT_BATCH2_EVENTS.APPLICABILITY
          ) {
            return {
              ok: false,
              code: "inngest_send_failed",
              detail: "injected_followup_dispatch_fail",
            };
          }
        }
        return { ok: true };
      },
    });

    const tickFail = await handleOrchestrateEvent({
      report_id,
      generation_id: gen.value.generation_id,
      locale: "en",
      generation_epoch: gen.value.generation_epoch,
    });
    assert.equal(tickFail.ok, false);
    assert.equal(tickFail.recovery_triggered, true);

    const recoverEvents = captured.filter(
      (e) => e.name === REPORT_BATCH2_EVENTS.RECOVER,
    );
    assert.equal(recoverEvents.length, 1);

    setReportBatch2EventSenderForTests({
      send: async () => ({ ok: true }),
    });
    await invokeBatch2HandlerAdapter({
      name: REPORT_BATCH2_EVENTS.RECOVER,
      data: recoverEvents[0]!.data,
      adapter_invocation_id: randomUUID(),
    });

    const after = await loadJob(report_id, gen.value.generation_id);
    assert.equal(
      after.value!.page_states.find((s) => s.page_id === page_id)?.outcome,
      "completed",
      "completed/authority page must not regress to running",
    );
    console.log(
      "D-T4 ok — tick dispatch fail → RECOVER; completed page intact",
    );
  }

  // --- D-T5: Recovery via invokeBatch2HandlerAdapter (same Handler) ---
  {
    await cleanup();
    const report_id = "rpt_ud_t5";
    const generation_id = "g_ud_t5";
    const captured: CapturedEvent[] = [];
    let orchestrateAttempts = 0;
    setReportBatch2EventSenderForTests({
      send: async (events) => {
        for (const e of events) {
          captured.push({ name: e.name, data: e.data });
          if (e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE) {
            orchestrateAttempts += 1;
            if (orchestrateAttempts === 1) {
              return {
                ok: false,
                code: "inngest_send_failed",
                detail: "t5_orch_fail",
              };
            }
          }
        }
        return { ok: true };
      },
    });
    const started = await startReportBatch2Production({
      report_id,
      generation_id,
      locale: "en",
      inputs: inputs(report_id),
    });
    assert.ok(started.ok);
    const recover = captured.find((e) => e.name === REPORT_BATCH2_EVENTS.RECOVER);
    assert.ok(recover);

    resetBatch2InvocationRecords();
    const result = await invokeBatch2HandlerAdapter({
      name: REPORT_BATCH2_EVENTS.RECOVER,
      data: recover!.data,
      adapter_invocation_id: randomUUID(),
    });
    assert.ok((result as { actions?: unknown[] }).actions);
    assert.ok(
      (result as { actions: { kind: string }[] }).actions.some(
        (a) => a.kind === "resend_intent" || a.kind === "dispatch_ready",
      ),
    );
    console.log(
      "D-T5 ok — RECOVER routes through report-page-recovery adapter Handler",
    );
  }

  // --- D-T6: Recovery internal dispatch fail throws (retryable Error) ---
  {
    await cleanup();
    const report_id = "rpt_ud_t6";
    const generation_id = "g_ud_t6";
    const captured: CapturedEvent[] = [];
    let orchestrateAttempts = 0;

    setReportBatch2EventSenderForTests({
      send: async (events) => {
        for (const e of events) {
          captured.push({ name: e.name, data: e.data });
          if (e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE) {
            orchestrateAttempts += 1;
            // First production send fails → RECOVER trigger.
            if (orchestrateAttempts === 1) {
              return {
                ok: false,
                code: "inngest_send_failed",
                detail: "t6_initial_orch_fail",
              };
            }
            // Recovery resend also fails once.
            if (orchestrateAttempts === 2) {
              return {
                ok: false,
                code: "inngest_send_failed",
                detail: "t6_recovery_resend_fail",
              };
            }
          }
        }
        return { ok: true };
      },
    });

    const started = await startReportBatch2Production({
      report_id,
      generation_id,
      locale: "en",
      inputs: inputs(report_id),
    });
    assert.ok(started.ok);
    const recover = captured.find((e) => e.name === REPORT_BATCH2_EVENTS.RECOVER);
    assert.ok(recover);

    await assert.rejects(
      () =>
        runReportPageRecoveryInngestStep({
          event: { data: recover!.data },
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err instanceof NonRetriableError, false);
        assert.match(err.message, /batch3_recovery_failed/);
        assert.match(err.message, /dispatch_failed|t6_recovery_resend_fail/);
        return true;
      },
    );

    const intentsFailed = await listPendingIntents({
      report_id,
      generation_id,
    });
    assert.ok(intentsFailed.ok);
    assert.ok(
      intentsFailed.value!.some((i) => i.status === "failed"),
      "Intent failure state retained after Recovery dispatch fail",
    );

    // Retry path: sender succeeds → Recovery completes.
    setReportBatch2EventSenderForTests({
      send: async () => ({ ok: true }),
    });
    const second = await runReportPageRecoveryInngestStep({
      event: { data: recover!.data },
    });
    assert.ok(!("skipped" in second && second.skipped));
    assert.ok(
      (second as { actions: { kind: string }[] }).actions.some(
        (a) => a.kind === "resend_intent",
      ),
    );
    const intentsAfter = await listPendingIntents({
      report_id,
      generation_id,
    });
    assert.ok(intentsAfter.ok);
    assert.equal(
      intentsAfter.value!.filter((i) => i.status === "failed").length,
      0,
    );
    console.log(
      "D-T6 ok — Recovery dispatch fail throws Error; retry succeeds",
    );
  }

  console.log("UNIT_D_RECOVERY_TRIGGER: PASS");
  console.log("REDIS_INTEGRATION: NOT_VERIFIED");
  console.log(
    "INNGEST_PLATFORM_RETRY: NOT_VERIFIED (local adapter ≠ platform retry)",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
