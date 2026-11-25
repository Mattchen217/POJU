/**
 * Unit C — Worker Failure Synchronization & Inngest Retry (Batch3 epoch).
 * Run: pnpm exec tsx scripts/test-report-orchestration-unit-c-worker-failure.ts
 *
 * MEMORY_KV only. Does not claim Redis Integration PASS.
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NonRetriableError } from "inngest";

import {
  createJob,
  handleGenerateEvent,
  handleRepairEvent,
  loadJob,
  resetBatch2JobStoreForTests,
  runReportPageGenerateOnce,
  runReportPageRepairOnce,
  setBatch2ModelInvokeForTests,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import {
  setAfterGenerateModelHookForTests,
  setQueueRepairSaveJobFailForTests,
  setValidatePageOutputHookForTests,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2/page-generate";
import { reportPageGenerate } from "@/lib/inngest/functions/report-page-generate";
import { reportPageRepair } from "@/lib/inngest/functions/report-page-repair";
import {
  activateGeneration,
  allocateGeneration,
  casSet,
  computeTaskKey,
  ensurePageFence,
  finalizationClaimKey,
  readAuthorityPageOutput,
  readPageFence,
  readTask,
  resetBatch3KeysForTests,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import {
  hashCanonicalPayload,
  reportPageDefinition,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ReportPageId } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_unit_c_worker",
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
    cfp_hash: "cfp_unit_c",
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
        source_version: "cfp_unit_c",
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
  setAfterGenerateModelHookForTests(null);
  setValidatePageOutputHookForTests(null);
  setQueueRepairSaveJobFailForTests(null);
}

async function boot(report_id: string, generation_id: string) {
  const gen = await allocateGeneration({
    report_id,
    locale: "en",
    generation_id,
  });
  assert.ok(gen.ok);
  if (!gen.ok) throw new Error("allocate");
  await activateGeneration({ record: gen.value, job_id: report_id });
  await createJob({
    report_id,
    generation_id: gen.value.generation_id,
    locale: "en",
    inputs: inputs(report_id),
    generation_epoch: gen.value.generation_epoch,
  });
  return gen.value;
}

async function prepGenerate(report_id: string, generation_id: string) {
  const page_id: ReportPageId = "01";
  const job0 = await loadJob(report_id, generation_id);
  assert.ok(job0.ok && job0.value);
  const { buildPageProductionPrep, computePageInputFingerprintForJob } =
    await import(
      "@/lib/llm/pro/delivery/decision-report-v2/batch2/page-prep"
    );
  const prep = buildPageProductionPrep(job0.value!, page_id);
  assert.equal(prep.build_fail, undefined, JSON.stringify(prep));
  const fp = computePageInputFingerprintForJob(job0.value!, page_id, prep);
  assert.ok(fp.ok, JSON.stringify(fp));
  if (!fp.ok) throw new Error("fp");
  const { updatePageState, saveJob } = await import(
    "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store"
  );
  updatePageState(job0.value!, page_id, { outcome: "queued" });
  assert.ok((await saveJob(job0.value!)).ok);
  return {
    page_id,
    fingerprint: fp.result.fingerprint,
    prep,
  };
}

function generateTaskKey(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  input_fingerprint: string;
}): string {
  const def = reportPageDefinition(input.page_id);
  return computeTaskKey({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    validity_rev: 0,
    input_fingerprint: input.input_fingerprint,
    upstream_output_fingerprints: {},
    page_contract_version: def.production_version,
    prompt_version: def.prompt_version,
    validator_version: def.validator_version,
    task_type: "generate",
  });
}

async function main(): Promise<void> {
  console.log("=== Unit C — Worker Failure Sync & Inngest Retry ===");

  // Config: registered Functions declare retries > 0
  {
    const genOpts = (reportPageGenerate as { opts?: { retries?: number } }).opts;
    const repairOpts = (reportPageRepair as { opts?: { retries?: number } }).opts;
    assert.equal(genOpts?.retries, 2, "generate retries");
    assert.equal(repairOpts?.retries, 2, "repair retries");
    console.log("C0 ok — Inngest generate/repair retries=2");
  }

  // --- C-T1: Generate model invoke exception → failAndRelease ---
  {
    await cleanup();
    const report_id = "rpt_uc_t1";
    const gen = await boot(report_id, "g_uc_t1");
    const { page_id, fingerprint } = await prepGenerate(
      report_id,
      gen.generation_id,
    );
    setBatch2ModelInvokeForTests(async () => {
      throw new Error("llm_timeout_simulated");
    });

    const result = await runReportPageGenerateOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fingerprint,
        upstream_output_fingerprints: {},
      },
      invocation_id: randomUUID(),
      worker_id: "w_uc_t1",
    });
    assert.equal(result.status, "failed");
    assert.equal(result.status === "failed" ? result.code : "", "model_invoke_error");
    assert.equal(result.status === "failed" ? result.retryable : false, true);

    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "open");
    assert.equal(fence.value?.task_key, null);

    const task_key = generateTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      input_fingerprint: fingerprint,
    });
    const task = await readTask(report_id, gen.generation_id, task_key);
    assert.equal(task.value?.status, "failed");

    const job = await loadJob(report_id, gen.generation_id);
    assert.ok(job.ok && job.value);
    const outcome = job.value!.page_states.find((s) => s.page_id === page_id)
      ?.outcome;
    // Retryable: Batch2 stays running so Inngest retry can re-enter.
    assert.equal(outcome, "running");
    console.log("C-T1 ok — model exception releases Claim; Batch2 stays running");
  }

  // --- C-T2: post-model processing exception → failAndRelease ---
  {
    await cleanup();
    const report_id = "rpt_uc_t2";
    const gen = await boot(report_id, "g_uc_t2");
    const { page_id, fingerprint } = await prepGenerate(
      report_id,
      gen.generation_id,
    );
    setBatch2ModelInvokeForTests(async () => ({
      content: JSON.stringify({ page: "01", stub: true }),
      tokens_used: 1,
      model_call_id: "mc_t2",
    }));
    setAfterGenerateModelHookForTests(() => {
      throw new Error("injected_post_process");
    });

    const result = await runReportPageGenerateOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fingerprint,
        upstream_output_fingerprints: {},
      },
      invocation_id: randomUUID(),
      worker_id: "w_uc_t2",
    });
    setAfterGenerateModelHookForTests(null);
    assert.equal(result.status, "failed");
    assert.equal(
      result.status === "failed" ? result.code : "",
      "post_process_error",
    );
    assert.equal(result.status === "failed" ? result.retryable : false, true);

    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "open");
    const task_key = generateTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      input_fingerprint: fingerprint,
    });
    const task = await readTask(report_id, gen.generation_id, task_key);
    assert.equal(task.value?.status, "failed");
    console.log("C-T2 ok — post-process exception releases Claim");
  }

  // --- C-T2b: exception inside real validatePageOutput path releases Claim ---
  {
    await cleanup();
    const report_id = "rpt_uc_t2b";
    const gen = await boot(report_id, "g_uc_t2b");
    const { page_id, fingerprint } = await prepGenerate(
      report_id,
      gen.generation_id,
    );
    // Valid-enough JSON to pass parsePageJson and enter validatePageOutput.
    setBatch2ModelInvokeForTests(async () => ({
      content: JSON.stringify({
        page: "01",
        face: "01",
        schema_version: "face01-v2",
        core_judgment: { text: "x", claim_ids: [] },
      }),
      tokens_used: 1,
      model_call_id: "mc_t2b",
    }));
    setValidatePageOutputHookForTests(() => {
      throw new Error("injected_validator_path_exception");
    });

    const result = await runReportPageGenerateOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fingerprint,
        upstream_output_fingerprints: {},
      },
      invocation_id: randomUUID(),
      worker_id: "w_uc_t2b",
    });
    setValidatePageOutputHookForTests(null);

    assert.equal(result.status, "failed");
    assert.equal(
      result.status === "failed" ? result.code : "",
      "post_process_error",
    );
    assert.match(
      result.status === "failed" ? result.detail : "",
      /injected_validator_path_exception/,
    );
    assert.equal(result.status === "failed" ? result.retryable : false, true);

    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "open");
    assert.equal(fence.value?.task_key, null);

    const task_key = generateTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      input_fingerprint: fingerprint,
    });
    const task = await readTask(report_id, gen.generation_id, task_key);
    assert.equal(task.value?.status, "failed");

    const job = await loadJob(report_id, gen.generation_id);
    assert.equal(
      job.value?.page_states.find((s) => s.page_id === page_id)?.outcome,
      "running",
    );

    // Handler must throw retryable Error (not swallow as success).
    setValidatePageOutputHookForTests(() => {
      throw new Error("injected_validator_path_exception");
    });
    await assert.rejects(
      () =>
        handleGenerateEvent({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          page_id,
          locale: "en",
          input_fingerprint: fingerprint,
          upstream_output_fingerprints: {},
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err instanceof NonRetriableError, false);
        assert.match(err.message, /post_process_error/);
        return true;
      },
    );
    setValidatePageOutputHookForTests(null);

    // Retry can obtain a new Attempt after Fence was opened.
    setBatch2ModelInvokeForTests(async () => ({
      content: "{ broken-on-retry",
      tokens_used: 1,
      model_call_id: "mc_t2b_retry",
    }));
    const retry = await runReportPageGenerateOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fingerprint,
        upstream_output_fingerprints: {},
      },
      invocation_id: randomUUID(),
      worker_id: "w_uc_t2b_retry",
    });
    assert.equal(retry.status, "needs_repair");
    const taskAfter = await readTask(report_id, gen.generation_id, task_key);
    // Generate handoff completes the generate task; Fence open for Repair.
    assert.equal(taskAfter.value?.status, "completed");
    const fenceAfter = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fenceAfter.value?.status, "open");
    console.log(
      "C-T2b ok — Validator-path throw releases Claim; handler throws; retry Claims",
    );
  }

  // --- C-T2c: Repair Pending saveJob fails → release Generate Claim (no durable Pending) ---
  {
    await cleanup();
    const report_id = "rpt_uc_t2c";
    const gen = await boot(report_id, "g_uc_t2c");
    const { page_id, fingerprint } = await prepGenerate(
      report_id,
      gen.generation_id,
    );
    setBatch2ModelInvokeForTests(async () => ({
      content: "{ not-json-triggers-repair",
      tokens_used: 1,
      model_call_id: "mc_t2c",
    }));
    setQueueRepairSaveJobFailForTests({
      code: "kv_write_failed",
      detail: "injected_queue_repair_save_fail",
    });

    const result = await runReportPageGenerateOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fingerprint,
        upstream_output_fingerprints: {},
      },
      invocation_id: randomUUID(),
      worker_id: "w_uc_t2c",
    });
    setQueueRepairSaveJobFailForTests(null);

    assert.equal(result.status, "failed");
    assert.equal(
      result.status === "failed" ? result.code : "",
      "kv_write_failed",
    );
    assert.equal(result.status === "failed" ? result.retryable : false, true);

    const job = await loadJob(report_id, gen.generation_id);
    assert.ok(job.ok && job.value);
    assert.equal(
      job.value!.repair_pending[page_id],
      undefined,
      "no durable repair_pending after save fail",
    );
    assert.equal(
      job.value!.page_states.find((s) => s.page_id === page_id)?.outcome,
      "running",
    );

    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "open");
    assert.equal(fence.value?.task_key, null);

    const task_key = generateTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      input_fingerprint: fingerprint,
    });
    const task = await readTask(report_id, gen.generation_id, task_key);
    assert.equal(task.value?.status, "failed");

    // Retry can re-claim after Fence opened (no stuck Claim).
    setBatch2ModelInvokeForTests(async () => ({
      content: "{ still-broken",
      tokens_used: 1,
      model_call_id: "mc_t2c_retry",
    }));
    const retry = await runReportPageGenerateOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fingerprint,
        upstream_output_fingerprints: {},
      },
      invocation_id: randomUUID(),
      worker_id: "w_uc_t2c_retry",
    });
    assert.equal(retry.status, "needs_repair");
    assert.ok(
      (await loadJob(report_id, gen.generation_id)).value?.repair_pending[
        page_id
      ],
    );
    console.log(
      "C-T2c ok — Pending save fail releases Claim; retry can enter Repair",
    );
  }

  // --- C-T3: Repair fail-release failure keeps Pending (Unit B regression) ---
  {
    await cleanup();
    const report_id = "rpt_uc_t3";
    const gen = await boot(report_id, "g_uc_t3");
    const { page_id, fingerprint } = await prepGenerate(
      report_id,
      gen.generation_id,
    );
    setBatch2ModelInvokeForTests(async () => ({
      content: "{ broken",
      tokens_used: 1,
      model_call_id: "mc_t3_gen",
    }));
    assert.equal(
      (
        await runReportPageGenerateOnce({
          event: {
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id,
            locale: "en",
            input_fingerprint: fingerprint,
            upstream_output_fingerprints: {},
          },
          invocation_id: randomUUID(),
          worker_id: "w_uc_t3_gen",
        })
      ).status,
      "needs_repair",
    );

    setBatch2ModelInvokeForTests(async (input) => {
      if (input.call_kind === "repair") {
        const cKey = finalizationClaimKey(report_id, gen.generation_id);
        assert.ok(
          (
            await casSet(cKey, null, {
              report_id,
              generation_id: gen.generation_id,
              generation_epoch: gen.generation_epoch,
              status: "sealed",
              sealed_at: new Date().toISOString(),
              input_fingerprint: "ifp_t3",
              pages: [],
            })
          ).ok,
        );
      }
      return {
        content: "{ still-broken",
        tokens_used: 1,
        model_call_id: "mc_t3_repair",
      };
    });

    const repair = await runReportPageRepairOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fingerprint,
      },
      invocation_id: randomUUID(),
      worker_id: "w_uc_t3_repair",
    });
    assert.equal(repair.status, "failed");
    assert.equal(repair.status === "failed" ? repair.code : "", "finalization_locked");
    assert.equal(repair.status === "failed" ? repair.retryable : true, false);

    const job = await loadJob(report_id, gen.generation_id);
    assert.ok(job.value?.repair_pending[page_id]);
    assert.notEqual(
      job.value!.page_states.find((s) => s.page_id === page_id)?.outcome,
      "failed",
    );
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "claimed");
    console.log("C-T3 ok — Repair release failure keeps Pending (Unit B)");
  }

  // --- C-T4: Inngest handler throws on retryable; retry can succeed ---
  {
    await cleanup();
    const report_id = "rpt_uc_t4";
    const gen = await boot(report_id, "g_uc_t4");
    const { page_id, fingerprint, prep } = await prepGenerate(
      report_id,
      gen.generation_id,
    );

    let calls = 0;
    setBatch2ModelInvokeForTests(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("transient_llm_blip");
      }
      // Second attempt: invalid JSON → needs_repair path is OK for claim reuse;
      // for Authority success we need valid Face01. Use validator-passing payload.
      const ctx = prep.ctx as import("@/lib/llm/pro/delivery/decision-report-v2/page01/production").Face01ProductionContext;
      const claimId =
        ctx.slice.report_analysis.key_claims[0]?.claim_id ||
        Object.keys(ctx.registry.claims)[0]!;
      const evId =
        ctx.slice.evidence_registry.evidence.find(
          (e) => e.evidence_id !== `ev_fact_${e.source_id}`,
        )?.evidence_id ||
        ctx.page02PlannedEvidenceIds[0] ||
        ctx.slice.evidence_registry.evidence[0]!.evidence_id;
      const factId = ctx.slice.reality_context.facts[0]!.fact_id;
      const validRaw = {
        page: "01",
        face: "01",
        schema_version: "face01-v2",
        page_title: "Decision",
        page_subtitle: "",
        core_judgment: {
          text: "Keep the job cash floor while exploring the offer in a bounded window.",
          claim_ids: [claimId],
        },
        why_this_path: [
          {
            text: "Runway and optionality both stay intact under a staged path.",
            claim_ids: [claimId],
            evidence_ids: [evId],
            target_page: "02",
            target_evidence_ids: [ctx.page02PlannedEvidenceIds[0] || evId],
          },
        ],
        recommendation_conditions: [
          {
            condition: "Personal runway remains near the confirmed window.",
            status: "satisfied",
            source_ids: [factId],
          },
          {
            condition: "Offer terms remain within the reviewed band.",
            status: "satisfied",
            source_ids: [
              ctx.slice.reality_context.facts[1]?.fact_id || factId,
            ],
          },
        ],
        not_recommended: [
          {
            option: "Resign immediately for the offer.",
            reason: "Burns the cash floor before terms are clear.",
            cost_or_conflict: "Loss of runway buffer.",
            claim_ids: [claimId],
            evidence_ids: [evId],
          },
        ],
        applicability_boundary: {
          current_basis: ["Confirmed runway and open equity conflict."],
          invalidation_conditions: [
            "Runway collapses or equity terms lock unfavorably.",
          ],
          page02_evidence_ids: [ctx.page02PlannedEvidenceIds[0] || evId],
          page08_review_refs: [],
        },
      };
      return {
        content: JSON.stringify(validRaw),
        tokens_used: 2,
        model_call_id: "mc_t4_ok",
      };
    });

    const event = {
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      locale: "en",
      input_fingerprint: fingerprint,
      upstream_output_fingerprints: {},
    };

    await assert.rejects(
      () => handleGenerateEvent(event),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err instanceof NonRetriableError, false);
        assert.match(err.message, /batch2_generate_failed:model_invoke_error/);
        return true;
      },
    );

    const fenceAfterFail = await readPageFence(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.equal(fenceAfterFail.value?.status, "open");
    const task_key = generateTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      input_fingerprint: fingerprint,
    });
    const failedTask = await readTask(report_id, gen.generation_id, task_key);
    assert.equal(failedTask.value?.status, "failed");
    const firstAttempt = failedTask.value?.attempt_id;

    // Simulated Inngest retry — new Claim (new attempt), no conflict with old.
    const retry = await handleGenerateEvent(event);
    assert.equal(retry.status, "completed");

    const fenceOk = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fenceOk.value?.status, "committed");
    assert.notEqual(fenceOk.value?.attempt_id, firstAttempt);

    const auth = await readAuthorityPageOutput(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.ok(auth.ok && auth.value);

    const job = await loadJob(report_id, gen.generation_id);
    assert.equal(
      job.value?.page_states.find((s) => s.page_id === page_id)?.outcome,
      "completed",
    );
    assert.equal(calls, 2);
    console.log(
      "C-T4 ok — handler throws retryable Error; retry Claims new Attempt + Commit",
    );
  }

  // --- C-T5: non-retryable scare_redline → NonRetriableError + terminal state ---
  {
    await cleanup();
    const report_id = "rpt_uc_t5";
    const gen = await boot(report_id, "g_uc_t5");
    const { page_id, fingerprint } = await prepGenerate(
      report_id,
      gen.generation_id,
    );
    // Content that trips scare redline (absolute destiny / scare language).
    setBatch2ModelInvokeForTests(async () => ({
      content: JSON.stringify({
        page: "01",
        text: "你命中注定必死无疑，立刻倾家荡产，无可挽回的绝境",
      }),
      tokens_used: 1,
      model_call_id: "mc_t5",
    }));

    const event = {
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      locale: "en",
      input_fingerprint: fingerprint,
      upstream_output_fingerprints: {},
    };

    await assert.rejects(
      () => handleGenerateEvent(event),
      (err: unknown) => {
        assert.ok(err instanceof NonRetriableError);
        assert.match(err.message, /scare_redline/);
        return true;
      },
    );

    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "open");
    const task_key = generateTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      input_fingerprint: fingerprint,
    });
    const task = await readTask(report_id, gen.generation_id, task_key);
    assert.equal(task.value?.status, "failed");

    const job = await loadJob(report_id, gen.generation_id);
    assert.equal(
      job.value?.page_states.find((s) => s.page_id === page_id)?.outcome,
      "failed",
    );

    // Failed terminal page → skipped (no throw, no re-claim).
    const second = await handleGenerateEvent(event);
    assert.equal(second.status, "skipped");
    console.log(
      "C-T5 ok — NonRetriableError for scare_redline; no leftover Claim; no re-run",
    );
  }

  // Repair handler: terminal failure uses NonRetriableError (not swallowed as ok:true)
  {
    await cleanup();
    const report_id = "rpt_uc_t5r";
    const gen = await boot(report_id, "g_uc_t5r");
    const { page_id, fingerprint } = await prepGenerate(
      report_id,
      gen.generation_id,
    );
    setBatch2ModelInvokeForTests(async () => ({
      content: "{ broken",
      tokens_used: 1,
      model_call_id: "mc_t5r_gen",
    }));
    assert.equal(
      (
        await runReportPageGenerateOnce({
          event: {
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id,
            locale: "en",
            input_fingerprint: fingerprint,
            upstream_output_fingerprints: {},
          },
          invocation_id: randomUUID(),
          worker_id: "w_uc_t5r_gen",
        })
      ).status,
      "needs_repair",
    );
    setBatch2ModelInvokeForTests(async () => ({
      content: "{ still-broken",
      tokens_used: 1,
      model_call_id: "mc_t5r_repair",
    }));
    await assert.rejects(
      () =>
        handleRepairEvent({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          page_id,
          locale: "en",
          input_fingerprint: fingerprint,
        }),
      (err: unknown) => {
        assert.ok(err instanceof NonRetriableError);
        assert.match(err.message, /repair_json_parse_failed/);
        return true;
      },
    );
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "open");
    console.log("C-T5b ok — Repair handler NonRetriableError + Fence open");
  }

  console.log("UNIT_C_WORKER_FAILURE: PASS");
  console.log("REDIS_INTEGRATION: NOT_VERIFIED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
