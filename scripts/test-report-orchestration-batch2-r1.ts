/**
 * Report orchestration Batch 2 R1 — durable KV + registered Inngest runtime.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch2-r1.ts
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  REPORT_BATCH2_EVENTS,
  REPORT_BATCH2_FUNCTION_META,
  assertReportBatch2FunctionRegistration,
  buildGeneratePayload,
  buildRepairPayload,
  buildOrchestratePayload,
  createJob,
  createRegisteredBatch2EventSender,
  getBatch2InvocationRecords,
  getJob,
  isReportBatch2SharedStoreAvailable,
  loadJob,
  resetBatch2InvocationRecords,
  resetBatch2JobStoreForTests,
  runReportBatch2OrchestratorTick,
  saveJob,
  setBatch2ModelDelayMsForTests,
  setBatch2ModelInvokeForTests,
  setPageOutput,
  sendReportBatch2Events,
  setReportBatch2EventSenderForTests,
  startReportBatch2Production,
  updatePageState,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import { hashCanonicalPayload } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { ReportPageId } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";
import { reportBatch2InngestFunctions } from "@/lib/inngest/functions/report-batch2";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import {
  buildPageProductionPrep,
  computePageInputFingerprintForJob,
  upstreamFingerprintsForPage,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2/page-prep";
import { durableKv } from "@/lib/kv/client";

function baseDc(overrides?: {
  facts?: DecisionContext["reality_facts"];
  dirs?: DecisionContext["dirs"];
  question?: string;
}): DecisionContext {
  return {
    context_id: "dc_orch_b2_r1",
    version: 1,
    status: "final",
    content_hash: "hash_orch_b2_r1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question:
        overrides?.question ??
        "Should I leave the job for a startup offer this quarter?",
      concrete_event: "Received startup offer with equity cliff.",
      desired_outcome: "Preserve runway and optionality.",
      stakes: "Career and cash floor",
      goal_priorities: ["runway"],
      unacceptable_outcomes: ["resign cold"],
    },
    constraints: [],
    reality_facts: overrides?.facts ?? [
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
    dirs: overrides?.dirs ?? [
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
    cfp_hash: "cfp_orch_b2_r1",
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
        source_version: "cfp_orch_b2_r1",
      },
    ],
    by_face: { "01": ["u_destiny_01"], "02": ["u_destiny_01"], "04": ["u_destiny_01"] },
    pattern_hits_used: [],
    science_tags_used: [],
  } as unknown as BookJudgmentPack;
}

function jobInputs(dc: DecisionContext, report_id: string): ReportBatch2JobInputs {
  return {
    report_id,
    dc,
    pack: basePack(),
    chart_fact_pack: "日主甲木…",
    bazi_available: true,
  };
}

const page01Stub = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: { text: "Keep the job.", claim_ids: ["u_destiny_01"] },
  why_this_path: [{ text: "Cash floor intact.", claim_ids: ["u_destiny_01"] }],
  recommendation_conditions: [],
  not_recommended: [],
  applicability_boundary: {
    current_basis: [],
    invalidation_conditions: [],
    page02_evidence_ids: ["u_destiny_01"],
    page08_review_refs: [],
  },
};

async function seedPage01Draft(report_id: string, generation_id: string): Promise<void> {
  const job = await getJob(report_id, generation_id);
  assert.ok(job);
  const fp = hashCanonicalPayload(page01Stub);
  job.page_outputs["01"] = page01Stub;
  updatePageState(job, "01", { output_fingerprint: fp });
  const saved = await saveJob(job);
  assert.equal(saved.ok, true);
}

async function completePage(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
  payload?: Record<string, unknown>,
): Promise<void> {
  const job = await getJob(report_id, generation_id);
  assert.ok(job);
  const out = payload ?? { page: page_id, face: page_id, schema_version: `face${page_id}-test`, test: true };
  const fp = hashCanonicalPayload(out);
  setPageOutput(job, page_id, out, fp);
  updatePageState(job, page_id, { outcome: "completed", output_fingerprint: fp });
  const saved = await saveJob(job);
  assert.equal(saved.ok, true);
}

async function cleanup(): Promise<void> {
  await resetBatch2JobStoreForTests();
  setReportBatch2EventSenderForTests(null);
  setBatch2ModelInvokeForTests(null);
  setBatch2ModelDelayMsForTests(null);
  resetBatch2InvocationRecords();
}

async function main(): Promise<void> {
  console.log("=== Report orchestration Batch2 R1 (KV + registered Inngest) ===");
  assert.equal(isReportBatch2SharedStoreAvailable(), true);

  assertReportBatch2FunctionRegistration();

  const runtimeSender = createRegisteredBatch2EventSender();
  setReportBatch2EventSenderForTests(runtimeSender);

  setBatch2ModelInvokeForTests(async (input) => ({
    content: "{ broken-json",
    tokens_used: 1,
    model_call_id: `mc_${input.page_id}_${input.call_kind}_${input.invocation_id.slice(0, 8)}`,
  }));

  // --- Job store persist failures ---
  {
    await cleanup();
    const d = durableKv() as unknown as {
      compareAndSetExact: (
        key: string,
        expected: string | null,
        next: unknown,
        opts?: { ex?: number },
      ) => Promise<boolean>;
    };
    const origCas = d.compareAndSetExact.bind(d);
    const failKey = "report-batch2:persist_fail:gen:meta";
    d.compareAndSetExact = async (key, expected, next, opts) => {
      if (key === failKey) throw new Error("kv_write_denied");
      return origCas(key, expected, next, opts);
    };
    const created = await createJob({
      report_id: "persist_fail",
      generation_id: "gen",
      locale: "en",
      inputs: jobInputs(baseDc(), "persist_fail"),
    });
    assert.equal(created.ok, false);
    if (created.ok) throw new Error("expected kv_write_failed");
    assert.match(created.code, /kv_write_failed|kv_unavailable/);
    d.compareAndSetExact = origCas;
    console.log("job-store ok — persist failure surfaces kv_write_failed");
  }

  // --- A. Parallel Page01/02 via registered report-page-generate ---
  {
    await cleanup();
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    const report_id = "rpt_r1_parallel";
    const generation_id = "gen_parallel";
    const c = await createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(baseDc(), report_id),
    });
    assert.equal(c.ok, true);
    await seedPage01Draft(report_id, generation_id);

    const tick = await runReportBatch2OrchestratorTick({ report_id, generation_id });
    assert.equal(tick.ok, true);
    if (!tick.ok) throw new Error(tick.detail);
    const genPayloads = tick.dispatched.filter((d) => d.name === REPORT_BATCH2_EVENTS.GENERATE);
    assert.equal(genPayloads.length, 2);

    setReportBatch2EventSenderForTests(runtimeSender);
    resetBatch2InvocationRecords();
    setBatch2ModelDelayMsForTests(60);
    await sendViaRuntime(genPayloads);
    await runtimeSender.drain();

    const inv = getBatch2InvocationRecords().filter(
      (r) => r.event_name === REPORT_BATCH2_EVENTS.GENERATE,
    );
    assert.equal(inv.length, 2);
    assert.equal(inv[0]!.function_id, "report-page-generate");
    assert.equal(inv[1]!.function_id, "report-page-generate");
    assert.notEqual(inv[0]!.adapter_invocation_id, inv[1]!.adapter_invocation_id);

    const job = await getJob(report_id, generation_id);
    assert.ok(job);
    const invLog = job.invocation_log.filter(
      (e) => e.event_name === REPORT_BATCH2_EVENTS.GENERATE,
    );
    assert.equal(invLog.length, 2);
    const a = invLog.find((e) => e.page_id === "01");
    const b = invLog.find((e) => e.page_id === "02");
    assert.ok(a?.started_at && a.ended_at && b?.started_at && b.ended_at);
    assert.ok(
      a.started_at! < b.ended_at! && b.started_at! < a.ended_at!,
      "registered workers should overlap in wall time",
    );
    assert.equal(job.page_outputs["02"], undefined);
    console.log("A ok — registered report-page-generate parallel");
  }

  // --- B-D: gates via registered report-page-orchestrator (capture child events) ---
  {
    await cleanup();
    const captured: Array<{ name: string; data: Record<string, unknown> }> = [];
    const gateSender = {
      send: async (
        events: Array<{ name: string; data: Record<string, unknown> }>,
      ) => {
        for (const e of events) {
          if (e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE) {
            await runtimeSender.send([e]);
          } else {
            captured.push(e);
          }
        }
        return { ok: true as const };
      },
      drain: () => runtimeSender.drain(),
    };
    setReportBatch2EventSenderForTests(gateSender);

    const report_id = "rpt_r1_gate";
    const generation_id = "gen_gate";
    await createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(baseDc(), report_id),
    });

    async function orchTick(): Promise<typeof captured> {
      captured.length = 0;
      resetBatch2InvocationRecords();
      await sendViaRuntime([
        buildOrchestratePayload({ report_id, generation_id, locale: "en" }),
      ]);
      await gateSender.drain();
      const orchInv = getBatch2InvocationRecords().filter(
        (r) => r.function_id === "report-page-orchestrator",
      );
      assert.ok(orchInv.length >= 1, "orchestrator Function must run");
      return [...captured];
    }

    await completePage(report_id, generation_id, "01");
    let dispatched = await orchTick();
    assert.ok(
      !dispatched.some(
        (d) =>
          d.name === REPORT_BATCH2_EVENTS.GENERATE &&
          d.data.page_id === "04",
      ),
      "Page04 must not dispatch before Page02 completes",
    );
    await completePage(report_id, generation_id, "02");
    dispatched = await orchTick();
    assert.ok(
      dispatched.some(
        (d) =>
          d.name === REPORT_BATCH2_EVENTS.GENERATE && d.data.page_id === "04",
      ),
    );
    console.log("B ok — Page04 gate via registered orchestrator");

    // C — serial 04→05→06 then APPLICABILITY (registered orchestrator)
    await completePage(report_id, generation_id, "04");
    dispatched = await orchTick();
    assert.ok(
      dispatched.some(
        (d) =>
          d.name === REPORT_BATCH2_EVENTS.GENERATE && d.data.page_id === "05",
      ),
    );
    assert.ok(
      !dispatched.some(
        (d) =>
          d.name === REPORT_BATCH2_EVENTS.GENERATE && d.data.page_id === "06",
      ),
    );
    await completePage(report_id, generation_id, "05");
    dispatched = await orchTick();
    assert.ok(
      dispatched.some(
        (d) =>
          d.name === REPORT_BATCH2_EVENTS.GENERATE && d.data.page_id === "06",
      ),
    );
    await completePage(report_id, generation_id, "06");
    dispatched = await orchTick();
    assert.ok(
      dispatched.some((d) => d.name === REPORT_BATCH2_EVENTS.APPLICABILITY),
    );
    assert.ok(
      !dispatched.some(
        (d) =>
          d.name === REPORT_BATCH2_EVENTS.GENERATE && d.data.page_id === "07",
      ),
    );
    console.log("C ok — serial 04→05→06 then APPLICABILITY via registered orchestrator");

    // D — Page07 three applicability outcomes via registered function
    const appChainSender = {
      send: async (
        events: Array<{ name: string; data: Record<string, unknown> }>,
      ) => {
        for (const e of events) {
          if (
            e.name === REPORT_BATCH2_EVENTS.APPLICABILITY ||
            e.name === REPORT_BATCH2_EVENTS.ORCHESTRATE
          ) {
            await runtimeSender.send([e]);
          } else {
            captured.push(e);
          }
        }
        return { ok: true as const };
      },
      drain: () => runtimeSender.drain(),
    };

    async function runApplicabilityCase(input: {
      report_id: string;
      generation_id: string;
      dc: DecisionContext;
      expect_status: "applicable" | "not_applicable" | "insufficient_information";
      expect_generate_page: "07" | "08";
    }): Promise<void> {
      await cleanup();
      setReportBatch2EventSenderForTests(gateSender);
      await createJob({
        report_id: input.report_id,
        generation_id: input.generation_id,
        locale: "en",
        inputs: jobInputs(input.dc, input.report_id),
      });
      for (const id of ["01", "02", "04", "05", "06"] as const) {
        await completePage(input.report_id, input.generation_id, id);
      }
      captured.length = 0;
      resetBatch2InvocationRecords();
      await sendViaRuntime([
        buildOrchestratePayload({
          report_id: input.report_id,
          generation_id: input.generation_id,
          locale: "en",
        }),
      ]);
      await gateSender.drain();
      const appEv = captured.find(
        (d) => d.name === REPORT_BATCH2_EVENTS.APPLICABILITY,
      );
      assert.ok(appEv, `expected APPLICABILITY for ${input.expect_status}`);
      setReportBatch2EventSenderForTests(appChainSender);
      captured.length = 0;
      resetBatch2InvocationRecords();
      await sendViaRuntime([appEv!]);
      await appChainSender.drain();
      assert.ok(
        getBatch2InvocationRecords().some(
          (r) => r.function_id === "report-page-applicability",
        ),
      );
      assert.ok(
        getBatch2InvocationRecords().some(
          (r) => r.function_id === "report-page-orchestrator",
        ),
        "applicability must continue via registered orchestrator",
      );
      const jobAfter = await loadJob(input.report_id, input.generation_id);
      assert.equal(jobAfter.ok, true);
      const st = jobAfter.value!.page_states.find((s) => s.page_id === "07");
      assert.equal(st?.applicability_status, input.expect_status);
      assert.ok(
        captured.some(
          (d) =>
            d.name === REPORT_BATCH2_EVENTS.GENERATE &&
            d.data.page_id === input.expect_generate_page,
        ),
        `${input.expect_status} must dispatch GENERATE ${input.expect_generate_page}`,
      );
    }

    await runApplicabilityCase({
      report_id: "rpt_r1_app07",
      generation_id: "gen_app07",
      dc: baseDc({
        question:
          "Should I form a partnership with a co-founder for this venture?",
      }),
      expect_status: "applicable",
      expect_generate_page: "07",
    });
    await runApplicabilityCase({
      report_id: "rpt_r1_na07",
      generation_id: "gen_na07",
      dc: baseDc({
        question: "Should I take a solo promotion and keep my runway?",
      }),
      expect_status: "not_applicable",
      expect_generate_page: "08",
    });
    await runApplicabilityCase({
      report_id: "rpt_r1_ins07",
      generation_id: "gen_ins07",
      dc: baseDc({
        question: "What should I do next?",
        facts: [],
        dirs: [
          {
            dir_id: "dir_move",
            need: "Whether relocation is still unknown",
            why: "The move is not decided",
            required_fact_roles: [],
            current_state: "unknown",
            partial_satisfaction: false,
            agenda_item_ids: [],
            id_lifecycle: "active",
          },
        ] as DecisionContext["dirs"],
      }),
      expect_status: "insufficient_information",
      expect_generate_page: "08",
    });
    console.log("D ok — Page07 three applicability outcomes via registered function");
  }

  // --- E. Repair via registered GENERATE then REPAIR ---
  {
    await cleanup();
    setBatch2ModelInvokeForTests(async (input) => ({
      content: "{ broken-json",
      tokens_used: 1,
      model_call_id: `mc_${input.page_id}_${input.call_kind}_${input.invocation_id.slice(0, 8)}`,
    }));
    const heldRepair: Array<{ name: string; data: Record<string, unknown> }> = [];
    const genThenHoldRepair = {
      send: async (
        events: Array<{ name: string; data: Record<string, unknown> }>,
      ) => {
        for (const e of events) {
          if (e.name === REPORT_BATCH2_EVENTS.REPAIR) {
            heldRepair.push(e);
          } else {
            await runtimeSender.send([e]);
          }
        }
        return { ok: true as const };
      },
      drain: () => runtimeSender.drain(),
    };
    setReportBatch2EventSenderForTests(genThenHoldRepair);
    resetBatch2InvocationRecords();
    const report_id = "rpt_r1_repair";
    const generation_id = "gen_repair";
    await createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(baseDc(), report_id),
    });
    const job0 = await getJob(report_id, generation_id);
    assert.ok(job0);
    const prep01 = buildPageProductionPrep(job0, "01");
    const fp01 = computePageInputFingerprintForJob(job0, "01", prep01);
    assert.equal(fp01.ok, true);
    const gen01 = buildGeneratePayload({
      report_id,
      generation_id,
      page_id: "01",
      locale: "en",
      input_fingerprint: fp01.ok ? fp01.result.fingerprint : "",
      upstream_output_fingerprints: upstreamFingerprintsForPage(job0, "01", prep01.ctx),
    });
    updatePageState(job0, "01", { outcome: "queued" });
    await saveJob(job0);

    // GENERATE through registered function; hold REPAIR so we can assert KV pending first
    await sendViaRuntime([gen01]);
    await genThenHoldRepair.drain();

    const genInv = getBatch2InvocationRecords().filter(
      (r) => r.function_id === "report-page-generate",
    );
    assert.ok(genInv.length >= 1);
    assert.ok(heldRepair.length >= 1, "generate must emit REPAIR event");

    const reloaded = await loadJob(report_id, generation_id);
    assert.equal(reloaded.ok, true);
    assert.ok(reloaded.value?.repair_pending["01"]);
    assert.equal(
      reloaded.value?.page_states.find((s) => s.page_id === "01")?.outcome,
      "repair_queued",
    );

    // Clear overlay so repair must read pending from durable store
    const { clearBatch2JobMemoryOverlay } = await import(
      "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store"
    );
    clearBatch2JobMemoryOverlay(report_id, generation_id);

    setReportBatch2EventSenderForTests(runtimeSender);
    resetBatch2InvocationRecords();
    // Keep generate inv ids from before reset — re-capture after repair only
    const genInvocationId = genInv[0]!.adapter_invocation_id;
    await sendReportBatch2Events(heldRepair as Parameters<typeof sendReportBatch2Events>[0]);
    await runtimeSender.drain();

    const repairInv = getBatch2InvocationRecords().filter(
      (r) => r.function_id === "report-page-repair",
    );
    assert.ok(repairInv.length >= 1);
    assert.notEqual(genInvocationId, repairInv[0]!.adapter_invocation_id);
    const afterRepair = await loadJob(report_id, generation_id);
    assert.ok(afterRepair.value);
    assert.notEqual(
      afterRepair.value!.page_states.find((s) => s.page_id === "01")?.outcome,
      "completed",
    );
    assert.equal(afterRepair.value!.page_outputs["01"], undefined);
    console.log("E ok — repair via registered report-page-repair + KV pending");
  }

  // --- F. Registration + maxDuration ---
  {
    assert.equal(reportBatch2InngestFunctions.length, 4);
    for (const meta of REPORT_BATCH2_FUNCTION_META) {
      assert.ok(reportBatch2InngestFunctions.some((fn) => fn.id() === meta.id));
    }
    const routeSrc = readFileSync(join(process.cwd(), "app/api/inngest/route.ts"), "utf8");
    assert.match(routeSrc, /reportBatch2InngestFunctions/);
    assert.match(routeSrc, /export const maxDuration = 300/);
    console.log("F ok — function registration + maxDuration");
  }

  // --- G. Inngest + KV unavailable fail-closed ---
  {
    await cleanup();
    const prevMem = process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE;
    const prevKey = process.env.INNGEST_EVENT_KEY;
    delete process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE;
    delete process.env.INNGEST_EVENT_KEY;
    setReportBatch2EventSenderForTests(null);

    assert.equal(isReportBatch2SharedStoreAvailable(), false);

    const blockedKv = await startReportBatch2Production({
      report_id: "rpt_no_kv",
      locale: "en",
      inputs: jobInputs(baseDc(), "rpt_no_kv"),
    });
    assert.equal(blockedKv.ok, false);
    if (blockedKv.ok) throw new Error("expected kv_unavailable");
    assert.equal(blockedKv.code, "kv_unavailable");

    process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";
    const blockedInngest = await startReportBatch2Production({
      report_id: "rpt_no_inngest",
      locale: "en",
      inputs: jobInputs(baseDc(), "rpt_no_inngest"),
    });
    assert.equal(blockedInngest.ok, false);
    assert.equal(blockedInngest.code, "inngest_unavailable");

    if (prevMem !== undefined) process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = prevMem;
    else process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";
    if (prevKey !== undefined) process.env.INNGEST_EVENT_KEY = prevKey;
    console.log("G ok — kv/inngest unavailable fail closed");
  }

  // --- H. Cross-worker fingerprint visibility ---
  {
    await cleanup();
    const report_id = "rpt_r1_cross";
    const generation_id = "gen_cross";
    await createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(baseDc(), report_id),
    });
    await completePage(report_id, generation_id, "01", page01Stub);
    const jobBefore = await loadJob(report_id, generation_id);
    assert.equal(jobBefore.ok, true);
    const fp01 = jobBefore.value!.page_states.find((s) => s.page_id === "01")?.output_fingerprint;
    assert.ok(fp01);

    const job02 = await loadJob(report_id, generation_id);
    assert.ok(job02.value);
    const prep02 = buildPageProductionPrep(job02.value!, "02");
    assert.equal(prep02.build_fail, undefined);
    const upstream = job02.value!.page_states.find((s) => s.page_id === "01")?.output_fingerprint;
    assert.equal(upstream, fp01);
    console.log("H ok — Page02 loadJob sees Page01 output_fingerprint");
  }

  console.log("ok report orchestration batch2 r1");
}

async function sendViaRuntime(
  payloads: Array<{ name: string; data: unknown }>,
): Promise<void> {
  await sendReportBatch2Events(
    payloads as Parameters<typeof sendReportBatch2Events>[0],
  );
}

main()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error(err);
    await cleanup();
    process.exit(1);
  });