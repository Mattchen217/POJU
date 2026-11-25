/**
 * Report orchestration Batch 2 R2 — concurrency, startup order, pointer, adapter honesty.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch2-r2.ts
 *
 * Coverage boundary (do not overclaim):
 *  - Local handler-adapter + shared KV concurrency
 *  - Static registration of four Inngest Functions
 *  - NOT deployed Vercel/Inngest invocation or 300s budgets
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  REPORT_BATCH2_EVENTS,
  REPORT_BATCH2_FUNCTION_META,
  appendDispatchLog,
  appendInvocationLog,
  assertReportBatch2FunctionRegistration,
  assertReportBatch2GenerateRepairSeparation,
  createJob,
  createBatch2HandlerAdapterEventSender,
  getBatch2AdapterInvocationRecords,
  inspectReportBatch2FunctionRegistration,
  isReportBatch2SharedStoreAvailable,
  loadJob,
  pollFinalDeliveryReportBatch2,
  readReportBatch2ActivePointer,
  resetBatch2InvocationRecords,
  resetBatch2JobStoreForTests,
  saveJob,
  saveJobPageOnlyForTests,
  setPageOutput,
  setReportBatch2EventSenderForTests,
  startFinalDeliveryReportBatch2,
  startReportBatch2Production,
  updatePageState,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import { hashCanonicalPayload as hashPayload } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import { reportBatch2InngestFunctions } from "@/lib/inngest/functions/report-batch2";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { FinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";
import { durableKv } from "@/lib/kv/client";
import { productionDeliveryUsesV3 } from "@/lib/llm/pro/delivery/pipeline-v3/flag";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_orch_b2_r2",
    version: 1,
    status: "final",
    content_hash: "hash_orch_b2_r2",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question: "Should I take a solo promotion and keep my runway?",
      concrete_event: "Promotion offer.",
      desired_outcome: "Preserve runway.",
      stakes: "Career",
      goal_priorities: ["runway"],
      unacceptable_outcomes: [],
    },
    constraints: [],
    reality_facts: [],
    dirs: [],
    conflicts: [],
    hypotheses: [],
  } as unknown as DecisionContext;
}

function basePack(): BookJudgmentPack {
  return {
    version: 1,
    locale: "en",
    cfp_hash: "cfp_r2",
    zfp_hash: null,
    zfpOmitted: true,
    shot_mode: "one",
    created_at: "2026-01-01T00:00:00Z",
    units: [],
    by_face: {},
    pattern_hits_used: [],
    science_tags_used: [],
  } as unknown as BookJudgmentPack;
}

function jobInputs(report_id: string): ReportBatch2JobInputs {
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
  setReportBatch2EventSenderForTests(null);
  resetBatch2InvocationRecords();
}

async function main(): Promise<void> {
  console.log("=== Report orchestration Batch2 R2 (concurrency + pointer + adapter) ===");
  assert.equal(isReportBatch2SharedStoreAvailable(), true);
  assertReportBatch2FunctionRegistration();
  assertReportBatch2GenerateRepairSeparation();

  // --- A. Deterministic interleaved Page01/Page02 writes ---
  {
    await cleanup();
    const report_id = "rpt_r2_race";
    const generation_id = "gen_race";
    const created = await createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(report_id),
    });
    assert.equal(created.ok, true);

    const snapA = await loadJob(report_id, generation_id);
    const snapB = await loadJob(report_id, generation_id);
    assert.equal(snapA.ok && snapB.ok, true);
    const jobA = snapA.value!;
    const jobB = snapB.value!;

    const out01 = { page: "01", face: "01", schema_version: "face01-test", n: 1 };
    const out02 = { page: "02", face: "02", schema_version: "face02-test", n: 2 };
    const fp01 = hashPayload(out01);
    const fp02 = hashPayload(out02);

    setPageOutput(jobA, "01", out01, fp01);
    updatePageState(jobA, "01", { outcome: "completed", output_fingerprint: fp01 });
    appendInvocationLog(jobA, {
      page_id: "01",
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      worker_id: "worker-a",
      invocation_id: "inv-a",
      model_call_id: "mc-a",
      started_at: "2026-01-01T00:00:01Z",
      ended_at: "2026-01-01T00:00:02Z",
    });
    appendDispatchLog(jobA, {
      at: "2026-01-01T00:00:01Z",
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id: "01",
      detail: "a-dispatch",
    });

    setPageOutput(jobB, "02", out02, fp02);
    updatePageState(jobB, "02", { outcome: "completed", output_fingerprint: fp02 });
    appendInvocationLog(jobB, {
      page_id: "02",
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      worker_id: "worker-b",
      invocation_id: "inv-b",
      model_call_id: "mc-b",
      started_at: "2026-01-01T00:00:01Z",
      ended_at: "2026-01-01T00:00:02Z",
    });
    appendDispatchLog(jobB, {
      at: "2026-01-01T00:00:01Z",
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id: "02",
      detail: "b-dispatch",
    });

    // Interleave: A writes page01 only, then B writes page02 only (stale full snapshots).
    const wA = await saveJobPageOnlyForTests(jobA, "01");
    assert.equal(wA.ok, true, JSON.stringify(wA));
    // Also flush A's logs via full save with only page01 dirty already cleared —
    // re-append logs onto a fresh load to prove log append independence.
    const mid = await loadJob(report_id, generation_id);
    assert.equal(mid.ok, true);
    assert.ok(mid.value!.page_outputs["01"]);
    assert.equal(mid.value!.page_outputs["02"], undefined);

    const wB = await saveJobPageOnlyForTests(jobB, "02");
    assert.equal(wB.ok, true, JSON.stringify(wB));

    // Persist logs from each stale snapshot without clobbering the other page.
    const logA = await loadJob(report_id, generation_id);
    assert.ok(logA.value);
    appendInvocationLog(logA.value!, {
      page_id: "01",
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      worker_id: "worker-a",
      invocation_id: "inv-a2",
      model_call_id: "mc-a2",
      started_at: "2026-01-01T00:00:03Z",
      ended_at: "2026-01-01T00:00:04Z",
    });
    appendDispatchLog(logA.value!, {
      at: "2026-01-01T00:00:03Z",
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id: "01",
      detail: "a-dispatch-2",
    });
    const sA = await saveJob(logA.value!);
    assert.equal(sA.ok, true);

    const logB = await loadJob(report_id, generation_id);
    assert.ok(logB.value);
    appendInvocationLog(logB.value!, {
      page_id: "02",
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      worker_id: "worker-b",
      invocation_id: "inv-b2",
      model_call_id: "mc-b2",
      started_at: "2026-01-01T00:00:03Z",
      ended_at: "2026-01-01T00:00:04Z",
    });
    appendDispatchLog(logB.value!, {
      at: "2026-01-01T00:00:03Z",
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id: "02",
      detail: "b-dispatch-2",
    });
    const sB = await saveJob(logB.value!);
    assert.equal(sB.ok, true);

    const final = await loadJob(report_id, generation_id);
    assert.equal(final.ok, true);
    const job = final.value!;
    assert.ok(job.page_outputs["01"], "Page01 output must survive");
    assert.ok(job.page_outputs["02"], "Page02 output must survive");
    assert.equal(
      job.page_states.find((s) => s.page_id === "01")?.outcome,
      "completed",
    );
    assert.equal(
      job.page_states.find((s) => s.page_id === "02")?.outcome,
      "completed",
    );
    assert.equal(
      job.page_states.find((s) => s.page_id === "01")?.output_fingerprint,
      fp01,
    );
    assert.equal(
      job.page_states.find((s) => s.page_id === "02")?.output_fingerprint,
      fp02,
    );
    assert.ok(
      job.invocation_log.some((e) => e.invocation_id === "inv-a2"),
      "A invocation log must remain",
    );
    assert.ok(
      job.invocation_log.some((e) => e.invocation_id === "inv-b2"),
      "B invocation log must remain",
    );
    assert.ok(job.dispatch_log.some((e) => e.detail === "a-dispatch-2"));
    assert.ok(job.dispatch_log.some((e) => e.detail === "b-dispatch-2"));
    console.log("A ok — interleaved Page01/02 persist both outputs + logs");
  }

  // --- B. Startup must not overwrite worker writes with create-time snapshot ---
  {
    await cleanup();
    const report_id = "rpt_r2_startup";
    const generation_id = "gen_startup";
    let orchestrateSent = false;
    setReportBatch2EventSenderForTests({
      send: async (events) => {
        for (const e of events) {
          if (e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE) {
            orchestrateSent = true;
            // Simulate worker mutating Job after event is visible.
            const loaded = await loadJob(report_id, generation_id);
            assert.equal(loaded.ok, true);
            assert.ok(loaded.value);
            const out = { page: "01", face: "01", schema_version: "t", w: 1 };
            const fp = hashPayload(out);
            setPageOutput(loaded.value!, "01", out, fp);
            updatePageState(loaded.value!, "01", {
              outcome: "completed",
              output_fingerprint: fp,
            });
            const saved = await saveJob(loaded.value!);
            assert.equal(saved.ok, true);
          }
        }
        return { ok: true as const };
      },
    });

    const started = await startReportBatch2Production({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(report_id),
    });
    assert.equal(started.ok, true, JSON.stringify(started));
    assert.equal(orchestrateSent, true);

    const after = await loadJob(report_id, generation_id);
    assert.equal(after.ok, true);
    assert.ok(
      after.value!.page_outputs["01"],
      "startup must not clobber worker Page01 write after ORCHESTRATE",
    );
    assert.equal(
      after.value!.page_states.find((s) => s.page_id === "01")?.outcome,
      "completed",
    );
    assert.equal(after.value!.status, "orchestrating");
    console.log("B ok — startup does not stale-overwrite worker Job");
  }

  // --- C. Active pointer three-state + init order + anti-dup ---
  {
    await cleanup();
    const job_id = "fd_job_r2_ptr";
    const ptrKey = `report-batch2-active:${job_id}`;

    const missing = await readReportBatch2ActivePointer(job_id);
    assert.equal(missing.status, "not_found");

    // Force read_failed by temporarily breaking get
    const d = durableKv() as unknown as {
      get: (...args: unknown[]) => Promise<unknown>;
    };
    const origGet = d.get.bind(d);
    d.get = async (...args: unknown[]) => {
      if (String(args[0]) === ptrKey) throw new Error("kv_pointer_boom");
      return origGet(...args);
    };
    const failed = await readReportBatch2ActivePointer(job_id);
    assert.equal(failed.status, "read_failed");
    d.get = origGet;

    const pollFail = await pollFinalDeliveryReportBatch2(job_id, {
      session_id: "s",
      locale: "en",
      decision_context_snapshot: baseDc(),
    } as FinalDeliveryJobInput);
    // without broken get, not_started
    assert.equal(pollFail.phase, "not_started");

    d.get = async (...args: unknown[]) => {
      if (String(args[0]) === ptrKey) throw new Error("kv_pointer_boom");
      return origGet(...args);
    };
    const pollReadFail = await pollFinalDeliveryReportBatch2(job_id, {
      session_id: "s",
      locale: "en",
      decision_context_snapshot: baseDc(),
    } as FinalDeliveryJobInput);
    assert.equal(pollReadFail.phase, "failed");
    assert.match(pollReadFail.reason, /pointer_read_failed/);
    d.get = origGet;

    assert.equal(productionDeliveryUsesV3(), true);
    process.env.INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY || "test_key";

    const d2 = durableKv() as unknown as {
      set: (...args: unknown[]) => Promise<unknown>;
    };
    const origSet = d2.set.bind(d2);
    d2.set = async (...args: unknown[]) => {
      if (String(args[0]) === ptrKey) throw new Error("pointer_set_denied");
      return origSet(...args);
    };
    const startPtrFail = await startFinalDeliveryReportBatch2(job_id, {
      session_id: "s",
      locale: "en",
      decision_context_snapshot: baseDc(),
    } as FinalDeliveryJobInput);
    d2.set = origSet;
    assert.equal(startPtrFail.ok, false);
    assert.equal(startPtrFail.code, "pointer_write_failed");

    // Clean meta left by failed start (job created before pointer write)
    await resetBatch2JobStoreForTests();

    // Happy pointer found after manual write
    await durableKv().set(
      ptrKey,
      {
        report_id: job_id,
        generation_id: `${job_id}:batch2`,
        started_at: new Date().toISOString(),
      },
      { ex: 3600 },
    );
    const found = await readReportBatch2ActivePointer(job_id);
    assert.equal(found.status, "found");
    if (found.status === "found") {
      assert.equal(found.pointer.generation_id, `${job_id}:batch2`);
    }

    // Anti-dup when pointer exists — must not recreate / re-dispatch
    const dup = await startFinalDeliveryReportBatch2(job_id, {
      session_id: "s",
      locale: "en",
      decision_context_snapshot: baseDc(),
    } as FinalDeliveryJobInput);
    assert.equal(dup.ok, true);
    if (dup.ok) assert.equal(dup.reused, true);

    await durableKv().del(ptrKey);
    console.log("C ok — Active Pointer three-state + anti-dup guards");
  }

  // --- D. Adapter vs registration honesty ---
  {
    await cleanup();
    const checks = inspectReportBatch2FunctionRegistration();
    assert.equal(checks.length, 4);
    for (const c of checks) {
      assert.equal(c.registered, true, c.id);
    }
    assert.equal(reportBatch2InngestFunctions.length, 4);

    const genSrc = readFileSync(
      join(process.cwd(), "lib/inngest/functions/report-page-generate.ts"),
      "utf8",
    );
    const repairSrc = readFileSync(
      join(process.cwd(), "lib/inngest/functions/report-page-repair.ts"),
      "utf8",
    );
    assert.match(genSrc, /id:\s*"report-page-generate"/);
    assert.match(genSrc, /REPORT_BATCH2_EVENTS\.GENERATE|event:.*GENERATE/);
    assert.match(repairSrc, /id:\s*"report-page-repair"/);
    assert.match(repairSrc, /REPORT_BATCH2_EVENTS\.REPAIR|event:.*REPAIR/);
    assert.notEqual(
      REPORT_BATCH2_FUNCTION_META.find((m) => m.id === "report-page-generate")
        ?.event,
      REPORT_BATCH2_FUNCTION_META.find((m) => m.id === "report-page-repair")
        ?.event,
    );

    const adapter = createBatch2HandlerAdapterEventSender();
    setReportBatch2EventSenderForTests(adapter);
    resetBatch2InvocationRecords();
    const report_id = "rpt_r2_adapter";
    const generation_id = "gen_adapter";
    await createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(report_id),
    });
    await adapter.send([
      {
        name: REPORT_BATCH2_EVENTS.ORCHESTRATE,
        data: { report_id, generation_id, locale: "en" },
      },
    ]);
    await adapter.drain();
    const rec = getBatch2AdapterInvocationRecords();
    assert.ok(rec.length >= 1);
    assert.equal(rec[0]!.path, "handler_adapter");
    assert.match(rec[0]!.adapter_invocation_id, /^adapter_/);
    console.log(
      "D ok — registration static check + handler_adapter path (not platform invocation)",
    );
    console.log(
      "DEPLOY_ENV_PENDING: Vercel/Inngest independent Function invocation + 300s budget not verified here",
    );
  }

  console.log("ok report orchestration batch2 r2");
}

main()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error(err);
    await cleanup();
    process.exit(1);
  });
