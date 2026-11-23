/**
 * Page06 Batch 1 — architecture / structure tests (Strategy Execution).
 * Run: pnpm exec tsx scripts/test-page06-architecture-batch1.ts
 */

import assert from "node:assert/strict";
import {
  PAGE06_SECTION_IDS,
  PAGE06_SECTION_DEFINITIONS,
  PAGE06_INPUT_FIELD_CONTRACTS,
  PAGE06_SECTION_CONTENT_SPECS,
  PAGE06_MODEL_TASKS,
  PAGE06_GAP_STATUSES,
  PAGE06_ARCHITECTURE_PROMPT_VERSION,
  PAGE06_FIELD_ASSEMBLERS,
  PAGE06_UPSTREAM_CONTRACT,
  PAGE06_DOWNSTREAM_CONTRACT,
  assertPage06InputAssemblyCoverage,
  page06AssembledFieldIds,
  normalizePage06ReadingOrder,
  page06RequiredSectionIds,
  page06InputContractsForSection,
  buildPage06ArchitectureProduction,
  page06TaskInterface,
} from "@/lib/llm/pro/delivery/decision-report-v2/page06/architecture";
import { buildFace06ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page06/production";
import { runContentBodyGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";

console.log("=== Page06 Batch1 architecture (no LLM quality claims) ===");

{
  assert.equal(PAGE06_SECTION_IDS.length, 7);
  assert.equal(PAGE06_SECTION_DEFINITIONS.length, 7);
  assert.equal(PAGE06_SECTION_CONTENT_SPECS.length, 7);
  assert.deepEqual(normalizePage06ReadingOrder([]), [...PAGE06_SECTION_IDS]);
  for (const id of page06RequiredSectionIds()) {
    assert.ok(PAGE06_SECTION_IDS.includes(id));
  }
  assert.ok(PAGE06_UPSTREAM_CONTRACT.page05.length > 0);
  assert.ok(PAGE06_UPSTREAM_CONTRACT.page01.length > 0);
  assert.ok(PAGE06_UPSTREAM_CONTRACT.page02.length > 0);
  assert.ok(PAGE06_UPSTREAM_CONTRACT.page04.length > 0);
  assert.ok(PAGE06_UPSTREAM_CONTRACT.decision_context.length > 0);
  assert.ok(PAGE06_UPSTREAM_CONTRACT.personal_readings_registry.length > 0);
  assert.equal(PAGE06_DOWNSTREAM_CONTRACT.page08.status, "future");
  assert.equal(PAGE06_DOWNSTREAM_CONTRACT.page08.implemented, false);
  for (const field of [
    "path_id",
    "action_ids",
    "experiment_ids",
    "observe_signals",
    "success_criteria",
    "failure_stop_switch_triggers",
    "window_time_boundary",
    "resource_guardrails",
    "defer_costs",
    "claim_ids",
    "evidence_ids",
    "reality_fact_ids",
  ]) {
    assert.ok(
      (PAGE06_DOWNSTREAM_CONTRACT.page08.fields as readonly string[]).includes(
        field,
      ),
      field,
    );
  }
  console.log("A PASS — section / dependency SSOTs");
}

{
  assertPage06InputAssemblyCoverage();
  assert.deepEqual(
    page06AssembledFieldIds(),
    PAGE06_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort(),
  );
  for (const id of PAGE06_SECTION_IDS) {
    assert.ok(page06InputContractsForSection(id).length >= 1);
  }
  for (const c of PAGE06_INPUT_FIELD_CONTRACTS) {
    assert.ok(typeof PAGE06_FIELD_ASSEMBLERS[c.field_id] === "function");
  }
  const blocking = new Set(
    PAGE06_INPUT_FIELD_CONTRACTS.filter(
      (c) => c.missing_handling === "block_page_generation",
    ).map((c) => c.field_id),
  );
  for (const id of [
    "decision_question",
    "report_locale",
    "page05_paths_payload",
    "page01_structured_payload",
    "page02_foundation_payload",
    "page04_bottleneck_payload",
  ]) {
    assert.ok(blocking.has(id), `${id} must block_page_generation`);
  }
  const paths = PAGE06_INPUT_FIELD_CONTRACTS.find(
    (c) => c.field_id === "page05_paths_payload",
  );
  assert.equal(paths?.required, true);
  assert.ok(paths?.meaning.toLowerCase().includes("preferred"));
  assert.deepEqual(
    [...PAGE06_GAP_STATUSES].sort(),
    ["conflict", "declined", "missing", "not_applicable", "unknown", "unverified"].sort(),
  );
  console.log("B PASS — input contracts + assemblers");
}

const dc: DecisionContext = {
  context_id: "dc_arch_06",
  version: 1,
  status: "final",
  content_hash: "hash_arch_06",
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

const pack: BookJudgmentPack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_arch06",
  zfp_hash: null,
  zfpOmitted: true,
  shot_mode: "one",
  created_at: "2026-01-01T00:00:00Z",
  units: [
    {
      id: "u_exec_06",
      track: "science",
      claim: "Staged explore preserves runway.",
      anchors: [],
      serves_face: ["06"],
      term_ids: [],
      source_domain: "science",
    },
  ],
  by_face: { "06": ["u_exec_06"] },
  pattern_hits_used: [],
  science_tags_used: [],
} as unknown as BookJudgmentPack;

const page01 = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: { text: "Prefer staged explore.", claim_ids: ["claim_u_exec_06"] },
  why_this_path: [{ text: "Runway supports explore.", claim_ids: ["claim_u_exec_06"] }],
  recommendation_conditions: [
    { condition: "runway holds", status: "assumed", source_ids: ["fact_runway"] },
  ],
  not_recommended: [
    { option: "Resign cold", reason: "Burns runway", cost_or_conflict: "Cash shock" },
  ],
  applicability_boundary: {
    current_basis: ["Confirmed runway"],
    invalidation_conditions: ["Runway collapses"],
    page02_evidence_ids: [],
    page08_review_refs: [],
  },
};

const page02 = {
  page: "02",
  face: "02",
  schema_version: "face02-v2",
  content_units: [
    {
      unit_id: "p02_u1",
      kind: "mechanism",
      text: "Cash-floor anxiety under offer pressure.",
      claim_ids: ["claim_u_exec_06"],
      evidence_ids: ["u_exec_06"],
      related_dir_ids: [],
    },
  ],
  explanation_boundary: {
    claim_ids: ["claim_u_exec_06"],
    known_limits: [],
    open_questions: [],
  },
} as unknown;

const page04 = {
  page: "04",
  face: "04",
  schema_version: "face04-v2",
  content_units: [
    {
      unit_id: "u_name",
      kind: "bottleneck_label",
      text: "Cash-floor panic.",
      title: "",
      claim_ids: ["claim_u_exec_06"],
      evidence_ids: [],
      related_reality_fact_ids: ["fact_runway"],
    },
  ],
} as unknown;

const page05 = {
  page: "05",
  face: "05",
  schema_version: "face05-v2",
  preferred_path_ids: ["path_staged"],
  alternative_path_ids: ["path_hold"],
  path_units: [
    {
      path_id: "path_staged",
      path_role: "preferred",
      title: "Staged explore",
      description: "Negotiate while keeping the cash floor.",
      prerequisites: ["runway holds"],
      required_resources: ["bandwidth"],
      risks: ["offer window"],
      success_signals: ["written plan holds"],
      reconsideration_conditions: [],
    },
    {
      path_id: "path_hold",
      path_role: "alternative",
      title: "Hold",
      description: "Clarify before any leave decision.",
      prerequisites: ["delay is acceptable"],
      required_resources: ["time"],
      risks: ["cooling"],
      success_signals: ["unknowns close"],
      reconsideration_conditions: [],
    },
  ],
};

async function runAsync() {
  const built = buildPage06ArchitectureProduction({
    report_id: "arch06",
    locale: "en",
    dc,
    pack,
    page01,
    page02,
    page04,
    page05,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.ok(
    built.architecture_prompt_bundle.includes(PAGE06_ARCHITECTURE_PROMPT_VERSION),
  );
  assert.ok(built.architecture_prompt_bundle.includes("future"));
  assert.equal(PAGE06_MODEL_TASKS.length, 2);
  assert.ok(page06TaskInterface("page06_execution_generate"));
  assert.equal(built.may_invoke_llm, true);

  const ctx = buildFace06ProductionContext({
    report_id: "arch06_ctx",
    locale: "en",
    dc,
    pack,
    page01,
    page02,
    page04,
    page05,
  });
  assert.equal(ctx.ok, true);
  if (!ctx.ok) throw new Error(ctx.reason);
  assert.equal(ctx.ctx.may_invoke_llm, true);
  assert.deepEqual(ctx.ctx.knownPage05PathIds.preferred_path_ids, ["path_staged"]);
  assert.ok(ctx.ctx.knownPage05PathIds.all_path_ids.includes("path_hold"));

  const noPreferred = buildFace06ProductionContext({
    report_id: "arch06_nopref",
    locale: "en",
    dc,
    pack,
    page01,
    page02,
    page04,
    page05: {
      ...page05,
      preferred_path_ids: [],
    },
  });
  assert.equal(noPreferred.ok, true);
  if (!noPreferred.ok) throw new Error(noPreferred.reason);
  assert.equal(noPreferred.ctx.may_invoke_llm, false);

  const blocked = await runContentBodyGenerate({
    key: "06",
    locale: "en",
    session_id: "arch06_block",
    report_id: "arch06_block",
    finalize: {} as never,
    decision_context_snapshot: dc,
    book_judgment_pack: pack,
    page01_schema: null,
    page02_schema: null,
    page04_schema: null,
    page05_schema: null,
    dispatch_attempt: 1,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "face06_blocked_on_required_inputs");
  assert.equal(blocked.tokens_used, 0);
  console.log("C PASS — production gate + prompt/task wired");
  console.log("=== Page06 Batch1 architecture tests done (structure only) ===");
}

runAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
