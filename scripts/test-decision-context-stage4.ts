/**
 * Product Stage 4 — frozen DC binding, read-only feed, P5/P6/P8 consistency.
 * Run: pnpm test:decision-context-stage4
 */

import assert from "node:assert/strict";
import {
  assertP5P6P8Consistency,
  assertSnapshotMatchesBinding,
  assertStage4ReadOnly,
  bindingFromDecisionContext,
  buildStage4SampleFromFrozenDc,
  computeContentHash,
  DcReportBindError,
  DC_REPORT_HASH_MISMATCH,
  DC_REPORT_MISSING,
  DC_REPORT_NOT_FROZEN,
  formatDecisionContextSliceForPage,
  freezeDecisionContext,
  naValidationBoundToDc,
  pageReceivesDecisionContextFeed,
  reaggregateDirsIntake,
  resolveDecisionContextForReport,
  seedDecisionContextFromOpening,
  stage4ValueDimensionChecklist,
  startV2FromFinal,
  STAGE4_VALUE_DIMENSIONS,
  type DecisionContext,
} from "../lib/poju/decision-context";
import { buildFacePromptPair } from "../lib/llm/pro/delivery/page-schema/face-prompt";
import { Face05Schema, Face06Schema, Face08Schema } from "../lib/llm/pro/delivery/page-schema/face-types";
import { buildCoverAndToc } from "../lib/llm/pro/delivery/merge-delivery-markdown";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    console.error(err);
  }
}

function makeFreezableDraft(context_id: string): DecisionContext {
  const seeded = seedDecisionContextFromOpening({
    context_id,
    now: "2026-11-03T15:00:00.000Z",
    core_dilemma: {
      concrete_event: "Whether to leave the current role this quarter",
      stakes: "Income and family stability",
      sticking_point: null,
    },
    desired_direction: { wants: "Clearer path with reversible first step", priority: "stability" },
    user_statements: [
      {
        statement: "I have six months runway",
        verification_level: "user_asserted",
        has_user_confirm_event: true,
        status: "confirmed",
        source_turn_id: "t_s4_1",
        fact_roles: ["runway", "event"],
      },
      {
        statement: "Partner support level is unclear",
        verification_level: "user_estimate",
        status: "unverified",
        source_turn_id: "t_s4_2",
        fact_roles: ["support"],
      },
    ],
    user_constraints: [
      {
        statement: "Cannot take irreversible relocation cost before verifying demand",
        category: "reversibility",
        rigidity: "hard",
        source_turn_id: "t_s4_c1",
        has_user_confirm_event: true,
      },
    ],
  });
  seeded.hypotheses = [
    {
      hypothesis_id: "h_s4_1",
      statement: "A low-cost consulting pilot will clarify demand before quitting",
      supporting_evidence: ["runway fact"],
      counter_evidence: [],
      validation_need: "Run a bounded pilot and observe inbound interest",
      state: "pending_validation",
      related_dir_ids: ["dir_s4_p5"],
    },
  ];
  seeded.reality_facts.push({
    fact_id: "f_support_placeholder",
    statement: "Partner discussed support at a high level (still incomplete detail)",
    status: "confirmed",
    verification_level: "user_asserted",
    source_stage: "collecting",
    source_turn_id: "t_s4_3",
    user_confirmed: true,
    fact_roles: ["support"],
    related_dir_ids: ["dir_s4_p5"],
  });
  seeded.reality_facts = seeded.reality_facts.map((f) => ({
    ...f,
    related_dir_ids: Array.from(
      new Set([
        ...(f.related_dir_ids ?? []),
        ...(f.fact_roles?.includes("support")
          ? ["dir_s4_p5"]
          : ["dir_s4_known"]),
      ]),
    ),
  }));
  seeded.constraints = seeded.constraints.map((c) => ({
    ...c,
    related_dir_ids: ["dir_s4_known", "dir_s4_p5"],
  }));
  const dirsSeed = [
    {
      dir_id: "dir_s4_known",
      need: "Confirm runway",
      why: "Affordability",
      required_fact_roles: ["runway"],
      current_state: "unknown" as const,
      partial_satisfaction: false,
      agenda_item_ids: [] as string[],
      id_lifecycle: "active" as const,
      may_affect_p5_ranking: false,
    },
    {
      dir_id: "dir_s4_p5",
      need: "Partner support certainty",
      why: "Changes preferred path ranking",
      required_fact_roles: ["support"],
      current_state: "unknown" as const,
      partial_satisfaction: false,
      agenda_item_ids: [] as string[],
      id_lifecycle: "active" as const,
      may_affect_p5_ranking: true,
    },
  ];
  seeded.dirs = reaggregateDirsIntake(
    dirsSeed,
    seeded.reality_facts,
    [],
    seeded.constraints,
    [],
    naValidationBoundToDc(seeded, "sess_stage4_fixture"),
  );
  seeded.information_boundaries = [
    "Exact partner support amount unknown; may change P5 ranking detail",
  ];
  return seeded;
}

async function main() {
  console.log("decision-context product stage4");

  const draft = makeFreezableDraft("dc_stage4");
  const STAGE4_SESS = "sess_stage4_fixture";
  const { frozen, version_snapshot } = freezeDecisionContext(draft, {
    stage3_sufficiency_end: true,
    now: "2026-11-03T15:30:00.000Z",
    naValidation: naValidationBoundToDc(draft, STAGE4_SESS),
  });

  await check("freeze yields final + hash", () => {
    assert.equal(frozen.status, "final");
    assert.equal(frozen.content_hash, computeContentHash(frozen));
    assert.equal(version_snapshot.content_hash, frozen.content_hash);
  });

  await check("resolveDecisionContextForReport binds current final", () => {
    const { snapshot, binding } = resolveDecisionContextForReport({
      decision_context: frozen,
      decision_context_versions: [version_snapshot],
    });
    assert.equal(binding.context_id, "dc_stage4");
    assert.equal(binding.context_version, frozen.version);
    assert.equal(binding.context_hash, frozen.content_hash);
    assert.equal(snapshot.status, "final");
    assertSnapshotMatchesBinding(snapshot, binding);
  });

  await check("hash mismatch hard-fails", () => {
    assert.throws(
      () =>
        resolveDecisionContextForReport(
          { decision_context: frozen },
          { expected_hash: "0".repeat(64) },
        ),
      (e: unknown) =>
        e instanceof DcReportBindError && e.code === DC_REPORT_HASH_MISMATCH,
    );
  });

  await check("draft DC cannot be used for report", () => {
    assert.throws(
      () =>
        resolveDecisionContextForReport({
          decision_context: { ...frozen, status: "draft", content_hash: null },
        }),
      (e: unknown) =>
        e instanceof DcReportBindError &&
        (e.code === DC_REPORT_NOT_FROZEN || e.code === DC_REPORT_MISSING),
    );
  });

  await check("missing DC hard-fails", () => {
    assert.throws(
      () => resolveDecisionContextForReport({}),
      (e: unknown) => e instanceof DcReportBindError && e.code === DC_REPORT_MISSING,
    );
  });

  await check("Stage4 read-only guard blocks mutate of final", () => {
    assert.throws(() => assertStage4ReadOnly(frozen), DcReportBindError);
  });

  await check("V2 supplement does not rewrite V1 hash; old binding stays valid", () => {
    const v1Hash = frozen.content_hash!;
    const { superseded, draft: v2 } = startV2FromFinal(frozen, {
      now: "2026-11-03T16:00:00.000Z",
      information_boundaries: ["New user note after report"],
      naValidation: naValidationBoundToDc(frozen, STAGE4_SESS),
    });
    assert.equal(superseded.content_hash, v1Hash);
    assert.equal(superseded.status, "superseded");
    assert.equal(v2.status, "draft");
    assert.equal(v2.version, frozen.version + 1);
    const oldBinding = bindingFromDecisionContext(superseded);
    assertSnapshotMatchesBinding(superseded, oldBinding);
    // Draft alone is not report-bindable
    assert.throws(
      () => resolveDecisionContextForReport({ decision_context: v2 }),
      DcReportBindError,
    );
    // With versions[], resolver binds the frozen superseded V1 (old report stays valid)
    const resolvedDefault = resolveDecisionContextForReport({
      decision_context: v2,
      decision_context_versions: [superseded],
    });
    assert.equal(resolvedDefault.binding.context_hash, v1Hash);
    assert.equal(resolvedDefault.snapshot.status, "superseded");
    // Explicit old version still resolves
    const resolvedOld = resolveDecisionContextForReport(
      {
        decision_context: v2,
        decision_context_versions: [superseded],
      },
      { context_id: "dc_stage4", version: superseded.version },
    );
    assert.equal(resolvedOld.binding.context_hash, v1Hash);
  });

  await check("DC page feed only on Stage4 pages; 03/07 empty", () => {
    assert.equal(pageReceivesDecisionContextFeed("05"), true);
    assert.equal(pageReceivesDecisionContextFeed("06"), true);
    assert.equal(pageReceivesDecisionContextFeed("08"), true);
    assert.ok(formatDecisionContextSliceForPage(frozen, "05").includes("Formal Decision Context"));
    assert.ok(formatDecisionContextSliceForPage(frozen, "05").includes(frozen.content_hash!));
    assert.equal(formatDecisionContextSliceForPage(frozen, "03"), "");
    assert.equal(formatDecisionContextSliceForPage(frozen, "07"), "");
  });

  await check("face prompt injects DC feed for P5", () => {
    const feed = formatDecisionContextSliceForPage(frozen, "05");
    const { system, user } = buildFacePromptPair({
      faceId: "05",
      locale: "en",
      slice: { pageId: "05", dump: { note: "test" } },
      decisionContextFeed: feed,
    });
    assert.match(system, /Stage4 P5|Product Stage4 P5/);
    assert.ok(user.includes("Formal Decision Context"));
    assert.ok(user.includes(frozen.context_id));
  });

  await check("Face05/06/08 schemas accept Stage4 fields", () => {
    const f05 = Face05Schema.parse({
      page: "05",
      face: "05",
      first_choice: "Conditional preferred: pilot then decide",
      second_choice: "Phased retain while verifying",
      caution_choice: "Immediate quit without pilot",
      switch_or_stop: "Stop if runway drops below confirmed floor",
      recommendation_conditions: "Partner support detail may change ranking",
      evidence_trace: ["fact:f1", "hypothesis:h_s4_1"],
    });
    assert.ok(f05.recommendation_conditions);
    const f06 = Face06Schema.parse({
      page: "06",
      face: "06",
      near_step_principle: "Run pilot",
      stage_climate: "Verification window",
      self_retune: "Adjust cadence",
      rhythm_note: "No scope expand",
      verification_experiment: {
        hypothesis: "Pilot clarifies demand",
        action: "Offer two paid pilot slots",
        observe: "Inbound interest quality",
        window: "Two weeks of outreach",
        success_criteria: "Enough signal to keep or revise preferred path",
        if_fail: "Adjust path; do not quit yet",
        defer_costs: "Defer relocation and resignation paperwork",
      },
    });
    assert.ok(f06.verification_experiment?.hypothesis);
    const f08 = Face08Schema.parse({
      page: "08",
      face: "08",
      red_lights: ["Irreversible spend before pilot ends"],
      review_questions: ["Did observation quality improve?"],
      when_to_rerun: "Material new support facts",
      shared_core_metrics: ["Inbound interest quality"],
      review_decision: "adjust",
      review_decision_rationale: "Open boundary on partner support",
    });
    assert.equal(f08.review_decision, "adjust");
  });

  await check("sample report binds hash and passes P5/P6/P8 consistency", () => {
    const artifact = buildStage4SampleFromFrozenDc(frozen, {
      report_id: "STAGE4-E2E-SAMPLE",
      now: "2026-11-03T17:00:00.000Z",
    });
    assert.equal(artifact.binding.context_hash, frozen.content_hash);
    assertP5P6P8Consistency(artifact);
    const dims = stage4ValueDimensionChecklist(artifact);
    for (const d of STAGE4_VALUE_DIMENSIONS) {
      assert.equal(dims[d].ok, true, `${d} should pass: ${dims[d].note}`);
    }
  });

  await check("cover meta includes Decision Context binding line", () => {
    const binding = bindingFromDecisionContext(frozen);
    const cover = buildCoverAndToc({
      original_question: "Should I leave this quarter?",
      locale: "en",
      report_id: "POJU-STAGE4",
      generated_at: "2026-11-03T17:00:00.000Z",
      decision_context_binding: binding,
    });
    assert.ok(cover.includes("Decision Context:"));
    assert.ok(cover.includes(binding.context_id));
    assert.ok(cover.includes(`v${binding.context_version}`));
  });

  await check("unverified facts stay separated in feed (not upgraded)", () => {
    const feed = formatDecisionContextSliceForPage(frozen, "05");
    assert.ok(feed.includes("unverified_or_estimate_facts"));
    assert.ok(feed.includes("Partner support level is unclear") || feed.includes("unverified"));
    assert.ok(feed.includes("never upgrade"));
  });

  console.log(`\nStage4 results: PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
