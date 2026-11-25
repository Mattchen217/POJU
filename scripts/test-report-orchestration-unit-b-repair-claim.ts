/**
 * Unit B — Ordinary-page Generate → Repair Claim conflict (Batch3 epoch).
 * Run: pnpm exec tsx scripts/test-report-orchestration-unit-b-repair-claim.ts
 *
 * Proves:
 * 1. Generate success Commit path still works (no handoff).
 * 2. Generate Claim → handoff → Repair Claim succeeds.
 * 3. Without handoff, Repair Claim is task_conflict (checks not relaxed).
 * 4. After Repair Claim, stale Generate Attempt cannot Authority-Commit.
 * 5. Repair failAndRelease leaves Task failed + Fence open (no permanent claim).
 * 6. Finalization lock blocks Generate→Repair handoff.
 * 7. Worker: validator/parse fail → needs_repair + Generate Fence released.
 * 8. Worker: Repair fail clears Fence (no permanent claimed).
 *
 * MEMORY_KV only. Does not claim Redis Integration PASS.
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createJob,
  loadJob,
  resetBatch2JobStoreForTests,
  runReportPageGenerateOnce,
  runReportPageRepairOnce,
  setBatch2ModelInvokeForTests,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import {
  activateGeneration,
  allocateGeneration,
  casSet,
  claimPageExecution,
  commitPageResult,
  ensurePageFence,
  finalizationClaimKey,
  readAuthorityPageOutput,
  readPageFence,
  readTask,
  releasePageClaimForHandoff,
  failAndReleasePageClaim,
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

function baseDc(): DecisionContext {
  return {
    context_id: "dc_unit_b_repair",
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
    cfp_hash: "cfp_unit_b",
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
        source_version: "cfp_unit_b",
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

async function claimGenerate(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
  page_id: ReportPageId,
  input_fingerprint: string,
) {
  await ensurePageFence({
    report_id,
    generation_id,
    generation_epoch,
    page_id,
  });
  const claimed = await fenceAndClaimPageTask({
    report_id,
    generation_id,
    generation_epoch,
    page_id,
    task_type: "generate",
    input_fingerprint,
    upstream_output_fingerprints: {},
    worker_id: "w_gen",
  });
  assert.ok(claimed.ok, JSON.stringify(claimed));
  if (!claimed.ok) throw new Error("claim generate");
  return claimed.value;
}

async function main(): Promise<void> {
  console.log("=== Unit B — Generate → Repair Claim (Batch3 epoch) ===");

  // --- B1. Generate Commit success (no handoff) ---
  {
    await cleanup();
    const report_id = "rpt_ub_b1";
    const gen = await boot(report_id, "g_ub_b1");
    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    const input_fingerprint = "fp_b1";
    const claimed = await claimGenerate(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      page_id,
      input_fingerprint,
    );
    const out = { page: "01", body: "generate_ok" };
    const fp = hashCanonicalPayload(out);
    const committed = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      attempt_id: claimed.attempt_id,
      task_key: claimed.task_key,
      output: out,
      output_fingerprint: fp,
      state_patch: { outcome: "completed", input_fingerprint },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint,
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: fp,
        attempt_id: claimed.attempt_id,
        task_key: claimed.task_key,
        validity_rev: claimed.validity_rev,
      },
    });
    assert.ok(committed.ok, JSON.stringify(committed));
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "committed");
    const auth = await readAuthorityPageOutput(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.ok(auth.ok && auth.value);
    console.log("B1 ok — Generate Authority Commit unchanged");
  }

  // --- B2. Without handoff, Repair Claim = task_conflict ---
  {
    await cleanup();
    const report_id = "rpt_ub_b2";
    const gen = await boot(report_id, "g_ub_b2");
    const page_id: ReportPageId = "01";
    const genClaim = await claimGenerate(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      page_id,
      "fp_b2",
    );
    const repair = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "repair",
      input_fingerprint: "fp_b2",
      upstream_output_fingerprints: {},
      worker_id: "w_repair",
    });
    assert.equal(repair.ok, false);
    assert.equal(repair.ok ? "" : repair.code, "task_conflict");
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.task_key, genClaim.task_key);
    console.log("B2 ok — Repair blocked while Generate holds Fence");
  }

  // --- B3. Handoff → Repair Claim → Authority Commit; stale Generate blocked ---
  {
    await cleanup();
    const report_id = "rpt_ub_b3";
    const gen = await boot(report_id, "g_ub_b3");
    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    const input_fingerprint = "fp_b3";
    const genClaim = await claimGenerate(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      page_id,
      input_fingerprint,
    );

    const handed = await releasePageClaimForHandoff({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_key: genClaim.task_key,
      attempt_id: genClaim.attempt_id,
    });
    assert.ok(handed.ok, JSON.stringify(handed));
    const fenceOpen = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fenceOpen.value?.status, "open");
    assert.equal(fenceOpen.value?.task_key, null);
    const genTask = await readTask(
      report_id,
      gen.generation_id,
      genClaim.task_key,
    );
    assert.equal(genTask.value?.status, "completed");

    const repairClaim = await fenceAndClaimPageTask({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "repair",
      input_fingerprint,
      upstream_output_fingerprints: {},
      worker_id: "w_repair",
    });
    assert.ok(repairClaim.ok, JSON.stringify(repairClaim));
    if (!repairClaim.ok) throw new Error("repair claim");
    assert.notEqual(repairClaim.value.task_key, genClaim.task_key);

    const out = { page: "01", body: "repair_ok" };
    const fp = hashCanonicalPayload(out);
    const committed = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      attempt_id: repairClaim.value.attempt_id,
      task_key: repairClaim.value.task_key,
      output: out,
      output_fingerprint: fp,
      state_patch: { outcome: "completed", input_fingerprint },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint,
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: fp,
        attempt_id: repairClaim.value.attempt_id,
        task_key: repairClaim.value.task_key,
        validity_rev: repairClaim.value.validity_rev,
      },
    });
    assert.ok(committed.ok, JSON.stringify(committed));
    const auth = await readAuthorityPageOutput(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.equal(
      auth.ok && auth.value
        ? hashCanonicalPayload(auth.value.output)
        : "",
      fp,
    );

    // Stale Generate Attempt must not overwrite Repair Authority.
    const stale = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      attempt_id: genClaim.attempt_id,
      task_key: genClaim.task_key,
      output: { page: "01", body: "stale_generate" },
      output_fingerprint: hashCanonicalPayload({
        page: "01",
        body: "stale_generate",
      }),
      state_patch: { outcome: "completed", input_fingerprint },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint,
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: hashCanonicalPayload({
          page: "01",
          body: "stale_generate",
        }),
        attempt_id: genClaim.attempt_id,
        task_key: genClaim.task_key,
        validity_rev: genClaim.validity_rev,
      },
    });
    assert.equal(stale.ok, false);
    const authAfter = await readAuthorityPageOutput(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.equal(
      authAfter.ok && authAfter.value
        ? hashCanonicalPayload(authAfter.value.output)
        : "",
      fp,
    );
    console.log(
      "B3 ok — handoff → Repair Claim → Authority Commit; stale Generate blocked",
    );
  }

  // --- B4. Repair failAndRelease: no permanent claimed Fence ---
  {
    await cleanup();
    const report_id = "rpt_ub_b4";
    const gen = await boot(report_id, "g_ub_b4");
    const page_id: ReportPageId = "01";
    const genClaim = await claimGenerate(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      page_id,
      "fp_b4",
    );
    assert.ok(
      (
        await releasePageClaimForHandoff({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          page_id,
          task_key: genClaim.task_key,
          attempt_id: genClaim.attempt_id,
        })
      ).ok,
    );
    const repairClaim = await fenceAndClaimPageTask({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "repair",
      input_fingerprint: "fp_b4",
      upstream_output_fingerprints: {},
      worker_id: "w_repair_fail",
    });
    assert.ok(repairClaim.ok);
    if (!repairClaim.ok) throw new Error("repair claim");

    const released = await failAndReleasePageClaim({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_key: repairClaim.value.task_key,
      attempt_id: repairClaim.value.attempt_id,
      detail: "repair_validation_failed: mock",
    });
    assert.ok(released.ok, JSON.stringify(released));
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "open");
    assert.equal(fence.value?.task_key, null);
    const task = await readTask(
      report_id,
      gen.generation_id,
      repairClaim.value.task_key,
    );
    assert.equal(task.value?.status, "failed");
    assert.match(task.value?.failure_detail ?? "", /repair_validation_failed/);
    console.log("B4 ok — Repair fail releases Fence; Task failed");
  }

  // --- B5. Finalization lock blocks handoff ---
  {
    await cleanup();
    const report_id = "rpt_ub_b5";
    const gen = await boot(report_id, "g_ub_b5");
    const page_id: ReportPageId = "01";
    const genClaim = await claimGenerate(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      page_id,
      "fp_b5",
    );
    const cKey = finalizationClaimKey(report_id, gen.generation_id);
    const lockDoc = {
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      status: "sealed",
      sealed_at: new Date().toISOString(),
      input_fingerprint: "ifp",
      pages: [],
    };
    assert.ok((await casSet(cKey, null, lockDoc)).ok);

    const handed = await releasePageClaimForHandoff({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_key: genClaim.task_key,
      attempt_id: genClaim.attempt_id,
    });
    assert.equal(handed.ok, false);
    assert.equal(handed.ok ? "" : handed.code, "finalization_locked");
    const task = await readTask(
      report_id,
      gen.generation_id,
      genClaim.task_key,
    );
    assert.equal(task.value?.status, "running");
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "claimed");
    assert.equal(fence.value?.task_key, genClaim.task_key);
    console.log("B5 ok — finalization lock blocks Generate→Repair handoff");
  }

  // --- B6. Worker: parse fail → needs_repair + Generate Fence released ---
  {
    await cleanup();
    const report_id = "rpt_ub_b6";
    const gen = await boot(report_id, "g_ub_b6");
    const page_id: ReportPageId = "01";
    setBatch2ModelInvokeForTests(async (input) => ({
      content: "{ not-valid-json",
      tokens_used: 1,
      model_call_id: `mc_${input.call_kind}`,
    }));

    // Compute fingerprint the same way the worker will.
    const job0 = await loadJob(report_id, gen.generation_id);
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

    // Mark page queued so generate runs.
    const { updatePageState, saveJob } = await import(
      "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store"
    );
    updatePageState(job0.value!, page_id, { outcome: "queued" });
    assert.ok((await saveJob(job0.value!)).ok);

    const result = await runReportPageGenerateOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fp.result.fingerprint,
        upstream_output_fingerprints: {},
      },
      invocation_id: randomUUID(),
      worker_id: "w_ub_b6",
    });
    assert.equal(result.status, "needs_repair", JSON.stringify(result));

    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "open");
    assert.equal(fence.value?.task_key, null);

    const job1 = await loadJob(report_id, gen.generation_id);
    assert.ok(job1.ok && job1.value);
    assert.ok(job1.value!.repair_pending[page_id]);
    const pageState = job1.value!.page_states.find((s) => s.page_id === page_id);
    assert.equal(pageState?.outcome, "repair_queued");

    // Repair Claim must succeed after worker handoff.
    const repairClaim = await fenceAndClaimPageTask({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "repair",
      input_fingerprint: fp.result.fingerprint,
      upstream_output_fingerprints: {},
      worker_id: "w_ub_b6_repair",
    });
    assert.ok(repairClaim.ok, JSON.stringify(repairClaim));
    console.log("B6 ok — worker Generate→Repair handoff + Repair Claim");
  }

  // --- B7. Worker: Repair fail clears claimed Fence ---
  {
    await cleanup();
    const report_id = "rpt_ub_b7";
    const gen = await boot(report_id, "g_ub_b7");
    const page_id: ReportPageId = "01";

    // Seed repair_pending via generate handoff path.
    setBatch2ModelInvokeForTests(async () => ({
      content: "{ broken",
      tokens_used: 1,
      model_call_id: "mc_gen",
    }));
    const job0 = await loadJob(report_id, gen.generation_id);
    assert.ok(job0.ok && job0.value);
    const { buildPageProductionPrep, computePageInputFingerprintForJob } =
      await import(
        "@/lib/llm/pro/delivery/decision-report-v2/batch2/page-prep"
      );
    const prep = buildPageProductionPrep(job0.value!, page_id);
    assert.equal(prep.build_fail, undefined);
    const fp = computePageInputFingerprintForJob(job0.value!, page_id, prep);
    assert.ok(fp.ok);
    if (!fp.ok) throw new Error("fp");
    const { updatePageState, saveJob } = await import(
      "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store"
    );
    updatePageState(job0.value!, page_id, { outcome: "queued" });
    assert.ok((await saveJob(job0.value!)).ok);
    const genResult = await runReportPageGenerateOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fp.result.fingerprint,
        upstream_output_fingerprints: {},
      },
      invocation_id: randomUUID(),
      worker_id: "w_ub_b7_gen",
    });
    assert.equal(genResult.status, "needs_repair");

    // Repair still returns invalid JSON → failAndRelease.
    setBatch2ModelInvokeForTests(async () => ({
      content: "{ still-broken",
      tokens_used: 1,
      model_call_id: "mc_repair",
    }));
    const repairResult = await runReportPageRepairOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fp.result.fingerprint,
      },
      invocation_id: randomUUID(),
      worker_id: "w_ub_b7_repair",
    });
    assert.equal(repairResult.status, "failed");
    assert.equal(
      repairResult.status === "failed" ? repairResult.code : "",
      "repair_json_parse_failed",
    );

    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "open");
    assert.equal(fence.value?.task_key, null);

    const job1 = await loadJob(report_id, gen.generation_id);
    assert.ok(job1.ok && job1.value);
    const pageState = job1.value!.page_states.find((s) => s.page_id === page_id);
    assert.equal(pageState?.outcome, "failed");
    assert.equal(job1.value!.repair_pending[page_id], undefined);
    console.log("B7 ok — worker Repair fail clears Fence + explicit failed");
  }

  // --- B7b. R1: failAndRelease fails → keep Pending, do not save failed ---
  {
    await cleanup();
    const report_id = "rpt_ub_b7b";
    const gen = await boot(report_id, "g_ub_b7b");
    const page_id: ReportPageId = "01";

    setBatch2ModelInvokeForTests(async () => ({
      content: "{ broken",
      tokens_used: 1,
      model_call_id: "mc_gen_b7b",
    }));
    const job0 = await loadJob(report_id, gen.generation_id);
    assert.ok(job0.ok && job0.value);
    const { buildPageProductionPrep, computePageInputFingerprintForJob } =
      await import(
        "@/lib/llm/pro/delivery/decision-report-v2/batch2/page-prep"
      );
    const prep = buildPageProductionPrep(job0.value!, page_id);
    assert.equal(prep.build_fail, undefined);
    const fp = computePageInputFingerprintForJob(job0.value!, page_id, prep);
    assert.ok(fp.ok);
    if (!fp.ok) throw new Error("fp");
    const { updatePageState, saveJob } = await import(
      "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store"
    );
    updatePageState(job0.value!, page_id, { outcome: "queued" });
    assert.ok((await saveJob(job0.value!)).ok);
    assert.equal(
      (
        await runReportPageGenerateOnce({
          event: {
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id,
            locale: "en",
            input_fingerprint: fp.result.fingerprint,
            upstream_output_fingerprints: {},
          },
          invocation_id: randomUUID(),
          worker_id: "w_ub_b7b_gen",
        })
      ).status,
      "needs_repair",
    );

    const pendingBefore = await loadJob(report_id, gen.generation_id);
    assert.ok(pendingBefore.ok && pendingBefore.value?.repair_pending[page_id]);

    // After Repair Claim (before failAndRelease): seal Finalization so release fails.
    // Model invoke runs after Claim — inject lock here, then return invalid JSON.
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
              input_fingerprint: "ifp_b7b",
              pages: [],
            })
          ).ok,
        );
      }
      return {
        content: "{ still-broken",
        tokens_used: 1,
        model_call_id: "mc_repair_b7b",
      };
    });

    const repairResult = await runReportPageRepairOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fp.result.fingerprint,
      },
      invocation_id: randomUUID(),
      worker_id: "w_ub_b7b_repair",
    });
    assert.equal(repairResult.status, "failed");
    assert.equal(
      repairResult.status === "failed" ? repairResult.code : "",
      "finalization_locked",
    );
    assert.match(
      repairResult.status === "failed" ? repairResult.detail : "",
      /fail_release_failed/,
    );
    assert.doesNotMatch(
      repairResult.status === "failed" ? repairResult.code : "",
      /repair_json_parse_failed/,
    );

    const jobAfter = await loadJob(report_id, gen.generation_id);
    assert.ok(jobAfter.ok && jobAfter.value);
    assert.ok(
      jobAfter.value!.repair_pending[page_id],
      "repair_pending must survive release failure",
    );
    const pageState = jobAfter.value!.page_states.find(
      (s) => s.page_id === page_id,
    );
    assert.notEqual(pageState?.outcome, "failed");

    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "claimed");
    assert.ok(fence.value?.task_key);
    const repairTask = await readTask(
      report_id,
      gen.generation_id,
      fence.value!.task_key!,
    );
    assert.equal(repairTask.value?.status, "running");
    assert.equal(repairTask.value?.task_type, "repair");
    console.log(
      "B7b ok — failAndRelease failure keeps Pending + claimed Fence",
    );
  }

  // --- B8. Worker: Generate fail → Repair Worker Validator + Authority Commit ---
  {
    await cleanup();
    const report_id = "rpt_ub_b8";
    const gen = await boot(report_id, "g_ub_b8");
    const page_id: ReportPageId = "01";

    setBatch2ModelInvokeForTests(async () => ({
      content: "{ broken-generate",
      tokens_used: 1,
      model_call_id: "mc_gen_b8",
    }));
    const job0 = await loadJob(report_id, gen.generation_id);
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

    const genResult = await runReportPageGenerateOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fp.result.fingerprint,
        upstream_output_fingerprints: {},
      },
      invocation_id: randomUUID(),
      worker_id: "w_ub_b8_gen",
    });
    assert.equal(genResult.status, "needs_repair", JSON.stringify(genResult));

    const jobPending = await loadJob(report_id, gen.generation_id);
    assert.ok(jobPending.ok && jobPending.value);
    assert.ok(jobPending.value!.repair_pending[page_id]);
    assert.equal(
      jobPending.value!.page_states.find((s) => s.page_id === page_id)?.outcome,
      "repair_queued",
    );

    // Build a Validator-passing Face01 payload from the same production ctx.
    const { validateFace01ProductionOutput } = await import(
      "@/lib/llm/pro/delivery/decision-report-v2/page01/production"
    );
    type Face01Ctx = import("@/lib/llm/pro/delivery/decision-report-v2/page01/production").Face01ProductionContext;
    const ctx = prep.ctx as Face01Ctx;
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
    const validated = validateFace01ProductionOutput({
      raw: validRaw,
      locale: "en",
      ctx,
    });
    assert.ok(validated.ok, JSON.stringify(validated));
    if (!validated.ok) throw new Error("validRaw must pass Face01 validator");
    const repairFp = hashCanonicalPayload(validated.page);

    setBatch2ModelInvokeForTests(async () => ({
      content: JSON.stringify(validRaw),
      tokens_used: 2,
      model_call_id: "mc_repair_b8",
    }));

    const repairResult = await runReportPageRepairOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: fp.result.fingerprint,
      },
      invocation_id: randomUUID(),
      worker_id: "w_ub_b8_repair",
    });
    assert.equal(
      repairResult.status,
      "completed",
      JSON.stringify(repairResult),
    );

    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "committed");

    const auth = await readAuthorityPageOutput(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.ok(auth.ok && auth.value);
    assert.equal(hashCanonicalPayload(auth.value!.output), repairFp);

    const jobDone = await loadJob(report_id, gen.generation_id);
    assert.ok(jobDone.ok && jobDone.value);
    assert.equal(jobDone.value!.repair_pending[page_id], undefined);
    assert.equal(
      jobDone.value!.page_states.find((s) => s.page_id === page_id)?.outcome,
      "completed",
    );
    console.log(
      "B8 ok — Repair Worker Validator + Authority Commit closed loop",
    );
  }

  // --- B9. R1: repair_queued persisted, Generate still holds Fence → resume handoff ---
  {
    await cleanup();
    const report_id = "rpt_ub_b9";
    const gen = await boot(report_id, "g_ub_b9");
    const page_id: ReportPageId = "01";
    const genClaim = await claimGenerate(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      page_id,
      "fp_b9",
    );

    const job0 = await loadJob(report_id, gen.generation_id);
    assert.ok(job0.ok && job0.value);
    const { setRepairPending, updatePageState, saveJob } = await import(
      "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store"
    );
    setRepairPending(job0.value!, page_id, {
      page_id,
      system: "s",
      user: "u",
      previous_raw: "{ bad",
      issues: [{ code: "json_parse_failed", detail: "x" }],
      input_fingerprint: "fp_b9",
      locale: "en",
      validator_version: "v",
      production_version: "v",
      prompt_version: "v",
    });
    updatePageState(job0.value!, page_id, { outcome: "repair_queued" });
    assert.ok((await saveJob(job0.value!)).ok);

    // Fence still claimed by Generate — simulate crash after Pending save.
    const fenceBefore = await readPageFence(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.equal(fenceBefore.value?.status, "claimed");
    assert.equal(fenceBefore.value?.task_key, genClaim.task_key);

    const resumed = await runReportPageGenerateOnce({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        locale: "en",
        input_fingerprint: "fp_b9",
        upstream_output_fingerprints: {},
      },
      invocation_id: randomUUID(),
      worker_id: "w_ub_b9_resume",
    });
    assert.equal(resumed.status, "needs_repair", JSON.stringify(resumed));

    const fenceAfter = await readPageFence(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.equal(fenceAfter.value?.status, "open");
    assert.equal(fenceAfter.value?.task_key, null);

    const genTask = await readTask(
      report_id,
      gen.generation_id,
      genClaim.task_key,
    );
    assert.equal(genTask.value?.status, "completed");

    // Must not re-claim the completed Generate Task.
    const reclaim = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint: "fp_b9",
      upstream_output_fingerprints: {},
      worker_id: "w_ub_b9_reclaim",
    });
    assert.equal(reclaim.ok, false);
    assert.equal(reclaim.ok ? "" : reclaim.code, "already_completed");

    const repairClaim = await fenceAndClaimPageTask({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "repair",
      input_fingerprint: "fp_b9",
      upstream_output_fingerprints: {},
      worker_id: "w_ub_b9_repair",
    });
    assert.ok(repairClaim.ok, JSON.stringify(repairClaim));
    console.log("B9 ok — resume handoff after repair_queued without re-claim");
  }

  console.log("UNIT_B_REPAIR_CLAIM: PASS");
  console.log("REDIS_INTEGRATION: NOT_VERIFIED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
