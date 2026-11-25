/**
 * Batch3 R3 — fence fail-closed persist, authority-aware reads, recovery fault injection.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3-r3.ts
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";

import {
  createJob,
  loadJob,
  loadJobRawBlobs,
  mergeReportBatch2IntoV3Lab,
  resetBatch2JobStoreForTests,
  runReportBatch2OrchestratorTick,
  setReportBatch2EventSenderForTests,
  type ReportBatch2JobInputs,
  type ReportBatch2JobRecord,
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
  mapPersistBlobLuaCode,
  persistPageBlobUnderCommittedFence,
  readAuthorityGatedPage,
  readAuthorityPageOutput,
  readPageFence,
  resetBatch3KeysForTests,
  runReportBatch3Recovery,
  setPersistPageBlobEvalOverrideForTests,
  setPersistPageBlobFailHookForTests,
  PERSIST_BLOB_LUA_FENCE_MISSING,
  PERSIST_BLOB_LUA_FENCE_STALE,
  PERSIST_BLOB_LUA_OK,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import { saveDeliveryLab } from "@/lib/llm/pro/delivery/lab/store";
import { productionV3LabId } from "@/lib/llm/pro/delivery/pipeline-v3/production-run";
import { hashCanonicalPayload } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ReportPageId } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3r3",
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
  setPersistPageBlobFailHookForTests(null);
  setPersistPageBlobEvalOverrideForTests(null);
  await resetBatch2JobStoreForTests();
  await resetBatch3KeysForTests();
  setReportBatch2EventSenderForTests(null);
}

async function boot(report_id: string, generation_id: string) {
  const gen = await allocateGeneration({
    report_id,
    locale: "en",
    generation_id,
  });
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
  return gen.value;
}

async function claimPage(opts: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  input_fingerprint: string;
  upstream: Record<string, string>;
}) {
  const fence = await ensurePageFence({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
  });
  assert.ok(fence.ok);
  if (!fence.ok) throw new Error("fence");
  const task_key = computeTaskKey({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    validity_rev: fence.value.validity_rev,
    page_id: opts.page_id,
    input_fingerprint: opts.input_fingerprint,
    upstream_output_fingerprints: opts.upstream,
    page_contract_version: "pv",
    prompt_version: "pr",
    validator_version: "vv",
    task_type: "generate",
  });
  await ensureQueuedTask({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
    task_type: "generate",
    task_key,
    input_fingerprint: opts.input_fingerprint,
    upstream_output_fingerprints: opts.upstream,
    page_contract_version: "pv",
    prompt_version: "pr",
    validator_version: "vv",
  });
  const claimed = await claimTask({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    task_key,
    worker_id: `w_${opts.page_id}`,
    validity_rev: fence.value.validity_rev,
  });
  assert.ok(claimed.ok);
  if (!claimed.ok) throw new Error("claim");
  return { fence: fence.value, task_key, attempt_id: claimed.value.attempt_id! };
}

async function commitPage(opts: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  input_fingerprint: string;
  upstream: Record<string, string>;
  output: unknown;
  attempt_id: string;
  task_key: string;
  validity_rev: number;
  _test_after_authority?: () => Promise<void> | void;
}) {
  const fp = hashCanonicalPayload(opts.output);
  return commitPageResult({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
    attempt_id: opts.attempt_id,
    task_key: opts.task_key,
    output: opts.output,
    output_fingerprint: fp,
    state_patch: {
      outcome: "completed",
      input_fingerprint: opts.input_fingerprint,
    },
    provenance: {
      report_id: opts.report_id,
      generation_id: opts.generation_id,
      generation_epoch: opts.generation_epoch,
      page_id: opts.page_id,
      input_fingerprint: opts.input_fingerprint,
      upstream_output_fingerprints: opts.upstream,
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
      output_fingerprint: fp,
      attempt_id: opts.attempt_id,
      task_key: opts.task_key,
      validity_rev: opts.validity_rev,
    },
    _test_after_authority: opts._test_after_authority,
  });
}

async function ensureLab(job_id: string): Promise<void> {
  await saveDeliveryLab({
    version: 1,
    lab_id: productionV3LabId(job_id),
    pipeline: "v3_three_step",
    cursor_index: 0,
    artifacts: { by_page: {} },
    steps: { "book.assemble": { status: "idle" } },
    updated_at: Date.now(),
  } as never);
}

async function main(): Promise<void> {
  console.log("=== Report orchestration Batch3 R3 ===");

  // --- A. mapPersistBlobLuaCode fail-closed ---
  {
    assert.equal(mapPersistBlobLuaCode(PERSIST_BLOB_LUA_OK).ok, true);
    const m1 = mapPersistBlobLuaCode(PERSIST_BLOB_LUA_FENCE_MISSING);
    assert.equal(m1.ok, false);
    assert.equal(m1.ok ? "" : m1.code, "not_found");
    const m2 = mapPersistBlobLuaCode(PERSIST_BLOB_LUA_FENCE_STALE);
    assert.equal(m2.ok, false);
    assert.equal(m2.ok ? "" : m2.code, "stale_page");
    const unk = mapPersistBlobLuaCode(-99);
    assert.equal(unk.ok, false);
    assert.equal(unk.ok ? "" : unk.code, "conflict");
    const nan = mapPersistBlobLuaCode(Number.NaN);
    assert.equal(nan.ok, false);
    console.log("R3-A1 ok — Lua return code map fail-closed");
  }

  // --- A. missing fence / stale fence / unknown eval / eval failure ---
  {
    await cleanup();
    const report_id = "rpt_b3r3_persist";
    const gen = await boot(report_id, "g_persist");

    // Missing fence
    const miss = await persistPageBlobUnderCommittedFence({
      report_id,
      generation_id: gen.generation_id,
      page_id: "05",
      validity_rev: 0,
      attempt_id: "a",
      output_fingerprint: "fp",
      state: { page_id: "05", outcome: "completed", output_fingerprint: "fp" },
      output: { x: 1 },
    });
    assert.equal(miss.ok, false);
    assert.ok(
      miss.ok === false &&
        (miss.code === "not_found" || miss.code === "stale_page"),
      JSON.stringify(miss),
    );

    // Force unknown lua code (Redis-path mapping) — no ungated write
    setPersistPageBlobEvalOverrideForTests(async () => ({
      ok: true,
      value: -77,
    }));
    const unk = await persistPageBlobUnderCommittedFence({
      report_id,
      generation_id: gen.generation_id,
      page_id: "05",
      validity_rev: 0,
      attempt_id: "a",
      output_fingerprint: "fp",
      state: { page_id: "05", outcome: "completed", output_fingerprint: "fp" },
      output: { x: 1 },
    });
    assert.equal(unk.ok, false);
    assert.equal(unk.ok ? "" : unk.code, "conflict");
    setPersistPageBlobEvalOverrideForTests(null);

    // Eval failure
    setPersistPageBlobEvalOverrideForTests(async () => ({
      ok: false,
      code: "kv_write_failed",
      detail: "injected eval boom",
    }));
    const boom = await persistPageBlobUnderCommittedFence({
      report_id,
      generation_id: gen.generation_id,
      page_id: "05",
      validity_rev: 0,
      attempt_id: "a",
      output_fingerprint: "fp",
      state: { page_id: "05", outcome: "completed", output_fingerprint: "fp" },
      output: { x: 1 },
    });
    assert.equal(boom.ok, false);
    assert.equal(boom.ok ? "" : boom.code, "kv_write_failed");
    setPersistPageBlobEvalOverrideForTests(null);

    // Happy path + stale after invalidate
    const c = await claimPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp01",
      upstream: {},
    });
    const out = { page: "01", ok: true };
    const committed = await commitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp01",
      upstream: {},
      output: out,
      attempt_id: c.attempt_id,
      task_key: c.task_key,
      validity_rev: c.fence.validity_rev,
    });
    assert.equal(committed.ok, true, JSON.stringify(committed));

    const late = await persistPageBlobUnderCommittedFence({
      report_id,
      generation_id: gen.generation_id,
      page_id: "01",
      validity_rev: c.fence.validity_rev,
      attempt_id: c.attempt_id,
      output_fingerprint: "wrong-fp",
      state: { page_id: "01", outcome: "completed", output_fingerprint: "wrong-fp" },
      output: { late: true },
    });
    assert.equal(late.ok, false);

    console.log("R3-A2 ok — persist missing/unknown/eval-fail/mismatch refuse");
  }

  // --- B. Authority-aware read + loadJob demotion ---
  {
    await cleanup();
    const report_id = "rpt_b3r3_read";
    const gen = await boot(report_id, "g_read");
    const c = await claimPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp01",
      upstream: {},
    });
    const out = { page: "01", auth: true };
    const fp = hashCanonicalPayload(out);
    const committed = await commitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp01",
      upstream: {},
      output: out,
      attempt_id: c.attempt_id,
      task_key: c.task_key,
      validity_rev: c.fence.validity_rev,
    });
    assert.equal(committed.ok, true);

    const raw = await loadJobRawBlobs(report_id, gen.generation_id);
    assert.ok(raw.ok && raw.value);
    const valid = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob: raw.value!.pages.get("01"),
    });
    assert.equal(valid.verdict, "valid");

    const loaded = await loadJob(report_id, gen.generation_id);
    assert.ok(loaded.ok && loaded.value);
    assert.ok(loaded.value!.page_outputs["01"]);
    assert.equal(
      loaded.value!.page_states.find((s) => s.page_id === "01")?.outcome,
      "completed",
    );

    // Invalidate → loadJob must demote completed
    const inv = await invalidateFromPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "r3_stale_read",
    });
    assert.equal(inv.ok, true, JSON.stringify(inv));

    // Re-seed a forged completed blob after invalidation cleared it
    const { durableKv } = await import("@/lib/kv/client");
    await durableKv().set(
      `report-batch2:${report_id}:${gen.generation_id}:page:01`,
      {
        rev: 9,
        state: {
          page_id: "01",
          outcome: "completed",
          output_fingerprint: fp,
        },
        output: out,
        validity_rev: c.fence.validity_rev,
        authority_output_fingerprint: fp,
      },
      { ex: 3600 },
    );

    const staleRead = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob: {
        rev: 9,
        state: {
          page_id: "01",
          outcome: "completed",
          output_fingerprint: fp,
        },
        output: out,
        validity_rev: c.fence.validity_rev,
        authority_output_fingerprint: fp,
      },
    });
    assert.notEqual(staleRead.verdict, "valid");
    assert.ok(
      staleRead.verdict === "stale" || staleRead.verdict === "mismatch",
      staleRead.verdict,
    );

    const demoted = await loadJob(report_id, gen.generation_id);
    assert.ok(demoted.ok && demoted.value);
    assert.equal(demoted.value!.page_outputs["01"], undefined);
    assert.notEqual(
      demoted.value!.page_states.find((s) => s.page_id === "01")?.outcome,
      "completed",
    );

    // Fresh report: completed blob with no fence at all → missing
    await cleanup();
    const report_id2 = "rpt_b3r3_read_miss";
    const gen2 = await boot(report_id2, "g_read_miss");
    const missingFence = await readAuthorityGatedPage({
      report_id: report_id2,
      generation_id: gen2.generation_id,
      generation_epoch: gen2.generation_epoch,
      page_id: "05",
      blob: {
        rev: 1,
        state: {
          page_id: "05",
          outcome: "completed",
          output_fingerprint: "x",
        },
        output: { forged: true },
        validity_rev: 0,
        authority_output_fingerprint: "x",
      },
    });
    assert.equal(missingFence.verdict, "missing");

    console.log("R3-B ok — authority read + loadJob demotion");
  }

  // --- C. Orchestrator must not unlock on stale upstream ---
  {
    await cleanup();
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    const report_id = "rpt_b3r3_orch";
    const gen = await boot(report_id, "g_orch");

    // Complete 01+02 under authority
    for (const page_id of ["01", "02"] as const) {
      const c = await claimPage({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint: `fp${page_id}`,
        upstream: {},
      });
      const committed = await commitPage({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint: `fp${page_id}`,
        upstream: {},
        output: { page: page_id, n: 1 },
        attempt_id: c.attempt_id,
        task_key: c.task_key,
        validity_rev: c.fence.validity_rev,
      });
      assert.equal(committed.ok, true, JSON.stringify(committed));
    }

    const tickOk = await runReportBatch2OrchestratorTick({
      report_id,
      generation_id: gen.generation_id,
    });
    assert.equal(tickOk.ok, true, JSON.stringify(tickOk));
    if (!tickOk.ok) throw new Error("tick");
    assert.ok(
      tickOk.dispatched.some(
        (d) => "page_id" in d.data && d.data.page_id === "04",
      ),
      JSON.stringify(tickOk.dispatched),
    );

    // Stale page01 → must not unlock 04 again from a fresh pending job view
    await invalidateFromPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "r3_orch_stale",
    });
    // Re-forge completed blobs for 01 (stale fence)
    const { durableKv } = await import("@/lib/kv/client");
    const out01 = { page: "01", n: 1 };
    const fp01 = hashCanonicalPayload(out01);
    await durableKv().set(
      `report-batch2:${report_id}:${gen.generation_id}:page:01`,
      {
        rev: 3,
        state: {
          page_id: "01",
          outcome: "completed",
          output_fingerprint: fp01,
        },
        output: out01,
        validity_rev: 0,
        authority_output_fingerprint: fp01,
      },
      { ex: 3600 },
    );

    const loaded = await loadJob(report_id, gen.generation_id);
    assert.ok(loaded.ok && loaded.value);
    assert.notEqual(
      loaded.value!.page_states.find((s) => s.page_id === "01")?.outcome,
      "completed",
    );

    // Reset page04 to pending so we can observe whether it becomes ready
    const job = loaded.value!;
    const st04 = job.page_states.find((s) => s.page_id === "04");
    if (st04) st04.outcome = "pending";
    // save via raw set of page04 pending — use durableKv
    await durableKv().set(
      `report-batch2:${report_id}:${gen.generation_id}:page:04`,
      {
        rev: 1,
        state: { page_id: "04", outcome: "pending" },
      },
      { ex: 3600 },
    );

    const tickStale = await runReportBatch2OrchestratorTick({
      report_id,
      generation_id: gen.generation_id,
    });
    assert.equal(tickStale.ok, true, JSON.stringify(tickStale));
    if (!tickStale.ok) throw new Error("tick2");
    assert.equal(
      tickStale.dispatched.filter(
        (d) => "page_id" in d.data && d.data.page_id === "04",
      ).length,
      0,
      "must not unlock Page04 when Page01 authority is stale",
    );

    console.log("R3-C ok — orchestrator refuses unlock on stale upstream");
  }

  // --- D. Final merge authority gate ---
  {
    await cleanup();
    const report_id = "rpt_b3r3_merge";
    const gen = await boot(report_id, "g_merge");
    await ensureLab(report_id);

    const forged: ReportBatch2JobRecord = {
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      locale: "en",
      page_states: [
        {
          page_id: "01",
          outcome: "completed",
          output_fingerprint: "forged",
        },
      ],
      page_outputs: { "01": { forged: true } },
      repair_pending: {},
      inputs: inputs(report_id),
      dispatch_log: [],
      invocation_log: [],
      status: "completed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const rejected = await mergeReportBatch2IntoV3Lab(
      report_id,
      { locale: "en" } as never,
      forged,
    );
    assert.equal(rejected.ok, false);
    // R4+: refuse forged/incomplete via persisted meta or authority — never deliver.
    assert.ok(
      rejected.ok === false &&
        (rejected.reason.includes("authority") ||
          rejected.reason.includes("not_completed") ||
          rejected.reason.includes("missing")),
      JSON.stringify(rejected),
    );

    // Single page alone cannot finalize — incomplete DAG / meta fail-closed.
    const c = await claimPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp01",
      upstream: {},
    });
    const out = { page: "01", merge: true };
    const committed = await commitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp01",
      upstream: {},
      output: out,
      attempt_id: c.attempt_id,
      task_key: c.task_key,
      validity_rev: c.fence.validity_rev,
    });
    assert.equal(committed.ok, true);

    const loaded = await loadJob(report_id, gen.generation_id);
    assert.ok(loaded.ok && loaded.value);
    const merged = await mergeReportBatch2IntoV3Lab(
      report_id,
      { locale: "en" } as never,
      loaded.value!,
    );
    assert.equal(merged.ok, false);
    assert.ok(
      merged.ok === false &&
        (merged.reason.includes("not_completed") ||
          merged.reason.includes("missing") ||
          merged.reason.includes("dag")),
      JSON.stringify(merged),
    );

    // Supersede generation — still refuse
    const gen2 = await allocateGeneration({
      report_id,
      locale: "en",
      generation_id: "g_merge2",
    });
    assert.ok(gen2.ok);
    if (!gen2.ok) throw new Error("g2");
    await activateGeneration({ record: gen2.value, job_id: report_id });
    const superReject = await mergeReportBatch2IntoV3Lab(
      report_id,
      { locale: "en" } as never,
      loaded.value!,
    );
    assert.equal(superReject.ok, false);
    assert.ok(
      superReject.ok === false &&
        (superReject.reason.includes("generation") ||
          superReject.reason.includes("not_completed") ||
          superReject.reason.includes("stale")),
      JSON.stringify(superReject),
    );

    console.log("R3-D ok — merge rejects forged / incomplete / superseded");
  }

  // --- E. Recovery fault injection (real persist fail, not delete-after) ---
  {
    await cleanup();
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    const report_id = "rpt_b3r3_fi";
    const gen = await boot(report_id, "g_fi");
    const c = await claimPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp01",
      upstream: {},
    });

    const llmForPage01: string[] = [];
    setReportBatch2EventSenderForTests({
      send: async (events) => {
        for (const e of events) {
          const name = String(e.name);
          const page =
            e.data && typeof e.data === "object" && "page_id" in e.data
              ? String((e.data as { page_id?: string }).page_id)
              : "";
          if (
            page === "01" &&
            (name.includes("generate") || name.includes("repair"))
          ) {
            llmForPage01.push(name);
          }
        }
        return { ok: true };
      },
    });

    setPersistPageBlobFailHookForTests(() => true);
    const out = { page: "01", fi: true };
    const fp = hashCanonicalPayload(out);
    const failed = await commitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp01",
      upstream: {},
      output: out,
      attempt_id: c.attempt_id,
      task_key: c.task_key,
      validity_rev: c.fence.validity_rev,
    });
    assert.equal(failed.ok, false, "commit must surface blob persist failure");
    setPersistPageBlobFailHookForTests(null);

    const fence = await readPageFence(
      report_id,
      gen.generation_id,
      "01",
    );
    assert.ok(fence.ok && fence.value?.status === "committed");

    const auth = await readAuthorityPageOutput(
      report_id,
      gen.generation_id,
      "01",
    );
    assert.ok(auth.ok && auth.value);
    assert.equal(auth.value!.output_fingerprint, fp);

    const rawMissing = await loadJobRawBlobs(report_id, gen.generation_id);
    assert.ok(rawMissing.ok && rawMissing.value);
    const preBlob = rawMissing.value!.pages.get("01");
    // createJob seeds pending blobs; injected fail must leave them non-completed
    assert.notEqual(preBlob?.state.outcome, "completed");
    assert.equal(preBlob?.authority_output_fingerprint ?? null, null);

    const recovered = await runReportBatch3Recovery({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
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
    assert.deepEqual(
      llmForPage01,
      [],
      "recovery must not re-dispatch generate/repair for the replayed page",
    );

    const after = await loadJob(report_id, gen.generation_id);
    assert.ok(after.ok && after.value);
    assert.ok(after.value!.page_outputs["01"]);
    assert.equal(
      after.value!.page_states.find((s) => s.page_id === "01")?.outcome,
      "completed",
    );

    const again = await runReportBatch3Recovery({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
    });
    assert.equal(again.ok, true);
    if (!again.ok) throw new Error("again");
    assert.ok(
      again.value.actions.some(
        (a) => a.kind === "skipped_completed" && a.page_id === "01",
      ),
      JSON.stringify(again.value.actions),
    );

    // Invalidation during gap + late persist refuse + recovery must not revive
    await cleanup();
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    const report_id2 = "rpt_b3r3_fi_race";
    const genB = await boot(report_id2, "g_fi_race");
    const c2 = await claimPage({
      report_id: report_id2,
      generation_id: genB.generation_id,
      generation_epoch: genB.generation_epoch,
      page_id: "05",
      input_fingerprint: "fp05",
      upstream: { "04": "up04" },
    });
    setPersistPageBlobFailHookForTests(() => true);
    const out5 = { page: "05", race: true };
    const failCommit = await commitPage({
      report_id: report_id2,
      generation_id: genB.generation_id,
      generation_epoch: genB.generation_epoch,
      page_id: "05",
      input_fingerprint: "fp05",
      upstream: { "04": "up04" },
      output: out5,
      attempt_id: c2.attempt_id,
      task_key: c2.task_key,
      validity_rev: c2.fence.validity_rev,
      _test_after_authority: async () => {
        // Invalidate after authority, before (failed) persist
        await invalidateFromPage({
          report_id: report_id2,
          generation_id: genB.generation_id,
          generation_epoch: genB.generation_epoch,
          source_page_id: "05",
          reason: "r3_fi_race",
        });
      },
    });
    assert.equal(failCommit.ok, false);
    setPersistPageBlobFailHookForTests(null);

    // Late worker persist attempt
    const late = await persistPageBlobUnderCommittedFence({
      report_id: report_id2,
      generation_id: genB.generation_id,
      page_id: "05",
      validity_rev: c2.fence.validity_rev,
      attempt_id: c2.attempt_id,
      output_fingerprint: hashCanonicalPayload(out5),
      state: {
        page_id: "05",
        outcome: "completed",
        output_fingerprint: hashCanonicalPayload(out5),
      },
      output: out5,
    });
    assert.equal(late.ok, false);

    const recRace = await runReportBatch3Recovery({
      report_id: report_id2,
      generation_id: genB.generation_id,
      generation_epoch: genB.generation_epoch,
    });
    assert.equal(recRace.ok, true, JSON.stringify(recRace));
    if (!recRace.ok) throw new Error("recRace");
    assert.equal(
      recRace.value.actions.filter(
        (a) => a.kind === "replay_page_blob" && a.page_id === "05",
      ).length,
      0,
      "must not revive invalidated page via recovery",
    );
    const jobRace = await loadJob(report_id2, genB.generation_id);
    assert.ok(jobRace.ok && jobRace.value);
    assert.notEqual(
      jobRace.value!.page_states.find((s) => s.page_id === "05")?.outcome,
      "completed",
    );

    console.log(
      "R3-E ok — injected persist fail → recovery replay; race does not revive",
    );
  }

  console.log(
    "DEPLOY_ENV_PENDING: real Upstash multi-key Lua concurrency not proven here",
  );
  console.log("ok report orchestration batch3 r3");
}

main()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error(err);
    await cleanup();
    process.exit(1);
  });
