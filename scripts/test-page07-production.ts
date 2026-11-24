/**
 * Page07 production closure — stubbed LLM through real runContentBodyGenerate.
 * Run: pnpm exec tsx scripts/test-page07-production.ts
 */

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import {
  runContentBodyGenerate,
  setContentBodyTestInvokeForTests,
} from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import {
  buildFace07ProductionContext,
  validateFace07ProductionOutput,
  parseFace07JsonStrict,
  synthesizeFace07StatusPage,
} from "@/lib/llm/pro/delivery/decision-report-v2/page07/production";
import { validateFace07Output } from "@/lib/llm/pro/delivery/decision-report-v2/page07/validate";
import {
  assemblePage07PdfArgumentBodies,
  assemblePage07SectionsForDisplay,
  PAGE07_SECTION_IDS,
} from "@/lib/llm/pro/delivery/decision-report-v2/page07/architecture";
import {
  isFace07Legacy,
  projectLegacyFace07ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page07/legacy-adapter";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import { Face07PageSlots } from "@/components/poju/delivery-pages/faces/Face07PageSlots";
import {
  createDeliveryLab,
  loadDeliveryLab,
  saveDeliveryLab,
} from "@/lib/llm/pro/delivery/lab/store";
import { initLabStepsV3, labStepDefsV3 } from "@/lib/llm/pro/delivery/lab/types-v3";
import { runLabStepV3 } from "@/lib/llm/pro/delivery/lab/run-step-v3";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { CallLLMResult } from "@/lib/llm/router";
import type { Face07V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

function stubResult(content: string, tokens = 80): CallLLMResult {
  return {
    content,
    actual_model: "test-stub",
    meta: {
      call_type: "main_delivery",
      tokens_used: tokens,
      latency_ms: 1,
      cost_usd: 0,
      cached_tokens: 0,
      thinking_enabled: false,
      thinking_effort: "high",
      finish_reason: "stop",
      usage_written: true,
    },
    llm_debug: {
      requested_effort: "high",
      max_tokens: 20000,
      reasoning_budget: 0,
      model: "test-stub",
      prompt_tokens: 10,
      cached_tokens: 0,
      cache_ratio: 0,
      completion_tokens: 10,
      reasoning_tokens: 0,
      reasoning_used_ratio: 0,
      latency_ms: 1,
      attempt: 1,
      retried: false,
      fell_back: false,
    },
  };
}

function makeDc(
  question: string,
  facts: DecisionContext["reality_facts"] = [],
  constraints: DecisionContext["constraints"] = [],
): DecisionContext {
  return {
    context_id: "dc_prod_07",
    version: 1,
    status: "final",
    content_hash: "hash_prod_07",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question: question,
      concrete_event: "Partnership talk",
      desired_outcome: "A clear split before moving",
      stakes: "Shared move",
      goal_priorities: ["clarity"],
      unacceptable_outcomes: ["unsigned move"],
    },
    constraints,
    reality_facts: facts,
    dirs: [],
    conflicts: [],
    hypotheses: [],
  };
}

const applicableQuestion = "Should I relocate and enter a partnership with Alex?";
const soloQuestion = "Should I take a solo promotion and keep my runway?";

const applicableFacts: DecisionContext["reality_facts"] = [
  {
    fact_id: "fact_alex",
    statement: "Partnership with Alex requires a written split before we relocate.",
    status: "confirmed",
    verification_level: "user_asserted",
    source_stage: "collecting",
    source_turn_id: "t1",
    user_confirmed: true,
  },
  {
    fact_id: "fact_guess",
    statement: "Alex might cover half the move cost.",
    status: "unverified",
    verification_level: "user_estimate",
    source_stage: "collecting",
    source_turn_id: "t2",
    user_confirmed: false,
  },
];

const dcApplicable = makeDc(applicableQuestion, applicableFacts, [
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
]);
const dcSolo = makeDc(soloQuestion, [
  {
    fact_id: "fact_runway",
    statement: "Runway is about eight months.",
    status: "confirmed",
    verification_level: "user_asserted",
    source_stage: "collecting",
    source_turn_id: "t1",
    user_confirmed: true,
  },
]);

const pack: BookJudgmentPack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_prod07",
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
  ],
  by_face: { "07": ["u_field_07"] },
  pattern_hits_used: [],
  science_tags_used: [],
} as unknown as BookJudgmentPack;

const page01 = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: {
    text: "Prefer a written split before any shared move.",
    claim_ids: ["claim_u_field_07"],
  },
  why_this_path: [
    { text: "The move is only workable with a written split.", claim_ids: ["claim_u_field_07"] },
  ],
  recommendation_conditions: [
    { condition: "split is written", status: "assumed", source_ids: ["fact_alex"] },
  ],
  not_recommended: [
    { option: "Move unsigned", reason: "Responsibility stays unclear", cost_or_conflict: "Shared cost shock" },
  ],
  applicability_boundary: {
    current_basis: ["Confirmed partnership fact"],
    invalidation_conditions: ["Alex withdraws"],
    page02_evidence_ids: ["u_field_07"],
    page08_review_refs: [],
  },
};

const page02 = {
  page: "02",
  face: "02",
  schema_version: "face02-v2",
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
  explanation_boundary: {
    claim_ids: ["claim_u_field_07"],
    known_limits: ["Move cost is unverified"],
    open_questions: ["Who pays the deposit"],
  },
};

const page04 = {
  page: "04",
  face: "04",
  schema_version: "face04-v2",
  content_units: [
    {
      unit_id: "u_name",
      kind: "bottleneck_label",
      text: "Unwritten responsibility before a shared move.",
      title: "",
      claim_ids: ["claim_u_field_07"],
      evidence_ids: [],
      related_reality_fact_ids: ["fact_alex"],
    },
  ],
  evidence_boundary: {
    claim_ids: ["claim_u_field_07"],
    confirmed_fact_ids: ["fact_alex"],
    hypothesis_notes: [],
    uncertainty_notes: ["Move cost is still an estimate"],
  },
};

const page05 = {
  page: "05",
  face: "05",
  schema_version: "face05-v2",
  preferred_path_ids: ["path_split"],
  alternative_path_ids: ["path_stay"],
  cautious_path_ids: [],
  path_units: [
    {
      path_id: "path_split",
      path_role: "preferred",
      title: "Write the split before relocating",
      description: "Keep the move conditional on a written partnership split.",
      prerequisites: ["Alex is willing to write it"],
      required_resources: ["one conversation"],
      risks: ["Talk stalls"],
      success_signals: ["A dated split note exists"],
      reconsideration_conditions: [],
    },
  ],
  path_comparison: { rows: [] },
  switching_rules: [],
  evidence_boundary: {
    claim_ids: ["claim_u_field_07"],
    confirmed_fact_ids: ["fact_alex"],
    hypothesis_notes: [],
    uncertainty_notes: ["x"],
  },
};

const page06 = {
  page: "06",
  face: "06",
  schema_version: "face06-v2",
  primary_path_id: "path_split",
  first_step: {
    action_id: "act_first",
    path_id: "path_split",
    what: "Draft the split note before any move date.",
    why_now: "The preferred path only holds with a written split.",
    required_resources: ["one sitting"],
    expected_observable_result: "A draft split exists.",
    claim_ids: ["claim_u_field_07"],
    evidence_ids: ["u_field_07"],
    reality_fact_ids: ["fact_alex"],
  },
  execution_actions: [
    {
      action_id: "act_send",
      path_id: "path_split",
      sequence: 1,
      action: "Send the draft only after it names the split.",
      rationale: "Keeps the move conditional.",
      resources: ["draft"],
      dependencies: ["act_first"],
      observable_result: "Draft is sent or held.",
      guardrails: ["Do not book the move in the same step"],
      claim_ids: ["claim_u_field_07"],
      evidence_ids: ["u_field_07"],
      reality_fact_ids: ["fact_alex"],
    },
  ],
};

function validFace07(overrides?: Record<string, unknown>) {
  const base = {
    page: "07",
    face: "07",
    schema_version: "face07-v2",
    locale: "en",
    applicability_status: "applicable",
    applicability_reason: "Relocation and partnership are linked to this decision.",
    skip_note: "",
    participants: [
      {
        participant_id: "self",
        display_label: "you",
        role: "self",
        source: "user_self",
        verification_status: "confirmed",
        related_fact_ids: ["fact_alex"],
        notes: "",
      },
      {
        participant_id: "p_alex",
        display_label: "Alex",
        role: "partner",
        source: "dc_fact",
        verification_status: "confirmed",
        related_fact_ids: ["fact_alex"],
        notes: "Named in the confirmed partnership fact.",
      },
    ],
    field_units: [
      {
        unit_id: "fu_move",
        kind: "field_entry_exit",
        text: "Do not enter the new city until the written split exists.",
        claim_ids: ["claim_u_field_07"],
        evidence_ids: ["u_field_07"],
        reality_fact_ids: ["fact_alex"],
        participant_ids: ["self"],
        dir_ids: [],
        supporting_personal_unit_refs: ["p02_personal"],
      },
    ],
    relationship_units: [
      {
        unit_id: "ru_split",
        kind: "power_interest",
        text: "The partnership with Alex stays conditional on a written split. The move-cost share is still unverified.",
        claim_ids: ["claim_u_field_07"],
        evidence_ids: ["u_field_07"],
        reality_fact_ids: ["fact_alex"],
        participant_ids: ["p_alex"],
        uncertainty_notes: ["Move cost share is unverified."],
        supporting_personal_unit_refs: [],
      },
    ],
    evidence_boundary: {
      claim_ids: ["claim_u_field_07"],
      confirmed_fact_ids: ["fact_alex"],
      hypothesis_notes: ["Move cost share is only an estimate."],
      uncertainty_notes: ["No authorized profile of Alex is available."],
      third_party_data_limits: ["Alex is not given a personality reading."],
      supporting_personal_unit_refs: ["p02_personal"],
    },
    alignment_with_main: {
      changes_page01_recommendation: false,
      changes_page05_path_order: false,
      effect_on_page06_execution: "Keep act_first as the split draft; do not add a move booking.",
      summary: "The field does not change the main recommendation. It keeps the split as an auxiliary condition.",
      claim_ids: ["claim_u_field_07"],
      evidence_ids: ["u_field_07"],
      related_page05_path_ids: ["path_split"],
      related_page06_action_ids: ["act_first"],
    },
    reading_order: [...PAGE07_SECTION_IDS],
    authorized_partner_profile: false,
  };
  return { ...base, ...(overrides ?? {}) };
}

function ctxOf(dc: DecisionContext = dcApplicable) {
  const built = buildFace07ProductionContext({
    report_id: "prod07",
    locale: "en",
    dc,
    pack,
    page01,
    page02,
    page04,
    page05,
    page06,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  return built.ctx;
}

async function buildLab(dc: DecisionContext): Promise<DeliveryLabSession> {
  process.env.BOOK_JUDGMENT_PACK = "0";
  const lab = await createDeliveryLab({
    ops_user: "lab_prod_07_wiring",
    source: {
      locale: "en",
      original_question: dc.definition.decision_question ?? "",
      desired_outcome: "Clarity",
      base_analysis: "{}",
      session_id: `sess_lab07_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      decision_context_snapshot: dc,
    },
    mode: "delivery_only",
  });
  lab.pipeline = "v3_three_step";
  lab.steps = initLabStepsV3();
  lab.artifacts.by_page = lab.artifacts.by_page ?? {};
  for (const [id, schema] of [
    ["01", page01],
    ["02", page02],
    ["04", page04],
    ["05", page05],
    ["06", page06],
  ] as const) {
    lab.artifacts.by_page[id] = {
      page_schema: schema as never,
      page_schema_pre_polish: structuredClone(schema),
    };
  }
  lab.artifacts.by_page["07"] = lab.artifacts.by_page["07"] ?? {};
  lab.artifacts.prealloc = {
    by_page: {},
    pool_source: "chart_fact_pack",
    chart_fact_pack: "dayMaster:甲",
  } as never;
  lab.artifacts.book_judgment_pack = pack;
  const defs = labStepDefsV3();
  const bodyIdx = defs.findIndex((d) => d.step_key === "07.content.body");
  assert.ok(bodyIdx >= 0, "07.content.body exists");
  for (let i = 0; i < bodyIdx; i++) {
    const key = defs[i]!.step_key;
    lab.steps[key] = {
      step_key: key,
      status: "approved",
      attempts: [
        {
          attempt_number: 1,
          timestamp: new Date().toISOString(),
          duration_ms: 1,
          input_payload: {},
          raw_model_output: null,
          processing_actions: [],
          gate_verdict: { passed: true, detail: "seed_approved" },
          output_to_next_stage: null,
        },
      ],
      approved_attempt: 0,
    };
  }
  lab.cursor_index = bodyIdx;
  lab.approved_order = defs.slice(0, bodyIdx).map((d) => d.step_key);
  await saveDeliveryLab(lab);
  return lab;
}

async function main() {
  console.log("=== Page07 production closure (stubbed LLM) ===");

  {
    const ctx = ctxOf();
    assert.equal(ctx.applicability.status, "applicable");
    assert.equal(ctx.may_invoke_llm, true);
    assert.ok(ctx.user.includes("## Production payload"));
    assert.ok(ctx.user.includes("fact_alex"));
    assert.ok(ctx.user.includes("path_split"));
    assert.ok(ctx.user.includes("act_first"));
    assert.ok(ctx.user.includes("p02_personal"));
    assert.equal(ctx.authorized_partner_profile, false);
    assert.ok(ctx.knownPersonalInterpretationUnitRefs.has("p02_personal"));
    assert.equal(Object.keys(ctx.registry.claims).length, 1);
    console.log("E PASS — applicable payload");
  }

  {
    const ctx = ctxOf();
    const validated = validateFace07ProductionOutput({
      raw: validFace07(),
      locale: "en",
      ctx,
    });
    assert.equal(validated.ok, true, validated.ok ? "" : validated.issues.map((i) => i.detail).join(" | "));
    if (!validated.ok) throw new Error("unreachable");
    assert.equal(validated.page.generation_metadata?.llm_invoked, true);
    assert.equal(validated.page.applicability_status, "applicable");

    const badPerson = validateFace07Output({
      raw: validFace07({
        relationship_units: [
          {
            ...(validFace07().relationship_units as object[])[0],
            supporting_personal_unit_refs: ["p02_personal"],
          },
        ],
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      factContentById: ctx.factContentById,
      upstream: ctx.upstream,
      knownDirIds: ctx.knownDirIds,
      knownPersonalInterpretationUnitRefs: ctx.knownPersonalInterpretationUnitRefs,
      authorizedPartnerProfile: false,
    });
    assert.equal(badPerson.ok, false);
    if (badPerson.ok) throw new Error("unreachable");
    assert.ok(
      badPerson.issues.some((i) => i.code === "personal_interpretation_applied_to_third_party"),
    );

    const invented = validateFace07Output({
      raw: validFace07({
        participants: [
          ...(validFace07().participants as object[]),
          {
            participant_id: "p_ghost",
            display_label: "Ghost",
            role: "advisor",
            source: "model",
            verification_status: "confirmed",
            related_fact_ids: ["fact_alex"],
            notes: "",
          },
        ],
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      factContentById: ctx.factContentById,
      upstream: ctx.upstream,
      knownPersonalInterpretationUnitRefs: ctx.knownPersonalInterpretationUnitRefs,
    });
    assert.equal(invented.ok, false);
    if (invented.ok) throw new Error("unreachable");
    assert.ok(invented.issues.some((i) => i.code === "invented_third_party"));

    const personality = validateFace07Output({
      raw: validFace07({
        relationship_units: [
          {
            ...(validFace07().relationship_units as object[])[0],
            text: "Alex 的性格决定了合伙能不能成。",
          },
        ],
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      factContentById: ctx.factContentById,
      upstream: ctx.upstream,
      knownPersonalInterpretationUnitRefs: ctx.knownPersonalInterpretationUnitRefs,
      authorizedPartnerProfile: false,
    });
    assert.equal(personality.ok, false);
    if (personality.ok) throw new Error("unreachable");
    assert.ok(
      personality.issues.some((i) => i.code === "third_party_personality_without_profile"),
    );

    const badPath = validateFace07Output({
      raw: validFace07({
        alignment_with_main: {
          ...(validFace07().alignment_with_main as object),
          related_page05_path_ids: ["path_missing"],
          related_page06_action_ids: ["act_missing"],
        },
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      factContentById: ctx.factContentById,
      upstream: ctx.upstream,
    });
    assert.equal(badPath.ok, false);
    if (badPath.ok) throw new Error("unreachable");
    assert.ok(badPath.issues.some((i) => i.detail.includes("path_missing")));
    assert.ok(badPath.issues.some((i) => i.detail.includes("act_missing")));

    const badFact = validateFace07Output({
      raw: validFace07({
        evidence_boundary: {
          ...(validFace07().evidence_boundary as object),
          confirmed_fact_ids: ["fact_guess"],
        },
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      factContentById: ctx.factContentById,
      upstream: ctx.upstream,
    });
    assert.equal(badFact.ok, false);
    if (badFact.ok) throw new Error("unreachable");
    assert.ok(badFact.issues.some((i) => i.code === "confirmed_fact_status_mismatch"));

    const scored = validateFace07Output({
      raw: validFace07({
        field_units: [
          {
            ...(validFace07().field_units as object[])[0],
            text: "This partnership has an 80% success rate.",
          },
        ],
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      factContentById: ctx.factContentById,
      upstream: ctx.upstream,
    });
    assert.equal(scored.ok, false);
    if (scored.ok) throw new Error("unreachable");
    assert.ok(scored.issues.some((i) => i.code === "invented_score_or_probability"));

    const emptyApplicable = validateFace07Output({
      raw: validFace07({ field_units: [], relationship_units: [] }),
      locale: "en",
      registry: ctx.registry,
      upstream: ctx.upstream,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
    });
    assert.equal(emptyApplicable.ok, false);

    console.log("F PASS — participants, evidence, page boundary");
  }

  {
    let calls = 0;
    setContentBodyTestInvokeForTests(async () => {
      calls += 1;
      return stubResult(JSON.stringify(validFace07()));
    });
    try {
      const generated = await runContentBodyGenerate({
        key: "07",
        locale: "en",
        session_id: "face07_prod",
        report_id: "face07_prod",
        finalize: {} as never,
        decision_context_snapshot: dcApplicable,
        book_judgment_pack: pack,
        page01_schema: page01,
        page02_schema: page02,
        page04_schema: page04,
        page05_schema: page05,
        page06_schema: page06,
        dispatch_attempt: 1,
      });
      assert.equal(generated.ok, true, generated.ok ? "" : generated.reason);
      if (!generated.ok) throw new Error(generated.reason);
      assert.equal(calls, 1);
      assert.ok(generated.tokens_used > 0);
      const page = generated.page as Face07V2;
      assert.equal(page.schema_version, "face07-v2");
      assert.equal(page.field_units.length, 1);
      assert.equal(generated.face07_meta?.validation, "passed");
      assert.equal(parseFace07JsonStrict("```json"), null);
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("G PASS — stubbed model production");
  }

  {
    let calls = 0;
    setContentBodyTestInvokeForTests(async () => {
      calls += 1;
      throw new Error("LLM must not run");
    });
    try {
      const skipped = await runContentBodyGenerate({
        key: "07",
        locale: "en",
        session_id: "face07_skip",
        report_id: "face07_skip",
        finalize: {} as never,
        decision_context_snapshot: dcSolo,
        book_judgment_pack: pack,
        dispatch_attempt: 1,
      });
      assert.equal(calls, 0);
      assert.equal(skipped.ok, true, skipped.ok ? "" : skipped.reason);
      if (!skipped.ok) throw new Error(skipped.reason);
      assert.equal(skipped.tokens_used, 0);
      const page = skipped.page as Face07V2;
      assert.equal(page.applicability_status, "not_applicable");
      assert.equal(page.field_units.length, 0);
      assert.equal(page.relationship_units.length, 0);
      assert.ok(page.skip_note.trim().length > 0);
      assert.equal(skipped.face07_meta?.validation, "skipped_not_applicable");

      const thin = await runContentBodyGenerate({
        key: "07",
        locale: "en",
        session_id: "face07_thin",
        report_id: "face07_thin",
        finalize: {} as never,
        decision_context_snapshot: makeDc("", [], []),
        book_judgment_pack: pack,
        dispatch_attempt: 1,
      });
      assert.equal(thin.ok, false);
      if (thin.ok) throw new Error("unreachable");
      assert.equal(thin.reason, "face07_insufficient_information");
      assert.equal(thin.tokens_used, 0);
      assert.equal(calls, 0);
      const structured = thin.face07_meta?.structured_status as Face07V2;
      assert.equal(structured.applicability_status, "insufficient_information");
      assert.equal(structured.field_units.length, 0);

      const blocked = await runContentBodyGenerate({
        key: "07",
        locale: "en",
        session_id: "face07_block",
        report_id: "face07_block",
        finalize: {} as never,
        decision_context_snapshot: dcApplicable,
        book_judgment_pack: pack,
        page01_schema: page01,
        dispatch_attempt: 1,
      });
      assert.equal(blocked.ok, false);
      if (blocked.ok) throw new Error("unreachable");
      assert.equal(blocked.reason, "face07_blocked_on_required_inputs");
      assert.equal(blocked.tokens_used, 0);
      assert.equal(calls, 0);
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("H PASS — skip and insufficient do not call the model");
  }

  {
    const ctx = ctxOf(dcSolo);
    const skip = synthesizeFace07StatusPage({
      locale: "en",
      applicability: ctx.applicability,
      architecture: ctx.architecture,
    });
    const checked = validateFace07Output({
      raw: skip,
      locale: "en",
      registry: ctx.registry,
      upstream: ctx.upstream,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
    });
    assert.equal(checked.ok, true, checked.ok ? "" : checked.issues.map((i) => i.detail).join(" | "));
    console.log("I PASS — structured skip validates");
  }

  {
    let calls = 0;
    setContentBodyTestInvokeForTests(async () => {
      calls += 1;
      return stubResult(JSON.stringify(validFace07()), 40);
    });
    try {
      const lab = await buildLab(dcApplicable);
      const current = await loadDeliveryLab(lab.lab_id);
      const run = await runLabStepV3(current!, "07.content.body", { polish_locale: "en" });
      assert.equal(run.ok, true, run.ok ? "" : run.reason);
      assert.equal(calls, 1);
      const payload = run.attempt?.input_payload as
        | {
            pipeline?: string;
            page06_schema_present?: boolean;
            face07_meta?: { validation?: string };
          }
        | undefined;
      assert.equal(payload?.pipeline, "face07_v2");
      assert.equal(payload?.page06_schema_present, true);
      const stored = (await loadDeliveryLab(lab.lab_id))!.artifacts.by_page["07"];
      const meta = (stored as { face07_production_meta?: { validation?: string } })
        .face07_production_meta;
      assert.equal(meta?.validation, "passed");
      const schema = stored?.page_schema as Face07V2;
      assert.equal(schema.schema_version, "face07-v2");
      assert.equal(schema.applicability_status, "applicable");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }

    setContentBodyTestInvokeForTests(async () => {
      throw new Error("skip lab must not call LLM");
    });
    try {
      const lab = await buildLab(dcSolo);
      const current = await loadDeliveryLab(lab.lab_id);
      const run = await runLabStepV3(current!, "07.content.body", { polish_locale: "en" });
      assert.equal(run.ok, true, run.ok ? "" : run.reason);
      assert.equal(run.attempt?.tokens_used ?? -1, 0);
      const stored = (await loadDeliveryLab(lab.lab_id))!.artifacts.by_page["07"]
        ?.page_schema as Face07V2;
      assert.equal(stored.applicability_status, "not_applicable");
      assert.equal(stored.field_units.length, 0);
    } finally {
      setContentBodyTestInvokeForTests(null);
    }

    {
      const lab = await buildLab(dcApplicable);
      delete (lab.source as { decision_context_snapshot?: unknown }).decision_context_snapshot;
      await saveDeliveryLab(lab);
      const current = await loadDeliveryLab(lab.lab_id);
      const run = await runLabStepV3(current!, "07.content.body", { polish_locale: "en" });
      assert.equal(run.ok, false);
      assert.equal(run.reason, "face07_missing_decision_context");
    }
    console.log("J PASS — Lab 07.content.body");
  }

  {
    const ctx = ctxOf();
    const validated = validateFace07ProductionOutput({
      raw: validFace07(),
      locale: "en",
      ctx,
    });
    assert.equal(validated.ok, true);
    if (!validated.ok) throw new Error("unreachable");
    const sections = assemblePage07SectionsForDisplay(validated.page, "en");
    assert.equal(sections.length, 4);
    assert.ok(sections[0]!.texts[0]!.includes("written split"));
    const pdf = assemblePage07PdfArgumentBodies(validated.page, "en");
    assert.equal(pdf.length, 4);
    assert.ok(pdf[0]!.body.includes("Field judgment") || pdf[0]!.body.includes("场域"));
    const viaRender = pageSchemaToArgumentBodies(validated.page as never);
    assert.equal(viaRender.length, 4);

    const legacy = {
      page: "07",
      face: "07",
      field_judgment: "The office cannot fund a second seat.",
      relation_interaction: "The co-signer has not agreed to a split.",
      evidence_fold: "Only the user's own notes are available.",
      align_with_01_05: "This does not replace the main recommendation.",
    };
    assert.equal(isFace07Legacy(legacy), true);
    const projected = projectLegacyFace07ForDisplay(legacy);
    assert.ok(projected);
    const legacyPdf = pageSchemaToArgumentBodies(legacy as never);
    assert.equal(legacyPdf.length, 4);
    assert.ok(legacyPdf.some((a) => a.body.includes("second seat")));

    const html = renderToStaticMarkup(
      createElement(Face07PageSlots, { page: validated.page, locale: "en" }),
    );
    assert.ok(html.includes("data-face=\"07\""));
    assert.ok(html.includes("data-applicability=\"applicable\""));
    assert.ok(html.includes("data-section=\"field_judgment\""));
    assert.ok(html.includes("written split"));
    const skipHtml = renderToStaticMarkup(
      createElement(Face07PageSlots, {
        page: synthesizeFace07StatusPage({
          locale: "en",
          applicability: ctxOf(dcSolo).applicability,
        }),
        locale: "en",
      }),
    );
    assert.ok(skipHtml.includes("data-page-skipped=\"1\""));
    const slotsSrc = readFileSync(
      resolvePath("components/poju/delivery-pages/faces/Face07PageSlots.tsx"),
      "utf8",
    );
    assert.ok(slotsSrc.includes("assemblePage07SectionsForDisplay"));
    const routerSrc = readFileSync(
      resolvePath("components/poju/delivery-pages/faces/FacePageSlots.tsx"),
      "utf8",
    );
    assert.ok(routerSrc.includes("Face07PageSlots"));
    console.log("K PASS — Reader and PDF");
  }

  console.log("ok page07 production closure");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
