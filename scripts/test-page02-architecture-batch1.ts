/**
 * Page02 Batch 1 — architecture / production-path tests.
 * Proves structure, gaps, prompts, tasks, Reader/PDF contract — NOT content quality.
 * Run: pnpm exec tsx scripts/test-page02-architecture-batch1.ts
 * Does NOT invoke a live LLM for quality verification.
 */

import assert from "node:assert/strict";
import {
  PAGE02_SECTION_DEFINITIONS,
  PAGE02_SECTION_IDS,
  PAGE02_INPUT_FIELD_CONTRACTS,
  PAGE02_SECTION_CONTENT_SPECS,
  PAGE02_MODEL_TASKS,
  PAGE02_GAP_STATUSES,
  PAGE02_ARCHITECTURE_PROMPT_VERSION,
  buildPage02ArchitectureProduction,
  buildPage02ArchitectureEnvelope,
  attachPage02ArchitectureToPage,
  validatePage02CanonicalPage,
  page02TaskInterface,
  buildPage02ArchitecturePromptBundle,
} from "@/lib/llm/pro/delivery/decision-report-v2/page02/architecture";
import { buildFace02ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page02/production";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { Face02V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

console.log("=== Page02 Batch1 architecture (no LLM quality claims) ===");

assert.equal(PAGE02_SECTION_IDS.length, 5);
assert.equal(PAGE02_SECTION_DEFINITIONS.length, 5);
assert.equal(PAGE02_SECTION_CONTENT_SPECS.length, 5);
assert.ok(PAGE02_INPUT_FIELD_CONTRACTS.length >= 8);
assert.equal(PAGE02_MODEL_TASKS.length, 2);
assert.deepEqual(
  [...PAGE02_GAP_STATUSES].sort(),
  ["conflict", "declined", "missing", "not_applicable", "unknown", "unverified"].sort(),
);
console.log("A PASS — section / input / content / task / gap SSOTs present");

const dc: DecisionContext = {
  context_id: "dc_arch_02",
  version: 1,
  status: "final",
  content_hash: "hash_arch_02",
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
      fact_roles: ["hard_constraint"],
      related_dir_ids: ["DIR_RUNWAY"],
    },
    {
      fact_id: "fact_salary_guess",
      statement: "Maybe cash is 120k.",
      status: "unverified",
      verification_level: "user_estimate",
      source_stage: "collecting",
      source_turn_id: "t2",
      user_confirmed: false,
      fact_roles: ["job_offer"],
      related_dir_ids: ["DIR_OFFER"],
    },
  ],
  dirs: [
    {
      dir_id: "DIR_RUNWAY",
      need: "Runway",
      why: "Cash",
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
  conflicts: [
    {
      conflict_id: "c1",
      conflict_field: "timeline",
      state: "open",
      statements: ["soon", "next year"],
    },
  ],
  hypotheses: [],
} as unknown as DecisionContext;

const pack: BookJudgmentPack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_arch",
  zfp_hash: null,
  zfpOmitted: true,
  shot_mode: "one",
  created_at: "2026-01-01T00:00:00Z",
  units: [
    {
      id: "u_destiny_02",
      track: "destiny",
      claim: "Cash-floor preference shapes pressure. cfp:dayMaster",
      anchors: ["cfp:dayMaster"],
      serves_face: ["02"],
      term_ids: ["day_master"],
      source_domain: "bazi",
      source_version: "cfp_arch",
    },
    {
      id: "u_science_02",
      track: "science",
      claim: "Eight-month runway supports staged explore.",
      anchors: ["runway_buffer"],
      serves_face: ["02"],
      term_ids: [],
      source_domain: "science",
    },
  ],
  by_face: { "02": ["u_destiny_02", "u_science_02"] },
  pattern_hits_used: [],
  science_tags_used: [],
} as unknown as BookJudgmentPack;

const page01 = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: {
    text: "Prefer a staged explore path that keeps the cash floor intact.",
    claim_ids: ["claim_u_destiny_02"],
  },
  why_this_path: [],
  recommendation_conditions: [],
  not_recommended: [],
  applicability_boundary: {
    current_basis: [],
    invalidation_conditions: [],
    page02_evidence_ids: [],
    page08_review_refs: [],
  },
};

// B: production path builds architecture without LLM
{
  const built = buildPage02ArchitectureProduction({
    report_id: "arch_batch1",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    page01,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.ok(built.architecture_prompt_bundle.includes(PAGE02_ARCHITECTURE_PROMPT_VERSION));
  assert.ok(built.system.includes("missing_inputs") || built.system.includes("Gap rules"));
  assert.equal(built.envelope.page_id, "02");
  assert.equal(built.envelope.sections.length, 5);
  assert.ok(built.envelope.input_manifest.length >= 8);
  assert.ok(
    built.envelope.missing_inputs.some((g) => g.status === "unverified"),
    "unverified fact must surface as gap",
  );
  assert.ok(
    built.envelope.missing_inputs.some((g) => g.status === "conflict"),
    "open conflict must surface as gap",
  );
  assert.ok(
    built.may_invoke_llm === true ||
      built.envelope.generation_status === "ready_for_generation" ||
      built.envelope.generation_status === "blocked_on_required_inputs",
  );
  // Prompt must forbid inventing facts
  assert.ok(built.architecture_prompt_bundle.includes("Do NOT invent"));
  console.log("B PASS — architecture production path (no LLM)");
}

// C: Face02 production context carries architecture
{
  const built = buildFace02ProductionContext({
    report_id: "arch_batch1_ctx",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    page01,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.ok(built.ctx.architecture);
  assert.ok(built.ctx.system.includes(PAGE02_ARCHITECTURE_PROMPT_VERSION));
  assert.equal(typeof built.ctx.may_invoke_llm, "boolean");
  console.log("C PASS — Face02 production context mounts architecture + prompt");
}

// D: blocking when Page01 / question missing
{
  const envelope = buildPage02ArchitectureEnvelope({
    report_id: "blocked",
    locale: "en",
    dc: { ...dc, definition: { ...dc.definition!, decision_question: "" } },
    pack,
    page01_core_judgment: null,
    available_domains: ["bazi"],
    approved_reading_count: 1,
    registry_claim_count: 2,
  });
  assert.equal(envelope.generation_status, "blocked_on_required_inputs");
  assert.ok(
    envelope.missing_inputs.some(
      (g) => g.handling === "defer_generation" && g.field_id === "page01_core_judgment",
    ),
  );
  console.log("D PASS — required-input gaps block generation status");
}

// E: canonical page attach + schema validate + persist roundtrip
{
  const fixturePage: Face02V2 = {
    page: "02",
    face: "02",
    schema_version: "face02-v2",
    content_units: [
      {
        unit_id: "u_summary",
        kind: "conditional_explanation",
        text: "Cash-floor preference explains why staged explore fits this window.",
        claim_ids: ["claim_u_science_02"],
        evidence_ids: [],
        related_reality_fact_unit_ids: [],
      },
      {
        unit_id: "u_why",
        kind: "conditional_explanation",
        text: "The judgment fits because runway is confirmed while offer cash stays estimate.",
        claim_ids: ["claim_u_science_02"],
        evidence_ids: [],
        related_reality_fact_unit_ids: [],
      },
    ],
    page_summary_unit_ids: ["u_summary"],
    relevant_personal_factor_unit_ids: [],
    personal_reality_interplay_unit_ids: [],
    why_judgment_fits_unit_ids: ["u_why"],
    explanation_boundary: {
      claim_ids: ["claim_u_science_02"],
      personal_unit_ids: [],
      confirmed_fact_unit_ids: [],
      hypothesis_unit_ids: [],
      uncertainty_notes: ["Offer cash remains an estimate."],
    },
    reading_order: [
      "page_summary",
      "relevant_personal_factors",
      "personal_reality_interplay",
      "why_judgment_fits",
      "explanation_boundary",
    ],
  };
  const envelope = buildPage02ArchitectureEnvelope({
    report_id: "attach",
    locale: "en",
    dc,
    pack,
    page01_core_judgment: "Prefer staged explore.",
    available_domains: ["bazi"],
    approved_reading_count: 1,
    registry_claim_count: 2,
  });
  const attached = attachPage02ArchitectureToPage(fixturePage, {
    ...envelope,
    generation_status: "generated_with_gaps",
  });
  assert.ok(attached.missing_inputs?.length);
  assert.ok(attached.input_manifest?.length);
  assert.ok(attached.sections?.length === 5);
  assert.equal(attached.generation_status, "generated_with_gaps");

  const validated = validatePage02CanonicalPage(attached);
  assert.equal(validated.ok, true);

  const reloaded = JSON.parse(JSON.stringify(attached)) as Face02V2;
  const again = validatePage02CanonicalPage(reloaded);
  assert.equal(again.ok, true);
  if (!again.ok) throw new Error(again.reason);
  assert.deepEqual(
    again.page.missing_inputs?.map((g) => g.gap_id).sort(),
    attached.missing_inputs!.map((g) => g.gap_id).sort(),
  );
  console.log("E PASS — attach / schema / persist-reload architecture fields");
}

// F: Reader/PDF consume same section titles + gaps (contract)
{
  const envelope = buildPage02ArchitectureEnvelope({
    report_id: "pdf",
    locale: "en",
    dc,
    pack,
    page01_core_judgment: "Prefer staged explore.",
    available_domains: ["bazi"],
    approved_reading_count: 1,
    registry_claim_count: 2,
  });
  const page = attachPage02ArchitectureToPage(
    {
      page: "02",
      face: "02",
      schema_version: "face02-v2",
      content_units: [
        {
          unit_id: "u_summary",
          kind: "conditional_explanation",
          text: "Summary text for PDF parity.",
          claim_ids: ["claim_u_science_02"],
          evidence_ids: [],
          related_reality_fact_unit_ids: [],
        },
        {
          unit_id: "u_why",
          kind: "conditional_explanation",
          text: "Why-fit text for PDF parity.",
          claim_ids: ["claim_u_science_02"],
          evidence_ids: [],
          related_reality_fact_unit_ids: [],
        },
      ],
      page_summary_unit_ids: ["u_summary"],
      relevant_personal_factor_unit_ids: [],
      personal_reality_interplay_unit_ids: [],
      why_judgment_fits_unit_ids: ["u_why"],
      explanation_boundary: {
        claim_ids: ["claim_u_science_02"],
        personal_unit_ids: [],
        confirmed_fact_unit_ids: [],
        hypothesis_unit_ids: [],
        uncertainty_notes: ["Note"],
      },
      reading_order: [...PAGE02_SECTION_IDS],
      missing_inputs: envelope.missing_inputs,
    } as Face02V2,
    envelope,
  );
  const bodies = pageSchemaToArgumentBodies(page as never);
  const joined = bodies.map((b) => b.body).join("\n\n");
  assert.ok(joined.includes("### 本页摘要"), "PDF must use section SSOT title");
  assert.ok(joined.includes("### 为何适合本题判断"));
  assert.ok(joined.includes("### 解释边界"));
  assert.ok(
    joined.includes("数据缺口") || joined.includes("unverified"),
    "PDF boundary must surface gaps",
  );
  console.log("F PASS — PDF/Reader section title + gap contract");
}

// G: task interface maps to production invoke tags
{
  const gen = page02TaskInterface("page02_content_units_generate");
  const repair = page02TaskInterface("page02_content_units_repair");
  assert.equal(gen?.invoke, "content_body_v3_face02");
  assert.equal(repair?.invoke, "face02_repair");
  assert.ok(gen?.task.bans.some((b) => b.toLowerCase().includes("invent")));
  console.log("G PASS — model task defs + invoke mapping");
}

// H: prompt bundle includes all section specs
{
  const bundle = buildPage02ArchitecturePromptBundle({
    input_manifest: [],
    missing_inputs: [],
    generation_status: "ready_for_generation",
  });
  for (const id of PAGE02_SECTION_IDS) {
    assert.ok(bundle.includes(id), `prompt missing section ${id}`);
  }
  console.log("H PASS — prompt templates cover all sections");
}

console.log("=== Page02 Batch1 architecture tests done (structure only) ===");
console.log(
  "SCOPE_NOTE: these tests prove architecture/data path — not model content accuracy or real-user E2E.",
);
