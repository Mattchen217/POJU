/**
 * Batch3 R1 — monotonic activate, atomic fenced commit, invalidation vs late commit,
 * outbox bootstrap + job_missing fail-closed.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3-r1.ts
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";

import {
  createJob,
  loadJob,
  resetBatch2JobStoreForTests,
  setReportBatch2EventSenderForTests,
  startReportBatch2Production,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import {
  activateGeneration,
  allocateGeneration,
  assertGenerationActive,
  claimTask,
  commitPageResult,
  computeTaskKey,
  ensurePageFence,
  ensureQueuedTask,
  invalidateFromPage,
  listPendingIntents,
  readActiveGeneration,
  readPageFence,
  resetBatch3KeysForTests,
  runReportBatch3Recovery,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import { hashCanonicalPayload } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3r1",
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
  console.log("=== Report orchestration Batch3 R1 ===");

  // --- 1. Monotonic activate ---
  {
    await cleanup();
    const report_id = "rpt_b3r1_act";
    const g1 = await allocateGeneration({ report_id, locale: "en", generation_id: "g1" });
    assert.ok(g1.ok);
    if (!g1.ok) throw new Error("g1");
    assert.equal(g1.value.status, "pending");
    assert.equal((await activateGeneration({ record: g1.value, job_id: report_id })).ok, true);

    const g2 = await allocateGeneration({ report_id, locale: "en", generation_id: "g2" });
    assert.ok(g2.ok && g2.value.generation_epoch > g1.value.generation_epoch);
    if (!g2.ok) throw new Error("g2");
    assert.equal((await activateGeneration({ record: g2.value, job_id: report_id })).ok, true);

    const late = await activateGeneration({ record: g1.value, job_id: report_id });
    assert.equal(late.ok, false);
    assert.ok(
      !late.ok &&
        (late.code === "stale_generation" || late.code === "generation_terminal"),
    );

    const active = await readActiveGeneration(report_id);
    assert.ok(active.ok && active.value);
    assert.equal(active.value!.generation_id, "g2");
    assert.equal(active.value!.generation_epoch, g2.value.generation_epoch);

    // Idempotent same generation activate
    const again = await activateGeneration({ record: g2.value, job_id: report_id });
    assert.equal(again.ok, true);

    // Concurrent higher-wins: allocate g3 then race g2 (lower) after g3 pending
    const g3 = await allocateGeneration({ report_id, locale: "en", generation_id: "g3" });
    assert.ok(g3.ok);
    if (!g3.ok) throw new Error("g3");
    const [r3, r2] = await Promise.all([
      activateGeneration({ record: g3.value, job_id: report_id }),
      activateGeneration({ record: g2.value, job_id: report_id }),
    ]);
    assert.equal(r3.ok, true);
    assert.equal(r2.ok, false);
    const final = await readActiveGeneration(report_id);
    assert.equal(final.ok && final.value?.generation_id, "g3");
    console.log("R1-1 ok — monotonic activate + concurrent higher-wins");
  }

  // --- 2+3. Atomic commit vs invalidation race ---
  {
    await cleanup();
    const report_id = "rpt_b3r1_commit";
    const gen = await allocateGeneration({ report_id, locale: "en", generation_id: "gen_c" });
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

    const fence = await ensurePageFence({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "05",
    });
    assert.ok(fence.ok);
    if (!fence.ok) throw new Error("fence");

    const task_key = computeTaskKey({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "05",
      input_fingerprint: "fp05",
      upstream_output_fingerprints: { "04": "up04" },
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
      task_type: "generate",
    });
    await ensureQueuedTask({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "05",
      task_type: "generate",
      task_key,
      input_fingerprint: "fp05",
      upstream_output_fingerprints: { "04": "up04" },
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
    });
    const claimed = await claimTask({
      report_id,
      generation_id: gen.value.generation_id,
      task_key,
      worker_id: "w05",
      validity_rev: fence.value.validity_rev,
    });
    assert.equal(claimed.ok, true);
    if (!claimed.ok) throw new Error("claim");

    // Invalidate Page05 (as if Page04 changed) while worker still holds claim
    const inv = await invalidateFromPage({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      source_page_id: "05",
      reason: "simulate_upstream_change",
    });
    assert.equal(inv.ok, true, JSON.stringify(inv));

    const late = await commitPageResult({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "05",
      attempt_id: claimed.value.attempt_id!,
      task_key,
      output: { page: "05", stale_write: true },
      output_fingerprint: hashCanonicalPayload({ page: "05", stale_write: true }),
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: gen.value.generation_id,
        generation_epoch: gen.value.generation_epoch,
        page_id: "05",
        input_fingerprint: "fp05",
        upstream_output_fingerprints: { "04": "up04" },
        page_contract_version: "pv",
        prompt_version: "pr",
        validator_version: "vv",
        output_fingerprint: hashCanonicalPayload({ page: "05", stale_write: true }),
        attempt_id: claimed.value.attempt_id!,
        task_key,
        validity_rev: fence.value.validity_rev,
      },
    });
    assert.equal(late.ok, false, JSON.stringify(late));
    assert.ok(
      !late.ok &&
        (late.code === "stale_page" || late.code === "stale_attempt"),
    );

    const fenceAfter = await readPageFence(
      report_id,
      gen.value.generation_id,
      "05",
    );
    assert.ok(fenceAfter.ok && fenceAfter.value);
    assert.equal(fenceAfter.value!.status, "stale");
    assert.ok(fenceAfter.value!.validity_rev > fence.value.validity_rev);

    const job = await loadJob(report_id, gen.value.generation_id);
    assert.ok(job.ok && job.value);
    assert.equal(job.value!.page_outputs["05"], undefined);
    console.log("R1-2/3 ok — invalidation blocks late fenced commit");
  }

  // --- 4. Outbox on start + job_missing fail-closed ---
  {
    await cleanup();
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    const report_id = "rpt_b3r1_outbox";
    const started = await startReportBatch2Production({
      report_id,
      generation_id: "gen_out",
      locale: "en",
      inputs: inputs(report_id),
    });
    assert.equal(started.ok, true, JSON.stringify(started));
    if (!started.ok) throw new Error("start");
    assert.ok(typeof started.generation_epoch === "number");

    const pending = await listPendingIntents({
      report_id,
      generation_id: started.generation_id,
    });
    // After successful send, intents are marked sent — pending may be empty.
    assert.equal(pending.ok, true);

    // Job missing path: new generation active without job
    await cleanup();
    const report_id2 = "rpt_b3r1_noj";
    const g = await allocateGeneration({
      report_id: report_id2,
      locale: "en",
      generation_id: "gen_noj",
    });
    assert.ok(g.ok);
    if (!g.ok) throw new Error("g");
    await activateGeneration({ record: g.value, job_id: report_id2 });
    const refuse = await runReportBatch3Recovery({
      report_id: report_id2,
      generation_id: g.value.generation_id,
      generation_epoch: g.value.generation_epoch,
    });
    assert.equal(refuse.ok, false);
    assert.equal(refuse.ok ? "" : refuse.code, "job_missing");
    console.log("R1-4 ok — outbox start path + job_missing fail-closed");
  }

  // --- Generation switch refuses old worker commit mid-flight ---
  {
    await cleanup();
    const report_id = "rpt_b3r1_switch";
    const g1 = await allocateGeneration({ report_id, locale: "en", generation_id: "sw1" });
    assert.ok(g1.ok);
    if (!g1.ok) throw new Error("g1");
    await activateGeneration({ record: g1.value, job_id: report_id });
    await createJob({
      report_id,
      generation_id: g1.value.generation_id,
      locale: "en",
      inputs: inputs(report_id),
      generation_epoch: g1.value.generation_epoch,
    });
    const fence = await ensurePageFence({
      report_id,
      generation_id: g1.value.generation_id,
      generation_epoch: g1.value.generation_epoch,
      page_id: "01",
    });
    assert.ok(fence.ok);
    if (!fence.ok) throw new Error("f");
    const task_key = computeTaskKey({
      report_id,
      generation_id: g1.value.generation_id,
      generation_epoch: g1.value.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp",
      upstream_output_fingerprints: {},
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
      task_type: "generate",
    });
    await ensureQueuedTask({
      report_id,
      generation_id: g1.value.generation_id,
      generation_epoch: g1.value.generation_epoch,
      page_id: "01",
      task_type: "generate",
      task_key,
      input_fingerprint: "fp",
      upstream_output_fingerprints: {},
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
    });
    const c = await claimTask({
      report_id,
      generation_id: g1.value.generation_id,
      task_key,
      worker_id: "w",
      validity_rev: fence.value.validity_rev,
    });
    assert.ok(c.ok);
    if (!c.ok) throw new Error("c");

    const g2 = await allocateGeneration({ report_id, locale: "en", generation_id: "sw2" });
    assert.ok(g2.ok);
    if (!g2.ok) throw new Error("g2");
    await activateGeneration({ record: g2.value, job_id: report_id });

    const late = await commitPageResult({
      report_id,
      generation_id: g1.value.generation_id,
      generation_epoch: g1.value.generation_epoch,
      page_id: "01",
      attempt_id: c.value.attempt_id!,
      task_key,
      output: { page: "01" },
      output_fingerprint: "fp_out",
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: g1.value.generation_id,
        generation_epoch: g1.value.generation_epoch,
        page_id: "01",
        input_fingerprint: "fp",
        upstream_output_fingerprints: {},
        page_contract_version: "pv",
        prompt_version: "pr",
        validator_version: "vv",
        output_fingerprint: "fp_out",
        attempt_id: c.value.attempt_id!,
        task_key,
        validity_rev: fence.value.validity_rev,
      },
    });
    assert.equal(late.ok, false);
    assert.equal(late.ok ? "" : late.code, "stale_generation");
    assert.equal(
      (await assertGenerationActive({
        report_id,
        generation_id: g2.value.generation_id,
        generation_epoch: g2.value.generation_epoch,
      })).ok,
      true,
    );
    console.log("R1-gen-switch ok — mid-flight commit rejected after new generation");
  }

  console.log("DEPLOY_ENV_PENDING: real Upstash multi-key Lua concurrency not proven here");
  console.log("ok report orchestration batch3 r1");
}

main()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error(err);
    await cleanup();
    process.exit(1);
  });
