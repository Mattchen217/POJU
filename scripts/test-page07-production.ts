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
  PAGE07_BEHAVIOR_EVIDENCE_FACT_ROLES,
  splitIntoSentences,
} from "@/lib/llm/pro/delivery/decision-report-v2/page07/fact-integrity";
import {
  assemblePage07PdfArgumentBodies,
  assemblePage07SectionsForDisplay,
  PAGE07_SECTION_IDS,
} from "@/lib/llm/pro/delivery/decision-report-v2/page07/architecture";
import {
  isFace07Legacy,
  projectLegacyFace07ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page07/legacy-adapter";
import {
  includePage07InUserFacingOrder,
  isFace07NotApplicableOmit,
} from "@/lib/llm/pro/delivery/decision-report-v2/page07/report-inclusion";
import { readingOrderAfterAssembly } from "@/lib/llm/pro/delivery/decision-report-v2/assembly";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import { Face07PageSlots } from "@/components/poju/delivery-pages/faces/Face07PageSlots";
import {
  buildDeliveryShelfSlots,
  sequentialDeliveryProseReady,
} from "@/lib/poju/delivery-shelf-slots";
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
        verification_status: "user_stated",
        related_fact_ids: ["fact_alex"],
        notes: "",
      },
      {
        participant_id: "p_alex",
        display_label: "Alex",
        role: "partner",
        source: "dc_fact",
        // fact_alex is confirmed + user_asserted → max participant status is user_stated
        verification_status: "user_stated",
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
        reality_fact_stances: [{ fact_id: "fact_alex", stance: "as_confirmed" }],
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
        reality_fact_stances: [{ fact_id: "fact_alex", stance: "as_confirmed" }],
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
      third_party_data_limits: ["No authorized partner profile; third-party motive analysis is withheld."],
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

    const baseV = {
      locale: "en" as const,
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      factContentById: ctx.factContentById,
      factVerificationLevelById: ctx.factVerificationLevelById,
      factRolesById: ctx.factRolesById,
      upstream: ctx.upstream,
      knownDirIds: ctx.knownDirIds,
      knownPersonalInterpretationUnitRefs: ctx.knownPersonalInterpretationUnitRefs,
      authorizedPartnerProfile: false as const,
    };

    // Fact-status upgrade: structural stance + assertive text (not keyword-only).
    for (const status of [
      "unknown",
      "unverified",
      "declined",
      "not_applicable",
      "user_estimate",
      "user_asserted",
      "hypothesis",
      "conflict",
    ] as const) {
      const factId = `fact_${status}`;
      const known = new Set([...ctx.knownFactIds, factId]);
      const statuses = new Map(ctx.factStatusById);
      statuses.set(factId, status);
      const contents = new Map(ctx.factContentById);
      contents.set(factId, `Alex might cover half the move cost (${status}).`);
      const levels = new Map(ctx.factVerificationLevelById);
      levels.set(factId, status === "user_asserted" ? "user_asserted" : "none");
      const v = {
        ...baseV,
        knownFactIds: known,
        factStatusById: statuses,
        factContentById: contents,
        factVerificationLevelById: levels,
      };

      // Deterministic statement without "confirmed" keyword must still fail.
      const upgradeField = validateFace07Output({
        ...v,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: [factId],
              reality_fact_stances: [{ fact_id: factId, stance: "as_conditional" }],
              text: `Alex will cover half the move cost (${status}).`,
            },
          ],
        }),
      });
      assert.equal(upgradeField.ok, false, `field upgrade for ${status}`);
      if (upgradeField.ok) throw new Error("unreachable");
      assert.ok(
        upgradeField.issues.some((i) => i.code === "fact_status_upgrade"),
        `missing fact_status_upgrade for field ${status}`,
      );

      // as_confirmed stance on non-confirmed fact
      const stanceConfirmed = validateFace07Output({
        ...v,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: [factId],
              reality_fact_stances: [{ fact_id: factId, stance: "as_confirmed" }],
              text: `If the estimate holds, keep the move conditional (${status}).`,
            },
          ],
        }),
      });
      assert.equal(stanceConfirmed.ok, false, `as_confirmed stance for ${status}`);
      if (stanceConfirmed.ok) throw new Error("unreachable");
      assert.ok(stanceConfirmed.issues.some((i) => i.code === "fact_status_upgrade"));

      const upgradeRel = validateFace07Output({
        ...v,
        raw: validFace07({
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              reality_fact_ids: [factId],
              reality_fact_stances: [{ fact_id: factId, stance: "as_conditional" }],
              text: `Alex will cover half the move (${status}).`,
            },
          ],
        }),
      });
      assert.equal(upgradeRel.ok, false, `relationship upgrade for ${status}`);
      if (upgradeRel.ok) throw new Error("unreachable");
      assert.ok(
        upgradeRel.issues.some((i) => i.code === "fact_status_upgrade"),
        `missing fact_status_upgrade for relationship ${status}`,
      );

      const intoConfirmed = validateFace07Output({
        ...v,
        raw: validFace07({
          evidence_boundary: {
            ...(validFace07().evidence_boundary as object),
            confirmed_fact_ids: [factId],
          },
        }),
      });
      assert.equal(intoConfirmed.ok, false, `confirmed_fact_ids for ${status}`);
      if (intoConfirmed.ok) throw new Error("unreachable");
      assert.ok(
        intoConfirmed.issues.some((i) => i.code === "confirmed_fact_status_mismatch"),
        `missing confirmed_fact_status_mismatch for ${status}`,
      );

      // Trailing hedge after assertive claim must not launder.
      const trailing = validateFace07Output({
        ...v,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: [factId],
              reality_fact_stances: [{ fact_id: factId, stance: "as_conditional" }],
              text: `Alex will cover half the move cost. This still needs confirmation.`,
            },
          ],
        }),
      });
      assert.equal(trailing.ok, false, `trailing hedge for ${status}`);
      if (trailing.ok) throw new Error("unreachable");
      assert.ok(trailing.issues.some((i) => i.code === "fact_status_upgrade"));

      const conditionalOk = validateFace07Output({
        ...v,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: [factId],
              reality_fact_stances: [{ fact_id: factId, stance: "as_conditional" }],
              text: `If the ${status} estimate holds, keep the move conditional on a written split.`,
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              reality_fact_ids: ["fact_alex"],
              reality_fact_stances: [{ fact_id: "fact_alex", stance: "as_confirmed" }],
            },
          ],
        }),
      });
      assert.equal(
        conditionalOk.ok,
        true,
        conditionalOk.ok
          ? ""
          : conditionalOk.issues.map((i) => i.detail).join(" | "),
      );
    }

    // Missing fact status → fail closed
    {
      const factId = "fact_no_status";
      const known = new Set([...ctx.knownFactIds, factId]);
      const statuses = new Map(ctx.factStatusById);
      // intentionally omit status
      const contents = new Map(ctx.factContentById);
      contents.set(factId, "Alex might cover half.");
      const missing = validateFace07Output({
        ...baseV,
        knownFactIds: known,
        factStatusById: statuses,
        factContentById: contents,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: [factId],
              reality_fact_stances: [{ fact_id: factId, stance: "as_conditional" }],
              text: "If the estimate holds, keep the move conditional.",
            },
          ],
        }),
      });
      assert.equal(missing.ok, false);
      if (missing.ok) throw new Error("unreachable");
      assert.ok(missing.issues.some((i) => i.code === "fact_status_missing"));
    }

    // Mixed confirmed + unverified in one unit: unverified must not ride along.
    {
      const statuses = new Map(ctx.factStatusById);
      const contents = new Map(ctx.factContentById);
      const mixed = validateFace07Output({
        ...baseV,
        factStatusById: statuses,
        factContentById: contents,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_alex", "fact_guess"],
              reality_fact_stances: [
                { fact_id: "fact_alex", stance: "as_confirmed" },
                { fact_id: "fact_guess", stance: "as_confirmed" },
              ],
              text: "Alex will cover half the move and the partnership split is written.",
            },
          ],
        }),
      });
      assert.equal(mixed.ok, false);
      if (mixed.ok) throw new Error("unreachable");
      assert.ok(
        mixed.issues.some(
          (i) => i.code === "fact_status_upgrade" && i.detail.includes("fact_guess"),
        ),
      );
    }

    // Participant provenance / forged self
    const forgedSelf = validateFace07Output({
      ...baseV,
      raw: validFace07({
        participants: [
          {
            participant_id: "p_fake",
            display_label: "Alex",
            role: "self",
            source: "user_stated",
            verification_status: "user_stated",
            related_fact_ids: [],
            notes: "",
          },
        ],
      }),
    });
    assert.equal(forgedSelf.ok, false);
    if (forgedSelf.ok) throw new Error("unreachable");
    assert.ok(forgedSelf.issues.some((i) => i.code === "forged_self_participant"));
    assert.ok(
      forgedSelf.issues.some((i) => i.code === "third_party_missing_fact_binding"),
    );

    const noFactThird = validateFace07Output({
      ...baseV,
      raw: validFace07({
        participants: [
          (validFace07().participants as object[])[0],
          {
            participant_id: "p_boss",
            display_label: "Sam",
            role: "boss",
            source: "model_said_so",
            verification_status: "user_stated",
            related_fact_ids: [],
            notes: "",
          },
        ],
      }),
    });
    assert.equal(noFactThird.ok, false);
    if (noFactThird.ok) throw new Error("unreachable");
    assert.ok(
      noFactThird.issues.some((i) => i.code === "third_party_missing_fact_binding"),
    );
    assert.ok(
      noFactThird.issues.some((i) => i.code === "forged_participant_provenance"),
    );

    // user_asserted fact cannot authorize participant verification_status=confirmed
    {
      const upgraded = validateFace07Output({
        ...baseV,
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: ["fact_alex"],
              notes: "",
            },
          ],
        }),
      });
      assert.equal(upgraded.ok, false);
      if (upgraded.ok) throw new Error("unreachable");
      assert.ok(
        upgraded.issues.some(
          (i) => i.code === "participant_verification_status_mismatch",
        ),
      );
    }

    // unverified fact → participant confirmed rejected; unknown kept as unknown OK
    {
      const statuses = new Map(ctx.factStatusById);
      statuses.set("fact_guess", "unverified");
      const contents = new Map(ctx.factContentById);
      const levels = new Map(ctx.factVerificationLevelById);
      levels.set("fact_guess", "user_estimate");
      const bad = validateFace07Output({
        ...baseV,
        factStatusById: statuses,
        factContentById: contents,
        factVerificationLevelById: levels,
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: ["fact_guess"],
              notes: "",
            },
          ],
        }),
      });
      assert.equal(bad.ok, false);
      if (bad.ok) throw new Error("unreachable");
      assert.ok(
        bad.issues.some((i) => i.code === "participant_verification_status_mismatch"),
      );

      const keepUnknown = validateFace07Output({
        ...baseV,
        factStatusById: new Map([...statuses, ["fact_unk", "unknown"]]),
        factContentById: new Map([...contents, ["fact_unk", "Alex is named only."]]),
        factVerificationLevelById: new Map([...levels, ["fact_unk", "none"]]),
        knownFactIds: new Set([...ctx.knownFactIds, "fact_unk"]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "other",
              source: "dc_fact",
              verification_status: "unknown",
              related_fact_ids: ["fact_unk"],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              reality_fact_ids: ["fact_unk"],
              reality_fact_stances: [
                { fact_id: "fact_unk", stance: "as_uncertain" },
              ],
              text: "If Alex remains only named without confirmation, treat the interaction as unknown.",
              participant_ids: ["p_alex"],
            },
          ],
        }),
      });
      assert.equal(
        keepUnknown.ok,
        true,
        keepUnknown.ok ? "" : keepUnknown.issues.map((i) => i.detail).join(" | "),
      );
    }

    // Role must match precisely — partner fact must not authorize boss/investor/advisor
    {
      const asBoss = validateFace07Output({
        ...baseV,
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "boss",
              source: "dc_fact",
              verification_status: "user_stated",
              related_fact_ids: ["fact_alex"],
              notes: "",
            },
          ],
        }),
      });
      assert.equal(asBoss.ok, false);
      if (asBoss.ok) throw new Error("unreachable");
      assert.ok(asBoss.issues.some((i) => i.code === "third_party_role_ungrounded"));

      const asInvestor = validateFace07Output({
        ...baseV,
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "investor",
              source: "dc_fact",
              verification_status: "user_stated",
              related_fact_ids: ["fact_alex"],
              notes: "",
            },
          ],
        }),
      });
      assert.equal(asInvestor.ok, false);
      if (asInvestor.ok) throw new Error("unreachable");
      assert.ok(
        asInvestor.issues.some((i) => i.code === "third_party_role_ungrounded"),
      );

      // spouse fact must not authorize investor
      const spouseFact = "fact_spouse";
      const spouseOkRole = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, spouseFact]),
        factStatusById: new Map([...ctx.factStatusById, [spouseFact, "confirmed"]]),
        factContentById: new Map([
          ...ctx.factContentById,
          [spouseFact, "Jordan is the user's spouse."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [spouseFact, "independently_verified"],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_jordan",
              display_label: "Jordan",
              role: "investor",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [spouseFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_jordan"],
              reality_fact_ids: [spouseFact],
              reality_fact_stances: [
                { fact_id: spouseFact, stance: "as_confirmed" },
              ],
            },
          ],
        }),
      });
      assert.equal(spouseOkRole.ok, false);
      if (spouseOkRole.ok) throw new Error("unreachable");
      assert.ok(
        spouseOkRole.issues.some((i) => i.code === "third_party_role_ungrounded"),
      );

      // family fact must not authorize advisor
      const familyFact = "fact_family";
      const familyAsAdvisor = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, familyFact]),
        factStatusById: new Map([...ctx.factStatusById, [familyFact, "confirmed"]]),
        factContentById: new Map([
          ...ctx.factContentById,
          [familyFact, "Sam is family living nearby."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [familyFact, "independently_verified"],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_sam",
              display_label: "Sam",
              role: "advisor",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [familyFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_sam"],
              reality_fact_ids: [familyFact],
              reality_fact_stances: [
                { fact_id: familyFact, stance: "as_confirmed" },
              ],
            },
          ],
        }),
      });
      assert.equal(familyAsAdvisor.ok, false);
      if (familyAsAdvisor.ok) throw new Error("unreachable");
      assert.ok(
        familyAsAdvisor.issues.some((i) => i.code === "third_party_role_ungrounded"),
      );

      // boss fact + boss role → pass
      const bossFact = "fact_boss";
      const bossOk = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, bossFact]),
        factStatusById: new Map([...ctx.factStatusById, [bossFact, "confirmed"]]),
        factContentById: new Map([
          ...ctx.factContentById,
          [bossFact, "Riley is the user's boss at work."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [bossFact, "independently_verified"],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_riley",
              display_label: "Riley",
              role: "boss",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [bossFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_riley"],
              reality_fact_ids: [bossFact],
              reality_fact_stances: [
                { fact_id: bossFact, stance: "as_confirmed" },
              ],
              text: "Keep the first step aligned with Riley's written approval window.",
            },
          ],
        }),
      });
      assert.equal(
        bossOk.ok,
        true,
        bossOk.ok ? "" : bossOk.issues.map((i) => i.detail).join(" | "),
      );

      // partner role still passes on partnership fact
      const partnerOk = validateFace07Output({
        ...baseV,
        raw: validFace07(),
      });
      assert.equal(
        partnerOk.ok,
        true,
        partnerOk.ok ? "" : partnerOk.issues.map((i) => i.detail).join(" | "),
      );
    }

    const personalityEn = validateFace07Output({
      ...baseV,
      raw: validFace07({
        relationship_units: [
          {
            ...(validFace07().relationship_units as object[])[0],
            text: "Alex's personality makes this partnership unreliable.",
          },
        ],
      }),
    });
    assert.equal(personalityEn.ok, false);
    if (personalityEn.ok) throw new Error("unreachable");
    assert.ok(
      personalityEn.issues.some(
        (i) => i.code === "third_party_personality_without_profile",
      ),
    );

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

    // ── R3: sentence-level assertive coverage + stance 1:1 + behavior ──
    const issueHas = (
      result: ReturnType<typeof validateFace07Output>,
      code: string,
      detailNeedle?: string,
    ) => {
      if (result.ok) return false;
      return result.issues.some(
        (i) =>
          i.code === code ||
          (i.code === "gate_face_zod_fail" && i.detail.includes(code)) ||
          (detailNeedle
            ? i.detail.includes(detailNeedle) &&
              (i.code === "fact_status_upgrade" || i.code === code)
            : false),
      );
    };

    for (const status of [
      "unknown",
      "unverified",
      "declined",
      "not_applicable",
      "user_estimate",
      "user_asserted",
      "hypothesis",
      "conflict",
    ] as const) {
      const factId = `fact_r3_${status}`;
      const known = new Set([...ctx.knownFactIds, factId]);
      const statuses = new Map(ctx.factStatusById);
      statuses.set(factId, status);
      const contents = new Map(ctx.factContentById);
      contents.set(factId, `Alex 可能承担一半搬迁成本 (${status}).`);
      const levels = new Map(ctx.factVerificationLevelById);
      levels.set(factId, status === "user_asserted" ? "user_asserted" : "none");
      const v = {
        ...baseV,
        knownFactIds: known,
        factStatusById: statuses,
        factContentById: contents,
        factVerificationLevelById: levels,
      };

      const rejectAssert = (text: string, label: string) => {
        const bad = validateFace07Output({
          ...v,
          raw: validFace07({
            field_units: [
              {
                ...(validFace07().field_units as object[])[0],
                reality_fact_ids: [factId],
                reality_fact_stances: [
                  { fact_id: factId, stance: "as_uncertain" },
                ],
                text,
              },
            ],
          }),
        });
        assert.equal(bad.ok, false, `R3 reject ${label} for ${status}`);
        if (bad.ok) throw new Error("unreachable");
        assert.ok(
          issueHas(bad, "fact_status_upgrade"),
          `R3 missing fact_status_upgrade for ${label}/${status}: ${bad.issues.map((i) => i.detail).join(" | ")}`,
        );
      };

      rejectAssert("Alex 承担一半搬迁成本。", "zh_present_assertive");
      rejectAssert("Alex 将承担一半搬迁成本。", "zh_will_bear");
      rejectAssert("Alex 已经决定承担一半搬迁成本。", "zh_already_decided");
      rejectAssert("Alex pays half of the relocation cost.", "en_pays");
      rejectAssert("Alex is paying half of the relocation cost.", "en_is_paying");
      rejectAssert("Alex will pay half of the relocation cost.", "en_will_pay");
      rejectAssert("Alex has agreed to cover half the relocation cost.", "en_has_agreed");
      rejectAssert("Alex covers the move deposit unconditionally.", "en_unconditional_behavior");

      const uncertainOk = validateFace07Output({
        ...v,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: [factId],
              reality_fact_stances: [
                { fact_id: factId, stance: "as_uncertain" },
              ],
              text: `Alex may cover half the relocation cost; this ${status} share remains unverified.`,
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              reality_fact_ids: ["fact_alex"],
              reality_fact_stances: [
                { fact_id: "fact_alex", stance: "as_confirmed" },
              ],
            },
          ],
        }),
      });
      assert.equal(
        uncertainOk.ok,
        true,
        uncertainOk.ok
          ? ""
          : `R3 uncertainOk ${status}: ${uncertainOk.issues.map((i) => i.detail).join(" | ")}`,
      );

      const conditionalOkR3 = validateFace07Output({
        ...v,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: [factId],
              reality_fact_stances: [
                { fact_id: factId, stance: "as_conditional" },
              ],
              text: `If approval is granted, Alex may contribute half the relocation cost (${status}).`,
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              reality_fact_ids: ["fact_alex"],
              reality_fact_stances: [
                { fact_id: "fact_alex", stance: "as_confirmed" },
              ],
            },
          ],
        }),
      });
      assert.equal(
        conditionalOkR3.ok,
        true,
        conditionalOkR3.ok
          ? ""
          : `R3 conditionalOk ${status}: ${conditionalOkR3.issues.map((i) => i.detail).join(" | ")}`,
      );

      // Cross-sentence condition cannot sponsor a later bare assert.
      rejectAssert(
        "If approval is granted, Alex may contribute. Alex will cover half regardless.",
        "cross_sentence_if",
      );
      rejectAssert(
        "If the estimate holds, keep the share conditional. Alex pays half of the relocation cost.",
        "cross_sentence_pays",
      );
      rejectAssert(
        "The cost share is still unverified. Alex will cover half the relocation cost.",
        "uncertainty_then_assert",
      );
      rejectAssert(
        "Alex will cover half the relocation cost. 仍需确认。",
        "trailing_hedge_zh",
      );
    }

    // First fact conditional, second non-confirmed fact bare-asserted.
    {
      const factB = "fact_r3_second";
      const mixedCross = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, factB]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [factB, "unverified"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [factB, "Alex might cover half the move cost."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [factB, "none"],
        ]),
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_alex", factB],
              reality_fact_stances: [
                { fact_id: "fact_alex", stance: "as_confirmed" },
                { fact_id: factB, stance: "as_conditional" },
              ],
              text: "If the partnership split holds, keep relocation gated. Alex will cover half the move cost regardless.",
            },
          ],
        }),
      });
      assert.equal(mixedCross.ok, false);
      if (mixedCross.ok) throw new Error("unreachable");
      assert.ok(
        mixedCross.issues.some(
          (i) =>
            i.code === "fact_status_upgrade" && i.detail.includes(factB),
        ),
        mixedCross.issues.map((i) => i.detail).join(" | "),
      );
    }

    // Stance 1:1 — duplicate / missing / orphan
    {
      const dupStance = validateFace07Output({
        ...baseV,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_guess"],
              reality_fact_stances: [
                { fact_id: "fact_guess", stance: "as_uncertain" },
                { fact_id: "fact_guess", stance: "as_conditional" },
              ],
              text: "Alex may cover half; the share remains unverified.",
            },
          ],
        }),
      });
      assert.equal(dupStance.ok, false);
      if (dupStance.ok) throw new Error("unreachable");
      assert.ok(
        issueHas(dupStance, "duplicate_reality_fact_stance"),
        dupStance.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
      );

      const missingStance = validateFace07Output({
        ...baseV,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_guess"],
              reality_fact_stances: [],
              text: "Alex may cover half; the share remains unverified.",
            },
          ],
        }),
      });
      assert.equal(missingStance.ok, false);
      if (missingStance.ok) throw new Error("unreachable");
      assert.ok(
        issueHas(missingStance, "missing_reality_fact_stance"),
        missingStance.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
      );

      const orphanStance = validateFace07Output({
        ...baseV,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_alex"],
              reality_fact_stances: [
                { fact_id: "fact_alex", stance: "as_confirmed" },
                { fact_id: "fact_ghost", stance: "as_uncertain" },
              ],
              text: "Do not enter the new city until the written split exists.",
            },
          ],
        }),
      });
      assert.equal(orphanStance.ok, false);
      if (orphanStance.ok) throw new Error("unreachable");
      assert.ok(
        issueHas(orphanStance, "orphan_reality_fact_stance"),
        orphanStance.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
      );

      // confirmed + unverified mixed: unverified must not upgrade via confirmed neighbor
      const mixedUpgrade = validateFace07Output({
        ...baseV,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_alex", "fact_guess"],
              reality_fact_stances: [
                { fact_id: "fact_alex", stance: "as_confirmed" },
                { fact_id: "fact_guess", stance: "as_uncertain" },
              ],
              text: "The partnership split is written. Alex pays half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(mixedUpgrade.ok, false);
      if (mixedUpgrade.ok) throw new Error("unreachable");
      assert.ok(
        mixedUpgrade.issues.some(
          (i) =>
            i.code === "fact_status_upgrade" && i.detail.includes("fact_guess"),
        ),
      );
    }

    // Participant behavior: confirmed identity ≠ confirmed behavior
    {
      const confPartFact = "fact_r3_conf_part";
      const unverifBehavior = "fact_r3_unbeh";
      const confirmedIdNoBehaviorFact = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([
          ...ctx.knownFactIds,
          confPartFact,
          unverifBehavior,
        ]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [confPartFact, "confirmed"],
          [unverifBehavior, "unverified"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [confPartFact, "Alex is named as a partner in the written split."],
          [unverifBehavior, "Alex might cover half the move cost."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [confPartFact, "independently_verified"],
          [unverifBehavior, "none"],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [confPartFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex"],
              reality_fact_ids: [unverifBehavior],
              reality_fact_stances: [
                { fact_id: unverifBehavior, stance: "as_uncertain" },
              ],
              text: "Alex pays half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(confirmedIdNoBehaviorFact.ok, false);
      if (confirmedIdNoBehaviorFact.ok) throw new Error("unreachable");
      assert.ok(
        confirmedIdNoBehaviorFact.issues.some(
          (i) =>
            i.code === "unconfirmed_participant_behavior" ||
            i.code === "fact_status_upgrade",
        ),
        confirmedIdNoBehaviorFact.issues
          .map((i) => `${i.code}:${i.detail}`)
          .join(" | "),
      );

      const userStatedAssert = validateFace07Output({
        ...baseV,
        raw: validFace07({
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex"],
              reality_fact_ids: ["fact_guess"],
              reality_fact_stances: [
                { fact_id: "fact_guess", stance: "as_uncertain" },
              ],
              text: "Alex pays half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(userStatedAssert.ok, false);
      if (userStatedAssert.ok) throw new Error("unreachable");
      assert.ok(
        userStatedAssert.issues.some(
          (i) =>
            i.code === "unverified_participant_treated_as_confirmed" ||
            i.code === "fact_status_upgrade",
        ),
      );

      // Mixed bindings on participant: confirmed cannot cover unverified for verification_status
      const mixedBind = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, confPartFact]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [confPartFact, "confirmed"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [confPartFact, "Alex is named as a partner in the written split."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [confPartFact, "independently_verified"],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [confPartFact, "fact_guess"],
              notes: "",
            },
          ],
        }),
      });
      assert.equal(mixedBind.ok, false);
      if (mixedBind.ok) throw new Error("unreachable");
      assert.ok(
        mixedBind.issues.some(
          (i) => i.code === "participant_verification_status_mismatch",
        ),
      );
    }

    // ── R4: sentence boundaries + conservative multi-fact + behavior facts ──
    {
      const zhNoSpace = splitIntoSentences(
        "如果审批通过，Alex可能参与。Alex将承担一半搬迁成本。",
      );
      assert.equal(zhNoSpace.length, 2, zhNoSpace.join(" | "));
      assert.ok(zhNoSpace[0]!.includes("如果审批通过"));
      assert.ok(zhNoSpace[1]!.includes("将承担"));

      const enSpaced = splitIntoSentences(
        "If approval is granted, Alex may contribute. Alex will cover half regardless.",
      );
      assert.equal(enSpaced.length, 2, enSpaced.join(" | "));

      const mixedLang = splitIntoSentences(
        "If approval holds, keep it conditional.Alex将承担一半搬迁成本。",
      );
      assert.ok(mixedLang.length >= 2, mixedLang.join(" | "));
      assert.ok(mixedLang.some((s) => /将承担/.test(s)));

      const decimalSafe = splitIntoSentences(
        "Keep the 3.14 deposit estimate unverified. Alex may cover half.",
      );
      assert.equal(decimalSafe.length, 2, decimalSafe.join(" | "));
      assert.ok(decimalSafe[0]!.includes("3.14"));
    }

    {
      const factGuessZh = "fact_r4_guess_zh";
      const vZh = {
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, factGuessZh]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [factGuessZh, "unverified"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [factGuessZh, "Alex可能承担一半搬迁成本"],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [factGuessZh, "none"],
        ]),
      };

      const zhCondThenAssert = validateFace07Output({
        ...vZh,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: [factGuessZh],
              reality_fact_stances: [
                { fact_id: factGuessZh, stance: "as_conditional" },
              ],
              text: "如果审批通过，Alex可能参与。Alex将承担一半搬迁成本。",
            },
          ],
        }),
      });
      assert.equal(zhCondThenAssert.ok, false);
      if (zhCondThenAssert.ok) throw new Error("unreachable");
      assert.ok(
        zhCondThenAssert.issues.some(
          (i) =>
            i.code === "fact_status_upgrade" && i.detail.includes(factGuessZh),
        ),
        zhCondThenAssert.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
      );

      const zhUncertThenAssert = validateFace07Output({
        ...vZh,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: [factGuessZh],
              reality_fact_stances: [
                { fact_id: factGuessZh, stance: "as_uncertain" },
              ],
              text: "搬迁成本分担仍未确认。Alex将承担一半搬迁成本。",
            },
          ],
        }),
      });
      assert.equal(zhUncertThenAssert.ok, false);
      if (zhUncertThenAssert.ok) throw new Error("unreachable");
      assert.ok(
        zhUncertThenAssert.issues.some(
          (i) =>
            i.code === "fact_status_upgrade" && i.detail.includes(factGuessZh),
        ),
      );

      const zhSynonymAssert = validateFace07Output({
        ...vZh,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_alex", factGuessZh],
              reality_fact_stances: [
                { fact_id: "fact_alex", stance: "as_confirmed" },
                { fact_id: factGuessZh, stance: "as_uncertain" },
              ],
              text: "合伙书面拆分已确认。Alex将承担一半搬迁成本。",
            },
          ],
        }),
      });
      assert.equal(zhSynonymAssert.ok, false);
      if (zhSynonymAssert.ok) throw new Error("unreachable");
      assert.ok(
        zhSynonymAssert.issues.some(
          (i) =>
            i.code === "fact_status_upgrade" && i.detail.includes(factGuessZh),
        ),
      );

      const confirmedFirst = validateFace07Output({
        ...baseV,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_alex", "fact_guess"],
              reality_fact_stances: [
                { fact_id: "fact_alex", stance: "as_confirmed" },
                { fact_id: "fact_guess", stance: "as_uncertain" },
              ],
              text: "The partnership split is written. Alex pays half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(confirmedFirst.ok, false);
      if (confirmedFirst.ok) throw new Error("unreachable");
      assert.ok(
        confirmedFirst.issues.some(
          (i) =>
            i.code === "fact_status_upgrade" && i.detail.includes("fact_guess"),
        ),
      );

      const unverifiedFirst = validateFace07Output({
        ...baseV,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_guess", "fact_alex"],
              reality_fact_stances: [
                { fact_id: "fact_guess", stance: "as_uncertain" },
                { fact_id: "fact_alex", stance: "as_confirmed" },
              ],
              text: "Alex pays half of the relocation cost. The partnership split is written.",
            },
          ],
        }),
      });
      assert.equal(unverifiedFirst.ok, false);
      if (unverifiedFirst.ok) throw new Error("unreachable");
      assert.ok(
        unverifiedFirst.issues.some(
          (i) =>
            i.code === "fact_status_upgrade" && i.detail.includes("fact_guess"),
        ),
      );

      const mixedEnZh = validateFace07Output({
        ...vZh,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_alex", factGuessZh],
              reality_fact_stances: [
                { fact_id: "fact_alex", stance: "as_confirmed" },
                { fact_id: factGuessZh, stance: "as_conditional" },
              ],
              text: "If the partnership split holds, keep relocation gated.Alex将承担一半搬迁成本。",
            },
          ],
        }),
      });
      assert.equal(mixedEnZh.ok, false);
      if (mixedEnZh.ok) throw new Error("unreachable");
      assert.ok(
        mixedEnZh.issues.some(
          (i) =>
            i.code === "fact_status_upgrade" && i.detail.includes(factGuessZh),
        ),
      );

      const uncertainAllowed = validateFace07Output({
        ...baseV,
        raw: validFace07({
          field_units: [
            {
              ...(validFace07().field_units as object[])[0],
              reality_fact_ids: ["fact_alex", "fact_guess"],
              reality_fact_stances: [
                { fact_id: "fact_alex", stance: "as_confirmed" },
                { fact_id: "fact_guess", stance: "as_uncertain" },
              ],
              text: "Keep the written split. Alex may cover half the move cost; that share remains unverified.",
            },
          ],
        }),
      });
      assert.equal(
        uncertainAllowed.ok,
        true,
        uncertainAllowed.ok
          ? ""
          : uncertainAllowed.issues.map((i) => i.detail).join(" | "),
      );
    }

    {
      const idFact = "fact_r4_id";
      const behUnver = "fact_r4_beh_u";
      const behConf = "fact_r4_beh_c";
      const otherIdFact = "fact_r4_other_id";

      const confIdUnverBeh = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([
          ...ctx.knownFactIds,
          idFact,
          behUnver,
        ]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [idFact, "confirmed"],
          [behUnver, "unverified"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [idFact, "Alex is named as a partner in the written split."],
          [behUnver, "Alex might cover half the move cost."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [idFact, "independently_verified"],
          [behUnver, "none"],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [idFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex"],
              reality_fact_ids: [idFact, behUnver],
              reality_fact_stances: [
                { fact_id: idFact, stance: "as_confirmed" },
                { fact_id: behUnver, stance: "as_uncertain" },
              ],
              text: "Alex pays half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(confIdUnverBeh.ok, false);
      if (confIdUnverBeh.ok) throw new Error("unreachable");
      assert.ok(
        confIdUnverBeh.issues.some(
          (i) => i.code === "unconfirmed_participant_behavior",
        ),
        confIdUnverBeh.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
      );
      assert.ok(
        confIdUnverBeh.issues.some(
          (i) =>
            i.code === "fact_status_upgrade" && i.detail.includes(behUnver),
        ),
      );

      const aFactForB = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, idFact, otherIdFact]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [idFact, "confirmed"],
          [otherIdFact, "confirmed"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [idFact, "Alex is named as a partner in the written split."],
          [otherIdFact, "Jordan is named as a partner in the written split."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [idFact, "independently_verified"],
          [otherIdFact, "independently_verified"],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [idFact],
              notes: "",
            },
            {
              participant_id: "p_jordan",
              display_label: "Jordan",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [otherIdFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex", "p_jordan"],
              reality_fact_ids: [idFact],
              reality_fact_stances: [
                { fact_id: idFact, stance: "as_confirmed" },
              ],
              text: "Jordan pays half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(aFactForB.ok, false);
      if (aFactForB.ok) throw new Error("unreachable");
      assert.ok(
        aFactForB.issues.some(
          (i) =>
            i.code === "unconfirmed_participant_behavior" &&
            i.detail.includes("p_jordan"),
        ),
        aFactForB.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
      );

      const unclearSupport = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, idFact]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [idFact, "confirmed"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [idFact, "Alex is named as a partner in the written split."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [idFact, "independently_verified"],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [idFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex"],
              reality_fact_ids: [idFact],
              reality_fact_stances: [
                { fact_id: idFact, stance: "as_confirmed" },
              ],
              text: "Alex pays half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(unclearSupport.ok, false);
      if (unclearSupport.ok) throw new Error("unreachable");
      assert.ok(
        unclearSupport.issues.some(
          (i) => i.code === "unconfirmed_participant_behavior",
        ),
      );

      const independentBehOk = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, idFact, behConf]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [idFact, "confirmed"],
          [behConf, "confirmed"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [idFact, "Alex is named as a partner in the written split."],
          [
            behConf,
            "Alex has agreed in writing to cover half the relocation cost.",
          ],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [idFact, "independently_verified"],
          [behConf, "independently_verified"],
        ]),
        factRolesById: new Map([
          ...ctx.factRolesById,
          [idFact, ["stakeholder"]],
          [behConf, ["third_party_commitment"]],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [idFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex"],
              reality_fact_ids: [behConf],
              reality_fact_stances: [
                { fact_id: behConf, stance: "as_confirmed" },
              ],
              text: "Alex has agreed to cover half the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(
        independentBehOk.ok,
        true,
        independentBehOk.ok
          ? ""
          : independentBehOk.issues.map((i) => i.detail).join(" | "),
      );
    }

    // ── R5: abbrev/URL sentence boundaries + behavior-evidence contract ──
    {
      assert.ok(PAGE07_BEHAVIOR_EVIDENCE_FACT_ROLES.has("third_party_commitment"));

      const dr = splitIntoSentences(
        "Dr. Alex will join. Alex may participate.",
      );
      assert.equal(dr.length, 2, dr.join(" | "));
      assert.equal(dr[0], "Dr. Alex will join.");
      assert.equal(dr[1], "Alex may participate.");

      const us = splitIntoSentences(
        "U.S. policy applies. The decision remains open.",
      );
      assert.equal(us.length, 2, us.join(" | "));
      assert.ok(us[0]!.startsWith("U.S. policy"));
      assert.ok(us[1]!.startsWith("The decision"));

      const eg = splitIntoSentences(
        "e.g. Alex may participate. Another option remains.",
      );
      assert.equal(eg.length, 2, eg.join(" | "));
      assert.ok(eg[0]!.toLowerCase().startsWith("e.g."));
      assert.ok(eg[1]!.startsWith("Another option"));

      const pm = splitIntoSentences(
        "The meeting is at 3.14 p.m. Alex may join.",
      );
      assert.equal(pm.length, 1, pm.join(" | "));
      assert.ok(pm[0]!.includes("3.14"));
      assert.ok(pm[0]!.includes("p.m."));
      assert.ok(pm[0]!.includes("Alex may join"));

      const url = splitIntoSentences(
        "See https://example.com/path for details. The next step is pending.",
      );
      assert.equal(url.length, 2, url.join(" | "));
      assert.ok(url[0]!.includes("https://example.com/path"));
      assert.ok(url[1]!.startsWith("The next step"));

      const email = splitIntoSentences(
        "contact@example.com is the address. The response is pending.",
      );
      assert.equal(email.length, 2, email.join(" | "));
      assert.ok(email[0]!.includes("contact@example.com"));
      assert.ok(email[1]!.startsWith("The response"));

      const zh = splitIntoSentences(
        "如果审批通过，Alex可能参与。Alex将承担一半搬迁成本。",
      );
      assert.equal(zh.length, 2, zh.join(" | "));
      assert.ok(zh[1]!.includes("将承担"));

      const en = splitIntoSentences(
        "If approval is granted, Alex may contribute. Alex will cover half regardless.",
      );
      assert.equal(en.length, 2, en.join(" | "));

      const mixedNoSpace = splitIntoSentences(
        "If approval holds, keep it conditional.Alex将承担一半搬迁成本。",
      );
      assert.ok(mixedNoSpace.length >= 2, mixedNoSpace.join(" | "));
      assert.ok(mixedNoSpace.some((s) => /将承担/.test(s)));

      // Real boundary after abbreviation must still split.
      const afterDr = splitIntoSentences(
        "Dr. Alex will join the meeting. The next step remains open.",
      );
      assert.equal(afterDr.length, 2, afterDr.join(" | "));
      assert.ok(afterDr[0]!.startsWith("Dr. Alex"));
      assert.ok(afterDr[1]!.startsWith("The next step"));
    }

    {
      const idFact = "fact_r5_id";
      const locFact = "fact_r5_loc";
      const jobFact = "fact_r5_job";
      const relFact = "fact_r5_rel";
      const behFact = "fact_r5_beh";
      const behAlex = "fact_r5_beh_alex";
      const behJordan = "fact_r5_beh_jordan";
      const behUnver = "fact_r5_beh_u";

      // A. Unrelated confirmed location fact cannot support pay behavior.
      const unrelatedLoc = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, idFact, locFact]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [idFact, "confirmed"],
          [locFact, "confirmed"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [idFact, "Alex is my business partner."],
          [locFact, "Alex lives in Boston."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [idFact, "independently_verified"],
          [locFact, "independently_verified"],
        ]),
        factRolesById: new Map([
          ...ctx.factRolesById,
          [idFact, ["stakeholder"]],
          [locFact, ["status_quo"]],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [idFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex"],
              reality_fact_ids: [locFact],
              reality_fact_stances: [
                { fact_id: locFact, stance: "as_confirmed" },
              ],
              text: "Alex will pay half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(unrelatedLoc.ok, false);
      if (unrelatedLoc.ok) throw new Error("unreachable");
      assert.ok(
        unrelatedLoc.issues.some(
          (i) => i.code === "unconfirmed_participant_behavior",
        ),
        unrelatedLoc.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
      );

      // B. Unrelated job fact cannot support invest behavior.
      const unrelatedJob = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, idFact, jobFact]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [idFact, "confirmed"],
          [jobFact, "confirmed"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [idFact, "Alex is my business partner."],
          [jobFact, "Alex works as a project manager."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [idFact, "independently_verified"],
          [jobFact, "independently_verified"],
        ]),
        factRolesById: new Map([
          ...ctx.factRolesById,
          [idFact, ["stakeholder"]],
          [jobFact, ["job_offer"]],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [idFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex"],
              reality_fact_ids: [jobFact],
              reality_fact_stances: [
                { fact_id: jobFact, stance: "as_confirmed" },
              ],
              text: "Alex will invest $50,000.",
            },
          ],
        }),
      });
      assert.equal(unrelatedJob.ok, false);
      if (unrelatedJob.ok) throw new Error("unreachable");
      assert.ok(
        unrelatedJob.issues.some(
          (i) => i.code === "unconfirmed_participant_behavior",
        ),
      );

      // C. Relationship identity fact cannot support relocate agreement.
      const unrelatedRel = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, relFact]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [relFact, "confirmed"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [relFact, "Alex is the user's partner."],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [relFact, "independently_verified"],
        ]),
        factRolesById: new Map([
          ...ctx.factRolesById,
          [relFact, ["stakeholder"]],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [relFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex"],
              reality_fact_ids: [relFact],
              reality_fact_stances: [
                { fact_id: relFact, stance: "as_confirmed" },
              ],
              text: "Alex has agreed to relocate.",
            },
          ],
        }),
      });
      assert.equal(unrelatedRel.ok, false);
      if (unrelatedRel.ok) throw new Error("unreachable");
      assert.ok(
        unrelatedRel.issues.some(
          (i) => i.code === "unconfirmed_participant_behavior",
        ),
      );

      // D. True independent behavior fact with allowlisted role — allow.
      const trueBeh = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([...ctx.knownFactIds, idFact, behFact]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [idFact, "confirmed"],
          [behFact, "confirmed"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [idFact, "Alex is my business partner."],
          [
            behFact,
            "Alex has agreed in writing to cover half of the relocation cost.",
          ],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [idFact, "independently_verified"],
          [behFact, "independently_verified"],
        ]),
        factRolesById: new Map([
          ...ctx.factRolesById,
          [idFact, ["stakeholder"]],
          [behFact, ["third_party_commitment"]],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [idFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex"],
              reality_fact_ids: [behFact],
              reality_fact_stances: [
                { fact_id: behFact, stance: "as_confirmed" },
              ],
              text: "Alex has agreed to cover half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(
        trueBeh.ok,
        true,
        trueBeh.ok ? "" : trueBeh.issues.map((i) => i.detail).join(" | "),
      );

      // E. Multi-participant isolation — Alex fact cannot support Jordan.
      const crossPart = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([
          ...ctx.knownFactIds,
          idFact,
          relFact,
          behAlex,
          behJordan,
        ]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [idFact, "confirmed"],
          [relFact, "confirmed"],
          [behAlex, "confirmed"],
          [behJordan, "confirmed"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [idFact, "Alex is my business partner."],
          [relFact, "Jordan is named as a partner in the written split."],
          [
            behAlex,
            "Alex has agreed in writing to cover half of the relocation cost.",
          ],
          [
            behJordan,
            "Jordan has agreed in writing to cover half of the relocation cost.",
          ],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [idFact, "independently_verified"],
          [relFact, "independently_verified"],
          [behAlex, "independently_verified"],
          [behJordan, "independently_verified"],
        ]),
        factRolesById: new Map([
          ...ctx.factRolesById,
          [idFact, ["stakeholder"]],
          [relFact, ["stakeholder"]],
          [behAlex, ["third_party_commitment"]],
          [behJordan, ["third_party_commitment"]],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [idFact],
              notes: "",
            },
            {
              participant_id: "p_jordan",
              display_label: "Jordan",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [relFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_alex", "p_jordan"],
              reality_fact_ids: [behAlex],
              reality_fact_stances: [
                { fact_id: behAlex, stance: "as_confirmed" },
              ],
              text: "Jordan has agreed to cover half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(crossPart.ok, false);
      if (crossPart.ok) throw new Error("unreachable");
      assert.ok(
        crossPart.issues.some(
          (i) =>
            i.code === "unconfirmed_participant_behavior" &&
            i.detail.includes("p_jordan"),
        ),
        crossPart.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
      );

      const crossPartOk = validateFace07Output({
        ...baseV,
        knownFactIds: new Set([
          ...ctx.knownFactIds,
          idFact,
          relFact,
          behJordan,
        ]),
        factStatusById: new Map([
          ...ctx.factStatusById,
          [idFact, "confirmed"],
          [relFact, "confirmed"],
          [behJordan, "confirmed"],
        ]),
        factContentById: new Map([
          ...ctx.factContentById,
          [idFact, "Alex is my business partner."],
          [relFact, "Jordan is named as a partner in the written split."],
          [
            behJordan,
            "Jordan has agreed in writing to cover half of the relocation cost.",
          ],
        ]),
        factVerificationLevelById: new Map([
          ...ctx.factVerificationLevelById,
          [idFact, "independently_verified"],
          [relFact, "independently_verified"],
          [behJordan, "independently_verified"],
        ]),
        factRolesById: new Map([
          ...ctx.factRolesById,
          [idFact, ["stakeholder"]],
          [relFact, ["stakeholder"]],
          [behJordan, ["third_party_commitment"]],
        ]),
        raw: validFace07({
          participants: [
            (validFace07().participants as object[])[0],
            {
              participant_id: "p_alex",
              display_label: "Alex",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [idFact],
              notes: "",
            },
            {
              participant_id: "p_jordan",
              display_label: "Jordan",
              role: "partner",
              source: "dc_fact",
              verification_status: "confirmed",
              related_fact_ids: [relFact],
              notes: "",
            },
          ],
          relationship_units: [
            {
              ...(validFace07().relationship_units as object[])[0],
              participant_ids: ["p_jordan"],
              reality_fact_ids: [behJordan],
              reality_fact_stances: [
                { fact_id: behJordan, stance: "as_confirmed" },
              ],
              text: "Jordan has agreed to cover half of the relocation cost.",
            },
          ],
        }),
      });
      assert.equal(
        crossPartOk.ok,
        true,
        crossPartOk.ok
          ? ""
          : crossPartOk.issues.map((i) => i.detail).join(" | "),
      );

      // F. Non-confirmed behavior text cannot be confirmed behavior evidence.
      for (const status of [
        "unverified",
        "unknown",
        "declined",
        "not_applicable",
      ] as const) {
        const nonConf = validateFace07Output({
          ...baseV,
          knownFactIds: new Set([...ctx.knownFactIds, idFact, behUnver]),
          factStatusById: new Map([
            ...ctx.factStatusById,
            [idFact, "confirmed"],
            [behUnver, status],
          ]),
          factContentById: new Map([
            ...ctx.factContentById,
            [idFact, "Alex is my business partner."],
            [
              behUnver,
              "Alex has agreed in writing to cover half of the relocation cost.",
            ],
          ]),
          factVerificationLevelById: new Map([
            ...ctx.factVerificationLevelById,
            [idFact, "independently_verified"],
            [behUnver, "none"],
          ]),
          factRolesById: new Map([
            ...ctx.factRolesById,
            [idFact, ["stakeholder"]],
            [behUnver, ["third_party_commitment"]],
          ]),
          raw: validFace07({
            participants: [
              (validFace07().participants as object[])[0],
              {
                participant_id: "p_alex",
                display_label: "Alex",
                role: "partner",
                source: "dc_fact",
                verification_status: "confirmed",
                related_fact_ids: [idFact],
                notes: "",
              },
            ],
            relationship_units: [
              {
                ...(validFace07().relationship_units as object[])[0],
                participant_ids: ["p_alex"],
                reality_fact_ids: [behUnver],
                reality_fact_stances: [
                  { fact_id: behUnver, stance: "as_uncertain" },
                ],
                text: "Alex has agreed to cover half of the relocation cost.",
              },
            ],
          }),
        });
        assert.equal(nonConf.ok, false, `non-confirmed behavior ${status}`);
        if (nonConf.ok) throw new Error("unreachable");
        assert.ok(
          nonConf.issues.some(
            (i) => i.code === "unconfirmed_participant_behavior",
          ),
          `missing unconfirmed_participant_behavior for ${status}`,
        );
        assert.ok(
          nonConf.issues.some(
            (i) =>
              i.code === "fact_status_upgrade" && i.detail.includes(behUnver),
          ),
          `missing fact_status_upgrade for ${status}`,
        );
      }
    }

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

    // not_applicable → omit Reader node + PDF blocks (no skip banner / blank page).
    const skipPage = synthesizeFace07StatusPage({
      locale: "en",
      applicability: ctxOf(dcSolo).applicability,
    });
    assert.equal(skipPage.applicability_status, "not_applicable");
    assert.equal(isFace07NotApplicableOmit(skipPage), true);
    assert.equal(includePage07InUserFacingOrder(skipPage), false);
    const skipHtml = renderToStaticMarkup(
      createElement(Face07PageSlots, { page: skipPage, locale: "en" }),
    );
    assert.equal(skipHtml, "");
    assert.ok(!skipHtml.includes("data-face=\"07\""));
    assert.ok(!skipHtml.includes("skipped"));
    const skipPdf = assemblePage07PdfArgumentBodies(skipPage, "en");
    assert.equal(skipPdf.length, 0);
    const skipViaRender = pageSchemaToArgumentBodies(skipPage as never);
    assert.equal(skipViaRender.length, 0);
    assert.equal(assemblePage07SectionsForDisplay(skipPage, "en").length, 0);

    // insufficient_information is NOT treated as normal not_applicable omit flag
    // for the same product reason — production fails closed; inclusion helper returns false
    // but isFace07NotApplicableOmit stays false.
    const insufficientPage = synthesizeFace07StatusPage({
      locale: "en",
      applicability: {
        status: "insufficient_information",
        reason: "Question is too thin to judge field/relationship.",
        signals: { topic_match: false, fact_match: false, constraint_match: false },
      },
    });
    assert.equal(insufficientPage.applicability_status, "insufficient_information");
    assert.equal(isFace07NotApplicableOmit(insufficientPage), false);
    assert.equal(includePage07InUserFacingOrder(insufficientPage), false);

    // Report reading order: omit 07 → 08 follows 06; glossary stays last.
    const orderOmit07 = readingOrderAfterAssembly({
      page07Schema: skipPage,
      glossary: {
        include: true,
        page: {
          page: "03",
          face: "03",
          kind: "glossary_appendix",
          reading_note: "Terms used in this report.",
          term_ids: ["t1"],
        } as never,
        term_ids: ["t1"],
      },
    });
    assert.deepEqual(orderOmit07, ["01", "02", "04", "05", "06", "08", "03"]);
    assert.ok(!orderOmit07.includes("07"));
    assert.equal(orderOmit07[orderOmit07.length - 1], "03");
    assert.equal(orderOmit07[orderOmit07.indexOf("08") - 1], "06");

    const orderWith07 = readingOrderAfterAssembly({
      page07Schema: validated.page,
      glossary: { include: false, page: null, term_ids: [] },
    });
    assert.ok(orderWith07.includes("07"));
    assert.equal(orderWith07[orderWith07.indexOf("08") - 1], "07");

    // Shelf: not_applicable page_schema must not create a ready Page07 slot.
    const fence = [
      "```poju-page-schema",
      JSON.stringify({ version: 1, page: skipPage }),
      "```",
    ].join("\n");
    const glossaryFence = [
      "```poju-page-schema",
      JSON.stringify({
        version: 1,
        page: {
          page: "03",
          face: "03",
          kind: "glossary_appendix",
          reading_note: "n",
          term_ids: ["t1"],
        },
      }),
      "```",
    ].join("\n");
    const book = [
      "## 01\n\nBrief",
      "## 02\n\nWhy",
      "## 04\n\nBottleneck",
      "## 05\n\nPaths",
      "## 06\n\nActions",
      `## 07\n\n${fence}`,
      "## 08\n\nClose",
      `## 03\n\n${glossaryFence}`,
    ].join("\n\n");
    const shelf = buildDeliveryShelfSlots(book, {
      locale: "en",
      complete: true,
      topic: "partnership",
      question: applicableQuestion,
    });
    const ready = sequentialDeliveryProseReady(shelf);
    assert.ok(!ready.some((s) => s.slotId === "07"), "shelf must omit not_applicable 07");
    const ids = ready.map((s) => s.slotId);
    const i08 = ids.indexOf("08");
    assert.ok(i08 > 0);
    assert.notEqual(ids[i08 - 1], "07");
    assert.equal(ids[ids.length - 1], "03");

    const slotsSrc = readFileSync(
      resolvePath("components/poju/delivery-pages/faces/Face07PageSlots.tsx"),
      "utf8",
    );
    assert.ok(slotsSrc.includes("assemblePage07SectionsForDisplay"));
    assert.ok(slotsSrc.includes("isFace07NotApplicableOmit"));
    const routerSrc = readFileSync(
      resolvePath("components/poju/delivery-pages/faces/FacePageSlots.tsx"),
      "utf8",
    );
    assert.ok(routerSrc.includes("Face07PageSlots"));
    assert.ok(routerSrc.includes("isFace07NotApplicableOmit"));
    console.log("K PASS — Reader and PDF omit not_applicable");
  }

  console.log("ok page07 production closure");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
