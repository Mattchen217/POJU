/**
 * Report orchestration Batch 1 R1 — DAG SSOT + fingerprints + ready resolution.
 * No LLM / Inngest workers. Run: pnpm exec tsx scripts/test-report-orchestration-batch1.ts
 */

import assert from "node:assert/strict";
import {
  REPORT_ORCHESTRATION_GRAPH_VERSION,
  REPORT_PAGE_IDS,
  REPORT_PAGE_REGISTRY,
  REPORT_DERIVED_NODE_REGISTRY,
  PAGE_VALIDATOR_VERSIONS,
  PAGE_PRODUCTION_VERSIONS,
  buildReportDependencyGraph,
  validateReportDependencyGraph,
  requiredUpstreamOf,
  transitiveUpstreamOf,
  downstreamDependentsOf,
  assertPage01Page02Independent,
  computePageInputFingerprint,
  computeAllPageInputFingerprints,
  selectUpstreamFingerprintsForPage,
  requireUpstreamFingerprintsForPage,
  makeTestSharedSlice,
  resolveReportReadyState,
  initialPendingPageStates,
  isPageReadyToDispatch,
  isPage07ApplicabilityGateReady,
  isPage07ModelGenerationReady,
  reportPageDefinition,
  type ReportPageRuntimeState,
  type ReportPageSharedInputSlice,
  type ReportPageId,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";

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

const FULL_UPSTREAM = {
  "01": "out_01",
  "02": "out_02",
  "04": "out_04",
  "05": "out_05",
  "06": "out_06",
  "07": "out_07",
} as const;

function sliceFor(pageId: ReportPageId, tag = "base"): ReportPageSharedInputSlice {
  return makeTestSharedSlice({
    locale: "en",
    dc_slice_fingerprint: `dc_${pageId}_${tag}`,
    personal_computation_slice_fingerprint: `personal_${pageId}_${tag}`,
    approved_readings_slice_fingerprint: `readings_${pageId}_${tag}`,
    evidence_registry_slice_fingerprint: `registry_${pageId}_${tag}`,
  });
}

console.log("=== Report orchestration Batch1 R1 (DAG SSOT, no LLM) ===");

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
  console.log("A ok — graph builds and validates");
}

{
  assertPage01Page02Independent();
  assert.deepEqual([...requiredUpstreamOf("01")], []);
  assert.deepEqual([...requiredUpstreamOf("02")], []);
  assert.ok(!requiredUpstreamOf("01").includes("02"));
  assert.ok(!requiredUpstreamOf("02").includes("01"));
  console.log("B ok — Page01 and Page02 have no mutual dependency");
}

{
  assert.deepEqual([...requiredUpstreamOf("04")], ["01", "02"]);
  assert.deepEqual([...requiredUpstreamOf("05")], ["01", "02", "04"]);
  assert.deepEqual([...requiredUpstreamOf("06")], ["01", "02", "04", "05"]);
  assert.deepEqual([...requiredUpstreamOf("07")], ["01", "02", "04", "05", "06"]);
  assert.deepEqual(
    [...requiredUpstreamOf("08")],
    ["01", "02", "04", "05", "06", "07"],
  );
  assert.ok(reportPageDefinition("07").conditional);
  assert.equal(reportPageDefinition("08").conditional, false);
  console.log("C ok — Page04←01+02; 05←04; 06←05; 07←06; 08←07 chain");
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
  console.log("D ok — cycles are rejected");
}

{
  const cycleGraph = buildReportDependencyGraph();
  const broken = {
    ...cycleGraph,
    edges: [...cycleGraph.edges, { from: "99" as never, to: "04" as const }],
  };
  const validated = validateReportDependencyGraph(broken);
  assert.equal(validated.ok, false);
  if (validated.ok) throw new Error("expected missing upstream");
  assert.ok(validated.issues.some((i) => i.code === "missing_upstream_node"));
  console.log("E ok — missing upstream nodes are rejected");
}

{
  let states = initialPendingPageStates();
  let res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_model_generations.sort(), ["01", "02"]);
  assert.deepEqual(res.ready_applicability_gates, []);
  assert.ok(res.blocked.some((b) => b.page_id === "04"));
  assert.ok(res.blocked.some((b) => b.page_id === "08"));
  assert.equal(res.ready_derived.length, 0);

  states = mark(states, "01", "completed");
  res = resolveReportReadyState(states);
  assert.ok(res.ready_model_generations.includes("02"));
  assert.ok(!res.ready_model_generations.includes("04"));
  assert.ok(
    res.blocked.some(
      (b) => b.page_id === "04" && b.missing_upstream.includes("02"),
    ),
  );

  states = mark(states, "02", "completed");
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_model_generations, ["04"]);

  states = mark(states, "04", "completed");
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_model_generations, ["05"]);

  states = mark(states, "05", "completed");
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_model_generations, ["06"]);

  states = mark(states, "06", "completed");
  res = resolveReportReadyState(states);
  // Page07 gate ready — NOT model generation.
  assert.deepEqual(res.ready_applicability_gates, ["07"]);
  assert.deepEqual(res.ready_model_generations, []);
  assert.ok(isPage07ApplicabilityGateReady(states));
  assert.equal(isPage07ModelGenerationReady(states), false);

  states = mark(states, "07", "skipped_not_applicable", {
    applicability_status: "not_applicable",
  });
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_model_generations, ["08"]);
  assert.ok(!isPageReadyToDispatch("07", states));

  states = mark(states, "08", "completed");
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_model_generations, []);
  assert.deepEqual(res.ready_derived, ["glossary_appendix"]);
  console.log("F ok — ready progression; Page07 gate ≠ model generation");
}

{
  // Four Page07 state transitions
  let states = completeThrough06(initialPendingPageStates());

  // 1) Upstream satisfied → applicability gate ready only
  let res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_applicability_gates, ["07"]);
  assert.ok(!res.ready_model_generations.includes("07"));
  assert.equal(isPage07ModelGenerationReady(states), false);

  // 2) applicable → model generation ready
  states = mark(states, "07", "pending", { applicability_status: "applicable" });
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_applicability_gates, []);
  assert.deepEqual(res.ready_model_generations, ["07"]);
  assert.ok(isPage07ModelGenerationReady(states));
  assert.equal(isPage07ApplicabilityGateReady(states), false);

  // 3) not_applicable terminal → no model; Page08 ready
  states = mark(states, "07", "skipped_not_applicable", {
    applicability_status: "not_applicable",
  });
  res = resolveReportReadyState(states);
  assert.ok(!res.ready_model_generations.includes("07"));
  assert.ok(!res.ready_applicability_gates.includes("07"));
  assert.deepEqual(res.ready_model_generations, ["08"]);

  // 4) insufficient_information terminal → no model; Page08 ready; not completed
  states = completeThrough06(initialPendingPageStates());
  states = mark(states, "07", "insufficient_information", {
    applicability_status: "insufficient_information",
  });
  res = resolveReportReadyState(states);
  assert.ok(!res.ready_model_generations.includes("07"));
  assert.deepEqual(res.ready_model_generations, ["08"]);
  const p07 = states.find((s) => s.page_id === "07");
  assert.notEqual(p07?.outcome, "completed");
  console.log("G ok — Page07 gate / applicable / NA / insufficient transitions");
}

{
  const a = computePageInputFingerprint({
    page_id: "01",
    shared_slice: sliceFor("01"),
    upstream_output_fingerprints: {},
  });
  assert.equal(a.ok, true);
  if (!a.ok) throw new Error(a.detail);
  const b = computePageInputFingerprint({
    page_id: "01",
    shared_slice: sliceFor("01"),
    upstream_output_fingerprints: { "02": "should_be_ignored" },
  });
  assert.equal(b.ok, true);
  if (!b.ok) throw new Error(b.detail);
  assert.equal(a.result.fingerprint, b.result.fingerprint);
  assert.equal(
    Object.keys(
      (a.result.canonical_payload.upstream_output_fingerprints as object) ?? {},
    ).length,
    0,
  );
  console.log("H ok — identical inputs yield identical fingerprint");
}

{
  const baseUp = { "01": "out_01", "02": "out_02" };
  const p04a = computePageInputFingerprint({
    page_id: "04",
    shared_slice: sliceFor("04"),
    upstream_output_fingerprints: baseUp,
  });
  const p04b = computePageInputFingerprint({
    page_id: "04",
    shared_slice: sliceFor("04"),
    upstream_output_fingerprints: { ...baseUp, "01": "out_01_CHANGED" },
  });
  assert.equal(p04a.ok && p04b.ok, true);
  if (!p04a.ok || !p04b.ok) throw new Error("p04 fp");
  assert.notEqual(p04a.result.fingerprint, p04b.result.fingerprint);

  const p01a = computePageInputFingerprint({
    page_id: "01",
    shared_slice: sliceFor("01"),
    upstream_output_fingerprints: baseUp,
  });
  const p01b = computePageInputFingerprint({
    page_id: "01",
    shared_slice: sliceFor("01"),
    upstream_output_fingerprints: { ...baseUp, "02": "out_02_CHANGED" },
  });
  assert.equal(p01a.ok && p01b.ok, true);
  if (!p01a.ok || !p01b.ok) throw new Error("p01 fp");
  assert.equal(p01a.result.fingerprint, p01b.result.fingerprint);
  console.log("I ok — upstream content change affects dependents only");
}

{
  // Negative: missing required upstream fingerprints fail closed
  const cases: Array<{
    page: ReportPageId;
    up: Record<string, string>;
    missing: string;
  }> = [
    { page: "04", up: { "02": "b" }, missing: "01" },
    { page: "04", up: { "01": "a" }, missing: "02" },
    { page: "05", up: { "01": "a", "02": "b" }, missing: "04" },
    {
      page: "06",
      up: { "01": "a", "02": "b", "04": "c" },
      missing: "05",
    },
    {
      page: "07",
      up: { "01": "a", "02": "b", "04": "c", "05": "d" },
      missing: "06",
    },
    {
      page: "08",
      up: {
        "01": "a",
        "02": "b",
        "04": "c",
        "05": "d",
        "06": "e",
      },
      missing: "07",
    },
  ];
  for (const c of cases) {
    const req = requireUpstreamFingerprintsForPage(c.page, c.up);
    assert.equal(req.ok, false, `expected fail for ${c.page}`);
    if (req.ok) throw new Error("unreachable");
    assert.ok(req.missing_upstream.includes(c.missing as ReportPageId));

    const fp = computePageInputFingerprint({
      page_id: c.page,
      shared_slice: sliceFor(c.page),
      upstream_output_fingerprints: c.up,
      page07_applicability_status:
        c.page === "07" || c.page === "08" ? "applicable" : undefined,
    });
    assert.equal(fp.ok, false, `fp must fail for ${c.page}`);
    if (fp.ok) throw new Error("unreachable");
    assert.equal(fp.code, "missing_required_upstream_fingerprint");
  }

  // Page01/02 still compute without upstream
  const p01 = computePageInputFingerprint({
    page_id: "01",
    shared_slice: sliceFor("01"),
    upstream_output_fingerprints: {},
  });
  const p02 = computePageInputFingerprint({
    page_id: "02",
    shared_slice: sliceFor("02"),
    upstream_output_fingerprints: {},
  });
  assert.equal(p01.ok, true);
  assert.equal(p02.ok, true);

  // Page08 missing applicability status
  const p08NoApp = computePageInputFingerprint({
    page_id: "08",
    shared_slice: sliceFor("08"),
    upstream_output_fingerprints: FULL_UPSTREAM,
    page07_applicability_status: null,
  });
  assert.equal(p08NoApp.ok, false);
  if (p08NoApp.ok) throw new Error("unreachable");
  assert.equal(p08NoApp.code, "missing_page07_applicability_status");

  const p07NoApp = computePageInputFingerprint({
    page_id: "07",
    shared_slice: sliceFor("07"),
    upstream_output_fingerprints: {
      "01": "a",
      "02": "b",
      "04": "c",
      "05": "d",
      "06": "e",
    },
  });
  assert.equal(p07NoApp.ok, false);
  if (p07NoApp.ok) throw new Error("unreachable");
  assert.equal(p07NoApp.code, "missing_page07_applicability_status");
  console.log("J ok — fail-closed missing upstream / applicability");
}

{
  // Per-page shared slices: used vs unused isolation
  const page01Base = sliceFor("01", "v1");
  const a = computePageInputFingerprint({
    page_id: "01",
    shared_slice: page01Base,
    upstream_output_fingerprints: {},
  });
  assert.equal(a.ok, true);
  if (!a.ok) throw new Error(a.detail);

  // Unused reading/evidence for Page01 means the *page slice* is unchanged.
  // A different page's readings change must not alter Page01 when slices differ.
  const page02ChangedReadings = makeTestSharedSlice({
    ...sliceFor("02", "v1"),
    approved_readings_slice_fingerprint: "readings_02_CHANGED",
  });
  const p02 = computePageInputFingerprint({
    page_id: "02",
    shared_slice: page02ChangedReadings,
    upstream_output_fingerprints: {},
  });
  assert.equal(p02.ok, true);

  const page01Still = computePageInputFingerprint({
    page_id: "01",
    shared_slice: page01Base, // Page01 slice unchanged
    upstream_output_fingerprints: {},
  });
  assert.equal(page01Still.ok, true);
  if (!page01Still.ok) throw new Error(page01Still.detail);
  assert.equal(a.result.fingerprint, page01Still.result.fingerprint);

  // Used DC fact change on Page01 slice → FP changes
  const page01DcChanged = makeTestSharedSlice({
    ...page01Base,
    dc_slice_fingerprint: "dc_01_CHANGED",
  });
  const page01Dc = computePageInputFingerprint({
    page_id: "01",
    shared_slice: page01DcChanged,
    upstream_output_fingerprints: {},
  });
  assert.equal(page01Dc.ok, true);
  if (!page01Dc.ok) throw new Error(page01Dc.detail);
  assert.notEqual(a.result.fingerprint, page01Dc.result.fingerprint);

  // Used approved reading change → FP changes
  const page01ReadingChanged = makeTestSharedSlice({
    ...page01Base,
    approved_readings_slice_fingerprint: "readings_01_CHANGED",
  });
  const page01R = computePageInputFingerprint({
    page_id: "01",
    shared_slice: page01ReadingChanged,
    upstream_output_fingerprints: {},
  });
  assert.equal(page01R.ok, true);
  if (!page01R.ok) throw new Error(page01R.detail);
  assert.notEqual(a.result.fingerprint, page01R.result.fingerprint);

  // Unused evidence for this page: if slice fingerprint unchanged, FP unchanged
  // (caller already excluded unused evidence from the slice hash).
  const page01SameRegistry = computePageInputFingerprint({
    page_id: "01",
    shared_slice: page01Base,
    upstream_output_fingerprints: {},
  });
  assert.equal(page01SameRegistry.ok, true);
  if (!page01SameRegistry.ok) throw new Error(page01SameRegistry.detail);
  assert.equal(a.result.fingerprint, page01SameRegistry.result.fingerprint);

  // Different pages' slices do not cross-contaminate
  const all = computeAllPageInputFingerprints({
    shared_slices: {
      "01": sliceFor("01"),
      "02": sliceFor("02"),
      "04": sliceFor("04"),
      "05": sliceFor("05"),
      "06": sliceFor("06"),
      "07": sliceFor("07"),
      "08": sliceFor("08"),
    },
    upstream_output_fingerprints: FULL_UPSTREAM,
    page07_applicability_status: "applicable",
  });
  assert.equal(all.errors.length, 0, all.errors.map((e) => e.detail).join(" | "));
  assert.notEqual(
    all.results["01"]?.fingerprint,
    all.results["02"]?.fingerprint,
  );
  // Changing only Page05 slice must not change Page01 result when recomputed alone
  const p01Again = computePageInputFingerprint({
    page_id: "01",
    shared_slice: sliceFor("01"),
    upstream_output_fingerprints: FULL_UPSTREAM,
  });
  assert.equal(p01Again.ok, true);
  if (!p01Again.ok) throw new Error(p01Again.detail);
  assert.equal(p01Again.result.fingerprint, all.results["01"]?.fingerprint);
  console.log("K ok — per-page shared slices; used/unused isolation");
}

{
  // Page07 applicability affects Page08 FP
  const p08a = computePageInputFingerprint({
    page_id: "08",
    shared_slice: sliceFor("08"),
    upstream_output_fingerprints: FULL_UPSTREAM,
    page07_applicability_status: "applicable",
  });
  const p08b = computePageInputFingerprint({
    page_id: "08",
    shared_slice: sliceFor("08"),
    upstream_output_fingerprints: FULL_UPSTREAM,
    page07_applicability_status: "not_applicable",
  });
  assert.equal(p08a.ok && p08b.ok, true);
  if (!p08a.ok || !p08b.ok) throw new Error("p08");
  assert.notEqual(p08a.result.fingerprint, p08b.result.fingerprint);

  const selected = selectUpstreamFingerprintsForPage("05", {
    "01": "a",
    "02": "b",
    "04": "c",
    "06": "should_ignore",
    "08": "should_ignore",
  });
  assert.deepEqual(selected, { "01": "a", "02": "b", "04": "c" });
  console.log("L ok — Page07 applicability in Page08 FP; unrelated upstream excluded");
}

{
  assert.deepEqual(downstreamDependentsOf("02").sort(), [
    "04",
    "05",
    "06",
    "07",
    "08",
  ]);
  assert.ok(!downstreamDependentsOf("02").includes("01"));
  assert.deepEqual(downstreamDependentsOf("05").sort(), ["06", "07", "08"]);
  assert.deepEqual(downstreamDependentsOf("07"), ["08"]);
  assert.ok(transitiveUpstreamOf("08").includes("01"));
  assert.ok(transitiveUpstreamOf("08").includes("06"));
  console.log("M ok — downstream invalidation scopes");
}

{
  // Per-page validator / production versions
  for (const id of REPORT_PAGE_IDS) {
    const def = reportPageDefinition(id);
    assert.equal(def.validator_version, PAGE_VALIDATOR_VERSIONS[id]);
    assert.equal(def.production_version, PAGE_PRODUCTION_VERSIONS[id]);
  }
  assert.notEqual(
    reportPageDefinition("05").validator_version,
    reportPageDefinition("01").validator_version,
  );

  const baseSlices = {
    "01": sliceFor("01"),
    "02": sliceFor("02"),
    "04": sliceFor("04"),
    "05": sliceFor("05"),
    "06": sliceFor("06"),
    "07": sliceFor("07"),
    "08": sliceFor("08"),
  };
  const before = computeAllPageInputFingerprints({
    shared_slices: baseSlices,
    upstream_output_fingerprints: FULL_UPSTREAM,
    page07_applicability_status: "applicable",
  });
  assert.equal(before.errors.length, 0);

  // Bump only Page05 validator → only Page05 (+ not auto-downstream in FP itself)
  // fingerprint of Page05 changes; Page01/02/04 unchanged.
  const after = computeAllPageInputFingerprints({
    shared_slices: baseSlices,
    upstream_output_fingerprints: FULL_UPSTREAM,
    page07_applicability_status: "applicable",
    validator_version_overrides: {
      "05": "page05-validator-BUMPED",
    },
  });
  assert.equal(after.errors.length, 0);
  assert.equal(
    before.results["01"]?.fingerprint,
    after.results["01"]?.fingerprint,
  );
  assert.equal(
    before.results["02"]?.fingerprint,
    after.results["02"]?.fingerprint,
  );
  assert.equal(
    before.results["04"]?.fingerprint,
    after.results["04"]?.fingerprint,
  );
  assert.notEqual(
    before.results["05"]?.fingerprint,
    after.results["05"]?.fingerprint,
  );
  // Downstream pages do not embed Page05 validator_version; their FP is unchanged
  // until Page05 *output* fingerprint changes (handled by upstream_output_fingerprints).
  assert.equal(
    before.results["06"]?.fingerprint,
    after.results["06"]?.fingerprint,
  );

  // When Page05 output changes, Page06+ change
  const afterOut = computeAllPageInputFingerprints({
    shared_slices: baseSlices,
    upstream_output_fingerprints: {
      ...FULL_UPSTREAM,
      "05": "out_05_CHANGED",
    },
    page07_applicability_status: "applicable",
  });
  assert.equal(afterOut.errors.length, 0);
  assert.equal(
    before.results["01"]?.fingerprint,
    afterOut.results["01"]?.fingerprint,
  );
  assert.equal(
    before.results["04"]?.fingerprint,
    afterOut.results["04"]?.fingerprint,
  );
  // Page05 input FP does not include its own output; only dependents change.
  assert.equal(
    before.results["05"]?.fingerprint,
    afterOut.results["05"]?.fingerprint,
  );
  assert.notEqual(
    before.results["06"]?.fingerprint,
    afterOut.results["06"]?.fingerprint,
  );
  assert.notEqual(
    before.results["08"]?.fingerprint,
    afterOut.results["08"]?.fingerprint,
  );

  // Key-order stability
  const p05a = computePageInputFingerprint({
    page_id: "05",
    shared_slice: sliceFor("05"),
    upstream_output_fingerprints: { "04": "c", "02": "b", "01": "a" },
  });
  const p05b = computePageInputFingerprint({
    page_id: "05",
    shared_slice: sliceFor("05"),
    upstream_output_fingerprints: { "01": "a", "02": "b", "04": "c" },
  });
  assert.equal(p05a.ok && p05b.ok, true);
  if (!p05a.ok || !p05b.ok) throw new Error("order");
  assert.equal(p05a.result.fingerprint, p05b.result.fingerprint);
  console.log("N ok — per-page validator isolation + key-order stability");
}

{
  // Empty shared slice field rejected
  const bad = computePageInputFingerprint({
    page_id: "01",
    shared_slice: makeTestSharedSlice({ dc_slice_fingerprint: "  " }),
    upstream_output_fingerprints: {},
  });
  assert.equal(bad.ok, false);
  if (bad.ok) throw new Error("unreachable");
  assert.equal(bad.code, "missing_shared_input_slice_field");
  console.log("O ok — empty shared slice fields rejected");
}

console.log("ok report orchestration batch1 R1");
