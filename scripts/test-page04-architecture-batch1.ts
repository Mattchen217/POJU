/**
 * Page04 Batch 1 — architecture / production-path tests (Core Bottleneck).
 * Proves structure, gaps, prompts, tasks, Reader/PDF, Lab persist — NOT content quality.
 * Run: pnpm exec tsx scripts/test-page04-architecture-batch1.ts
 */

import assert from "node:assert/strict";
import {
  PAGE04_SECTION_DEFINITIONS,
  PAGE04_SECTION_IDS,
  PAGE04_INPUT_FIELD_CONTRACTS,
  PAGE04_SECTION_CONTENT_SPECS,
  PAGE04_MODEL_TASKS,
  PAGE04_GAP_STATUSES,
  PAGE04_ARCHITECTURE_PROMPT_VERSION,
  buildPage04ArchitectureProduction,
  attachPage04ArchitectureToPage,
  validatePage04CanonicalPage,
  page04TaskInterface,
  buildPage04ArchitecturePromptBundle,
  assemblePage04SectionsForDisplay,
  assemblePage04PdfArgumentBodies,
  page04InputContractsForSection,
  normalizePage04ReadingOrder,
  page04RequiredSectionIds,
  assemblePage04InputManifest,
  buildPage04MissingInputs,
  assertPage04InputAssemblyCoverage,
  page04AssembledFieldIds,
  filterValidApprovedReadings,
  PAGE04_FIELD_ASSEMBLERS,
} from "@/lib/llm/pro/delivery/decision-report-v2/page04/architecture";
import { buildFace04ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page04/production";
import {
  isFace04Legacy,
  projectLegacyFace04ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page04/legacy-adapter";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import { runContentBodyGenerate } from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import {
  createDeliveryLab,
  loadDeliveryLab,
  saveDeliveryLab,
} from "@/lib/llm/pro/delivery/lab/store";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { Face04V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

console.log("=== Page04 Batch1 architecture (no LLM quality claims) ===");

// A: Section SSOT
{
  assert.equal(PAGE04_SECTION_IDS.length, 5);
  assert.equal(PAGE04_SECTION_DEFINITIONS.length, 5);
  assert.equal(PAGE04_SECTION_CONTENT_SPECS.length, 5);
  assert.equal(new Set(PAGE04_SECTION_IDS).size, 5);
  assert.deepEqual(
    normalizePage04ReadingOrder([]),
    [...PAGE04_SECTION_IDS],
  );
  assert.deepEqual(
    normalizePage04ReadingOrder([
      "leverage_point",
      "leverage_point",
      "not_real",
      "bottleneck_naming",
    ]),
    [
      "leverage_point",
      "bottleneck_naming",
      "manifestation",
      "force_through_cost",
      "evidence_boundary",
    ],
  );
  for (const id of page04RequiredSectionIds()) {
    assert.ok(PAGE04_SECTION_IDS.includes(id));
  }
  assert.deepEqual(
    [...PAGE04_GAP_STATUSES].sort(),
    ["conflict", "declined", "missing", "not_applicable", "unknown", "unverified"].sort(),
  );
  console.log("A PASS — section / gap SSOTs + reading_order normalize");
}

const dc: DecisionContext = {
  context_id: "dc_arch_04",
  version: 1,
  status: "final",
  content_hash: "hash_arch_04",
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
  constraints: [{ constraint_id: "c_runway", text: "Keep 6m runway", kind: "hard" }],
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
  dirs: [],
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
  cfp_hash: "cfp_arch04",
  zfp_hash: null,
  zfpOmitted: true,
  shot_mode: "one",
  created_at: "2026-01-01T00:00:00Z",
  units: [
    {
      id: "u_bn_04",
      track: "science",
      claim: "Cash-floor fear repeats under offer pressure.",
      anchors: ["runway_buffer"],
      serves_face: ["04"],
      term_ids: [],
      source_domain: "science",
    },
  ],
  by_face: { "04": ["u_bn_04"] },
  pattern_hits_used: [],
  science_tags_used: [],
} as unknown as BookJudgmentPack;

const page01 = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: {
    text: "Prefer a staged explore path that keeps the cash floor intact.",
    claim_ids: ["claim_u_bn_04"],
  },
  why_this_path: [
    { text: "Runway buffer supports staged explore.", claim_ids: ["claim_u_bn_04"] },
  ],
  recommendation_conditions: [
    {
      condition: "runway holds",
      status: "assumed",
      source_ids: ["fact_runway"],
    },
    {
      condition: "offer terms clear",
      status: "assumed",
      source_ids: ["fact_salary_guess"],
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
    page02_evidence_ids: ["u_bn_04"],
    page08_review_refs: [],
  },
};

function sampleFace04V2(): Face04V2 {
  return {
    page: "04",
    face: "04",
    schema_version: "face04-v2",
    locale: "en",
    content_units: [
      {
        unit_id: "u_name",
        kind: "bottleneck_label",
        text: "Cash-floor panic under offer pressure.",
        title: "",
        claim_ids: ["claim_u_bn_04"],
        evidence_ids: [],
        related_reality_fact_ids: ["fact_runway"],
      },
      {
        unit_id: "u_manif",
        kind: "manifestation",
        text: "When the offer arrives, spending freezes and decisions stall.",
        claim_ids: ["claim_u_bn_04"],
        evidence_ids: [],
        related_reality_fact_ids: ["fact_runway"],
      },
      {
        unit_id: "u_force",
        kind: "force_through_cost",
        text: "If forced cold-resign continues, runway may compress under uncertainty.",
        claim_ids: ["claim_u_bn_04"],
        evidence_ids: [],
      },
      {
        unit_id: "u_lev",
        kind: "leverage_point",
        text: "Stabilize a cash floor decision rule before expanding offer talks.",
        claim_ids: ["claim_u_bn_04"],
        evidence_ids: [],
      },
      {
        unit_id: "u_ev",
        kind: "evidence_note",
        text: "Grounded on confirmed runway fact + pack claim.",
        claim_ids: ["claim_u_bn_04"],
        evidence_ids: [],
      },
    ],
    bottleneck_naming_unit_ids: ["u_name"],
    manifestation_unit_ids: ["u_manif"],
    force_through_cost_unit_ids: ["u_force"],
    leverage_point_unit_ids: ["u_lev"],
    evidence_boundary: {
      claim_ids: ["claim_u_bn_04"],
      evidence_note_unit_ids: ["u_ev"],
      confirmed_fact_ids: ["fact_runway"],
      hypothesis_notes: [],
      uncertainty_notes: ["Salary figure remains unverified"],
    },
    reading_order: [...PAGE04_SECTION_IDS],
  };
}

// B: Input contracts + assemblers 1:1
{
  assertPage04InputAssemblyCoverage();
  assert.deepEqual(
    page04AssembledFieldIds(),
    PAGE04_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort(),
  );
  for (const id of PAGE04_SECTION_IDS) {
    assert.ok(page04InputContractsForSection(id).length >= 1);
  }
  for (const c of PAGE04_INPUT_FIELD_CONTRACTS) {
    assert.ok(typeof PAGE04_FIELD_ASSEMBLERS[c.field_id] === "function");
    assert.ok(c.source_path.trim().length > 0);
  }
  console.log("B PASS — input contracts + assemblers coverage");
}

// C: Gap statuses
{
  const baseSnap = {
    report_id: "gap04",
    locale: "en",
    dc,
    pack,
    page01_core_judgment: page01.core_judgment.text,
    page01_conditions: page01.recommendation_conditions,
    page02_has_content_units: false,
    page02_unit_count: 0,
    page03_available: false,
    approved_readings: [
      {
        reading_id: "r1",
        domain: "bazi",
        excerpt: "Cash-floor preference under pressure.",
      },
    ],
    approved_reading_count: 1,
    registry_claim_count: 2,
  };
  const m = assemblePage04InputManifest(baseSnap);
  assert.equal(
    m.find((x) => x.field_id === "unverified_reality_facts_payload")!
      .collection_status,
    "unverified",
  );
  assert.equal(
    m.find((x) => x.field_id === "open_conflicts")!.collection_status,
    "conflict",
  );
  assert.equal(
    m.find((x) => x.field_id === "page03_pattern_payload")!.collection_status,
    "not_applicable",
  );
  // count-only readings
  const countOnly = assemblePage04InputManifest({
    ...baseSnap,
    approved_readings: [],
    approved_reading_count: 9,
  });
  assert.equal(
    countOnly.find((x) => x.field_id === "personal_readings_payload")!.present,
    false,
  );
  assert.equal(filterValidApprovedReadings([{ reading_id: "a" }]).length, 0);

  const declinedDc = {
    ...dc,
    reality_facts: [
      { ...dc.reality_facts![0], fact_id: "f_d", status: "declined" },
      { ...dc.reality_facts![0], fact_id: "f_u", status: "unknown" },
      { ...dc.reality_facts![0], fact_id: "f_n", status: "not_applicable" },
    ],
    conflicts: [],
  } as DecisionContext;
  const dm = assemblePage04InputManifest({ ...baseSnap, dc: declinedDc });
  assert.equal(
    dm.find((x) => x.field_id === "confirmed_reality_facts_payload")!.present,
    false,
  );
  const gaps = buildPage04MissingInputs(dm);
  assert.ok(gaps.some((g) => g.field_id === "declined_or_unknown_facts"));
  for (const g of gaps) {
    assert.equal(g.page_id, "04");
    assert.ok(g.why_needed && g.affects_content && g.follow_up_collect_hint);
  }
  console.log("C PASS — gap statuses (no confirmed upgrade)");
}

// D: Schema / unit integrity
{
  const ok = validatePage04CanonicalPage(sampleFace04V2());
  assert.equal(ok.ok, true);
  const dup = sampleFace04V2();
  dup.content_units.push({ ...dup.content_units[0]!, unit_id: "u_name" });
  const badDup = validatePage04CanonicalPage(dup);
  assert.equal(badDup.ok, false);
  const badRef = sampleFace04V2();
  badRef.bottleneck_naming_unit_ids = ["missing_unit"];
  assert.equal(validatePage04CanonicalPage(badRef).ok, false);
  console.log("D PASS — Face04V2 schema + unit integrity");
}

async function runAsyncChecks() {
  // E + F: Production gate + prompt/task
  {
    const built = buildPage04ArchitectureProduction({
      report_id: "arch04",
      locale: "en",
      dc,
      pack,
      chart_fact_pack: "日主甲木…",
      page01,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error(built.reason);
    assert.ok(
      built.architecture_prompt_bundle.includes(
        PAGE04_ARCHITECTURE_PROMPT_VERSION,
      ),
    );
    assert.ok(built.architecture_prompt_bundle.includes("Core Bottleneck"));
    assert.ok(
      built.architecture_prompt_bundle.includes("input_manifest") ||
        built.architecture_prompt_bundle.includes("Input manifest"),
    );
    assert.ok(built.system.includes("Page04") || built.user.includes("Page04"));
    assert.equal(built.envelope.sections.length, 5);
    assert.equal(PAGE04_MODEL_TASKS.length, 2);
    assert.ok(page04TaskInterface("page04_content_units_generate"));
    assert.ok(page04TaskInterface("page04_content_units_repair"));

    const ctx = buildFace04ProductionContext({
      report_id: "arch04_ctx",
      locale: "en",
      dc,
      pack,
      page01,
    });
    assert.equal(ctx.ok, true);
    if (!ctx.ok) throw new Error(ctx.reason);
    assert.ok(
      ctx.ctx.architecture_prompt_bundle.includes(
        PAGE04_ARCHITECTURE_PROMPT_VERSION,
      ),
    );
    assert.equal(
      ctx.ctx.architecture.generation_metadata.task_id,
      "page04_content_units_generate",
    );

    const blocked = await runContentBodyGenerate({
      key: "04",
      locale: "en",
      session_id: "arch04_block",
      report_id: "arch04_block",
      finalize: {} as never,
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
    assert.equal(blocked.reason, "face04_blocked_on_required_inputs");
    assert.equal(blocked.tokens_used, 0);
    console.log("E/F PASS — production gate + prompt/task wired");
  }

  // G: Lab persist/reload
  {
    const lab = await createDeliveryLab({
      ops_user: "lab_persist_04_test",
      source: {
        locale: "en",
        original_question: "Should I leave for the startup offer?",
        desired_outcome: "Preserve runway",
        base_analysis: "{}",
        session_id: `sess_lab04_${Date.now()}`,
      },
    });
    const built = buildFace04ProductionContext({
      report_id: lab.lab_id,
      locale: "en",
      dc,
      pack,
      page01,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error(built.reason);
    const attached = attachPage04ArchitectureToPage(sampleFace04V2(), {
      ...built.ctx.architecture,
      generation_status: "generated_with_gaps",
      generation_metadata: {
        ...built.ctx.architecture.generation_metadata,
        llm_invoked: false,
      },
    });
    lab.artifacts.by_page["04"] = {
      ...(lab.artifacts.by_page["04"] ?? {
        page_key: "04",
        status: "pending",
        attempts: [],
      }),
      page_schema: attached as never,
      page_schema_pre_polish: structuredClone(attached) as never,
    };
    await saveDeliveryLab(lab);
    const reloaded = await loadDeliveryLab(lab.lab_id);
    assert.ok(reloaded);
    const stored = reloaded!.artifacts.by_page["04"]?.page_schema;
    const validated = validatePage04CanonicalPage(stored);
    assert.equal(validated.ok, true);
    if (!validated.ok) throw new Error(validated.detail);
    assert.equal(validated.page.generation_status, "generated_with_gaps");
    assert.ok(Array.isArray(validated.page.input_manifest));
    assert.ok(Array.isArray(validated.page.sections));
    const reader = assemblePage04SectionsForDisplay(validated.page, "en");
    const pdf = assemblePage04PdfArgumentBodies(validated.page, "en");
    assert.equal(reader.length, pdf.length);
    assert.equal(reader.length, PAGE04_SECTION_IDS.length);
    console.log("PAGE04_ARCH_PERSIST_RELOAD_OK");
    console.log("G PASS — Lab persist/reload architecture fields");
  }

  // H: Legacy PDF entry (raw historical object)
  {
    const rawLegacy = {
      page: "04",
      face: "04",
      bottleneck_name: "Cash-floor panic under offer pressure.",
      manifestation: "Spending freezes when the offer arrives.",
      if_force_through: "Cold resign may compress runway.",
      evidence_fold: "Historical evidence fold about runway preference.",
    };
    assert.equal(isFace04Legacy(rawLegacy), true);
    const pdfBodies = pageSchemaToArgumentBodies(rawLegacy as never);
    assert.equal(pdfBodies.length, PAGE04_SECTION_IDS.length);
    for (let i = 0; i < PAGE04_SECTION_DEFINITIONS.length; i++) {
      assert.ok(
        pdfBodies[i]!.body.startsWith(
          `### ${PAGE04_SECTION_DEFINITIONS[i]!.title_zh}`,
        ),
      );
    }
    const joined = pdfBodies.map((b) => b.body).join("\n");
    assert.ok(joined.includes("Cash-floor panic under offer pressure."));
    assert.ok(joined.includes("Spending freezes when the offer arrives."));
    assert.ok(joined.includes("Cold resign may compress runway."));
    assert.ok(
      joined.includes("Historical evidence fold about runway preference."),
    );
    const projected = projectLegacyFace04ForDisplay(rawLegacy)!;
    const reader = assemblePage04SectionsForDisplay(projected, "zh");
    assert.deepEqual(
      reader.map((s) => s.section_id),
      [...PAGE04_SECTION_IDS],
    );
    assert.throws(
      () =>
        pageSchemaToArgumentBodies({
          page: "04",
          face: "04",
        } as never),
      /face04_pdf_legacy_project_failed/,
    );
    const canon = pageSchemaToArgumentBodies(sampleFace04V2() as never);
    assert.ok(canon[0]!.body.includes("### What the bottleneck is"));
    console.log("H PASS — raw legacy PDF → projectLegacy → section-assembly");
  }

  // I: Reader uses section-assembly
  {
    const ui = readFileSync(
      resolvePath("components/poju/delivery-pages/faces/Face04PageSlots.tsx"),
      "utf8",
    );
    assert.ok(ui.includes("assemblePage04SectionsForDisplay"));
    assert.ok(ui.includes("section-assembly"));
    console.log("I PASS — Reader/PDF shared assembly wiring");
  }
}

runAsyncChecks()
  .then(() => {
    console.log("=== Page04 Batch1 architecture tests done (structure only) ===");
    console.log(
      "SCOPE_NOTE: architecture/data path only — not model content accuracy or real-user E2E.",
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
