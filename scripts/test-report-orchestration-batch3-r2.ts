/**
 * Batch3 R2 — interleaved authority/invalidation race, authority replay recovery,
 * validity_rev page-blob ordering.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3-r2.ts
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";

import {
  createJob,
  getJob,
  loadJob,
  resetBatch2JobStoreForTests,
  setReportBatch2EventSenderForTests,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import {
  activateGeneration,
  allocateGeneration,
  claimTask,
  commitPageResult,
  computeTaskKey,
  ensurePageFence,
  ensureQueuedTask,
  invalidateFromPage,
  readAuthorityPageOutput,
  readPageFence,
  resetBatch3KeysForTests,
  runReportBatch3Recovery,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import { hashCanonicalPayload } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3r2",
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
  console.log("=== Report orchestration Batch3 R2 ===");

  // --- 1. Interleaved: authority commit → invalidation → late blob persist ---
  {
    await cleanup();
    const report_id = "rpt_b3r2_race";
    const gen = await allocateGeneration({ report_id, locale: "en", generation_id: "g" });
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
      validity_rev: 0,
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
      worker_id: "w",
      validity_rev: fence.value.validity_rev,
    });
    assert.ok(claimed.ok);
    if (!claimed.ok) throw new Error("claim");

    const out = { page: "05", late: true };
    const fp = hashCanonicalPayload(out);
    let invalidatedDuringGap = false;
    const result = await commitPageResult({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "05",
      attempt_id: claimed.value.attempt_id!,
      task_key,
      output: out,
      output_fingerprint: fp,
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
        output_fingerprint: fp,
        attempt_id: claimed.value.attempt_id!,
        task_key,
        validity_rev: fence.value.validity_rev,
      },
      _test_after_authority: async () => {
        const inv = await invalidateFromPage({
          report_id,
          generation_id: gen.value.generation_id,
          generation_epoch: gen.value.generation_epoch,
          source_page_id: "05",
          reason: "race_invalidate_during_blob_gap",
        });
        assert.equal(inv.ok, true, JSON.stringify(inv));
        invalidatedDuringGap = true;
      },
    });
    assert.equal(invalidatedDuringGap, true);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.ok ? "" : result.code, "stale_page");

    const fenceAfter = await readPageFence(
      report_id,
      gen.value.generation_id,
      "05",
    );
    assert.ok(fenceAfter.ok && fenceAfter.value);
    assert.equal(fenceAfter.value!.status, "stale");

    const job = await loadJob(report_id, gen.value.generation_id);
    assert.ok(job.ok && job.value);
    assert.equal(job.value!.page_outputs["05"], undefined);
    assert.notEqual(
      job.value!.page_states.find((s) => s.page_id === "05")?.outcome,
      "completed",
    );
    console.log("R2-1 ok — invalidation during blob gap rejects late completed");
  }

  // --- 2. Authority success + blob fail → Recovery replay ---
  {
    await cleanup();
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    const report_id = "rpt_b3r2_replay";
    const gen = await allocateGeneration({ report_id, locale: "en", generation_id: "gr" });
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
      page_id: "01",
    });
    assert.ok(fence.ok);
    if (!fence.ok) throw new Error("f");

    const task_key = computeTaskKey({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      validity_rev: 0,
      page_id: "01",
      input_fingerprint: "fp01",
      upstream_output_fingerprints: {},
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
      task_type: "generate",
    });
    await ensureQueuedTask({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "01",
      task_type: "generate",
      task_key,
      input_fingerprint: "fp01",
      upstream_output_fingerprints: {},
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
    });
    const claimed = await claimTask({
      report_id,
      generation_id: gen.value.generation_id,
      task_key,
      worker_id: "w1",
      validity_rev: fence.value.validity_rev,
    });
    assert.ok(claimed.ok);
    if (!claimed.ok) throw new Error("c");

    const out = { page: "01", recovered: true };
    const fp = hashCanonicalPayload(out);
    // Simulate authority committed but blob persist failed via hook that
    // deletes nothing but we force persist failure by invalidating... 
    // Instead: commit fully, then wipe page blob while leaving authority.
    const committed = await commitPageResult({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id: "01",
      attempt_id: claimed.value.attempt_id!,
      task_key,
      output: out,
      output_fingerprint: fp,
      state_patch: { outcome: "completed", input_fingerprint: "fp01" },
      provenance: {
        report_id,
        generation_id: gen.value.generation_id,
        generation_epoch: gen.value.generation_epoch,
        page_id: "01",
        input_fingerprint: "fp01",
        upstream_output_fingerprints: {},
        page_contract_version: "pv",
        prompt_version: "pr",
        validator_version: "vv",
        output_fingerprint: fp,
        attempt_id: claimed.value.attempt_id!,
        task_key,
        validity_rev: fence.value.validity_rev,
      },
    });
    assert.equal(committed.ok, true, JSON.stringify(committed));

    const auth = await readAuthorityPageOutput(
      report_id,
      gen.value.generation_id,
      "01",
    );
    assert.ok(auth.ok && auth.value);
    assert.equal(auth.value!.output_fingerprint, fp);

    // Wipe Batch2 page blob (simulate persist failure after authority)
    const { durableKv } = await import("@/lib/kv/client");
    await durableKv().del(
      `report-batch2:${report_id}:${gen.value.generation_id}:page:01`,
    );
    const missing = await getJob(report_id, gen.value.generation_id);
    assert.ok(missing);
    assert.equal(missing!.page_outputs["01"], undefined);

    const recovered = await runReportBatch3Recovery({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      locale: "en",
      limit: 20,
    });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    if (!recovered.ok) throw new Error("rec");
    assert.ok(
      recovered.value.actions.some(
        (a) => a.kind === "replay_page_blob" && a.page_id === "01",
      ),
      JSON.stringify(recovered.value.actions),
    );

    const after = await loadJob(report_id, gen.value.generation_id);
    assert.ok(after.ok && after.value);
    assert.ok(after.value!.page_outputs["01"]);
    assert.equal(
      after.value!.page_states.find((s) => s.page_id === "01")?.outcome,
      "completed",
    );
    assert.equal(
      after.value!.page_states.find((s) => s.page_id === "01")?.output_fingerprint,
      fp,
    );

    // Idempotent second recovery
    const again = await runReportBatch3Recovery({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
    });
    assert.equal(again.ok, true);
    console.log("R2-2 ok — recovery replays authority output into page blob");
  }

  console.log("DEPLOY_ENV_PENDING: real Upstash multi-key Lua concurrency not proven here");
  console.log("ok report orchestration batch3 r2");
}

main()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error(err);
    await cleanup();
    process.exit(1);
  });
