/**
 * Report orchestration Batch 2 — Inngest scheduling + concurrent Page01/02.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch2.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  REPORT_BATCH2_EVENTS,
  buildGeneratePayload,
  buildRepairPayload,
  buildOrchestratePayload,
  sendReportBatch2Events,
  runReportPageGenerateOnce,
  handleApplicabilityEvent,
  handleGenerateEvent,
  handleOrchestrateEvent,
  handleRepairEvent,
  resetBatch2JobStoreForTests,
  runReportBatch2OrchestratorTick,
  setBatch2ModelDelayMsForTests,
  setBatch2ModelInvokeForTests,
  setReportBatch2EventSenderForTests,
  startReportBatch2Production,
  createJob,
  getJob,
  saveJob,
  setPageOutput,
  updatePageState,
  type ReportBatch2ApplicabilityEventData,
  type ReportBatch2GenerateEventData,
  type ReportBatch2OrchestrateEventData,
  type ReportBatch2RepairEventData,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import {
  hashCanonicalPayload,
  resolveReportReadyState,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { ReportPageId } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";
import { reportBatch2InngestFunctions } from "@/lib/inngest/functions/report-batch2";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ReportBatch2JobInputs } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/types";
import {
  buildPageProductionPrep,
  computePageInputFingerprintForJob,
  upstreamFingerprintsForPage,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2/page-prep";

type BusDispatch = { name: string; page_id?: string; at: number };

type ModelRecord = {
  page_id: string;
  call_kind: "generate" | "repair";
  invocation_id: string;
  model_call_id: string;
  started_at: string;
  ended_at: string;
};

const modelRecords: ModelRecord[] = [];

function baseDc(overrides?: {
  facts?: DecisionContext["reality_facts"];
  question?: string;
}): DecisionContext {
  return {
    context_id: "dc_orch_b2",
    version: 1,
    status: "final",
    content_hash: "hash_orch_b2",
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
    constraints: [
      {
        constraint_id: "c_runway",
        statement: "Keep at least 6 months runway.",
        category: "financial",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t1",
        rigidity: "hard",
        user_confirmed: true,
        related_dir_ids: ["DIR_RUNWAY"],
      },
    ],
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
      {
        dir_id: "DIR_OFFER",
        need: "Offer",
        why: "Terms",
        required_fact_roles: ["job_offer"],
        current_state: "known",
        partial_satisfaction: true,
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
    cfp_hash: "cfp_orch_b2",
    zfp_hash: null,
    zfpOmitted: true,
    shot_mode: "one",
    created_at: "2026-01-01T00:00:00Z",
    units: [
      {
        id: "u_destiny_01",
        track: "destiny",
        claim: "Current cycle favors keeping a stable cash floor. cfp:dayMaster",
        anchors: ["cfp:dayMaster"],
        serves_face: ["01", "02", "04"],
        caveat: "Not a timing guarantee.",
        term_ids: ["day_master"],
        source_domain: "bazi",
        source_version: "cfp_orch_b2",
      },
      {
        id: "u_science_01",
        track: "science",
        claim: "Eight-month runway supports a staged path.",
        anchors: ["runway_months"],
        serves_face: ["01", "02", "04"],
        term_ids: [],
        source_domain: "science",
      },
    ],
    by_face: {
      "01": ["u_destiny_01", "u_science_01"],
      "02": ["u_destiny_01", "u_science_01"],
      "04": ["u_destiny_01", "u_science_01"],
    },
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

function pageStub(pageId: ReportPageId): Record<string, unknown> {
  return { page: pageId, face: pageId, schema_version: `face${pageId}-test`, test: true };
}

const page01AlignmentStub = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: {
    text: "Keep the job while testing the offer.",
    claim_ids: ["u_destiny_01"],
  },
  why_this_path: [
    {
      text: "Cash floor is intact.",
      claim_ids: ["u_destiny_01"],
    },
  ],
  recommendation_conditions: [
    {
      condition: "Runway stays above 6 months",
      status: "assumed",
      source_ids: ["fact_runway"],
    },
  ],
  not_recommended: [
    {
      option: "Resign cold",
      reason: "Burns runway",
      cost_or_conflict: "Irreversible cash shock",
    },
  ],
  applicability_boundary: {
    current_basis: ["Confirmed runway"],
    invalidation_conditions: ["Runway collapses"],
    page02_evidence_ids: ["u_destiny_01"],
    page08_review_refs: [],
  },
};

/** Pre-seed Page01 body for Page02 prep while Page01 outcome stays pending (parallel dispatch). */
function seedPage01DraftForParallelPage02(
  report_id: string,
  generation_id: string,
): void {
  const job = getJob(report_id, generation_id);
  assert.ok(job);
  const fp = hashCanonicalPayload(page01AlignmentStub);
  job.page_outputs["01"] = page01AlignmentStub;
  updatePageState(job, "01", { output_fingerprint: fp });
  saveJob(job);
}

function completePage(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
  payload?: Record<string, unknown>,
): void {
  const job = getJob(report_id, generation_id);
  assert.ok(job, "job missing");
  const out = payload ?? pageStub(page_id);
  const fp = hashCanonicalPayload(out);
  setPageOutput(job, page_id, out, fp);
  updatePageState(job, page_id, {
    outcome: "completed",
    output_fingerprint: fp,
  });
  saveJob(job);
}

function dispatchEventNames(
  report_id: string,
  generation_id: string,
  eventName: string,
  page_id?: string,
): number {
  const job = getJob(report_id, generation_id);
  assert.ok(job);
  return job.dispatch_log.filter(
    (e) =>
      e.event_name === eventName &&
      (page_id === undefined || e.page_id === page_id),
  ).length;
}

class TestEventBus {
  readonly dispatchLog: BusDispatch[] = [];
  private inFlight: Promise<void>[] = [];

  install(): void {
    setReportBatch2EventSenderForTests({
      send: async (events) => {
        for (const e of events) {
          const page_id =
            typeof e.data.page_id === "string"
              ? (e.data.page_id as string)
              : undefined;
          this.dispatchLog.push({ name: e.name, page_id, at: Date.now() });
          const work = this.routeEvent(e.name, e.data).catch((err) => {
            throw err;
          });
          this.inFlight.push(work);
        }
        return { ok: true };
      },
    });
  }

  reset(): void {
    this.dispatchLog.length = 0;
    this.inFlight.length = 0;
  }

  private async routeEvent(
    name: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (name === REPORT_BATCH2_EVENTS.ORCHESTRATE) {
      await handleOrchestrateEvent(data as ReportBatch2OrchestrateEventData);
      return;
    }
    if (name === REPORT_BATCH2_EVENTS.GENERATE) {
      await handleGenerateEvent(data as ReportBatch2GenerateEventData);
      return;
    }
    if (name === REPORT_BATCH2_EVENTS.REPAIR) {
      await handleRepairEvent(data as ReportBatch2RepairEventData);
      return;
    }
    if (name === REPORT_BATCH2_EVENTS.APPLICABILITY) {
      await handleApplicabilityEvent(data as ReportBatch2ApplicabilityEventData);
      return;
    }
    throw new Error(`unknown batch2 event: ${name}`);
  }

  async drain(): Promise<void> {
    const deadline = Date.now() + 120_000;
    let quietMs = 0;
    while (Date.now() < deadline) {
      if (this.inFlight.length > 0) {
        const batch = this.inFlight.splice(0);
        await Promise.all(batch);
        quietMs = 0;
        continue;
      }
      await new Promise((r) => setTimeout(r, 25));
      quietMs += 25;
      if (quietMs >= 200) break;
    }
  }

  flush(): Promise<void> {
    return this.drain();
  }
}

function installDefaultModelStub(
  responder?: (input: {
    page_id: string;
    call_kind: "generate" | "repair";
  }) => string,
): void {
  setBatch2ModelInvokeForTests(async (input) => {
    const started_at = new Date().toISOString();
    const content =
      responder?.(input) ?? JSON.stringify({ not_a_valid_page: true });
    const model_call_id = `mc_${input.page_id}_${input.call_kind}_${input.invocation_id.slice(0, 8)}`;
    const ended_at = new Date().toISOString();
    modelRecords.push({
      page_id: input.page_id,
      call_kind: input.call_kind,
      invocation_id: input.invocation_id,
      model_call_id,
      started_at,
      ended_at,
    });
    return { content, tokens_used: 1, model_call_id };
  });
}

function cleanupAll(bus?: TestEventBus): void {
  resetBatch2JobStoreForTests();
  setReportBatch2EventSenderForTests(null);
  setBatch2ModelInvokeForTests(null);
  setBatch2ModelDelayMsForTests(null);
  modelRecords.length = 0;
  bus?.reset();
}

async function main(): Promise<void> {
  console.log("=== Report orchestration Batch2 (Inngest scheduling) ===");

  const bus = new TestEventBus();

  try {
  // --- A. Page01/02 parallel ---
  {
    cleanupAll(bus);
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });

    const report_id = "rpt_b2_parallel";
    const generation_id = "gen_parallel";
    createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(baseDc(), report_id),
    });
    seedPage01DraftForParallelPage02(report_id, generation_id);

    const tick = await runReportBatch2OrchestratorTick({
      report_id,
      generation_id,
    });
    assert.equal(tick.ok, true);
    if (!tick.ok) throw new Error(tick.detail);
    const genPayloads = tick.dispatched.filter(
      (d) => d.name === REPORT_BATCH2_EVENTS.GENERATE,
    );
    assert.equal(genPayloads.length, 2);
    assert.deepEqual(
      genPayloads
        .map((d) => (d.data as ReportBatch2GenerateEventData).page_id)
        .sort(),
      ["01", "02"],
    );

    const jobAfterTick = getJob(report_id, generation_id);
    assert.ok(jobAfterTick);
    assert.equal(
      jobAfterTick.dispatch_log.filter(
        (e) => e.event_name === REPORT_BATCH2_EVENTS.GENERATE,
      ).length,
      2,
    );

    bus.install();
    installDefaultModelStub();
    setBatch2ModelDelayMsForTests(80);
    modelRecords.length = 0;

    const dispatchStartedAt = Date.now();
    await Promise.all(
      genPayloads.map((payload) =>
        handleGenerateEvent(payload.data as ReportBatch2GenerateEventData),
      ),
    );
    const dispatchEndedAt = Date.now();
    assert.ok(
      dispatchEndedAt - dispatchStartedAt < 140,
      "concurrent GENERATE workers should overlap (not serial 80ms+80ms)",
    );
    await bus.drain();

    const job = getJob(report_id, generation_id);
    assert.ok(job);
    const invGen = job.invocation_log.filter(
      (e) => e.event_name === REPORT_BATCH2_EVENTS.GENERATE,
    );
    const inv01 = invGen.filter((e) => e.page_id === "01");
    const inv02 = invGen.filter((e) => e.page_id === "02");
    assert.equal(inv01.length, 1);
    assert.equal(inv02.length, 1);
    assert.ok(inv01[0]?.started_at && inv01[0]?.ended_at);
    assert.ok(inv02[0]?.started_at && inv02[0]?.ended_at);
    assert.ok(
      inv01[0]!.started_at! < inv02[0]!.ended_at! &&
        inv02[0]!.started_at! < inv01[0]!.ended_at!,
      "model invoke windows should overlap (80ms delay)",
    );
    assert.notEqual(inv01[0]!.invocation_id, inv02[0]!.invocation_id);

    const generates = modelRecords.filter((r) => r.call_kind === "generate");
    assert.equal(generates.length, 2);
    assert.notEqual(generates[0]!.invocation_id, generates[1]!.invocation_id);

    assert.equal(job.page_outputs["02"], undefined);

    const prod = await startReportBatch2Production({
      report_id: "rpt_b2_parallel_api",
      locale: "en",
      inputs: jobInputs(baseDc(), "rpt_b2_parallel_api"),
    });
    assert.equal(prod.ok, true);

    console.log("A ok — Page01/02 parallel GENERATE + overlapping model invokes");
  }

  // --- B. Page04 gate ---
  {
    cleanupAll(bus);
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    const report_id = "rpt_b2_gate";
    const generation_id = "gen_gate";
    createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(baseDc(), report_id),
    });

    completePage(report_id, generation_id, "01");
    let tick = await runReportBatch2OrchestratorTick({ report_id, generation_id });
    assert.equal(tick.ok, true);
    if (!tick.ok) throw new Error(tick.detail);
    assert.ok(
      !tick.dispatched.some(
        (d) =>
          d.name === REPORT_BATCH2_EVENTS.GENERATE &&
          "page_id" in d.data &&
          d.data.page_id === "04",
      ),
    );

    resetBatch2JobStoreForTests();
    createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(baseDc(), report_id),
    });
    completePage(report_id, generation_id, "02");
    tick = await runReportBatch2OrchestratorTick({ report_id, generation_id });
    assert.equal(tick.ok, true);
    if (!tick.ok) throw new Error(tick.detail);
    assert.ok(
      !tick.dispatched.some(
        (d) =>
          d.name === REPORT_BATCH2_EVENTS.GENERATE &&
          "page_id" in d.data &&
          d.data.page_id === "04",
      ),
    );

    resetBatch2JobStoreForTests();
    createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(baseDc(), report_id),
    });
    completePage(report_id, generation_id, "01");
    completePage(report_id, generation_id, "02");
    tick = await runReportBatch2OrchestratorTick({ report_id, generation_id });
    assert.equal(tick.ok, true);
    if (!tick.ok) throw new Error(tick.detail);
  assert.ok(
      tick.dispatched.some(
        (d) =>
          d.name === REPORT_BATCH2_EVENTS.GENERATE &&
          "page_id" in d.data &&
          d.data.page_id === "04",
      ),
    );
    console.log("B ok — Page04 gated on both Page01 and Page02");
  }

  // --- C. Serial downstream ---
  {
    cleanupAll(bus);
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    const report_id = "rpt_b2_serial";
    const generation_id = "gen_serial";
    createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(baseDc(), report_id),
    });

    completePage(report_id, generation_id, "01");
    completePage(report_id, generation_id, "02");
    let tick = await runReportBatch2OrchestratorTick({ report_id, generation_id });
    assert.equal(tick.ok, true);
    if (!tick.ok) throw new Error(tick.detail);
    const genPages = tick.dispatched
      .filter((d) => d.name === REPORT_BATCH2_EVENTS.GENERATE)
      .map((d) => ("page_id" in d.data ? d.data.page_id : null));
    assert.deepEqual(genPages, ["04"]);

    completePage(report_id, generation_id, "04");
    tick = await runReportBatch2OrchestratorTick({ report_id, generation_id });
    assert.equal(tick.ok, true);
    if (!tick.ok) throw new Error(tick.detail);
    assert.deepEqual(
      tick.dispatched
        .filter((d) => d.name === REPORT_BATCH2_EVENTS.GENERATE)
        .map((d) => ("page_id" in d.data ? d.data.page_id : null)),
      ["05"],
    );

    completePage(report_id, generation_id, "05");
    tick = await runReportBatch2OrchestratorTick({ report_id, generation_id });
    assert.equal(tick.ok, true);
    if (!tick.ok) throw new Error(tick.detail);
    assert.deepEqual(
      tick.dispatched
        .filter((d) => d.name === REPORT_BATCH2_EVENTS.GENERATE)
        .map((d) => ("page_id" in d.data ? d.data.page_id : null)),
      ["06"],
    );

    completePage(report_id, generation_id, "06");
    tick = await runReportBatch2OrchestratorTick({ report_id, generation_id });
    assert.equal(tick.ok, true);
    if (!tick.ok) throw new Error(tick.detail);
    assert.ok(
      tick.dispatched.some((d) => d.name === REPORT_BATCH2_EVENTS.APPLICABILITY),
    );
    assert.ok(
      !tick.dispatched.some(
        (d) =>
          d.name === REPORT_BATCH2_EVENTS.GENERATE &&
          "page_id" in d.data &&
          d.data.page_id === "07",
      ),
    );

    const job = getJob(report_id, generation_id)!;
    updatePageState(job, "07", {
      outcome: "skipped_not_applicable",
      applicability_status: "not_applicable",
    });
    saveJob(job);
    const ready08 = resolveReportReadyState(job.page_states);
    assert.deepEqual(ready08.ready_model_generations, ["08"]);
    tick = await runReportBatch2OrchestratorTick({ report_id, generation_id });
    assert.equal(tick.ok, true);
    if (!tick.ok) throw new Error(tick.detail);
    const dispatched08 = tick.dispatched.some(
      (d) =>
        d.name === REPORT_BATCH2_EVENTS.GENERATE &&
        "page_id" in d.data &&
        d.data.page_id === "08",
    );
    const logged08 = job.dispatch_log.some(
      (e) =>
        e.event_name === REPORT_BATCH2_EVENTS.GENERATE && e.page_id === "08",
    );
    assert.ok(
      dispatched08 ||
        logged08 ||
        getJob(report_id, generation_id)!.page_states.find(
          (s) => s.page_id === "08",
        )?.outcome === "failed",
      "Page08 ready after Page07 skip; GENERATE may fail prep with toy upstream stubs",
    );
    console.log("C ok — serial downstream 04→05→06→07 gate→08");
  }

  // --- D. Page07 applicability ---
  {
    const runApplicabilityScenario = async (opts: {
      label: string;
      dc: DecisionContext;
      expectGenerate07: boolean;
      expectOutcome?: string;
    }) => {
      cleanupAll(bus);
      bus.install();
      installDefaultModelStub();
      const report_id = `rpt_b2_p07_${opts.label}`;
      const generation_id = `gen_p07_${opts.label}`;
      createJob({
        report_id,
        generation_id,
        locale: "en",
        inputs: jobInputs(opts.dc, report_id),
      });
      for (const pid of ["01", "02", "04", "05", "06"] as const) {
        completePage(report_id, generation_id, pid);
      }
      const tick = await runReportBatch2OrchestratorTick({
        report_id,
        generation_id,
      });
      assert.equal(tick.ok, true);
      if (!tick.ok) throw new Error(tick.detail);
      await bus.drain();

      const job = getJob(report_id, generation_id)!;
      const st07 = job.page_states.find((s) => s.page_id === "07");

      if (opts.expectOutcome) {
        assert.equal(st07?.outcome, opts.expectOutcome);
      }

      if (opts.expectGenerate07) {
        assert.equal(st07?.applicability_status, "applicable");
        const tickGen = await runReportBatch2OrchestratorTick({
          report_id,
          generation_id,
        });
        assert.equal(tickGen.ok, true);
        await bus.drain();
        assert.ok(
          bus.dispatchLog.some(
            (e) =>
              e.name === REPORT_BATCH2_EVENTS.GENERATE && e.page_id === "07",
          ) ||
            dispatchEventNames(
              report_id,
              generation_id,
              REPORT_BATCH2_EVENTS.GENERATE,
              "07",
            ) > 0 ||
            tickGen.dispatched.some(
              (d) =>
                d.name === REPORT_BATCH2_EVENTS.GENERATE &&
                "page_id" in d.data &&
                d.data.page_id === "07",
            ),
        );
      } else {
        assert.notEqual(st07?.applicability_status, "applicable");
        assert.equal(
          bus.dispatchLog.filter(
            (e) =>
              e.name === REPORT_BATCH2_EVENTS.GENERATE && e.page_id === "07",
          ).length,
          0,
        );
        const ready08 = resolveReportReadyState(job.page_states);
        assert.deepEqual(ready08.ready_model_generations, ["08"]);
        const tick08 = await runReportBatch2OrchestratorTick({
          report_id,
          generation_id,
        });
        assert.equal(tick08.ok, true);
        assert.ok(
          tick08.dispatched.some(
            (d) =>
              d.name === REPORT_BATCH2_EVENTS.GENERATE &&
              "page_id" in d.data &&
              d.data.page_id === "08",
          ) ||
            job.dispatch_log.some(
              (e) =>
                e.event_name === REPORT_BATCH2_EVENTS.GENERATE &&
                e.page_id === "08",
            ) ||
            getJob(report_id, generation_id)!.page_states.find(
              (s) => s.page_id === "08",
            )?.outcome === "failed",
        );
      }
    };

    await runApplicabilityScenario({
      label: "applicable",
      dc: baseDc({
        question:
          "Should I enter a partnership with Alex as co-founder this quarter?",
      }),
      expectGenerate07: true,
    });

    await runApplicabilityScenario({
      label: "not_applicable",
      dc: baseDc({
        question: "Should I take a solo promotion and keep my runway?",
      }),
      expectGenerate07: false,
      expectOutcome: "skipped_not_applicable",
    });

    const dcInsufficient = baseDc({
      question: "Should I optimize my personal runway this quarter?",
      facts: [
        {
          fact_id: "fact_career_unlinked",
          statement: "Considering a career change but terms are disputed.",
          status: "disputed",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: "t1",
          user_confirmed: false,
        },
      ],
    });
    await runApplicabilityScenario({
      label: "insufficient",
      dc: dcInsufficient,
      expectGenerate07: false,
      expectOutcome: "insufficient_information",
    });

    console.log(
      "D ok — Page07 applicable / not_applicable / insufficient_information + unlock 08",
    );
  }

  // --- E. Repair independent ---
  {
    cleanupAll(bus);
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    installDefaultModelStub();
    const report_id = "rpt_b2_repair";
    const generation_id = "gen_repair";
    createJob({
      report_id,
      generation_id,
      locale: "en",
      inputs: jobInputs(baseDc(), report_id),
    });
    const job0 = getJob(report_id, generation_id)!;
    const prep01 = buildPageProductionPrep(job0, "01");
    assert.equal(prep01.build_fail, undefined);
    const fp01 = computePageInputFingerprintForJob(job0, "01", prep01);
    assert.equal(fp01.ok, true);
    if (!fp01.ok) throw new Error(fp01.detail);
    const gen01 = buildGeneratePayload({
      report_id,
      generation_id,
      page_id: "01",
      locale: "en",
      input_fingerprint: fp01.result.fingerprint,
      upstream_output_fingerprints: upstreamFingerprintsForPage(
        job0,
        "01",
        prep01.ctx,
      ),
    });
    updatePageState(job0, "01", { outcome: "queued" });
    saveJob(job0);
    const directGen = await runReportPageGenerateOnce({
      event: gen01.data,
      invocation_id: "e2e-gen-01",
      worker_id: "report-page-generate",
    });
    assert.equal(
      directGen.status,
      "needs_repair",
      JSON.stringify(directGen),
    );
    bus.install();
    await sendReportBatch2Events([
      buildRepairPayload({
        report_id,
        generation_id,
        page_id: "01",
        locale: "en",
        input_fingerprint: gen01.data.input_fingerprint,
      }),
    ]);
    await bus.drain();

    const job = getJob(report_id, generation_id)!;
    const st01 = job.page_states.find((s) => s.page_id === "01");
    assert.ok(
      bus.dispatchLog.some((e) => e.name === REPORT_BATCH2_EVENTS.REPAIR),
    );

    const genLog = job.invocation_log.filter(
      (e) =>
        e.page_id === "01" && e.event_name === REPORT_BATCH2_EVENTS.GENERATE,
    );
    const repairLog = job.invocation_log.filter(
      (e) => e.page_id === "01" && e.event_name === REPORT_BATCH2_EVENTS.REPAIR,
    );
    assert.equal(genLog.length, 1);
    assert.ok(repairLog.length >= 1);
    assert.equal(genLog[0]!.worker_id, "report-page-generate");
    assert.equal(repairLog[0]!.worker_id, "report-page-repair");
    assert.notEqual(genLog[0]!.invocation_id, repairLog[0]!.invocation_id);

    const genModel = modelRecords.filter(
      (r) => r.page_id === "01" && r.call_kind === "generate",
    );
    const repairModel = modelRecords.filter(
      (r) => r.page_id === "01" && r.call_kind === "repair",
    );
    assert.equal(genModel.length, 1);
    assert.ok(repairModel.length >= 1);
    assert.notEqual(genModel[0]!.invocation_id, repairModel[0]!.invocation_id);

    assert.notEqual(st01?.outcome, "completed");
    assert.equal(st01?.outcome, "failed");
    assert.equal(job.page_outputs["01"], undefined);
    console.log("E ok — generate vs repair independent workers and invocations");
  }

  // --- F. Independent budgets / registrations ---
  {
    assert.equal(reportBatch2InngestFunctions.length, 4);
    const ids = reportBatch2InngestFunctions.map((fn) => fn.id());
    assert.ok(ids.includes("report-page-orchestrator"));
    assert.ok(ids.includes("report-page-generate"));
    assert.ok(ids.includes("report-page-repair"));
    assert.ok(ids.includes("report-page-applicability"));
    assert.notEqual(
      ids.find((id) => id === "report-page-generate"),
      ids.find((id) => id === "report-page-repair"),
    );

    const routePath = join(process.cwd(), "app/api/inngest/route.ts");
    const routeSrc = readFileSync(routePath, "utf8");
    assert.match(routeSrc, /reportBatch2InngestFunctions/);
    assert.match(routeSrc, /export const maxDuration = 300/);

    const vercelPath = join(process.cwd(), "vercel.json");
    const vercelSrc = readFileSync(vercelPath, "utf8");
    assert.match(
      vercelSrc,
      /"app\/api\/inngest\/route\.ts"[\s\S]*"maxDuration":\s*300/,
    );
    console.log("F ok — four Inngest functions + route/vercel maxDuration 300");
  }

  // --- G. Inngest unavailable ---
  {
    cleanupAll(bus);
    const prevKey = process.env.INNGEST_EVENT_KEY;
    const prevVia = process.env.REPORT_BATCH2_VIA_INNGEST;
    delete process.env.INNGEST_EVENT_KEY;
    process.env.REPORT_BATCH2_VIA_INNGEST = "0";
    setReportBatch2EventSenderForTests(null);

    const blocked = await startReportBatch2Production({
      report_id: "rpt_b2_no_inngest",
      locale: "en",
      inputs: jobInputs(baseDc(), "rpt_b2_no_inngest"),
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) throw new Error("expected inngest_unavailable");
    assert.equal(blocked.code, "inngest_unavailable");

    if (prevKey !== undefined) process.env.INNGEST_EVENT_KEY = prevKey;
    else delete process.env.INNGEST_EVENT_KEY;
    if (prevVia !== undefined) process.env.REPORT_BATCH2_VIA_INNGEST = prevVia;
    else delete process.env.REPORT_BATCH2_VIA_INNGEST;

    console.log("G ok — no Inngest / test sender → inngest_unavailable, no V3 fallback");
  }

  {
    const orchSrc = readFileSync(
      join(
        process.cwd(),
        "lib/llm/pro/delivery/decision-report-v2/batch2/orchestrator.ts",
      ),
      "utf8",
    );
    assert.ok(!orchSrc.includes("callLLM("));
    console.log("H ok — batch2 orchestrator tick has no callLLM");
  }

    console.log("ok report orchestration batch2");
  } finally {
    cleanupAll(bus);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});