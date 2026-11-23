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
  assemblePage02SectionsForDisplay,
  assemblePage02PdfArgumentBodies,
  page02InputContractsForSection,
  PAGE02_SECTION_IDS as SECTION_IDS,
  normalizePage02ReadingOrder,
  page02RequiredSectionIds,
  assemblePage02InputManifest,
  buildPage02MissingInputs,
  assertPage02InputAssemblyCoverage,
  page02AssembledFieldIds,
  filterValidApprovedReadings,
  PAGE02_FIELD_ASSEMBLERS,
} from "@/lib/llm/pro/delivery/decision-report-v2/page02/architecture";
import { isFace02Legacy, projectLegacyFace02ForDisplay } from "@/lib/llm/pro/delivery/decision-report-v2/page02/legacy-adapter";
import { buildFace02ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page02/production";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import { runContentBodyGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { Face02V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

console.log("=== Page02 Batch1 architecture (no LLM quality claims) ===");

assert.equal(PAGE02_SECTION_IDS.length, 5);
assert.equal(PAGE02_SECTION_DEFINITIONS.length, 5);
assert.equal(PAGE02_SECTION_CONTENT_SPECS.length, 5);
assert.ok(
  PAGE02_INPUT_FIELD_CONTRACTS.length >= 15,
  "expanded per-section input contracts",
);
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

// I: unique architecture entry — wrapper must equal production ctx.architecture
{
  const a = buildFace02ProductionContext({
    report_id: "unique_entry",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    page01,
  });
  const b = buildPage02ArchitectureProduction({
    report_id: "unique_entry",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    page01,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  if (!a.ok || !b.ok) throw new Error("build fail");
  assert.deepEqual(
    a.ctx.architecture.missing_inputs.map((g) => g.gap_id).sort(),
    b.envelope.missing_inputs.map((g) => g.gap_id).sort(),
  );
  assert.equal(a.ctx.may_invoke_llm, b.may_invoke_llm);
  console.log("I PASS — single architecture assembly entry (no duplicate logic)");
}

// J–L moved into async main below for content-body await.

async function runAsyncClosureChecks() {
  // J: content-body hard-blocks LLM when may_invoke_llm=false
  {
    const blocked = await runContentBodyGenerate({
      key: "02",
      finalize: { "02": { core_conclusion: "" } } as never,
      locale: "en",
      session_id: "arch_block_llm",
      report_id: "arch_block_llm",
      decision_context_snapshot: {
        ...dc,
        definition: { ...dc.definition!, decision_question: "" },
      } as DecisionContext,
      book_judgment_pack: pack,
      chart_fact_pack: "日主甲木…",
      page01_schema: null,
      dispatch_attempt: 1,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "face02_blocked_on_required_inputs");
    assert.equal(blocked.tokens_used, 0);
    console.log("J PASS — content-body enforces may_invoke_llm (no LLM call)");
  }

  // K: Reader + PDF share section assembly order/titles
  {
    const built = buildFace02ProductionContext({
      report_id: "reader_pdf",
      locale: "zh",
      dc,
      pack,
      chart_fact_pack: "日主甲木…",
      page01,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error(built.reason);
    const page = attachPage02ArchitectureToPage(
      {
        page: "02",
        face: "02",
        schema_version: "face02-v2",
        content_units: [
          {
            unit_id: "u_summary",
            kind: "conditional_explanation",
            text: "摘要正文",
            claim_ids: ["claim_u_science_02"],
            evidence_ids: [],
            related_reality_fact_unit_ids: [],
          },
          {
            unit_id: "u_why",
            kind: "conditional_explanation",
            text: "适合解释",
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
          uncertainty_notes: ["边界说明"],
        },
        reading_order: [...PAGE02_SECTION_IDS],
      } as Face02V2,
      built.ctx.architecture,
    );
    const reader = assemblePage02SectionsForDisplay(page, "zh");
    const pdf = assemblePage02PdfArgumentBodies(page, "zh");
    assert.deepEqual(
      reader.map((s) => s.section_id),
      [...PAGE02_SECTION_IDS],
    );
    assert.equal(reader[0]?.title, "本页摘要");
    assert.ok(pdf[0]?.body.startsWith("### 本页摘要"));
    assert.equal(reader.length, pdf.length);
    for (let i = 0; i < reader.length; i++) {
      assert.ok(pdf[i]!.body.includes(`### ${reader[i]!.title}`));
    }
    console.log("K PASS — Reader/PDF shared section assembly");
  }

  // L: every section has ≥1 input contract + assembler coverage 1:1
  {
    for (const id of SECTION_IDS) {
      assert.ok(
        page02InputContractsForSection(id).length >= 1,
        `section ${id} needs input contracts`,
      );
    }
    const coverage = assertPage02InputAssemblyCoverage();
    assert.deepEqual(
      coverage.field_ids,
      PAGE02_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort(),
    );
    assert.deepEqual(
      page02AssembledFieldIds(),
      PAGE02_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort(),
    );
    for (const c of PAGE02_INPUT_FIELD_CONTRACTS) {
      assert.ok(
        typeof PAGE02_FIELD_ASSEMBLERS[c.field_id] === "function",
        `assembler missing for ${c.field_id}`,
      );
      assert.ok(c.source_path.trim().length > 0, `${c.field_id} needs source_path`);
      assert.ok(c.affects_content.trim().length > 0);
      assert.ok(c.follow_up_collect_hint.trim().length > 0);
    }
    console.log(
      "L PASS — every field_id has contract + assembler (no silent missing fallback)",
    );
  }

  // M: reading_order normalize — required never omitted; dupes/unknowns dropped
  {
    const required = page02RequiredSectionIds();
    assert.ok(required.includes("page_summary"));
    assert.ok(required.includes("why_judgment_fits"));
    assert.ok(required.includes("explanation_boundary"));

    assert.deepEqual(
      normalizePage02ReadingOrder([]),
      [...PAGE02_SECTION_IDS],
    );
    assert.deepEqual(
      normalizePage02ReadingOrder(undefined),
      [...PAGE02_SECTION_IDS],
    );
    // Missing required → keep custom prefix, append omitted (incl. required) in SSOT order
    const missingRequired = normalizePage02ReadingOrder([
      "relevant_personal_factors",
      "personal_reality_interplay",
    ]);
    assert.deepEqual(missingRequired, [
      "relevant_personal_factors",
      "personal_reality_interplay",
      "page_summary",
      "why_judgment_fits",
      "explanation_boundary",
    ]);
    assert.equal(missingRequired.length, PAGE02_SECTION_IDS.length);
    for (const id of required) {
      assert.ok(missingRequired.includes(id));
    }
    // Dupes + unknown
    const dupUnknown = normalizePage02ReadingOrder([
      "why_judgment_fits",
      "page_summary",
      "page_summary",
      "not_a_real_section",
      "explanation_boundary",
    ]);
    assert.equal(new Set(dupUnknown).size, dupUnknown.length);
    assert.ok(!dupUnknown.includes("not_a_real_section" as never));
    assert.equal(dupUnknown.length, PAGE02_SECTION_IDS.length);
    assert.equal(dupUnknown[0], "why_judgment_fits");
    assert.equal(dupUnknown[1], "page_summary");

    const pageIncomplete = {
      page: "02",
      face: "02",
      schema_version: "face02-v2",
      locale: "en",
      content_units: [
        {
          unit_id: "u_summary",
          kind: "conditional_explanation",
          text: "Summary once.",
          claim_ids: ["claim_u_science_02"],
          evidence_ids: [],
          related_reality_fact_unit_ids: [],
        },
        {
          unit_id: "u_why",
          kind: "conditional_explanation",
          text: "Why once.",
          claim_ids: ["claim_u_science_02"],
          evidence_ids: [],
          related_reality_fact_unit_ids: [],
        },
      ],
      page_summary_unit_ids: ["u_summary", "u_summary"],
      relevant_personal_factor_unit_ids: [],
      personal_reality_interplay_unit_ids: [],
      why_judgment_fits_unit_ids: ["u_why"],
      explanation_boundary: {
        claim_ids: ["claim_u_science_02"],
        personal_unit_ids: [],
        confirmed_fact_unit_ids: [],
        hypothesis_unit_ids: [],
        uncertainty_notes: ["note"],
      },
      reading_order: ["page_summary", "why_judgment_fits"],
    } as Face02V2;

    const validated = validatePage02CanonicalPage(pageIncomplete);
    assert.equal(validated.ok, true);
    if (!validated.ok) throw new Error(validated.detail);
    const expectedOrder = normalizePage02ReadingOrder([
      "page_summary",
      "why_judgment_fits",
    ]);
    assert.deepEqual(validated.page.reading_order, expectedOrder);
    assert.equal(validated.page.reading_order!.length, PAGE02_SECTION_IDS.length);
    for (const id of required) {
      assert.ok(validated.page.reading_order!.includes(id));
    }

    const reader = assemblePage02SectionsForDisplay(validated.page, "en");
    const pdf = assemblePage02PdfArgumentBodies(validated.page, "en");
    const render = pageSchemaToArgumentBodies({
      ...validated.page,
      locale: "en",
    } as never);
    assert.equal(reader.length, PAGE02_SECTION_IDS.length);
    assert.equal(reader.length, pdf.length);
    assert.equal(reader.length, render.length);
    assert.deepEqual(
      reader.map((s) => s.section_id),
      expectedOrder,
    );
    // Optional empty sections still emit empty_display
    const optionalEmpty = reader.find(
      (s) => s.section_id === "relevant_personal_factors",
    );
    assert.ok(optionalEmpty);
    assert.equal(optionalEmpty!.texts.length, 0);
    assert.ok(optionalEmpty!.empty_display.length > 0);
    assert.ok(
      pdf.some((b) => b.body.includes(optionalEmpty!.empty_display)),
    );
    // Duplicate unit_id does not double-render
    const summary = reader.find((s) => s.section_id === "page_summary")!;
    assert.equal(summary.texts.length, 1);
    assert.equal(summary.texts[0], "Summary once.");
    console.log(
      "M PASS — reading_order normalize + empty optional + unit dedupe (Reader/PDF)",
    );
  }

  // N: every field_id maps to real snapshot inputs; gap statuses wired
  {
    const baseSnap = {
      report_id: "field_map",
      locale: "en",
      dc,
      pack,
      page01_core_judgment: page01.core_judgment.text,
      page01_why_paths: ["why path A"],
      page01_conditions: [
        { condition: "runway holds", status: "assumed", source_ids: ["fact_runway"] },
      ],
      available_domains: ["bazi"],
      profile_version: "cfp_arch",
      approved_readings: [
        {
          reading_id: "r_day",
          domain: "bazi",
          excerpt: "Cash-floor preference under pressure.",
        },
      ],
      approved_reading_count: 1,
      registry_claim_count: 2,
      reality_mechanism_evidence_count: 1,
    };
    const manifest = assemblePage02InputManifest(baseSnap);
    assert.equal(manifest.length, PAGE02_INPUT_FIELD_CONTRACTS.length);
    for (const c of PAGE02_INPUT_FIELD_CONTRACTS) {
      const entry = manifest.find((m) => m.field_id === c.field_id);
      assert.ok(entry, `manifest missing ${c.field_id}`);
      assert.equal(entry!.section_id, c.section_id);
      assert.equal(entry!.source_kind, c.source_kind);
    }
    // Ready fields from fixture
    assert.equal(
      manifest.find((m) => m.field_id === "page01_core_judgment")!.present,
      true,
    );
    assert.equal(
      manifest.find((m) => m.field_id === "decision_question")!.present,
      true,
    );
    assert.equal(
      manifest.find((m) => m.field_id === "personal_readings_payload")!.present,
      true,
    );
    assert.equal(
      manifest.find((m) => m.field_id === "confirmed_reality_facts_payload")!
        .present,
      true,
    );
    assert.equal(
      manifest.find((m) => m.field_id === "unverified_reality_facts_payload")!
        .collection_status,
      "unverified",
    );
    assert.equal(
      manifest.find((m) => m.field_id === "open_conflicts")!.collection_status,
      "conflict",
    );

    // Count-only readings must NOT mark present
    const countOnly = assemblePage02InputManifest({
      ...baseSnap,
      approved_readings: [],
      approved_reading_count: 9,
    });
    const payload = countOnly.find(
      (m) => m.field_id === "personal_readings_payload",
    )!;
    assert.equal(payload.present, false);
    assert.equal(payload.collection_status, "missing");

    // Incomplete reading objects → missing
    const incompleteObjs = assemblePage02InputManifest({
      ...baseSnap,
      approved_readings: [
        { reading_id: "r1", domain: "bazi" },
        { reading_id: "", domain: "bazi", excerpt: "x" },
        { domain: "bazi", excerpt: "no id" },
      ],
      approved_reading_count: 3,
    });
    assert.equal(
      incompleteObjs.find((m) => m.field_id === "personal_readings_payload")!
        .present,
      false,
    );
    assert.equal(filterValidApprovedReadings([{ reading_id: "a" }]).length, 0);
    assert.equal(
      filterValidApprovedReadings([
        { reading_id: "a", domain: "bazi", excerpt: "ok" },
      ]).length,
      1,
    );

    // Declined / unknown / not_applicable status path
    const dcStatuses = {
      ...dc,
      reality_facts: [
        {
          ...dc.reality_facts![0],
          fact_id: "fact_declined",
          status: "declined",
        },
        {
          ...dc.reality_facts![0],
          fact_id: "fact_unknown",
          status: "unknown",
        },
        {
          ...dc.reality_facts![0],
          fact_id: "fact_na",
          status: "not_applicable",
        },
      ],
      conflicts: [],
    } as DecisionContext;
    const statusManifest = assemblePage02InputManifest({
      ...baseSnap,
      dc: dcStatuses,
    });
    const declinedEntry = statusManifest.find(
      (m) => m.field_id === "declined_or_unknown_facts",
    )!;
    assert.equal(declinedEntry.present, true);
    assert.ok(
      ["declined", "unknown", "not_applicable"].includes(
        declinedEntry.collection_status,
      ),
    );
    // Confirmed payload must NOT treat declined as confirmed
    assert.equal(
      statusManifest.find(
        (m) => m.field_id === "confirmed_reality_facts_payload",
      )!.present,
      false,
    );

    const gaps = buildPage02MissingInputs(statusManifest);
    for (const g of gaps) {
      assert.ok(g.section_id);
      assert.ok(g.affects_content.trim().length > 0);
      assert.ok(g.why_needed.trim().length > 0);
      assert.ok(g.follow_up_collect_hint.trim().length > 0);
      assert.ok(
        [
          "omit_section_content",
          "defer_generation",
          "generate_conditional_only",
          "show_gap_note_only",
        ].includes(g.handling),
      );
    }
    assert.ok(
      gaps.some((g) => g.field_id === "declined_or_unknown_facts"),
      "declined/unknown facts must produce gap notes",
    );
    console.log(
      "N PASS — field_id assembly mapping + readings object gate + gap statuses",
    );
  }

  // O: legacy Face02 still projects; Reader/PDF share assembly; locale from page
  {
    const legacy = {
      page: "02",
      face: "02",
      destiny_reason: "Legacy destiny prose about structure under pressure.",
      science_mechanism: "Legacy science mechanism about runway buffers.",
      convergence: "Legacy convergence note for fit.",
      verifiable_anchors: ["anchor one"],
    };
    assert.equal(isFace02Legacy(legacy), true);
    const projected = projectLegacyFace02ForDisplay(legacy);
    assert.ok(projected);
    assert.equal(projected!.schema_version, "face02-v2");
    assert.deepEqual(
      normalizePage02ReadingOrder(projected!.reading_order),
      [...PAGE02_SECTION_IDS],
    );
    const reader = assemblePage02SectionsForDisplay(projected!, "zh");
    const pdf = assemblePage02PdfArgumentBodies(projected!, "zh");
    assert.equal(reader.length, pdf.length);
    assert.equal(reader.length, PAGE02_SECTION_IDS.length);

    // locale stamped on canonical page drives PDF titles
    const withLocale = {
      ...projected!,
      locale: "en" as const,
    };
    const renderEn = pageSchemaToArgumentBodies(withLocale as never);
    assert.ok(renderEn[0]?.body.includes("### Page summary"));
    console.log("O PASS — legacy compat + locale from canonical page for PDF");
  }
}

runAsyncClosureChecks()
  .then(() => {
    console.log("=== Page02 Batch1 architecture tests done (structure only) ===");
    console.log(
      "SCOPE_NOTE: these tests prove architecture/data path — not model content accuracy or real-user E2E.",
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
