/**
 * Report orchestration Batch 3 — fencing, idempotency, invalidation, recovery.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3.ts
 *
 * Coverage: local KV + handler adapters. DEPLOY_ENV_PENDING for real Inngest/Vercel.
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";

import {
  REPORT_BATCH2_EVENTS,
  createJob,
  loadJob,
  resetBatch2JobStoreForTests,
  saveJob,
  saveJobPageOnlyForTests,
  setPageOutput,
  setReportBatch2EventSenderForTests,
  startReportBatch2Production,
  updatePageState,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import {
  activateGeneration,
  allocateGeneration,
  assertGenerationActive,
  claimTask,
  commitPageResult,
  computeTaskKey,
  enqueueDispatchIntent,
  ensureQueuedTask,
  ensurePageFence,
  fenceAndClaimPageTask,
  invalidateFromPage,
  listPendingIntents,
  markIntentFailed,
  readActiveGeneration,
  resetBatch3KeysForTests,
  runReportBatch3Recovery,
  writePageProvenance,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import { hashCanonicalPayload } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import { reportBatch2InngestFunctions } from "@/lib/inngest/functions/report-batch2";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3",
    version: 1,
    status: "final",
    content_hash: "h",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question: "Should I take a solo promotion and keep my runway?",
      concrete_event: "x",
      desired_outcome: "y",
      stakes: "z",
      goal_priorities: [],
      unacceptable_outcomes: [],
    },
    constraints: [],
    reality_facts: [],
    dirs: [],
    conflicts: [],
    hypotheses: [],
  } as unknown as DecisionContext;
}

function inputs(report_id: string): ReportBatch2JobInputs {
  return {
    report_id,
    dc: baseDc(),
    pack: {
      version: 1,
      locale: "en",
      cfp_hash: "c",
      zfp_hash: null,
      zfpOmitted: true,
      shot_mode: "one",
      created_at: "2026-01-01T00:00:00Z",
      units: [],
      by_face: {},
      pattern_hits_used: [],
      science_tags_used: [],
    } as unknown as BookJudgmentPack,
    chart_fact_pack: "cfp",
    bazi_available: true,
  };
}

async function cleanup(): Promise<void> {
  await resetBatch2JobStoreForTests();
  await resetBatch3KeysForTests();
  setReportBatch2EventSenderForTests(null);
}

async function main(): Promise<void> {
  console.log("=== Report orchestration Batch3 (fencing / idempotency / invalidation / recovery) ===");

  // --- A. Generation fencing ---
  {
    await cleanup();
    const report_id = "rpt_b3_fence";
    const g1 = await allocateGeneration({ report_id, locale: "en", generation_id: "gen_old" });
    assert.equal(g1.ok, true);
    if (!g1.ok) throw new Error("g1");
    const a1 = await activateGeneration({ record: g1.value, job_id: report_id });
    assert.equal(a1.ok, true);

    const g2 = await allocateGeneration({ report_id, locale: "en", generation_id: "gen_new" });
    assert.equal(g2.ok, true);
    if (!g2.ok) throw new Error("g2");
    assert.ok(g2.value.generation_epoch > g1.value.generation_epoch);

    const a2 = await activateGeneration({ record: g2.value, job_id: report_id });
    assert.equal(a2.ok, true);

    const stale = await assertGenerationActive({
      report_id,
      generation_id: g1.value.generation_id,
      generation_epoch: g1.value.generation_epoch,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.ok ? "" : stale.code, "stale_generation");

    const active = await assertGenerationActive({
      report_id,
      generation_id: g2.value.generation_id,
      generation_epoch: g2.value.generation_epoch,
    });
    assert.equal(active.ok, true);

    // Late lower-epoch activate must fail (monotonic + terminal protect)
    const steal = await activateGeneration({ record: g1.value, job_id: report_id });
    assert.equal(steal.ok, false, JSON.stringify(steal));
    assert.ok(
      !steal.ok &&
        (steal.code === "stale_generation" || steal.code === "generation_terminal"),
    );

    const stillG2 = await assertGenerationActive({
      report_id,
      generation_id: g2.value.generation_id,
      generation_epoch: g2.value.generation_epoch,
    });
    assert.equal(stillG2.ok, true);

    await createJob({
      report_id,
      generation_id: g1.value.generation_id,
      locale: "en",
      inputs: inputs(report_id),
      generation_epoch: g1.value.generation_epoch,
    });

    const lateCommit = await commitPageResult({
      report_id,
      generation_id: g1.value.generation_id,
      generation_epoch: g1.value.generation_epoch,
      page_id: "01",
      attempt_id: "att_old",
      task_key: "tk_old",
      output: { page: "01" },
      output_fingerprint: "fp_old",
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: g1.value.generation_id,
        generation_epoch: g1.value.generation_epoch,
        page_id: "01",
        input_fingerprint: "in",
        upstream_output_fingerprints: {},
        page_contract_version: "v",
        prompt_version: "p",
        validator_version: "val",
        output_fingerprint: "fp_old",
        attempt_id: "att_old",
        task_key: "tk_old",
      },
    });
    assert.equal(lateCommit.ok, false);
    assert.ok(
      !lateCommit.ok &&
        (lateCommit.code === "stale_generation" ||
          lateCommit.code === "not_found" ||
          lateCommit.code === "stale_page"),
      JSON.stringify(lateCommit),
    );
    console.log("A ok — generation fencing rejects stale commits");
  }

  // --- B. Task idempotency ---
  {
    await cleanup();
    const report_id = "rpt_b3_idem";
    const gen = await allocateGeneration({ report_id, locale: "en", generation_id: "gen_idem" });
    assert.equal(gen.ok, true);
    if (!gen.ok) throw new Error("gen");
    await activateGeneration({ record: gen.value, job_id: report_id });

    const task_key = computeTaskKey({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp_in",
      upstream_output_fingerprints: {},
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
      task_type: "generate",
    });
    const task_key2 = computeTaskKey({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp_in_other",
      upstream_output_fingerprints: {},
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
      task_type: "generate",
    });
    assert.notEqual(task_key, task_key2);

    const pageFence = await ensurePageFence({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "01",
    });
    assert.equal(pageFence.ok, true);
    if (!pageFence.ok) throw new Error("fence");

    await ensureQueuedTask({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "01",
      task_type: "generate",
      task_key,
      input_fingerprint: "fp_in",
      upstream_output_fingerprints: {},
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
    });

    const c1 = await claimTask({
      report_id,
      generation_id: gen.value.generation_id,
      task_key,
      worker_id: "w1",
      validity_rev: pageFence.value.validity_rev,
    });
    assert.equal(c1.ok, true);
    const c2 = await claimTask({
      report_id,
      generation_id: gen.value.generation_id,
      task_key,
      worker_id: "w2",
      validity_rev: pageFence.value.validity_rev,
    });
    assert.equal(c2.ok, false);
    assert.equal(c2.ok ? "" : c2.code, "already_claimed");

    // Expired lease reclaim
    const { readTask } = await import(
      "@/lib/llm/pro/delivery/decision-report-v2/batch3/task-store"
    );
    const live = await readTask(report_id, gen.value.generation_id, task_key);
    assert.ok(live.ok && live.value);
    if (live.ok && live.value) {
      const { casSet } = await import("@/lib/llm/pro/delivery/decision-report-v2/batch3/kv-cas");
      const expired = {
        ...live.value,
        lease_expires_at: new Date(Date.now() - 1000).toISOString(),
      };
      await casSet(
        `report-batch3:${report_id}:${gen.value.generation_id}:task:${task_key}`,
        JSON.stringify(live.value),
        expired,
      );
    }
    const c3 = await claimTask({
      report_id,
      generation_id: gen.value.generation_id,
      task_key,
      worker_id: "w3",
      validity_rev: pageFence.value.validity_rev,
    });
    assert.equal(c3.ok, true);
    if (!c3.ok) throw new Error("c3");
    assert.notEqual(c3.value.attempt_id, c1.ok ? c1.value.attempt_id : null);

    // Late old attempt cannot complete
    await createJob({
      report_id,
      generation_id: gen.value.generation_id,
      locale: "en",
      inputs: inputs(report_id),
      generation_epoch: gen.value.generation_epoch,
    });
    const late = await commitPageResult({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "01",
      attempt_id: c1.ok ? c1.value.attempt_id! : "x",
      task_key,
      output: { page: "01" },
      output_fingerprint: "fp",
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: gen.value.generation_id,
        generation_epoch: gen.value.generation_epoch,
        page_id: "01",
        input_fingerprint: "fp_in",
        upstream_output_fingerprints: {},
        page_contract_version: "pv",
        prompt_version: "pr",
        validator_version: "vv",
        output_fingerprint: "fp",
        attempt_id: c1.ok ? c1.value.attempt_id! : "x",
        task_key,
        validity_rev: pageFence.value.validity_rev,
      },
    });
    assert.equal(late.ok, false);
    assert.equal(late.ok ? "" : late.code, "stale_attempt");

    // Successful commit with current attempt
    const okCommit = await commitPageResult({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "01",
      attempt_id: c3.value.attempt_id!,
      task_key,
      output: { page: "01", ok: true },
      output_fingerprint: hashCanonicalPayload({ page: "01", ok: true }),
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: gen.value.generation_id,
        generation_epoch: gen.value.generation_epoch,
        page_id: "01",
        input_fingerprint: "fp_in",
        upstream_output_fingerprints: {},
        page_contract_version: "pv",
        prompt_version: "pr",
        validator_version: "vv",
        output_fingerprint: hashCanonicalPayload({ page: "01", ok: true }),
        attempt_id: c3.value.attempt_id!,
        task_key,
        validity_rev: pageFence.value.validity_rev,
      },
    });
    assert.equal(okCommit.ok, true, JSON.stringify(okCommit));

    const again = await claimTask({
      report_id,
      generation_id: gen.value.generation_id,
      task_key,
      worker_id: "w4",
    });
    assert.equal(again.ok, false);
    assert.equal(again.ok ? "" : again.code, "already_completed");
    console.log("B ok — claim / lease / late attempt / completed idempotency");
  }

  // --- C. Invalidation ---
  {
    await cleanup();
    const report_id = "rpt_b3_inv";
    const gen = await allocateGeneration({ report_id, locale: "en", generation_id: "gen_inv" });
    assert.ok(gen.ok);
    if (!gen.ok) throw new Error("gen");
    await activateGeneration({ record: gen.value, job_id: report_id });
    await createJob({
      report_id,
      generation_id: gen.value.generation_id,
      locale: "en",
      inputs: inputs(report_id),
      generation_epoch: gen.value.generation_epoch,
    });

    const job = await loadJob(report_id, gen.value.generation_id);
    assert.ok(job.ok && job.value);
    for (const page_id of ["01", "02", "04", "05"] as const) {
      const out = { page: page_id, n: 1 };
      const fp = hashCanonicalPayload(out);
      setPageOutput(job.value!, page_id, out, fp);
      updatePageState(job.value!, page_id, { outcome: "completed", output_fingerprint: fp });
      await writePageProvenance({
        report_id,
        generation_id: gen.value.generation_id,
        generation_epoch: gen.value.generation_epoch,
        page_id,
        input_fingerprint: `in_${page_id}`,
        upstream_output_fingerprints:
          page_id === "02"
            ? {} // optional Page01 not consumed
            : page_id === "04"
              ? {
                  "01": hashCanonicalPayload({ page: "01", n: 1 }),
                  "02": hashCanonicalPayload({ page: "02", n: 1 }),
                }
              : {},
        page_contract_version: "pv",
        prompt_version: "pr",
        validator_version: "vv",
        output_fingerprint: fp,
        attempt_id: "a",
        task_key: "t",
        validity_rev: 0,
        completed_at: new Date().toISOString(),
        stale: false,
      });
    }
    await saveJob(job.value!);

    const inv = await invalidateFromPage({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      source_page_id: "04",
      reason: "page04_changed",
    });
    assert.equal(inv.ok, true);
    if (!inv.ok) throw new Error("inv");
    assert.ok(inv.value.invalidated.includes("04"));
    assert.ok(inv.value.invalidated.includes("05"));

    // Page01 change: Page02 not consumed → not invalidated; Page04 is required dep
    const inv01 = await invalidateFromPage({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      source_page_id: "01",
      reason: "page01_changed",
    });
    assert.equal(inv01.ok, true);
    if (!inv01.ok) throw new Error("inv01");
    assert.ok(!inv01.value.invalidated.includes("02"), "optional unconsumed Page02 must not invalidate");
    assert.ok(inv01.value.invalidated.includes("04"));
    console.log("C ok — DAG invalidation + optional Page01 rule");
  }

  // --- D. Recovery + dispatch intent ---
  {
    await cleanup();
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    const report_id = "rpt_b3_rec";
    const started = await startReportBatch2Production({
      report_id,
      generation_id: "gen_rec",
      locale: "en",
      inputs: inputs(report_id),
    });
    assert.equal(started.ok, true, JSON.stringify(started));
    if (!started.ok) throw new Error("start");

    const active = await readActiveGeneration(report_id);
    assert.equal(active.ok, true);
    assert.ok(active.ok && active.value);

    const intent = await enqueueDispatchIntent({
      report_id,
      generation_id: started.generation_id,
      generation_epoch: started.generation_epoch!,
      event_name: REPORT_BATCH2_EVENTS.ORCHESTRATE,
      payload: {
        report_id,
        generation_id: started.generation_id,
        locale: "en",
        generation_epoch: started.generation_epoch,
      },
    });
    assert.equal(intent.ok, true);
    if (!intent.ok) throw new Error("intent");
    await markIntentFailed(intent.value, "simulated_send_fail");

    const pending = await listPendingIntents({
      report_id,
      generation_id: started.generation_id,
    });
    assert.equal(pending.ok, true);
    assert.ok(pending.ok && pending.value.length >= 1);

    const recovered = await runReportBatch3Recovery({
      report_id,
      generation_id: started.generation_id,
      generation_epoch: started.generation_epoch!,
      locale: "en",
      limit: 5,
    });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    if (!recovered.ok) throw new Error("rec");
    assert.ok(recovered.value.actions.length >= 1);

    // Superseded recovery refused
    const gNew = await allocateGeneration({
      report_id,
      locale: "en",
      generation_id: "gen_rec2",
    });
    assert.ok(gNew.ok);
    if (!gNew.ok) throw new Error("gNew");
    await activateGeneration({ record: gNew.value, job_id: report_id });
    const refuse = await runReportBatch3Recovery({
      report_id,
      generation_id: started.generation_id,
      generation_epoch: started.generation_epoch!,
    });
    assert.equal(refuse.ok, true);
    if (!refuse.ok) throw new Error("refuse");
    assert.ok(
      refuse.value.actions.some((a) => a.kind === "skipped_superseded"),
    );
    console.log("D ok — recovery + dispatch intent + superseded refuse");
  }

  // --- E. Batch2 parallel regression smoke ---
  {
    await cleanup();
    const report_id = "rpt_b3_par";
    const generation_id = "gen_par";
    await createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: inputs(report_id),
    });
    const a = await loadJob(report_id, generation_id);
    const b = await loadJob(report_id, generation_id);
    assert.ok(a.ok && b.ok);
    const o1 = { page: "01", x: 1 };
    const o2 = { page: "02", x: 2 };
    const f1 = hashCanonicalPayload(o1);
    const f2 = hashCanonicalPayload(o2);
    setPageOutput(a.value!, "01", o1, f1);
    updatePageState(a.value!, "01", { outcome: "completed", output_fingerprint: f1 });
    setPageOutput(b.value!, "02", o2, f2);
    updatePageState(b.value!, "02", { outcome: "completed", output_fingerprint: f2 });
    assert.equal((await saveJobPageOnlyForTests(a.value!, "01")).ok, true);
    assert.equal((await saveJobPageOnlyForTests(b.value!, "02")).ok, true);
    const final = await loadJob(report_id, generation_id);
    assert.ok(final.value?.page_outputs["01"]);
    assert.ok(final.value?.page_outputs["02"]);
    console.log("E ok — Page01/02 parallel page-only writes still both persist");
  }

  // --- F. Registration ---
  {
    assert.ok(reportBatch2InngestFunctions.some((fn) => fn.id() === "report-page-recovery"));
    assert.ok(reportBatch2InngestFunctions.some((fn) => fn.id() === "report-page-generate"));
    assert.ok(reportBatch2InngestFunctions.some((fn) => fn.id() === "report-page-repair"));
    console.log("F ok — recovery Function registered alongside generate/repair");
  }

  console.log("DEPLOY_ENV_PENDING: real Vercel/Inngest invocation + 300s budget not verified");
  console.log("ok report orchestration batch3");
}

main()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error(err);
    await cleanup();
    process.exit(1);
  });
