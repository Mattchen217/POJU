/**
 * Page08 Batch 1 — architecture / structure tests (Risk Monitoring & Decision Review).
 * Run: pnpm exec tsx scripts/test-page08-architecture-batch1.ts
 */

import assert from "node:assert/strict";
import {
  PAGE08_SECTION_IDS,
  PAGE08_SECTION_DEFINITIONS,
  PAGE08_INPUT_FIELD_CONTRACTS,
  PAGE08_SECTION_CONTENT_SPECS,
  PAGE08_MODEL_TASKS,
  PAGE08_GAP_STATUSES,
  PAGE08_ARCHITECTURE_PROMPT_VERSION,
  PAGE08_FIELD_ASSEMBLERS,
  PAGE08_UPSTREAM_CONTRACT,
  PAGE08_DOWNSTREAM_CONTRACT,
  assertPage08InputAssemblyCoverage,
  page08AssembledFieldIds,
  normalizePage08ReadingOrder,
  page08RequiredSectionIds,
  page08InputContractsForSection,
  buildPage08ArchitectureProduction,
  page08TaskInterface,
} from "@/lib/llm/pro/delivery/decision-report-v2/page08/architecture";
import { buildFace08ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page08/production";
import { PAGE06_DOWNSTREAM_CONTRACT } from "@/lib/llm/pro/delivery/decision-report-v2/page06/architecture";
import { PAGE07_DOWNSTREAM_CONTRACT } from "@/lib/llm/pro/delivery/decision-report-v2/page07/architecture";
import {
  runContentBodyGenerate,
  setContentBodyTestInvokeForTests,
} from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";

console.log("=== Page08 Batch1 architecture (no LLM quality claims) ===");

{
  assert.equal(PAGE08_SECTION_IDS.length, 5);
  assert.equal(PAGE08_SECTION_DEFINITIONS.length, 5);
  assert.equal(PAGE08_SECTION_CONTENT_SPECS.length, 5);
  assert.deepEqual(normalizePage08ReadingOrder([]), [...PAGE08_SECTION_IDS]);
  assert.deepEqual(
    PAGE08_SECTION_DEFINITIONS.map((s) => s.segment_letter),
    ["A", "B", "C", "D", "E"],
  );
  for (const id of page08RequiredSectionIds()) {
    assert.ok(PAGE08_SECTION_IDS.includes(id));
  }
  for (const key of ["page01", "page02", "page04", "page05", "page06", "page07", "decision_context"] as const) {
    assert.ok(PAGE08_UPSTREAM_CONTRACT[key].length > 0, key);
  }
  assert.equal(PAGE08_DOWNSTREAM_CONTRACT.none.status, "terminal");
  assert.equal(PAGE06_DOWNSTREAM_CONTRACT.page08.status, "active");
  assert.equal(PAGE06_DOWNSTREAM_CONTRACT.page08.implemented, true);
  assert.equal(PAGE07_DOWNSTREAM_CONTRACT.page08.status, "active");
  assert.equal(PAGE07_DOWNSTREAM_CONTRACT.page08.implemented, true);
  assert.equal(PAGE08_MODEL_TASKS.length, 2);
  assert.equal(page08TaskInterface("page08_monitoring_generate")?.on_failure, "single_repair_then_fail");
  assert.ok(PAGE08_ARCHITECTURE_PROMPT_VERSION.includes("page08"));
  assert.ok(PAGE08_GAP_STATUSES.includes("not_applicable"));
  console.log("A ok — section / dependency SSOTs");
}

{
  assertPage08InputAssemblyCoverage();
  assert.deepEqual(
    page08AssembledFieldIds(),
    PAGE08_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort(),
  );
  for (const id of PAGE08_SECTION_IDS) {
    assert.ok(page08InputContractsForSection(id).length >= 1, id);
  }
  for (const c of PAGE08_INPUT_FIELD_CONTRACTS) {
    assert.equal(typeof PAGE08_FIELD_ASSEMBLERS[c.field_id], "function");
  }
  const blocking = new Set(
    PAGE08_INPUT_FIELD_CONTRACTS.filter((c) => c.missing_handling === "block_page_generation").map(
      (c) => c.field_id,
    ),
  );
  for (const id of [
    "decision_question",
    "report_locale",
    "page01_structured_payload",
    "page02_foundation_payload",
    "page04_bottleneck_payload",
    "page05_paths_payload",
    "page06_monitoring_payload",
    "evidence_registry_claims",
  ]) {
    assert.ok(blocking.has(id), id);
  }
  const page07 = PAGE08_INPUT_FIELD_CONTRACTS.find((c) => c.field_id === "page07_field_payload");
  assert.equal(page07?.required, false);
  assert.equal(page07?.missing_handling, "gap_note_only");
  const paths = PAGE08_INPUT_FIELD_CONTRACTS.find((c) => c.field_id === "page05_paths_payload");
  assert.ok(paths?.meaning.toLowerCase().includes("preferred"));
  const monitor = PAGE08_INPUT_FIELD_CONTRACTS.find((c) => c.field_id === "page06_monitoring_payload");
  assert.ok(monitor?.meaning.includes("monitoring_contract"));
  console.log("B ok — input contracts + assemblers");
}

const dc: DecisionContext = {
  context_id: "dc_arch_08",
  version: 1,
  status: "final",
  content_hash: "hash_arch_08",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  definition: {
    decision_question: "Should I leave for a startup offer?",
    concrete_event: "Offer received",
    desired_outcome: "Keep runway",
    stakes: "Career",
    goal_priorities: ["runway"],
    unacceptable_outcomes: ["resign cold"],
  },
  constraints: [],
  reality_facts: [
    {
      fact_id: "fact_runway",
      statement: "Runway about 8 months.",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "collecting",
      source_turn_id: "t1",
      user_confirmed: true,
    },
  ],
  dirs: [],
  conflicts: [],
  hypotheses: [],
};

const pack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_arch08",
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
  ],
  by_face: { "08": ["u_mon_08"] },
  pattern_hits_used: [],
  science_tags_used: [],
} as unknown as BookJudgmentPack;

const page01 = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: { text: "Prefer a staged explore.", claim_ids: ["claim_u_mon_08"] },
};
const page02 = {
  page: "02",
  face: "02",
  schema_version: "face02-v2",
  content_units: [{ unit_id: "p02_u", kind: "reality_fact", text: "Runway is stated.", claim_ids: ["c"] }],
};
const page04 = {
  page: "04",
  face: "04",
  schema_version: "face04-v2",
  content_units: [{ unit_id: "p04_u", text: "Cash floor is the bottleneck." }],
};
const page05 = {
  page: "05",
  face: "05",
  schema_version: "face05-v2",
  preferred_path_ids: ["path_staged"],
  path_units: [
    {
      path_id: "path_staged",
      path_role: "preferred",
      title: "Staged",
      description: "Explore while keeping runway.",
    },
  ],
};
const page06 = {
  page: "06",
  face: "06",
  schema_version: "face06-v2",
  primary_path_id: "path_staged",
  first_step: { action_id: "act_first", what: "Write the comparison", path_id: "path_staged" },
  execution_actions: [],
  monitoring_contract: {
    path_id: "path_staged",
    action_ids: ["act_first"],
    experiment_ids: [],
    observe_signals: ["Whether the written comparison exists"],
    stop_triggers: ["Runway falls under six months"],
    claim_ids: ["claim_u_mon_08"],
    evidence_ids: ["u_mon_08"],
    reality_fact_ids: ["fact_runway"],
  },
};

function page07(status: "applicable" | "not_applicable" | "insufficient_information") {
  return {
    page: "07",
    face: "07",
    schema_version: "face07-v2",
    applicability_status: status,
    applicability_reason:
      status === "applicable"
        ? "A named team budget is already in the facts."
        : status === "not_applicable"
          ? "This decision has no field or relationship to analyze."
          : "The field label is present but no linked fact.",
    participants: status === "applicable" ? [{ participant_id: "self", display_label: "用户", role: "self" }] : [],
    field_units:
      status === "applicable"
        ? [{ unit_id: "f_budget", text: "UNIQUE_FIELD_TEAM_BUDGET_CAP" }]
        : [],
    relationship_units: [],
    alignment_with_main: {
      changes_page01_recommendation: false,
      changes_page05_path_order: false,
      effect_on_page06_execution: status === "applicable" ? "Keep the first step inside the stated budget." : "none",
      summary: status,
      related_page05_path_ids: status === "applicable" ? ["path_staged"] : [],
      related_page06_action_ids: status === "applicable" ? ["act_first"] : [],
    },
    evidence_boundary: { confirmed_fact_ids: [], uncertainty_notes: [] },
  };
}

function build(extra: { page07?: unknown; page06?: unknown; locale?: string; dc?: DecisionContext | null }) {
  return buildFace08ProductionContext({
    report_id: "arch08",
    locale: extra.locale ?? "en",
    dc: extra.dc === undefined ? dc : extra.dc,
    pack,
    page01,
    page02,
    page04,
    page05,
    page06: extra.page06 === undefined ? page06 : extra.page06,
    page07: extra.page07,
  });
}

{
  const built = build({ page07: page07("not_applicable") });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.equal(built.ctx.may_invoke_llm, true);
  assert.equal(built.ctx.production_payload.page07.presence, "not_applicable");
  assert.equal(built.ctx.production_payload.page07.applicability_status, "not_applicable");
  assert.equal(built.ctx.production_payload.page07.field_units.length, 0);
  assert.equal(
    built.ctx.architecture.missing_inputs.some((g) => g.gap_id === "gap_page07_insufficient_information"),
    false,
  );
  assert.equal(
    built.ctx.architecture.missing_inputs.some((g) => g.handling === "defer_generation" && g.field_id === "page07_field_payload"),
    false,
  );
  console.log("C ok — Page07 not_applicable does not block");
}

{
  const built = build({});
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.equal(built.ctx.may_invoke_llm, true);
  assert.equal(built.ctx.production_payload.page07.presence, "missing");
  assert.equal(built.ctx.production_payload.page07.applicability_status, null);
  const gap = built.ctx.architecture.missing_inputs.find((g) => g.field_id === "page07_field_payload");
  assert.ok(gap);
  assert.equal(gap?.status, "missing");
  assert.equal(gap?.handling, "show_gap_note_only");
  assert.match(gap?.affects_content ?? "", /missing/i);
  console.log("D ok — missing Page07 is a gap");
}

{
  const built = build({ page07: page07("insufficient_information") });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.equal(built.ctx.may_invoke_llm, true);
  assert.equal(built.ctx.production_payload.page07.presence, "insufficient_information");
  assert.equal(built.ctx.production_payload.page07.applicability_status, "insufficient_information");
  assert.notEqual(built.ctx.production_payload.page07.applicability_status, "applicable");
  assert.equal(built.ctx.production_payload.page07.field_units.length, 0);
  const gap = built.ctx.architecture.missing_inputs.find(
    (g) => g.gap_id === "gap_page07_insufficient_information",
  );
  assert.ok(gap);
  assert.match(gap?.affects_content ?? "", /applicable/i);
  console.log("E ok — Page07 insufficient_information stays a gap");
}

{
  const built = build({ page07: page07("applicable") });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.ok(built.ctx.user.includes("page08_monitoring_generate"));
  assert.ok(built.ctx.user.includes("## Production payload"));
  assert.ok(built.ctx.user.includes("continue, adjust, pause, stop, or reassess"));
  assert.ok(built.ctx.architecture_prompt_bundle.includes("risks"));
  assert.ok(built.ctx.architecture_prompt_bundle.includes("observation_signals"));
  assert.equal(built.ctx.architecture.sections.length, 5);
  assert.equal(page08TaskInterface("missing"), null);
  const arch = buildPage08ArchitectureProduction({
    report_id: "arch08b",
    locale: "en",
    dc,
    pack,
    page01,
    page02,
    page04,
    page05,
    page06,
    page07: page07("applicable"),
  });
  assert.equal(arch.ok, true);
  if (!arch.ok) throw new Error(arch.reason);
  assert.equal(arch.may_invoke_llm, true);
  assert.ok(arch.system.includes("风险监测与决策复盘"));
  console.log("F ok — prompt and task wired");
}

{
  assert.deepEqual(normalizePage08ReadingOrder(["evidence_boundary", "risks", "risks", "nope"]), [
    "evidence_boundary",
    "risks",
    "observation_signals",
    "triggers",
    "reassessment_conditions",
  ]);
  console.log("G ok — reading order");
}

{
  const trigger = PAGE08_SECTION_CONTENT_SPECS.find((s) => s.section_id === "triggers");
  assert.ok(trigger?.must_include.join(" ").includes("continue"));
  assert.ok(trigger?.must_include.join(" ").includes("pause"));
  assert.ok(trigger?.must_include.join(" ").includes("reassess"));
  assert.ok(trigger?.must_not_include.join(" ").toLowerCase().includes("rerun") || trigger?.must_not_include.join(" ").includes("sixth"));
  for (const spec of PAGE08_SECTION_CONTENT_SPECS) {
    assert.ok(PAGE08_SECTION_IDS.includes(spec.section_id));
  }
  assert.ok(
    PAGE08_SECTION_CONTENT_SPECS.find((s) => s.section_id === "risks")
      ?.length_guidance.includes("0–8"),
  );
  assert.ok(
    PAGE08_SECTION_CONTENT_SPECS.find((s) => s.section_id === "triggers")
      ?.must_not_include.join(" ")
      .includes("Filler triggers"),
  );
  console.log("H ok — content specs");
}

{
  const built = build({ page07: page07("applicable") });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.equal(built.ctx.may_invoke_llm, true);
  assert.equal(built.ctx.architecture.generation_status, "ready_for_generation");
  assert.equal(built.ctx.production_payload.page07.applicability_status, "applicable");
  assert.ok(JSON.stringify(built.ctx.production_payload.page07.field_units).includes("UNIQUE_FIELD_TEAM_BUDGET_CAP"));
  assert.ok(built.ctx.user.includes("Whether the written comparison exists"));
  assert.ok(built.ctx.user.includes('"status": "confirmed"'));
  console.log("I ok — ready production context");
}

{
  const missingDc = buildFace08ProductionContext({
    report_id: "arch08",
    locale: "en",
    dc: null,
    pack,
    page01,
    page02,
    page04,
    page05,
    page06,
  });
  assert.equal(missingDc.ok, false);
  if (missingDc.ok) throw new Error("expected missing dc");
  assert.equal(missingDc.reason, "face08_missing_decision_context");

  const noQuestion = build({
    dc: {
      ...dc,
      definition: { ...dc.definition, decision_question: "  " },
    },
  });
  assert.equal(noQuestion.ok, true);
  if (!noQuestion.ok) throw new Error(noQuestion.reason);
  assert.equal(noQuestion.ctx.may_invoke_llm, false);
  assert.equal(noQuestion.ctx.architecture.generation_status, "blocked_on_required_inputs");

  const noMonitor = build({
    page06: { ...page06, monitoring_contract: undefined },
  });
  assert.equal(noMonitor.ok, true);
  if (!noMonitor.ok) throw new Error(noMonitor.reason);
  assert.equal(noMonitor.ctx.may_invoke_llm, false);
  assert.ok(
    noMonitor.ctx.architecture.missing_inputs.some(
      (g) => g.field_id === "page06_monitoring_payload" && g.handling === "defer_generation",
    ),
  );

  let calls = 0;
  setContentBodyTestInvokeForTests(async () => {
    calls += 1;
    throw new Error("llm should not run");
  });
  void runContentBodyGenerate({
    key: "08",
    locale: "en",
    session_id: "arch08_block",
    report_id: "arch08_block",
    finalize: {} as never,
    decision_context_snapshot: dc,
    book_judgment_pack: pack,
    page01_schema: page01,
    page02_schema: page02,
    page04_schema: page04,
    page05_schema: page05,
    page06_schema: { ...page06, monitoring_contract: undefined },
    dispatch_attempt: 1,
  })
    .then((blocked) => {
      assert.equal(blocked.ok, false);
      if (blocked.ok) throw new Error("expected block");
      assert.equal(blocked.reason, "face08_blocked_on_required_inputs");
      assert.equal(calls, 0);
      console.log("J ok — required inputs block before any model call");
      console.log("ok page08 architecture batch1");
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => {
      setContentBodyTestInvokeForTests(null);
    });
}
