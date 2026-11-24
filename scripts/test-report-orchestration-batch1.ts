/**
 * Report orchestration Batch 1 — DAG SSOT + fingerprints + ready resolution.
 * No LLM / Inngest workers. Run: pnpm exec tsx scripts/test-report-orchestration-batch1.ts
 */

import assert from "node:assert/strict";
import {
  REPORT_ORCHESTRATION_GRAPH_VERSION,
  REPORT_PAGE_IDS,
  REPORT_PAGE_REGISTRY,
  REPORT_DERIVED_NODE_REGISTRY,
  buildReportDependencyGraph,
  validateReportDependencyGraph,
  requiredUpstreamOf,
  transitiveUpstreamOf,
  downstreamDependentsOf,
  assertPage01Page02Independent,
  computePageInputFingerprint,
  computeAllPageInputFingerprints,
  selectUpstreamFingerprintsForPage,
  resolveReportReadyState,
  initialPendingPageStates,
  isPageReadyToDispatch,
  reportPageDefinition,
  type ReportPageRuntimeState,
  type ReportSharedInputSnapshot,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";

const shared: ReportSharedInputSnapshot = {
  locale: "en",
  dc_snapshot_fingerprint: "dc_fp_aaa",
  personal_computation_fingerprint: "personal_fp_bbb",
  approved_readings_fingerprint: "readings_fp_ccc",
  evidence_registry_fingerprint: "registry_fp_ddd",
};

function mark(
  states: ReportPageRuntimeState[],
  pageId: ReportPageRuntimeState["page_id"],
  outcome: ReportPageRuntimeState["outcome"],
): ReportPageRuntimeState[] {
  return states.map((s) =>
    s.page_id === pageId ? { ...s, outcome } : s,
  );
}

console.log("=== Report orchestration Batch1 (DAG SSOT, no LLM) ===");

{
  const graph = buildReportDependencyGraph();
  const validated = validateReportDependencyGraph(graph);
  assert.equal(validated.ok, true, validated.ok ? "" : validated.issues.map((i) => i.detail).join(" | "));
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
  assert.deepEqual(res.ready_pages.sort(), ["01", "02"]);
  assert.ok(res.blocked.some((b) => b.page_id === "04"));
  assert.ok(res.blocked.some((b) => b.page_id === "08"));
  assert.equal(res.ready_derived.length, 0);

  // Only Page01 completed → Page04 still blocked; Page02 still ready.
  states = mark(states, "01", "completed");
  res = resolveReportReadyState(states);
  assert.ok(res.ready_pages.includes("02"));
  assert.ok(!res.ready_pages.includes("04"));
  assert.ok(res.blocked.some((b) => b.page_id === "04" && b.missing_upstream.includes("02")));

  // Page01+02 completed → Page04 ready; 05 still blocked.
  states = mark(states, "02", "completed");
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_pages, ["04"]);
  assert.ok(res.blocked.some((b) => b.page_id === "05"));

  states = mark(states, "04", "completed");
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_pages, ["05"]);

  states = mark(states, "05", "completed");
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_pages, ["06"]);

  states = mark(states, "06", "completed");
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_pages, ["07"]);

  // Page07 not_applicable is a satisfying terminal for Page08.
  states = mark(states, "07", "skipped_not_applicable");
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_pages, ["08"]);
  assert.ok(!isPageReadyToDispatch("07", states));

  states = mark(states, "08", "completed");
  res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_pages, []);
  assert.deepEqual(res.ready_derived, ["glossary_appendix"]);
  console.log("F ok — ready/blocked progression including Page07 not_applicable");
}

{
  let states = initialPendingPageStates();
  for (const id of ["01", "02", "04", "05", "06"] as const) {
    states = mark(states, id, "completed");
  }
  states = mark(states, "07", "insufficient_information");
  const res = resolveReportReadyState(states);
  assert.deepEqual(res.ready_pages, ["08"]);
  console.log("G ok — Page07 insufficient_information unblocks Page08");
}

{
  const a = computePageInputFingerprint({
    page_id: "01",
    shared,
    upstream_output_fingerprints: {},
  });
  const b = computePageInputFingerprint({
    page_id: "01",
    shared,
    upstream_output_fingerprints: { "02": "should_be_ignored" },
  });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(
    Object.keys(
      (a.canonical_payload.upstream_output_fingerprints as object) ?? {},
    ).length,
    0,
  );
  console.log("H ok — identical inputs yield identical fingerprint; unrelated upstream ignored");
}

{
  const baseUp = { "01": "out_01", "02": "out_02" };
  const p04a = computePageInputFingerprint({
    page_id: "04",
    shared,
    upstream_output_fingerprints: baseUp,
  });
  const p04b = computePageInputFingerprint({
    page_id: "04",
    shared,
    upstream_output_fingerprints: { ...baseUp, "01": "out_01_CHANGED" },
  });
  assert.notEqual(p04a.fingerprint, p04b.fingerprint);

  const p01a = computePageInputFingerprint({
    page_id: "01",
    shared,
    upstream_output_fingerprints: baseUp,
  });
  const p01b = computePageInputFingerprint({
    page_id: "01",
    shared,
    upstream_output_fingerprints: { ...baseUp, "02": "out_02_CHANGED" },
  });
  assert.equal(p01a.fingerprint, p01b.fingerprint);

  const p02a = computePageInputFingerprint({
    page_id: "02",
    shared,
    upstream_output_fingerprints: { "01": "x" },
  });
  const p02b = computePageInputFingerprint({
    page_id: "02",
    shared,
    upstream_output_fingerprints: { "01": "y" },
  });
  assert.equal(p02a.fingerprint, p02b.fingerprint);
  console.log("I ok — upstream content change affects dependents only");
}

{
  const sharedChanged = {
    ...shared,
    dc_snapshot_fingerprint: "dc_fp_CHANGED",
  };
  const a = computePageInputFingerprint({
    page_id: "02",
    shared,
    upstream_output_fingerprints: {},
  });
  const b = computePageInputFingerprint({
    page_id: "02",
    shared: sharedChanged,
    upstream_output_fingerprints: {},
  });
  assert.notEqual(a.fingerprint, b.fingerprint);
  console.log("J ok — shared DC change alters page fingerprints");
}

{
  const p08a = computePageInputFingerprint({
    page_id: "08",
    shared,
    upstream_output_fingerprints: {
      "01": "a",
      "02": "b",
      "04": "c",
      "05": "d",
      "06": "e",
      "07": "f",
    },
    page07_applicability_status: "applicable",
  });
  const p08b = computePageInputFingerprint({
    page_id: "08",
    shared,
    upstream_output_fingerprints: {
      "01": "a",
      "02": "b",
      "04": "c",
      "05": "d",
      "06": "e",
      "07": "f",
    },
    page07_applicability_status: "not_applicable",
  });
  assert.notEqual(p08a.fingerprint, p08b.fingerprint);

  const selected = selectUpstreamFingerprintsForPage("05", {
    "01": "a",
    "02": "b",
    "04": "c",
    "06": "should_ignore",
    "08": "should_ignore",
  });
  assert.deepEqual(selected, { "01": "a", "02": "b", "04": "c" });
  console.log("K ok — Page07 applicability affects Page08 FP; unrelated pages excluded");
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
  console.log("L ok — downstream invalidation scopes");
}

{
  const all = computeAllPageInputFingerprints({
    shared,
    upstream_output_fingerprints: {
      "01": "o1",
      "02": "o2",
      "04": "o4",
      "05": "o5",
      "06": "o6",
      "07": "o7",
    },
    page07_applicability_status: "applicable",
  });
  for (const id of REPORT_PAGE_IDS) {
    assert.ok(all[id].fingerprint.length === 64);
  }
  // Property order in upstream bag must not change hash.
  const p05a = computePageInputFingerprint({
    page_id: "05",
    shared,
    upstream_output_fingerprints: { "04": "c", "02": "b", "01": "a" },
  });
  const p05b = computePageInputFingerprint({
    page_id: "05",
    shared,
    upstream_output_fingerprints: { "01": "a", "02": "b", "04": "c" },
  });
  assert.equal(p05a.fingerprint, p05b.fingerprint);
  console.log("M ok — all-page fingerprints + key-order stability");
}

console.log("ok report orchestration batch1");
