/**
 * Report orchestration Batch 1 R4 — DAG SSOT + production-context fingerprints.
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
  hashCanonicalPayload,
  isValidPageOutputFingerprint,
  selectUpstreamFingerprintsForPage,
  selectOptionalUpstreamFingerprintsForPage,
  requireUpstreamFingerprintsForPage,
  makeTestSharedSlice,
  buildPageSharedInputFingerprintFromProductionContext,
  page02ConsumesPage01Alignment,
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
import { buildFace05ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page05/production";
import { buildFace06ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page06/production";
import { buildFace07ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page07/production";
import { buildFace08ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page08/production";
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

/** Valid SHA-256 hex page-output fingerprints for optional upstream tests. */
const FP01_A = hashCanonicalPayload({ page: "01", v: "a" });
const FP01_B = hashCanonicalPayload({ page: "01", v: "b" });
assert.ok(isValidPageOutputFingerprint(FP01_A));
assert.ok(isValidPageOutputFingerprint(FP01_B));
assert.notEqual(FP01_A, FP01_B);

function payloadRegistryIds(ctx: {
  production_payload: {
    registry: {
      claims: Array<{ claim_id: string }>;
      evidence: Array<{ evidence_id: string }>;
    };
  };
}): { claimIds: string[]; evidenceIds: string[] } {
  return {
    claimIds: ctx.production_payload.registry.claims.map((c) => c.claim_id),
    evidenceIds: ctx.production_payload.registry.evidence.map(
      (e) => e.evidence_id,
    ),
  };
}

console.log("=== Report orchestration Batch1 R4 (production-context fingerprints) ===");

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
  // Page02 A–J: optional Page01 consumption detection + fingerprint consistency
  const pack = basePack();
  const dc = baseDc();

  const page01CoreOnly = {
    ...page01Stub,
    core_judgment: {
      text: "Core-only judgment for Page02 consumption.",
      claim_ids: ["u_destiny_01"],
    },
    why_this_path: [],
    recommendation_conditions: [],
  };
  const page01WhyOnly = {
    ...page01Stub,
    core_judgment: { text: "", claim_ids: [] },
    why_this_path: [
      { text: "Why-path-only alignment for Page02.", claim_ids: ["u_destiny_01"] },
    ],
    recommendation_conditions: [],
  };
  const page01ConditionsOnly = {
    ...page01Stub,
    core_judgment: { text: "", claim_ids: [] },
    why_this_path: [],
    recommendation_conditions: [
      {
        // Differ within architecture value_summary window (status:first-32).
        condition: "SIX-mo runway gate remains confirmed",
        status: "assumed",
        source_ids: ["fact_runway"],
      },
    ],
  };
  const page01ConditionsAlt = {
    ...page01ConditionsOnly,
    recommendation_conditions: [
      {
        condition: "THREE-mo runway gate remains confirmed",
        status: "unconfirmed",
        source_ids: ["fact_runway"],
      },
    ],
  };

  // A — only core judgment → consumed
  const builtCore = buildFace02ProductionContext({
    report_id: "job_orch_r4_02a",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    page01: page01CoreOnly,
  });
  assert.equal(builtCore.ok, true);
  if (!builtCore.ok) throw new Error(builtCore.reason);
  assert.equal(page02ConsumesPage01Alignment(builtCore.ctx), true);
  console.log("H-A ok — only Page01 core judgment → consumed");

  // B — only why paths → consumed
  const builtWhy = buildFace02ProductionContext({
    report_id: "job_orch_r4_02b",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    page01: page01WhyOnly,
  });
  assert.equal(builtWhy.ok, true);
  if (!builtWhy.ok) throw new Error(builtWhy.reason);
  assert.equal(page02ConsumesPage01Alignment(builtWhy.ctx), true);
  console.log("H-B ok — only Page01 why paths → consumed");

  // C — only recommendation conditions → consumed
  const builtCond = buildFace02ProductionContext({
    report_id: "job_orch_r4_02c",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    page01: page01ConditionsOnly,
  });
  assert.equal(builtCond.ok, true);
  if (!builtCond.ok) throw new Error(builtCond.reason);
  assert.equal(page02ConsumesPage01Alignment(builtCond.ctx), true);
  console.log("H-C ok — only Page01 recommendation conditions → consumed");

  // D — conditions content change → Page02 fingerprint changes
  const fpCond = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: builtCond.ctx,
    upstream_output_fingerprints: { "01": FP01_A },
  });
  assert.equal(fpCond.ok, true);
  if (!fpCond.ok) throw new Error(fpCond.detail);
  const builtCondAlt = buildFace02ProductionContext({
    report_id: "job_orch_r4_02c",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    page01: page01ConditionsAlt,
  });
  assert.equal(builtCondAlt.ok, true);
  if (!builtCondAlt.ok) throw new Error(builtCondAlt.reason);
  const fpCondAlt = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: builtCondAlt.ctx,
    upstream_output_fingerprints: { "01": FP01_A },
  });
  assert.equal(fpCondAlt.ok, true);
  if (!fpCondAlt.ok) throw new Error(fpCondAlt.detail);
  assert.notEqual(fpCond.result.fingerprint, fpCondAlt.result.fingerprint);
  console.log("H-D ok — recommendation conditions change → fingerprint changes");

  // E — consumed, missing Page01 output fingerprint → reject
  const missUp = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: builtCond.ctx,
    upstream_output_fingerprints: {},
  });
  assert.equal(missUp.ok, false);
  if (missUp.ok) throw new Error("expected mismatch");
  assert.equal(missUp.code, "optional_upstream_context_mismatch");
  console.log("H-E ok — consumed + missing Page01 FP rejected");

  // F — consumed, empty or invalid format → reject
  for (const bad of ["", "   ", "out_page01_v1", "absent", "zz"]) {
    const badFp = computePageInputFingerprintFromProductionContext({
      page_id: "02",
      production_context: builtCond.ctx,
      upstream_output_fingerprints: { "01": bad },
    });
    assert.equal(badFp.ok, false, `expected reject for ${JSON.stringify(bad)}`);
    if (badFp.ok) throw new Error("expected mismatch");
    assert.equal(badFp.code, "optional_upstream_context_mismatch");
  }
  console.log("H-F ok — consumed + empty/invalid Page01 FP rejected");

  // G — not consumed, but valid Page01 FP provided → reject
  const p02No = buildFace02ProductionContext({
    report_id: "job_orch_r4_02g",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
  });
  assert.equal(p02No.ok, true);
  if (!p02No.ok) throw new Error(p02No.reason);
  assert.equal(page02ConsumesPage01Alignment(p02No.ctx), false);
  const orphanUp = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: p02No.ctx,
    upstream_output_fingerprints: { "01": FP01_A },
  });
  assert.equal(orphanUp.ok, false);
  if (orphanUp.ok) throw new Error("expected mismatch");
  assert.equal(orphanUp.code, "optional_upstream_context_mismatch");
  console.log("H-G ok — not consumed + valid Page01 FP rejected");

  // H — not consumed, no Page01 FP → allow, record absent
  const fp02No = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: p02No.ctx,
    upstream_output_fingerprints: {},
  });
  assert.equal(fp02No.ok, true);
  if (!fp02No.ok) throw new Error(fp02No.detail);
  assert.equal(
    (fp02No.result.canonical_payload.optional_upstream_fingerprints as Record<
      string,
      string
    >)["01"],
    REPORT_OPTIONAL_UPSTREAM_ABSENT,
  );
  assert.equal(
    selectOptionalUpstreamFingerprintsForPage("02", {})["01"],
    REPORT_OPTIONAL_UPSTREAM_ABSENT,
  );
  console.log("H-H ok — not consumed + absent Page01 FP recorded");

  // I — consumed + valid Page01 FP → allow; FP changes with upstream hash
  const fpWithA = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: builtCond.ctx,
    upstream_output_fingerprints: { "01": FP01_A },
  });
  const fpWithB = computePageInputFingerprintFromProductionContext({
    page_id: "02",
    production_context: builtCond.ctx,
    upstream_output_fingerprints: { "01": FP01_B },
  });
  assert.equal(fpWithA.ok && fpWithB.ok, true);
  if (!fpWithA.ok || !fpWithB.ok) throw new Error("p02 up");
  assert.notEqual(fpWithA.result.fingerprint, fpWithB.result.fingerprint);
  assert.notEqual(fp02No.result.fingerprint, fpWithA.result.fingerprint);
  console.log("H-I ok — consumed + valid Page01 FP allowed");

  // J — Page01/02 still independently ready (optional is not required)
  assertPage01Page02Independent();
  const ready = resolveReportReadyState(initialPendingPageStates());
  assert.deepEqual(ready.ready_model_generations.sort(), ["01", "02"]);
  assert.deepEqual([...requiredUpstreamOf("02")], []);
  console.log("H-J ok — Page01/02 independent; optional upstream not required");
  console.log("H ok — Page02 optional Page01 A–J");
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

{
  // --- Page05–08 real builder isolation (R3) ---
  const UP05 = { "01": "o1", "02": "o2", "04": "o4" } as const;
  const UP06 = { ...UP05, "05": "o5" } as const;
  const UP07 = { ...UP06, "06": "o6" } as const;
  const UP08 = { ...UP07, "07": "o7" } as const;

  const page04ForLater = {
    page: "04",
    face: "04",
    schema_version: "face04-v2",
    content_units: [
      {
        unit_id: "u_name",
        kind: "bottleneck_label",
        text: "Cash-floor panic under offer pressure.",
        title: "",
        claim_ids: ["claim_u_path_05"],
        evidence_ids: [],
        related_reality_fact_ids: ["fact_runway"],
      },
    ],
    bottleneck_naming_unit_ids: ["u_name"],
    manifestation_unit_ids: ["u_name"],
    force_through_cost_unit_ids: ["u_name"],
    leverage_point_unit_ids: ["u_name"],
    evidence_boundary: {
      claim_ids: ["claim_u_path_05"],
      evidence_note_unit_ids: [],
      confirmed_fact_ids: ["fact_runway"],
      hypothesis_notes: [],
      uncertainty_notes: ["x"],
    },
    reading_order: [
      "bottleneck_naming",
      "manifestation",
      "force_through_cost",
      "leverage_point",
      "evidence_boundary",
    ],
  };

  const page05Schema = {
    page: "05",
    face: "05",
    schema_version: "face05-v2",
    preferred_path_ids: ["path_staged"],
    alternative_path_ids: ["path_hold"],
    cautious_path_ids: [],
    path_units: [
      {
        path_id: "path_staged",
        path_role: "preferred",
        title: "Staged explore while keeping runway",
        description: "Negotiate terms while keeping the cash floor intact.",
        prerequisites: ["runway holds"],
        required_resources: ["negotiation bandwidth"],
        risks: ["offer window closes"],
        success_signals: ["written runway plan holds for 30 days"],
        reconsideration_conditions: [],
      },
      {
        path_id: "path_hold",
        path_role: "alternative",
        title: "Hold and clarify before any leave decision",
        description: "Defer leave talk until salary and equity facts are clarified.",
        prerequisites: ["can delay response"],
        required_resources: ["time window"],
        risks: ["relationship cooling"],
        success_signals: ["key unknowns become confirmed or declined"],
        reconsideration_conditions: [],
      },
    ],
    path_comparison: {
      rows: [
        {
          path_id: "path_staged",
          benefit: "Keeps runway",
          cost: "Negotiation effort",
          risk: "Offer window",
          resource_requirement: "Bandwidth",
          reversibility: "High",
          prerequisites: "Runway holds",
        },
        {
          path_id: "path_hold",
          benefit: "Clarify first",
          cost: "Time delay",
          risk: "Cooling",
          resource_requirement: "Calendar",
          reversibility: "High",
          prerequisites: "Delay ok",
        },
      ],
    },
    switching_rules: [
      {
        rule_id: "sw_to_hold",
        source_path_id: "path_staged",
        trigger_condition: "Runway drops",
        action: "switch",
        target_path_id: "path_hold",
        rationale: "Protect cash floor",
      },
    ],
  };

  const page06Schema = {
    page: "06",
    face: "06",
    schema_version: "face06-v2",
    primary_path_id: "path_staged",
    first_step: {
      action_id: "act_first",
      what: "Write the comparison",
      path_id: "path_staged",
    },
    execution_actions: [
      { action_id: "act_budget", action: "Set a cash floor check", path_id: "path_staged" },
    ],
    monitoring_contract: {
      path_id: "path_staged",
      action_ids: ["act_first"],
      experiment_ids: [],
      observe_signals: ["Whether the written comparison exists"],
      red_flags: ["Cash floor breached"],
      review_questions: ["Did the comparison stay bounded?"],
      continue_triggers: ["Comparison stays inside the cash floor"],
      adjust_triggers: ["Scope grows past one offer"],
      stop_triggers: ["Runway falls under six months"],
      rerun_triggers: [],
      resource_guardrails: ["Do not resign during the window"],
      defer_costs: ["Waiting without a written comparison"],
      claim_ids: ["claim_u_mon_08"],
      evidence_ids: ["u_mon_08"],
      reality_fact_ids: ["fact_runway"],
    },
  };

  const page07ApplicableSchema = {
    page: "07",
    face: "07",
    schema_version: "face07-v2",
    applicability_status: "applicable",
    applicability_reason: "A named partnership is already stated.",
    participants: [{ participant_id: "self", display_label: "用户", role: "self" }],
    field_units: [
      {
        unit_id: "f_budget",
        kind: "field_constraint",
        text: "UNIQUE_FIELD_TEAM_BUDGET_CAP",
      },
    ],
    relationship_units: [],
    alignment_with_main: {
      changes_page01_recommendation: false,
      changes_page05_path_order: false,
      note: "Auxiliary condition",
    },
    evidence_boundary: { uncertainty_notes: [] },
    related_page05_path_ids: ["path_staged"],
    related_page06_action_ids: ["act_first"],
    effect_on_page06_execution: null,
  };

  // Page05
  {
    const pack05 = {
      version: 1,
      locale: "en",
      cfp_hash: "cfp_orch_05",
      zfp_hash: null,
      zfpOmitted: true,
      shot_mode: "one",
      created_at: "2026-01-01T00:00:00Z",
      units: [
        {
          id: "u_path_05",
          track: "science",
          claim: "Staged explore preserves runway.",
          anchors: ["runway_buffer"],
          serves_face: ["05"],
          term_ids: [],
          source_domain: "science",
        },
        {
          id: "u_unused_08",
          track: "science",
          claim: "Unused by Page05 — page08 only.",
          anchors: ["close"],
          serves_face: ["08"],
          term_ids: [],
          source_domain: "science",
        },
      ],
      by_face: { "05": ["u_path_05"], "08": ["u_unused_08"] },
      pattern_hits_used: [],
      science_tags_used: [],
    } as unknown as BookJudgmentPack;
    const dc05 = baseDc();
    const built = buildFace05ProductionContext({
      report_id: "job_orch_r3_05",
      locale: "en",
      dc: dc05,
      pack: pack05,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
    });
    assert.equal(built.ok, true, built.ok ? "" : built.reason);
    if (!built.ok) throw new Error(built.reason);
    const personal = (
      buildPageSharedInputFingerprintFromProductionContext("05", built.ctx) as {
        ok: true;
        extract: { components: { personal_consumed: { available_domains: string[]; domain_versions: Record<string, string> } } };
      }
    ).extract.components.personal_consumed;
    assert.ok(!personal.available_domains.includes("ziwei"));
    assert.ok(!("ziwei" in personal.domain_versions));

    const fpA = computePageInputFingerprintFromProductionContext({
      page_id: "05",
      production_context: built.ctx,
      upstream_output_fingerprints: UP05,
    });
    assert.equal(fpA.ok, true);
    if (!fpA.ok) throw new Error(fpA.detail);

    const dcChanged = baseDc({
      facts: baseDc().reality_facts!.map((f) =>
        f.fact_id === "fact_runway"
          ? { ...f, statement: "Runway about 2 months — consumed by Page05." }
          : f,
      ),
    });
    const builtFact = buildFace05ProductionContext({
      report_id: "job_orch_r3_05",
      locale: "en",
      dc: dcChanged,
      pack: pack05,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
    });
    assert.equal(builtFact.ok, true);
    if (!builtFact.ok) throw new Error(builtFact.reason);
    const fpFact = computePageInputFingerprintFromProductionContext({
      page_id: "05",
      production_context: builtFact.ctx,
      upstream_output_fingerprints: UP05,
    });
    assert.equal(fpFact.ok, true);
    if (!fpFact.ok) throw new Error(fpFact.detail);
    assert.notEqual(fpA.result.fingerprint, fpFact.result.fingerprint);

    const ids05 = payloadRegistryIds(built.ctx);
    assert.ok(!ids05.claimIds.includes("claim_u_unused_08"));
    assert.ok(!ids05.evidenceIds.includes("u_unused_08"));
    assert.ok(ids05.claimIds.includes("claim_u_path_05"));
    assert.ok(ids05.evidenceIds.includes("u_path_05"));

    // C — unused BookJudgment unit
    const packUnused = {
      ...pack05,
      units: (pack05.units as Array<{ id: string; claim: string }>).map((u) =>
        u.id === "u_unused_08" ? { ...u, claim: "CHANGED unused page08 unit" } : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnused = buildFace05ProductionContext({
      report_id: "job_orch_r3_05",
      locale: "en",
      dc: dc05,
      pack: packUnused,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
    });
    assert.equal(builtUnused.ok, true);
    if (!builtUnused.ok) throw new Error(builtUnused.reason);
    const fpUnused = computePageInputFingerprintFromProductionContext({
      page_id: "05",
      production_context: builtUnused.ctx,
      upstream_output_fingerprints: UP05,
    });
    assert.equal(fpUnused.ok, true);
    if (!fpUnused.ok) throw new Error(fpUnused.detail);
    assert.equal(fpA.result.fingerprint, fpUnused.result.fingerprint);

    // D — unused registry claim source (filtered by real builder seeding)
    const packUnusedClaim = {
      ...pack05,
      units: (pack05.units as Array<{ id: string; claim: string }>).map((u) =>
        u.id === "u_unused_08"
          ? { ...u, claim: "CHANGED unused registry claim body for Page05" }
          : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnusedClaim = buildFace05ProductionContext({
      report_id: "job_orch_r3_05",
      locale: "en",
      dc: dc05,
      pack: packUnusedClaim,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
    });
    assert.equal(builtUnusedClaim.ok, true);
    if (!builtUnusedClaim.ok) throw new Error(builtUnusedClaim.reason);
    assert.ok(
      !payloadRegistryIds(builtUnusedClaim.ctx).claimIds.includes(
        "claim_u_unused_08",
      ),
    );
    const fpUnusedClaim = computePageInputFingerprintFromProductionContext({
      page_id: "05",
      production_context: builtUnusedClaim.ctx,
      upstream_output_fingerprints: UP05,
    });
    assert.equal(fpUnusedClaim.ok, true);
    if (!fpUnusedClaim.ok) throw new Error(fpUnusedClaim.detail);
    assert.equal(fpA.result.fingerprint, fpUnusedClaim.result.fingerprint);

    // E — unused registry evidence source (caveat → explanation if seeded)
    const packUnusedEv = {
      ...pack05,
      units: (
        pack05.units as Array<{ id: string; claim: string; caveat?: string }>
      ).map((u) =>
        u.id === "u_unused_08"
          ? {
              ...u,
              caveat: "CHANGED unused registry evidence caveat for Page05",
            }
          : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnusedEv = buildFace05ProductionContext({
      report_id: "job_orch_r3_05",
      locale: "en",
      dc: dc05,
      pack: packUnusedEv,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
    });
    assert.equal(builtUnusedEv.ok, true);
    if (!builtUnusedEv.ok) throw new Error(builtUnusedEv.reason);
    assert.ok(
      !payloadRegistryIds(builtUnusedEv.ctx).evidenceIds.includes("u_unused_08"),
    );
    const fpUnusedEv = computePageInputFingerprintFromProductionContext({
      page_id: "05",
      production_context: builtUnusedEv.ctx,
      upstream_output_fingerprints: UP05,
    });
    assert.equal(fpUnusedEv.ok, true);
    if (!fpUnusedEv.ok) throw new Error(fpUnusedEv.detail);
    assert.equal(fpA.result.fingerprint, fpUnusedEv.result.fingerprint);

    const page04Changed = {
      ...page04ForLater,
      content_units: [
        {
          ...(page04ForLater.content_units[0] as object),
          text: "CHANGED bottleneck label for Page05 upstream payload.",
        },
      ],
    };
    const builtUp = buildFace05ProductionContext({
      report_id: "job_orch_r3_05",
      locale: "en",
      dc: dc05,
      pack: pack05,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04Changed,
    });
    assert.equal(builtUp.ok, true);
    if (!builtUp.ok) throw new Error(builtUp.reason);
    const fpUp = computePageInputFingerprintFromProductionContext({
      page_id: "05",
      production_context: builtUp.ctx,
      upstream_output_fingerprints: UP05,
    });
    assert.equal(fpUp.ok, true);
    if (!fpUp.ok) throw new Error(fpUp.detail);
    assert.notEqual(fpA.result.fingerprint, fpUp.result.fingerprint);
    console.log(
      "L1 ok — Page05 real builder isolation + registry claim/evidence filter",
    );
  }

  // Page06
  {
    const pack06 = {
      version: 1,
      locale: "en",
      cfp_hash: "cfp_orch_06",
      zfp_hash: null,
      zfpOmitted: true,
      shot_mode: "one",
      created_at: "2026-01-01T00:00:00Z",
      units: [
        {
          id: "u_exec_06",
          track: "science",
          claim: "Staged explore preserves runway better than cold resign.",
          anchors: ["runway_buffer"],
          serves_face: ["06"],
          term_ids: [],
          source_domain: "science",
        },
        {
          id: "u_unused_08",
          track: "science",
          claim: "Unused by Page06.",
          anchors: ["close"],
          serves_face: ["08"],
          term_ids: [],
          source_domain: "science",
        },
      ],
      by_face: { "06": ["u_exec_06"], "08": ["u_unused_08"] },
      pattern_hits_used: [],
      science_tags_used: [],
    } as unknown as BookJudgmentPack;
    const page02For06 = {
      ...page02Stub,
      content_units: [
        {
          unit_id: "p02_personal",
          kind: "personal_interpretation",
          text: "Cash-floor anxiety amplifies under offer deadlines.",
          title: "",
          claim_ids: ["claim_u_exec_06"],
          evidence_ids: ["u_exec_06"],
          source_domain: "science",
        },
      ],
    };
    const built = buildFace06ProductionContext({
      report_id: "job_orch_r3_06",
      locale: "en",
      dc: baseDc(),
      pack: pack06,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For06,
      page04: page04ForLater,
      page05: page05Schema,
    });
    assert.equal(built.ok, true, built.ok ? "" : built.reason);
    if (!built.ok) throw new Error(built.reason);
    const personal = (
      buildPageSharedInputFingerprintFromProductionContext("06", built.ctx) as {
        ok: true;
        extract: { components: { personal_consumed: { available_domains: string[]; domain_versions: Record<string, string> } } };
      }
    ).extract.components.personal_consumed;
    assert.ok(!personal.available_domains.includes("ziwei"));

    const fpA = computePageInputFingerprintFromProductionContext({
      page_id: "06",
      production_context: built.ctx,
      upstream_output_fingerprints: UP06,
    });
    assert.equal(fpA.ok, true);
    if (!fpA.ok) throw new Error(fpA.detail);

    const dcChanged = baseDc({
      facts: baseDc().reality_facts!.map((f) =>
        f.fact_id === "fact_runway"
          ? { ...f, statement: "Runway about 1 month — Page06 consumes." }
          : f,
      ),
    });
    const builtFact = buildFace06ProductionContext({
      report_id: "job_orch_r3_06",
      locale: "en",
      dc: dcChanged,
      pack: pack06,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For06,
      page04: page04ForLater,
      page05: page05Schema,
    });
    assert.equal(builtFact.ok, true);
    if (!builtFact.ok) throw new Error(builtFact.reason);
    const fpFact = computePageInputFingerprintFromProductionContext({
      page_id: "06",
      production_context: builtFact.ctx,
      upstream_output_fingerprints: UP06,
    });
    assert.equal(fpFact.ok, true);
    if (!fpFact.ok) throw new Error(fpFact.detail);
    assert.notEqual(fpA.result.fingerprint, fpFact.result.fingerprint);

    const ids06 = payloadRegistryIds(built.ctx);
    assert.ok(!ids06.claimIds.includes("claim_u_unused_08"));
    assert.ok(!ids06.evidenceIds.includes("u_unused_08"));
    assert.ok(ids06.claimIds.includes("claim_u_exec_06"));
    assert.ok(ids06.evidenceIds.includes("u_exec_06"));

    const packUnused = {
      ...pack06,
      units: (pack06.units as Array<{ id: string; claim: string }>).map((u) =>
        u.id === "u_unused_08" ? { ...u, claim: "CHANGED unused" } : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnused = buildFace06ProductionContext({
      report_id: "job_orch_r3_06",
      locale: "en",
      dc: baseDc(),
      pack: packUnused,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For06,
      page04: page04ForLater,
      page05: page05Schema,
    });
    assert.equal(builtUnused.ok, true);
    if (!builtUnused.ok) throw new Error(builtUnused.reason);
    const fpUnused = computePageInputFingerprintFromProductionContext({
      page_id: "06",
      production_context: builtUnused.ctx,
      upstream_output_fingerprints: UP06,
    });
    assert.equal(fpUnused.ok, true);
    if (!fpUnused.ok) throw new Error(fpUnused.detail);
    assert.equal(fpA.result.fingerprint, fpUnused.result.fingerprint);

    const packUnusedClaim = {
      ...pack06,
      units: (pack06.units as Array<{ id: string; claim: string }>).map((u) =>
        u.id === "u_unused_08"
          ? { ...u, claim: "CHANGED unused registry claim body for Page06" }
          : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnusedClaim = buildFace06ProductionContext({
      report_id: "job_orch_r3_06",
      locale: "en",
      dc: baseDc(),
      pack: packUnusedClaim,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For06,
      page04: page04ForLater,
      page05: page05Schema,
    });
    assert.equal(builtUnusedClaim.ok, true);
    if (!builtUnusedClaim.ok) throw new Error(builtUnusedClaim.reason);
    assert.ok(
      !payloadRegistryIds(builtUnusedClaim.ctx).claimIds.includes(
        "claim_u_unused_08",
      ),
    );
    const fpUnusedClaim = computePageInputFingerprintFromProductionContext({
      page_id: "06",
      production_context: builtUnusedClaim.ctx,
      upstream_output_fingerprints: UP06,
    });
    assert.equal(fpUnusedClaim.ok, true);
    if (!fpUnusedClaim.ok) throw new Error(fpUnusedClaim.detail);
    assert.equal(fpA.result.fingerprint, fpUnusedClaim.result.fingerprint);

    const packUnusedEv = {
      ...pack06,
      units: (
        pack06.units as Array<{ id: string; claim: string; caveat?: string }>
      ).map((u) =>
        u.id === "u_unused_08"
          ? {
              ...u,
              caveat: "CHANGED unused registry evidence caveat for Page06",
            }
          : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnusedEv = buildFace06ProductionContext({
      report_id: "job_orch_r3_06",
      locale: "en",
      dc: baseDc(),
      pack: packUnusedEv,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For06,
      page04: page04ForLater,
      page05: page05Schema,
    });
    assert.equal(builtUnusedEv.ok, true);
    if (!builtUnusedEv.ok) throw new Error(builtUnusedEv.reason);
    assert.ok(
      !payloadRegistryIds(builtUnusedEv.ctx).evidenceIds.includes("u_unused_08"),
    );
    const fpUnusedEv = computePageInputFingerprintFromProductionContext({
      page_id: "06",
      production_context: builtUnusedEv.ctx,
      upstream_output_fingerprints: UP06,
    });
    assert.equal(fpUnusedEv.ok, true);
    if (!fpUnusedEv.ok) throw new Error(fpUnusedEv.detail);
    assert.equal(fpA.result.fingerprint, fpUnusedEv.result.fingerprint);

    const page05Changed = {
      ...page05Schema,
      path_units: [
        {
          ...page05Schema.path_units[0],
          title: "CHANGED staged path title for Page06 upstream",
        },
        page05Schema.path_units[1],
      ],
    };
    const builtUp = buildFace06ProductionContext({
      report_id: "job_orch_r3_06",
      locale: "en",
      dc: baseDc(),
      pack: pack06,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For06,
      page04: page04ForLater,
      page05: page05Changed,
    });
    assert.equal(builtUp.ok, true);
    if (!builtUp.ok) throw new Error(builtUp.reason);
    const fpUp = computePageInputFingerprintFromProductionContext({
      page_id: "06",
      production_context: builtUp.ctx,
      upstream_output_fingerprints: UP06,
    });
    assert.equal(fpUp.ok, true);
    if (!fpUp.ok) throw new Error(fpUp.detail);
    assert.notEqual(fpA.result.fingerprint, fpUp.result.fingerprint);
    console.log(
      "L2 ok — Page06 real builder isolation + registry claim/evidence filter",
    );
  }

  // Page07
  {
    const pack07 = {
      version: 1,
      locale: "en",
      cfp_hash: "cfp_orch_07",
      zfp_hash: null,
      zfpOmitted: true,
      shot_mode: "one",
      created_at: "2026-01-01T00:00:00Z",
      units: [
        {
          id: "u_field_07",
          track: "science",
          claim: "A written split is the condition for sharing a move.",
          anchors: ["split_before_move"],
          serves_face: ["07"],
          term_ids: [],
          source_domain: "science",
        },
        {
          id: "u_unused_08",
          track: "science",
          claim: "Unused by Page07.",
          anchors: ["close"],
          serves_face: ["08"],
          term_ids: [],
          source_domain: "science",
        },
      ],
      by_face: { "07": ["u_field_07"], "08": ["u_unused_08"] },
      pattern_hits_used: [],
      science_tags_used: [],
    } as unknown as BookJudgmentPack;

    const dcApplicable = {
      ...baseDc({
        question: "Should I relocate and enter a partnership with Alex?",
        facts: [
          {
            fact_id: "fact_alex",
            statement: "Partnership with Alex requires a written split before we relocate.",
            status: "confirmed",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "t1",
            user_confirmed: true,
          },
        ],
      }),
      constraints: [
        {
          constraint_id: "c_split",
          statement: "No relocate until the partnership split is written.",
          category: "responsibility",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: "t1",
          rigidity: "hard",
          user_confirmed: true,
        },
      ],
    } as unknown as DecisionContext;

    const dcSolo = baseDc({
      question: "Should I take a solo promotion and keep my runway?",
    });

    const page02For07 = {
      ...page02Stub,
      content_units: [
        {
          unit_id: "p02_personal",
          kind: "personal_interpretation",
          text: "The user tightens when responsibility is unwritten.",
          title: "",
          claim_ids: ["claim_u_field_07"],
          evidence_ids: ["u_field_07"],
          source_domain: "science",
        },
      ],
    };
    const page05For07 = {
      ...page05Schema,
      preferred_path_ids: ["path_split"],
      path_units: [
        {
          path_id: "path_split",
          path_role: "preferred",
          title: "Write the split before relocating",
          description: "Keep the move conditional on a written partnership split.",
          prerequisites: ["Alex is willing"],
          required_resources: ["one conversation"],
          risks: ["Talk stalls"],
          success_signals: ["A dated split note exists"],
          reconsideration_conditions: [],
        },
      ],
    };
    const page06For07 = {
      ...page06Schema,
      primary_path_id: "path_split",
      first_step: {
        action_id: "act_first",
        path_id: "path_split",
        what: "Draft the split note before any move date.",
      },
      execution_actions: [
        {
          action_id: "act_send",
          path_id: "path_split",
          action: "Send the draft only after it names the split.",
        },
      ],
    };

    const builtApp = buildFace07ProductionContext({
      report_id: "job_orch_r3_07",
      locale: "en",
      dc: dcApplicable,
      pack: pack07,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For07,
      page04: page04ForLater,
      page05: page05For07,
      page06: page06For07,
    });
    assert.equal(builtApp.ok, true, builtApp.ok ? "" : builtApp.reason);
    if (!builtApp.ok) throw new Error(builtApp.reason);
    assert.equal(builtApp.ctx.applicability.status, "applicable");
    const personal = (
      buildPageSharedInputFingerprintFromProductionContext("07", builtApp.ctx) as {
        ok: true;
        extract: { components: { personal_consumed: { available_domains: string[]; domain_versions: Record<string, string> } } };
      }
    ).extract.components.personal_consumed;
    assert.ok(!personal.available_domains.includes("ziwei"));

    const fpApp = computePageInputFingerprintFromProductionContext({
      page_id: "07",
      production_context: builtApp.ctx,
      upstream_output_fingerprints: UP07,
    });
    assert.equal(fpApp.ok, true);
    if (!fpApp.ok) throw new Error(fpApp.detail);

    const builtSolo = buildFace07ProductionContext({
      report_id: "job_orch_r3_07",
      locale: "en",
      dc: dcSolo,
      pack: pack07,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For07,
      page04: page04ForLater,
      page05: page05For07,
      page06: page06For07,
    });
    assert.equal(builtSolo.ok, true);
    if (!builtSolo.ok) throw new Error(builtSolo.reason);
    assert.notEqual(builtSolo.ctx.applicability.status, "applicable");
    const fpSolo = computePageInputFingerprintFromProductionContext({
      page_id: "07",
      production_context: builtSolo.ctx,
      upstream_output_fingerprints: UP07,
    });
    assert.equal(fpSolo.ok, true);
    if (!fpSolo.ok) throw new Error(fpSolo.detail);
    assert.notEqual(fpApp.result.fingerprint, fpSolo.result.fingerprint);

    const ids07 = payloadRegistryIds(builtApp.ctx);
    assert.ok(!ids07.claimIds.includes("claim_u_unused_08"));
    assert.ok(!ids07.evidenceIds.includes("u_unused_08"));
    assert.ok(ids07.claimIds.includes("claim_u_field_07"));
    assert.ok(ids07.evidenceIds.includes("u_field_07"));

    const packUnused = {
      ...pack07,
      units: (pack07.units as Array<{ id: string; claim: string }>).map((u) =>
        u.id === "u_unused_08" ? { ...u, claim: "CHANGED unused by 07" } : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnused = buildFace07ProductionContext({
      report_id: "job_orch_r3_07",
      locale: "en",
      dc: dcApplicable,
      pack: packUnused,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For07,
      page04: page04ForLater,
      page05: page05For07,
      page06: page06For07,
    });
    assert.equal(builtUnused.ok, true);
    if (!builtUnused.ok) throw new Error(builtUnused.reason);
    const fpUnused = computePageInputFingerprintFromProductionContext({
      page_id: "07",
      production_context: builtUnused.ctx,
      upstream_output_fingerprints: UP07,
    });
    assert.equal(fpUnused.ok, true);
    if (!fpUnused.ok) throw new Error(fpUnused.detail);
    assert.equal(fpApp.result.fingerprint, fpUnused.result.fingerprint);

    const packUnusedClaim = {
      ...pack07,
      units: (pack07.units as Array<{ id: string; claim: string }>).map((u) =>
        u.id === "u_unused_08"
          ? { ...u, claim: "CHANGED unused registry claim body for Page07" }
          : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnusedClaim = buildFace07ProductionContext({
      report_id: "job_orch_r3_07",
      locale: "en",
      dc: dcApplicable,
      pack: packUnusedClaim,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For07,
      page04: page04ForLater,
      page05: page05For07,
      page06: page06For07,
    });
    assert.equal(builtUnusedClaim.ok, true);
    if (!builtUnusedClaim.ok) throw new Error(builtUnusedClaim.reason);
    assert.ok(
      !payloadRegistryIds(builtUnusedClaim.ctx).claimIds.includes(
        "claim_u_unused_08",
      ),
    );
    const fpUnusedClaim = computePageInputFingerprintFromProductionContext({
      page_id: "07",
      production_context: builtUnusedClaim.ctx,
      upstream_output_fingerprints: UP07,
    });
    assert.equal(fpUnusedClaim.ok, true);
    if (!fpUnusedClaim.ok) throw new Error(fpUnusedClaim.detail);
    assert.equal(fpApp.result.fingerprint, fpUnusedClaim.result.fingerprint);

    const packUnusedEv = {
      ...pack07,
      units: (
        pack07.units as Array<{ id: string; claim: string; caveat?: string }>
      ).map((u) =>
        u.id === "u_unused_08"
          ? {
              ...u,
              caveat: "CHANGED unused registry evidence caveat for Page07",
            }
          : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnusedEv = buildFace07ProductionContext({
      report_id: "job_orch_r3_07",
      locale: "en",
      dc: dcApplicable,
      pack: packUnusedEv,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For07,
      page04: page04ForLater,
      page05: page05For07,
      page06: page06For07,
    });
    assert.equal(builtUnusedEv.ok, true);
    if (!builtUnusedEv.ok) throw new Error(builtUnusedEv.reason);
    assert.ok(
      !payloadRegistryIds(builtUnusedEv.ctx).evidenceIds.includes("u_unused_08"),
    );
    const fpUnusedEv = computePageInputFingerprintFromProductionContext({
      page_id: "07",
      production_context: builtUnusedEv.ctx,
      upstream_output_fingerprints: UP07,
    });
    assert.equal(fpUnusedEv.ok, true);
    if (!fpUnusedEv.ok) throw new Error(fpUnusedEv.detail);
    assert.equal(fpApp.result.fingerprint, fpUnusedEv.result.fingerprint);

    const page06Changed = {
      ...page06For07,
      first_step: {
        ...page06For07.first_step,
        what: "CHANGED first step for Page07 upstream payload",
      },
    };
    const builtUp = buildFace07ProductionContext({
      report_id: "job_orch_r3_07",
      locale: "en",
      dc: dcApplicable,
      pack: pack07,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02For07,
      page04: page04ForLater,
      page05: page05For07,
      page06: page06Changed,
    });
    assert.equal(builtUp.ok, true);
    if (!builtUp.ok) throw new Error(builtUp.reason);
    const fpUp = computePageInputFingerprintFromProductionContext({
      page_id: "07",
      production_context: builtUp.ctx,
      upstream_output_fingerprints: UP07,
    });
    assert.equal(fpUp.ok, true);
    if (!fpUp.ok) throw new Error(fpUp.detail);
    assert.notEqual(fpApp.result.fingerprint, fpUp.result.fingerprint);
    console.log(
      "L3 ok — Page07 real builder isolation + applicability + registry filter",
    );
  }

  // Page08
  {
    const pack08 = {
      version: 1,
      locale: "en",
      cfp_hash: "cfp_orch_08",
      zfp_hash: null,
      zfpOmitted: true,
      shot_mode: "one",
      created_at: "2026-01-01T00:00:00Z",
      units: [
        {
          id: "u_mon_08",
          track: "science",
          claim: "Watch the cash floor before widening the explore.",
          anchors: ["runway_buffer"],
          serves_face: ["08"],
          term_ids: [],
          source_domain: "science",
        },
        {
          id: "u_unused_05",
          track: "science",
          claim: "Unused by Page08 — page05 only.",
          anchors: ["path"],
          serves_face: ["05"],
          term_ids: [],
          source_domain: "science",
        },
      ],
      by_face: { "08": ["u_mon_08"], "05": ["u_unused_05"] },
      pattern_hits_used: [],
      science_tags_used: [],
    } as unknown as BookJudgmentPack;

    const built = buildFace08ProductionContext({
      report_id: "job_orch_r3_08",
      locale: "en",
      dc: baseDc(),
      pack: pack08,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
      page05: page05Schema,
      page06: page06Schema,
      page07: page07ApplicableSchema,
    });
    assert.equal(built.ok, true, built.ok ? "" : built.reason);
    if (!built.ok) throw new Error(built.reason);

    const fpA = computePageInputFingerprintFromProductionContext({
      page_id: "08",
      production_context: built.ctx,
      upstream_output_fingerprints: UP08,
    });
    assert.equal(fpA.ok, true);
    if (!fpA.ok) throw new Error(fpA.detail);

    const dcChanged = baseDc({
      facts: baseDc().reality_facts!.map((f) =>
        f.fact_id === "fact_runway"
          ? { ...f, statement: "Runway about 4 months — changes dateCorpus." }
          : f,
      ),
    });
    const builtFact = buildFace08ProductionContext({
      report_id: "job_orch_r3_08",
      locale: "en",
      dc: dcChanged,
      pack: pack08,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
      page05: page05Schema,
      page06: page06Schema,
      page07: page07ApplicableSchema,
    });
    assert.equal(builtFact.ok, true);
    if (!builtFact.ok) throw new Error(builtFact.reason);
    assert.notEqual(built.ctx.dateCorpus, builtFact.ctx.dateCorpus);
    const fpFact = computePageInputFingerprintFromProductionContext({
      page_id: "08",
      production_context: builtFact.ctx,
      upstream_output_fingerprints: UP08,
    });
    assert.equal(fpFact.ok, true);
    if (!fpFact.ok) throw new Error(fpFact.detail);
    assert.notEqual(fpA.result.fingerprint, fpFact.result.fingerprint);

    const ids08 = payloadRegistryIds(built.ctx);
    assert.ok(!ids08.claimIds.includes("claim_u_unused_05"));
    assert.ok(!ids08.evidenceIds.includes("u_unused_05"));
    assert.ok(ids08.claimIds.includes("claim_u_mon_08"));
    assert.ok(ids08.evidenceIds.includes("u_mon_08"));

    const packUnused = {
      ...pack08,
      units: (pack08.units as Array<{ id: string; claim: string }>).map((u) =>
        u.id === "u_unused_05" ? { ...u, claim: "CHANGED unused page05 unit" } : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnused = buildFace08ProductionContext({
      report_id: "job_orch_r3_08",
      locale: "en",
      dc: baseDc(),
      pack: packUnused,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
      page05: page05Schema,
      page06: page06Schema,
      page07: page07ApplicableSchema,
    });
    assert.equal(builtUnused.ok, true);
    if (!builtUnused.ok) throw new Error(builtUnused.reason);
    const fpUnused = computePageInputFingerprintFromProductionContext({
      page_id: "08",
      production_context: builtUnused.ctx,
      upstream_output_fingerprints: UP08,
    });
    assert.equal(fpUnused.ok, true);
    if (!fpUnused.ok) throw new Error(fpUnused.detail);
    assert.equal(fpA.result.fingerprint, fpUnused.result.fingerprint);

    const packUnusedClaim = {
      ...pack08,
      units: (pack08.units as Array<{ id: string; claim: string }>).map((u) =>
        u.id === "u_unused_05"
          ? { ...u, claim: "CHANGED unused registry claim body for Page08" }
          : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnusedClaim = buildFace08ProductionContext({
      report_id: "job_orch_r3_08",
      locale: "en",
      dc: baseDc(),
      pack: packUnusedClaim,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
      page05: page05Schema,
      page06: page06Schema,
      page07: page07ApplicableSchema,
    });
    assert.equal(builtUnusedClaim.ok, true);
    if (!builtUnusedClaim.ok) throw new Error(builtUnusedClaim.reason);
    assert.ok(
      !payloadRegistryIds(builtUnusedClaim.ctx).claimIds.includes(
        "claim_u_unused_05",
      ),
    );
    const fpUnusedClaim = computePageInputFingerprintFromProductionContext({
      page_id: "08",
      production_context: builtUnusedClaim.ctx,
      upstream_output_fingerprints: UP08,
    });
    assert.equal(fpUnusedClaim.ok, true);
    if (!fpUnusedClaim.ok) throw new Error(fpUnusedClaim.detail);
    assert.equal(fpA.result.fingerprint, fpUnusedClaim.result.fingerprint);

    const packUnusedEv = {
      ...pack08,
      units: (
        pack08.units as Array<{ id: string; claim: string; caveat?: string }>
      ).map((u) =>
        u.id === "u_unused_05"
          ? {
              ...u,
              caveat: "CHANGED unused registry evidence caveat for Page08",
            }
          : u,
      ),
    } as unknown as BookJudgmentPack;
    const builtUnusedEv = buildFace08ProductionContext({
      report_id: "job_orch_r3_08",
      locale: "en",
      dc: baseDc(),
      pack: packUnusedEv,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
      page05: page05Schema,
      page06: page06Schema,
      page07: page07ApplicableSchema,
    });
    assert.equal(builtUnusedEv.ok, true);
    if (!builtUnusedEv.ok) throw new Error(builtUnusedEv.reason);
    assert.ok(
      !payloadRegistryIds(builtUnusedEv.ctx).evidenceIds.includes("u_unused_05"),
    );
    const fpUnusedEv = computePageInputFingerprintFromProductionContext({
      page_id: "08",
      production_context: builtUnusedEv.ctx,
      upstream_output_fingerprints: UP08,
    });
    assert.equal(fpUnusedEv.ok, true);
    if (!fpUnusedEv.ok) throw new Error(fpUnusedEv.detail);
    assert.equal(fpA.result.fingerprint, fpUnusedEv.result.fingerprint);

    const page07Changed = {
      ...page07ApplicableSchema,
      field_units: [
        {
          unit_id: "f_budget",
          kind: "field_constraint",
          text: "CHANGED_FIELD_TEXT_FOR_DATE_CORPUS",
        },
      ],
    };
    const builtCorpus = buildFace08ProductionContext({
      report_id: "job_orch_r3_08",
      locale: "en",
      dc: baseDc(),
      pack: pack08,
      chart_fact_pack: "日主甲木…",
      page01: page01Stub,
      page02: page02Stub,
      page04: page04ForLater,
      page05: page05Schema,
      page06: page06Schema,
      page07: page07Changed,
    });
    assert.equal(builtCorpus.ok, true);
    if (!builtCorpus.ok) throw new Error(builtCorpus.reason);
    assert.notEqual(built.ctx.dateCorpus, builtCorpus.ctx.dateCorpus);
    const fpCorpus = computePageInputFingerprintFromProductionContext({
      page_id: "08",
      production_context: builtCorpus.ctx,
      upstream_output_fingerprints: UP08,
    });
    assert.equal(fpCorpus.ok, true);
    if (!fpCorpus.ok) throw new Error(fpCorpus.detail);
    assert.notEqual(fpA.result.fingerprint, fpCorpus.result.fingerprint);
    console.log(
      "L4 ok — Page08 real builder isolation + dateCorpus + registry filter",
    );
  }

  console.log("L ok — Page05–08 real production-context isolation");
}

console.log("ok report orchestration batch1 R4");
