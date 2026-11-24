/**
 * Report orchestration Batch 1 R2 — DAG SSOT + production-context fingerprints.
 * No LLM / Inngest workers. Run: pnpm exec tsx scripts/test-report-orchestration-batch1.ts
 */

import assert from "node:assert/strict";
import {
  REPORT_ORCHESTRATION_GRAPH_VERSION,
  REPORT_PAGE_IDS,
  REPORT_PAGE_REGISTRY,
  REPORT_DERIVED_NODE_REGISTRY,
  REPORT_OPTIONAL_UPSTREAM_ABSENT,
  PAGE_VALIDATOR_VERSIONS,
  PAGE_PRODUCTION_VERSIONS,
  buildReportDependencyGraph,
  validateReportDependencyGraph,
  requiredUpstreamOf,
  transitiveUpstreamOf,
  downstreamDependentsOf,
  assertPage01Page02Independent,
  computePageInputFingerprint,
  computePageInputFingerprintFromProductionContext,
  computeAllPageInputFingerprints,
  selectUpstreamFingerprintsForPage,
  selectOptionalUpstreamFingerprintsForPage,
  requireUpstreamFingerprintsForPage,
  makeTestSharedSlice,
  buildPageSharedInputFingerprintFromProductionContext,
  resolveReportReadyState,
  initialPendingPageStates,
  isPageReadyToDispatch,
  isPage07ApplicabilityGateReady,
  isPage07ModelGenerationReady,
  reportPageDefinition,
  pageFingerprintOptionalUpstreamIds,
  pageSharedInputKeys,
  type ReportPageRuntimeState,
  type ReportPageId,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import { buildFace01ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page01/production";
import { buildFace02ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page02/production";
import { buildFace04ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page04/production";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";

function mark(
  states: ReportPageRuntimeState[],
  pageId: ReportPageRuntimeState["page_id"],
  outcome: ReportPageRuntimeState["outcome"],
  extra?: Partial<ReportPageRuntimeState>,
): ReportPageRuntimeState[] {
  return states.map((s) =>
    s.page_id === pageId ? { ...s, outcome, ...extra } : s,
  );
}

function completeThrough06(
  states: ReportPageRuntimeState[],
): ReportPageRuntimeState[] {
  let s = states;
  for (const id of ["01", "02", "04", "05", "06"] as const) {
    s = mark(s, id, "completed");
  }
  return s;
}

function baseDc(overrides?: {
  facts?: DecisionContext["reality_facts"];
  question?: string;
}): DecisionContext {
  return {
    context_id: "dc_orch_r2",
    version: 1,
    status: "final",
    content_hash: "hash_orch_r2",
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
        fact_id: "fact_salary_guess",
        statement: "Maybe total cash is around 120k.",
        status: "unverified",
        verification_level: "user_estimate",
        source_stage: "collecting",
        source_turn_id: "t2",
        user_confirmed: false,
        fact_roles: ["job_offer"],
        related_dir_ids: ["DIR_OFFER"],
      },
      {
        fact_id: "fact_noise_hobby",
        statement: "Likes hiking on weekends.",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t4",
        user_confirmed: true,
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
    cfp_hash: "cfp_orch_r2",
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
        source_version: "cfp_orch_r2",
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
      {
        id: "u_page08_only",
        track: "science",
        claim: "Close ritual note for page 08 only — unused by Page01.",
        anchors: ["close"],
        serves_face: ["08"],
        term_ids: [],
        source_domain: "science",
      },
    ],
    by_face: {
      "01": ["u_destiny_01", "u_science_01"],
      "02": ["u_destiny_01", "u_science_01"],
      "04": ["u_destiny_01", "u_science_01"],
      "08": ["u_page08_only"],
    },
    pattern_hits_used: [],
    science_tags_used: [],
  } as unknown as BookJudgmentPack;
}

const page01Stub = {
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

const page02Stub = {
  page: "02",
  face: "02",
  schema_version: "face02-v2",
  content_units: [
    {
      unit_id: "p02_u1",
      kind: "personal_interpretation",
      text: "Day-master framing favors staged exploration.",
      claim_ids: ["u_destiny_01"],
      evidence_ids: ["u_destiny_01"],
      related_dir_ids: [],
    },
  ],
  explanation_boundary: {
    text: "Not a guarantee.",
    evidence_ids: [],
  },
};

console.log("=== Report orchestration Batch1 R2 (production-context fingerprints) ===");

{
  const graph = buildReportDependencyGraph();
  const validated = validateReportDependencyGraph(graph);
  assert.equal(
    validated.ok,
    true,
    validated.ok ? "" : validated.issues.map((i) => i.detail).join(" | "),
  );
  assert.equal(graph.graph_version, REPORT_ORCHESTRATION_GRAPH_VERSION);
  assert.deepEqual([...graph.page_ids], [...REPORT_PAGE_IDS]);
  assert.equal(REPORT_PAGE_REGISTRY.length, 7);
  assert.equal(REPORT_DERIVED_NODE_REGISTRY[0]?.node_id, "glossary_appendix");
  // Per-page shared keys are not identical across all pages.
  assert.notDeepEqual(
    [...pageSharedInputKeys("01")],
    [...pageSharedInputKeys("07")],
  );
  assert.ok(pageSharedInputKeys("02").includes("page01_alignment_consumed"));
  assert.ok(!pageSharedInputKeys("01").includes("page01_alignment_consumed"));
  assert.ok(pageSharedInputKeys("07").includes("applicability_consumed"));
  assert.ok(!pageSharedInputKeys("07").includes("readings_consumed"));
  assert.ok(pageSharedInputKeys("08").includes("date_corpus_consumed"));
  assert.ok(!pageSharedInputKeys("08").includes("readings_consumed"));
  console.log("A ok — graph validates; shared_input_keys differ by page");
}

{
  assertPage01Page02Independent();
  assert.deepEqual([...requiredUpstreamOf("01")], []);
  assert.deepEqual([...requiredUpstreamOf("02")], []);
  assert.deepEqual([...pageFingerprintOptionalUpstreamIds("02")], ["01"]);
  assert.deepEqual([...pageFingerprintOptionalUpstreamIds("01")], []);
  console.log("B ok — Page01/02 no required mutual dep; Page02 optional←01");
}

{
  assert.deepEqual([...requiredUpstreamOf("04")], ["01", "02"]);
  assert.ok(reportPageDefinition("07").conditional);
  console.log("C ok — required upstream chain intact");
}

{
  const cycleGraph = buildReportDependencyGraph();
  const broken = {
    ...cycleGraph,
    edges: [...cycleGraph.edges, { from: "08" as const, to: "01" as const }],
  };
  const validated = validateReportDependencyGraph(broken);
  assert.equal(validated.ok, false);
  if (validated.ok) throw new Error("expected cycle");
  assert.ok(validated.issues.some((i) => i.code === "cycle_detected"));
  console.log("D ok — cycles rejected");
}

{
  let states = initialPendingPageStates();
  let res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_model_generations.sort(), ["01", "02"]);
  assert.deepEqual(res.ready_applicability_gates, []);
  // Optional Page01 must not block Page02
  assert.ok(res.ready_model_generations.includes("02"));

  states = completeThrough06(states);
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_applicability_gates, ["07"]);
  assert.deepEqual(res.ready_model_generations, []);

  states = mark(states, "07", "pending", { applicability_status: "applicable" });
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_model_generations, ["07"]);

  states = mark(states, "07", "skipped_not_applicable", {
    applicability_status: "not_applicable",
  });
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_model_generations, ["08"]);
  console.log("E ok — ready progression; Page02 not blocked by optional Page01");
}

{
  let states = completeThrough06(initialPendingPageStates());
  assert.ok(isPage07ApplicabilityGateReady(states));
  assert.equal(isPage07ModelGenerationReady(states), false);
  states = mark(states, "07", "pending", { applicability_status: "applicable" });
  assert.ok(isPage07ModelGenerationReady(states));
  states = mark(states, "07", "insufficient_information", {
    applicability_status: "insufficient_information",
  });
  const res = resolveReportReadyState(states);
  assert.ok(!res.ready_model_generations.includes("07"));
  assert.deepEqual(res.ready_model_generations, ["08"]);
  console.log("F ok — Page07 gate / applicable / insufficient transitions");
}

{
  // --- Real production-context fingerprints (Page01) ---
  const pack = basePack();
  const dc = baseDc();
  const built = buildFace01ProductionContext({
    report_id: "job_orch_r2_01",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
  });
  assert.equal(built.ok, true, built.ok ? "" : built.reason);
  if (!built.ok) throw new Error(built.reason);

  const fpBase = computePageInputFingerprintFromProductionContext({
    page_id: "01",
    production_context: built.ctx,
    upstream_output_fingerprints: {},
  });
  assert.equal(fpBase.ok, true, fpBase.ok ? "" : fpBase.detail);
  if (!fpBase.ok) throw new Error(fpBase.detail);

  // Used fact change → FP changes
  const dcFactChanged = baseDc({
    facts: baseDc().reality_facts!.map((f) =>
      f.fact_id === "fact_runway"
        ? { ...f, statement: "Personal runway is about 3 months." }
        : f,
    ),
  });
  const builtFact = buildFace01ProductionContext({
    report_id: "job_orch_r2_01",
    locale: "en",
    dc: dcFactChanged,
    pack,
    chart_fact_pack: "日主甲木…",
  });
  assert.equal(builtFact.ok, true);
  if (!builtFact.ok) throw new Error(builtFact.reason);
  const inSlice = built.ctx.slice.reality_context.facts.some(
    (f) => f.fact_id === "fact_runway",
  );
  assert.ok(inSlice, "fact_runway must be consumed by Page01");
  const fpFact = computePageInputFingerprintFromProductionContext({
    page_id: "01",
    production_context: builtFact.ctx,
    upstream_output_fingerprints: {},
  });
  assert.equal(fpFact.ok, true);
  if (!fpFact.ok) throw new Error(fpFact.detail);
  assert.notEqual(fpBase.result.fingerprint, fpFact.result.fingerprint);

  // Unused Page08-only unit / reading change → Page01 FP unchanged
  const packUnusedChanged = {
    ...pack,
    units: pack.units.map((u) =>
      u.id === "u_page08_only"
        ? { ...u, claim: "CHANGED close ritual for page 08 only." }
        : u,
    ),
  } as BookJudgmentPack;
  const builtUnused = buildFace01ProductionContext({
    report_id: "job_orch_r2_01",
    locale: "en",
    dc,
    pack: packUnusedChanged,
    chart_fact_pack: "日主甲木…",
  });
  assert.equal(builtUnused.ok, true);
  if (!builtUnused.ok) throw new Error(builtUnused.reason);
  assert.ok(
    !Object.keys(builtUnused.ctx.registry.claims).includes("u_page08_only") &&
      !Object.keys(builtUnused.ctx.registry.evidence).includes("u_page08_only"),
    "Page01 must not consume page08-only unit",
  );
  const fpUnused = computePageInputFingerprintFromProductionContext({
    page_id: "01",
    production_context: builtUnused.ctx,
    upstream_output_fingerprints: {},
  });
  assert.equal(fpUnused.ok, true);
  if (!fpUnused.ok) throw new Error(fpUnused.detail);
  assert.equal(fpBase.result.fingerprint, fpUnused.result.fingerprint);

  // Used approved reading / destiny unit change → Page01 FP changes
  const packReadingChanged = {
    ...pack,
    units: pack.units.map((u) =>
      u.id === "u_destiny_01"
        ? { ...u, claim: "CHANGED destiny claim for page 01. cfp:dayMaster" }
        : u,
    ),
  } as BookJudgmentPack;
  const builtReading = buildFace01ProductionContext({
    report_id: "job_orch_r2_01",
    locale: "en",
    dc,
    pack: packReadingChanged,
    chart_fact_pack: "日主甲木…",
  });
  assert.equal(builtReading.ok, true);
  if (!builtReading.ok) throw new Error(builtReading.reason);
  const fpReading = computePageInputFingerprintFromProductionContext({
    page_id: "01",
    production_context: builtReading.ctx,
    upstream_output_fingerprints: {},
  });
  assert.equal(fpReading.ok, true);
  if (!fpReading.ok) throw new Error(fpReading.detail);
  assert.notEqual(fpBase.result.fingerprint, fpReading.result.fingerprint);

  // Missing production context → fail closed
  const missingCtx = computePageInputFingerprintFromProductionContext({
    page_id: "01",
    production_context: null,
    upstream_output_fingerprints: {},
  });
  assert.equal(missingCtx.ok, false);
  if (missingCtx.ok) throw new Error("unreachable");
  assert.equal(missingCtx.code, "missing_production_context");
  console.log("G ok — Page01 real context: used fact/reading change; unused unit ignored");
}

{
  // Page01/02 personal domains: bazi-only vs ziwei availability
  const pack = basePack();
  const dc = baseDc();
  const baziOnly = buildFace01ProductionContext({
    report_id: "job_orch_r2_dom",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    ziwei_available: false,
  });
  assert.equal(baziOnly.ok, true);
  if (!baziOnly.ok) throw new Error(baziOnly.reason);
  const fpBazi = computePageInputFingerprintFromProductionContext({
    page_id: "01",
    production_context: baziOnly.ctx,
    upstream_output_fingerprints: {},
  });
  assert.equal(fpBazi.ok, true);
  if (!fpBazi.ok) throw new Error(fpBazi.detail);

  // Page02 without Page01 vs with Page01
  const p02No = buildFace02ProductionContext({
    report_id: "job_orch_r2_02",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
  });
  assert.equal(p02No.ok, true);
  if (!p02No.ok) throw new Error(p02No.reason);
  const fp02No = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: p02No.ctx,
    upstream_output_fingerprints: {},
  });
  assert.equal(fp02No.ok, true);
  if (!fp02No.ok) throw new Error(fp02No.detail);
  const optAbsent = selectOptionalUpstreamFingerprintsForPage("02", {});
  assert.equal(optAbsent["01"], REPORT_OPTIONAL_UPSTREAM_ABSENT);
  assert.equal(
    (fp02No.result.canonical_payload.optional_upstream_fingerprints as Record<
      string,
      string
    >)["01"],
    REPORT_OPTIONAL_UPSTREAM_ABSENT,
  );

  const p02With = buildFace02ProductionContext({
    report_id: "job_orch_r2_02",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    page01: page01Stub,
  });
  assert.equal(p02With.ok, true);
  if (!p02With.ok) throw new Error(p02With.reason);
  assert.ok(p02With.ctx.page01_core_judgment);
  const fp02WithAbsentUp = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: p02With.ctx,
    upstream_output_fingerprints: {},
  });
  assert.equal(fp02WithAbsentUp.ok, true);
  if (!fp02WithAbsentUp.ok) throw new Error(fp02WithAbsentUp.detail);
  // Alignment content present → different from no-Page01 context
  assert.notEqual(fp02No.result.fingerprint, fp02WithAbsentUp.result.fingerprint);

  // Page01 output fingerprint present vs changed
  const fp02WithUp = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: p02With.ctx,
    upstream_output_fingerprints: { "01": "out_page01_v1" },
  });
  const fp02WithUp2 = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: p02With.ctx,
    upstream_output_fingerprints: { "01": "out_page01_v2" },
  });
  assert.equal(fp02WithUp.ok && fp02WithUp2.ok, true);
  if (!fp02WithUp.ok || !fp02WithUp2.ok) throw new Error("p02 up");
  assert.notEqual(fp02WithUp.result.fingerprint, fp02WithUp2.result.fingerprint);
  assert.notEqual(fp02WithAbsentUp.result.fingerprint, fp02WithUp.result.fingerprint);

  // Still independently ready
  const ready = resolveReportReadyState(initialPendingPageStates());
  assert.deepEqual(ready.ready_model_generations.sort(), ["01", "02"]);
  console.log("H ok — Page02 optional Page01 alignment + output FP; parallel ready");
}

{
  // Page04 real context: unused page08 unit ignored; used fact changes FP; no ziwei in personal
  const pack = basePack();
  const dc = baseDc();
  const built = buildFace04ProductionContext({
    report_id: "job_orch_r2_04",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    page01: page01Stub,
    page02: page02Stub,
  });
  assert.equal(built.ok, true, built.ok ? "" : built.reason);
  if (!built.ok) throw new Error(built.reason);
  const extract = buildPageSharedInputFingerprintFromProductionContext(
    "04",
    built.ctx,
  );
  assert.equal(extract.ok, true);
  if (!extract.ok) throw new Error(extract.detail);
  const personal = extract.extract.components.personal_consumed as {
    domain_versions: Record<string, string>;
    available_domains: string[];
  };
  assert.ok(!("ziwei" in personal.domain_versions));
  assert.ok(!personal.available_domains.includes("ziwei"));

  const fp04 = computePageInputFingerprintFromProductionContext({
    page_id: "04",
    production_context: built.ctx,
    upstream_output_fingerprints: { "01": "o1", "02": "o2" },
  });
  assert.equal(fp04.ok, true);
  if (!fp04.ok) throw new Error(fp04.detail);

  const dcChanged = baseDc({
    facts: baseDc().reality_facts!.map((f) =>
      f.fact_id === "fact_runway"
        ? { ...f, statement: "Runway collapsed to 2 months." }
        : f,
    ),
  });
  const built2 = buildFace04ProductionContext({
    report_id: "job_orch_r2_04",
    locale: "en",
    dc: dcChanged,
    pack,
    chart_fact_pack: "日主甲木…",
    page01: page01Stub,
    page02: page02Stub,
  });
  assert.equal(built2.ok, true);
  if (!built2.ok) throw new Error(built2.reason);
  const fp04b = computePageInputFingerprintFromProductionContext({
    page_id: "04",
    production_context: built2.ctx,
    upstream_output_fingerprints: { "01": "o1", "02": "o2" },
  });
  assert.equal(fp04b.ok, true);
  if (!fp04b.ok) throw new Error(fp04b.detail);
  assert.notEqual(fp04.result.fingerprint, fp04b.result.fingerprint);

  const pack08Changed = {
    ...pack,
    units: pack.units.map((u) =>
      u.id === "u_page08_only" ? { ...u, claim: "CHANGED unused by 04" } : u,
    ),
  } as BookJudgmentPack;
  const built3 = buildFace04ProductionContext({
    report_id: "job_orch_r2_04",
    locale: "en",
    dc,
    pack: pack08Changed,
    chart_fact_pack: "日主甲木…",
    page01: page01Stub,
    page02: page02Stub,
  });
  assert.equal(built3.ok, true);
  if (!built3.ok) throw new Error(built3.reason);
  const fp04c = computePageInputFingerprintFromProductionContext({
    page_id: "04",
    production_context: built3.ctx,
    upstream_output_fingerprints: { "01": "o1", "02": "o2" },
  });
  assert.equal(fp04c.ok, true);
  if (!fp04c.ok) throw new Error(fp04c.detail);
  assert.equal(fp04.result.fingerprint, fp04c.result.fingerprint);

  // Page01 vs Page04 slices do not cross-contaminate: Page01 FP unchanged by Page04-only upstream bag noise
  const p01 = buildFace01ProductionContext({
    report_id: "job_orch_r2_x",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
  });
  assert.equal(p01.ok, true);
  if (!p01.ok) throw new Error(p01.reason);
  const a = computePageInputFingerprintFromProductionContext({
    page_id: "01",
    production_context: p01.ctx,
    upstream_output_fingerprints: {},
  });
  const b = computePageInputFingerprintFromProductionContext({
    page_id: "01",
    production_context: p01.ctx,
    upstream_output_fingerprints: { "04": "should_ignore", "08": "nope" },
  });
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) throw new Error("cross");
  assert.equal(a.result.fingerprint, b.result.fingerprint);
  console.log("I ok — Page04 real context isolation; no ziwei; cross-page bag ignored");
}

{
  // Fail-closed required upstream (still)
  const cases: Array<{ page: ReportPageId; up: Record<string, string>; missing: string }> = [
    { page: "04", up: { "02": "b" }, missing: "01" },
    { page: "04", up: { "01": "a" }, missing: "02" },
    { page: "05", up: { "01": "a", "02": "b" }, missing: "04" },
    { page: "08", up: { "01": "a", "02": "b", "04": "c", "05": "d", "06": "e" }, missing: "07" },
  ];
  for (const c of cases) {
    const req = requireUpstreamFingerprintsForPage(c.page, c.up);
    assert.equal(req.ok, false);
    if (req.ok) throw new Error("unreachable");
    assert.ok(req.missing_upstream.includes(c.missing as ReportPageId));
    const fp = computePageInputFingerprint({
      page_id: c.page,
      shared_slice: makeTestSharedSlice(c.page),
      upstream_output_fingerprints: c.up,
      page07_applicability_status:
        c.page === "07" || c.page === "08" ? "applicable" : undefined,
    });
    assert.equal(fp.ok, false);
  }
  // Page01/02 still compute without required upstream
  const p01 = computePageInputFingerprint({
    page_id: "01",
    shared_slice: makeTestSharedSlice("01"),
    upstream_output_fingerprints: {},
  });
  assert.equal(p01.ok, true);
  console.log("J ok — fail-closed missing required upstream");
}

{
  // Version isolation via opaque slices (not a consumption proof)
  const slices = Object.fromEntries(
    REPORT_PAGE_IDS.map((id) => [id, makeTestSharedSlice(id)]),
  ) as Record<ReportPageId, ReturnType<typeof makeTestSharedSlice>>;
  const FULL_UP = {
    "01": "o1",
    "02": "o2",
    "04": "o4",
    "05": "o5",
    "06": "o6",
    "07": "o7",
  };
  const before = computeAllPageInputFingerprints({
    shared_slices: slices,
    upstream_output_fingerprints: FULL_UP,
    page07_applicability_status: "applicable",
  });
  assert.equal(before.errors.length, 0, before.errors.map((e) => e.detail).join("|"));
  const after = computeAllPageInputFingerprints({
    shared_slices: slices,
    upstream_output_fingerprints: FULL_UP,
    page07_applicability_status: "applicable",
    validator_version_overrides: { "05": "page05-validator-BUMPED" },
  });
  assert.equal(after.errors.length, 0);
  assert.equal(before.results["01"]?.fingerprint, after.results["01"]?.fingerprint);
  assert.equal(before.results["04"]?.fingerprint, after.results["04"]?.fingerprint);
  assert.notEqual(before.results["05"]?.fingerprint, after.results["05"]?.fingerprint);
  for (const id of REPORT_PAGE_IDS) {
    assert.equal(reportPageDefinition(id).validator_version, PAGE_VALIDATOR_VERSIONS[id]);
    assert.equal(reportPageDefinition(id).production_version, PAGE_PRODUCTION_VERSIONS[id]);
  }
  const selected = selectUpstreamFingerprintsForPage("05", {
    "01": "a",
    "02": "b",
    "04": "c",
    "06": "ignore",
  });
  assert.deepEqual(selected, { "01": "a", "02": "b", "04": "c" });
  assert.deepEqual(downstreamDependentsOf("07"), ["08"]);
  assert.ok(transitiveUpstreamOf("08").includes("01"));
  assert.ok(isPageReadyToDispatch("01", initialPendingPageStates()));
  console.log("K ok — per-page validator isolation + upstream select");
}

console.log("ok report orchestration batch1 R2");
