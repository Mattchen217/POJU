/**
 * Page05 Batch 1 — architecture / structure tests (Feasible Paths).
 * Run: pnpm exec tsx scripts/test-page05-architecture-batch1.ts
 */

import assert from "node:assert/strict";
import {
  PAGE05_SECTION_IDS,
  PAGE05_SECTION_DEFINITIONS,
  PAGE05_INPUT_FIELD_CONTRACTS,
  PAGE05_SECTION_CONTENT_SPECS,
  PAGE05_MODEL_TASKS,
  PAGE05_GAP_STATUSES,
  PAGE05_ARCHITECTURE_PROMPT_VERSION,
  PAGE05_FIELD_ASSEMBLERS,
  PAGE05_UPSTREAM_CONTRACT,
  PAGE05_DOWNSTREAM_CONTRACT,
  assertPage05InputAssemblyCoverage,
  page05AssembledFieldIds,
  normalizePage05ReadingOrder,
  page05RequiredSectionIds,
  page05InputContractsForSection,
  buildPage05ArchitectureProduction,
  page05TaskInterface,
} from "@/lib/llm/pro/delivery/decision-report-v2/page05/architecture";
import { buildFace05ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page05/production";
import { runContentBodyGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";

console.log("=== Page05 Batch1 architecture (no LLM quality claims) ===");

{
  assert.equal(PAGE05_SECTION_IDS.length, 5);
  assert.equal(PAGE05_SECTION_DEFINITIONS.length, 5);
  assert.equal(PAGE05_SECTION_CONTENT_SPECS.length, 5);
  assert.deepEqual(normalizePage05ReadingOrder([]), [...PAGE05_SECTION_IDS]);
  for (const id of page05RequiredSectionIds()) {
    assert.ok(PAGE05_SECTION_IDS.includes(id));
  }
  assert.ok(PAGE05_UPSTREAM_CONTRACT.page01.length > 0);
  assert.ok(PAGE05_DOWNSTREAM_CONTRACT.page06.length > 0);
  assert.ok(PAGE05_DOWNSTREAM_CONTRACT.page08.length > 0);
  console.log("A PASS — section / dependency SSOTs");
}

{
  assertPage05InputAssemblyCoverage();
  assert.deepEqual(
    page05AssembledFieldIds(),
    PAGE05_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort(),
  );
  for (const id of PAGE05_SECTION_IDS) {
    assert.ok(page05InputContractsForSection(id).length >= 1);
  }
  for (const c of PAGE05_INPUT_FIELD_CONTRACTS) {
    assert.ok(typeof PAGE05_FIELD_ASSEMBLERS[c.field_id] === "function");
  }
  assert.deepEqual(
    [...PAGE05_GAP_STATUSES].sort(),
    ["conflict", "declined", "missing", "not_applicable", "unknown", "unverified"].sort(),
  );
  console.log("B PASS — input contracts + assemblers");
}

const dc: DecisionContext = {
  context_id: "dc_arch_05",
  version: 1,
  status: "final",
  content_hash: "hash_arch_05",
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
  cfp_hash: "cfp_arch05",
  zfp_hash: null,
  zfpOmitted: true,
  shot_mode: "one",
  created_at: "2026-01-01T00:00:00Z",
  units: [
    {
      id: "u_path_05",
      track: "science",
      claim: "Staged explore preserves runway.",
      anchors: [],
      serves_face: ["05"],
      term_ids: [],
      source_domain: "science",
    },
  ],
  by_face: { "05": ["u_path_05"] },
  pattern_hits_used: [],
  science_tags_used: [],
} as unknown as BookJudgmentPack;

const page01 = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: { text: "Prefer staged explore.", claim_ids: ["claim_u_path_05"] },
  why_this_path: [{ text: "Runway supports explore.", claim_ids: ["claim_u_path_05"] }],
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
      claim_ids: ["claim_u_path_05"],
      evidence_ids: ["u_path_05"],
      related_dir_ids: [],
    },
  ],
  explanation_boundary: {
    claim_ids: ["claim_u_path_05"],
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
      claim_ids: ["claim_u_path_05"],
      evidence_ids: [],
      related_reality_fact_ids: ["fact_runway"],
    },
  ],
} as unknown;

async function runAsync() {
  const built = buildPage05ArchitectureProduction({
    report_id: "arch05",
    locale: "en",
    dc,
    pack,
    page01,
    page02,
    page04,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.ok(
    built.architecture_prompt_bundle.includes(PAGE05_ARCHITECTURE_PROMPT_VERSION),
  );
  assert.equal(PAGE05_MODEL_TASKS.length, 2);
  assert.ok(page05TaskInterface("page05_paths_generate"));

  const ctx = buildFace05ProductionContext({
    report_id: "arch05_ctx",
    locale: "en",
    dc,
    pack,
    page01,
    page02,
    page04,
  });
  assert.equal(ctx.ok, true);
  if (!ctx.ok) throw new Error(ctx.reason);
  assert.equal(ctx.ctx.may_invoke_llm, true);

  const blocked = await runContentBodyGenerate({
    key: "05",
    locale: "en",
    session_id: "arch05_block",
    report_id: "arch05_block",
    finalize: {} as never,
    decision_context_snapshot: dc,
    book_judgment_pack: pack,
    page01_schema: null,
    page02_schema: null,
    page04_schema: null,
    dispatch_attempt: 1,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "face05_blocked_on_required_inputs");
  assert.equal(blocked.tokens_used, 0);
  console.log("C PASS — production gate + prompt/task wired");
  console.log("=== Page05 Batch1 architecture tests done (structure only) ===");
}

runAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
