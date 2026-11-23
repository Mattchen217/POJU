/**
 * Page05 production closure — stubbed LLM through real runContentBodyGenerate.
 * Run: pnpm exec tsx scripts/test-page05-production.ts
 */

import assert from "node:assert/strict";
import {
  runContentBodyGenerate,
  setContentBodyTestInvokeForTests,
} from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import {
  buildFace05ProductionContext,
  validateFace05ProductionOutput,
  parseFace05JsonStrict,
} from "@/lib/llm/pro/delivery/decision-report-v2/page05/production";
import { validateFace05Output } from "@/lib/llm/pro/delivery/decision-report-v2/page05/validate";
import { assertFace05PathIdIntegrity } from "@/lib/llm/pro/delivery/decision-report-v2/page05/path-units";
import {
  assemblePage05SectionsForDisplay,
  assemblePage05PdfArgumentBodies,
  validatePage05CanonicalPage,
  PAGE05_SECTION_IDS,
  PAGE05_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM,
  assertPage05InputAssemblyCoverage,
} from "@/lib/llm/pro/delivery/decision-report-v2/page05/architecture";
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
import type { Face05V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import {
  isFace05Legacy,
  projectLegacyFace05ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page05/legacy-adapter";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

function stubResult(content: string, tokens = 100): CallLLMResult {
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

const dc: DecisionContext = {
  context_id: "dc_prod_05",
  version: 1,
  status: "final",
  content_hash: "hash_prod_05",
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
  constraints: [
    {
      constraint_id: "c_runway",
      statement: "Keep at least 6 months runway",
      category: "financial",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "collecting",
      source_turn_id: "t1",
      rigidity: "hard",
      user_confirmed: true,
    },
  ],
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
    {
      fact_id: "fact_salary_guess",
      statement: "Maybe cash is 120k.",
      status: "unverified",
      verification_level: "user_estimate",
      source_stage: "collecting",
      source_turn_id: "t2",
      user_confirmed: false,
    },
    {
      fact_id: "fact_declined",
      statement: "Equity details declined.",
      status: "declined",
      verification_level: "none",
      source_stage: "collecting",
      source_turn_id: "t3",
      user_confirmed: false,
    },
  ],
  dirs: [],
  conflicts: [],
  hypotheses: [],
};

const pack: BookJudgmentPack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_prod05",
  zfp_hash: null,
  zfpOmitted: true,
  shot_mode: "one",
  created_at: "2026-01-01T00:00:00Z",
  units: [
    {
      id: "u_path_05",
      track: "science",
      claim: "Staged explore preserves runway better than cold resign.",
      anchors: ["runway_buffer"],
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
  core_judgment: {
    text: "Prefer a staged explore path that keeps the cash floor intact.",
    claim_ids: ["claim_u_path_05"],
  },
  why_this_path: [
    { text: "Runway buffer supports staged explore.", claim_ids: ["claim_u_path_05"] },
  ],
  recommendation_conditions: [
    { condition: "runway holds", status: "assumed", source_ids: ["fact_runway"] },
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
    page02_evidence_ids: ["u_path_05"],
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
      text: "Cash-floor anxiety amplifies under offer deadlines.",
      claim_ids: ["claim_u_path_05"],
      evidence_ids: ["u_path_05"],
      related_dir_ids: [],
    },
  ],
  explanation_boundary: {
    claim_ids: ["claim_u_path_05"],
    known_limits: ["Salary unverified"],
    open_questions: ["Equity terms"],
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
      text: "Cash-floor panic under offer pressure.",
      title: "",
      claim_ids: ["claim_u_path_05"],
      evidence_ids: [],
      related_reality_fact_ids: ["fact_runway"],
    },
  ],
  bottleneck_naming_unit_ids: ["u_name"],
  manifestation_unit_ids: ["u_name"],
  force_through_cost_unit_ids: ["u_name"],
  leverage_point_unit_ids: ["u_name"],
  evidence_boundary: {
    claim_ids: ["claim_u_path_05"],
    evidence_note_unit_ids: [],
    confirmed_fact_ids: ["fact_runway"],
    hypothesis_notes: [],
    uncertainty_notes: ["x"],
  },
  reading_order: [
    "bottleneck_naming",
    "manifestation",
    "force_through_cost",
    "leverage_point",
    "evidence_boundary",
  ],
} as unknown;

function validFace05Raw(overrides?: Record<string, unknown>): Record<string, unknown> {
  const base = {
    page: "05",
    face: "05",
    schema_version: "face05-v2",
    locale: "en",
    path_units: [
      {
        path_id: "path_staged",
        path_role: "preferred",
        title: "Staged explore while keeping runway",
        description: "Negotiate terms while keeping current cash floor intact.",
        recommendation_reason: "Aligns with runway constraint and Page01 staged explore.",
        prerequisites: ["runway holds"],
        required_resources: ["negotiation bandwidth"],
        expected_benefits: ["preserve optionality"],
        costs: ["slower equity clarity"],
        risks: ["offer window closes"],
        reversibility: "High — can pause without resigning",
        success_signals: ["written runway plan holds for 30 days"],
        reconsideration_conditions: [],
        claim_ids: ["claim_u_path_05"],
        evidence_ids: ["u_path_05"],
        related_reality_fact_ids: ["fact_runway"],
        supporting_page01_refs: ["core_judgment"],
        supporting_page02_refs: ["p02_u1"],
        supporting_page04_refs: ["u_name"],
      },
      {
        path_id: "path_hold",
        path_role: "alternative",
        title: "Hold and clarify before any leave decision",
        description: "Defer leave talk until salary/equity facts are clarified.",
        recommendation_reason: "Lower commitment while unverified cash remains open.",
        prerequisites: ["can delay response without burning bridge"],
        required_resources: ["time window"],
        expected_benefits: ["reduce uncertainty"],
        costs: ["may miss early equity window"],
        risks: ["relationship cooling"],
        reversibility: "High",
        success_signals: ["key unknowns become confirmed or declined"],
        reconsideration_conditions: [],
        claim_ids: ["claim_u_path_05"],
        evidence_ids: ["u_path_05"],
        related_reality_fact_ids: ["fact_salary_guess"],
        supporting_page01_refs: ["recommendation_conditions[0]"],
        supporting_page02_refs: ["p02_u1"],
        supporting_page04_refs: ["u_name"],
      },
    ],
    preferred_path_ids: ["path_staged"],
    alternative_path_ids: ["path_hold"],
    cautious_path_ids: [],
    path_comparison: {
      rows: [
        {
          path_id: "path_staged",
          benefit: "Keeps runway while exploring",
          cost: "Negotiation effort",
          risk: "Offer window risk",
          resource_requirement: "Bandwidth",
          reversibility: "High",
          prerequisites: "Runway holds",
        },
        {
          path_id: "path_hold",
          benefit: "Clarifies unknowns first",
          cost: "Time delay",
          risk: "Cooling relationship",
          resource_requirement: "Calendar buffer",
          reversibility: "High",
          prerequisites: "Delay is acceptable",
        },
      ],
    },
    switching_rules: [
      {
        rule_id: "sw_to_hold",
        source_path_id: "path_staged",
        trigger_condition: "Runway forecast drops below six months",
        action: "switch",
        target_path_id: "path_hold",
        rationale: "Protect cash floor before continuing explore talks.",
        claim_ids: ["claim_u_path_05"],
        evidence_ids: ["u_path_05"],
        related_reality_fact_ids: ["fact_runway"],
      },
      {
        rule_id: "stop_cold",
        source_path_id: "path_staged",
        trigger_condition: "Pressure to resign without written terms",
        action: "stop",
        target_path_id: null,
        rationale: "Cold resign burns the confirmed runway buffer.",
        claim_ids: ["claim_u_path_05"],
        evidence_ids: ["u_path_05"],
        related_reality_fact_ids: ["fact_runway"],
      },
    ],
    evidence_boundary: {
      claim_ids: ["claim_u_path_05"],
      confirmed_fact_ids: ["fact_runway"],
      hypothesis_notes: [],
      uncertainty_notes: ["Salary figure remains unverified"],
      cautious_absent_note:
        "No separate cautious path beyond cold resign already framed as stop condition.",
    },
    reading_order: [...PAGE05_SECTION_IDS],
  };
  return { ...base, ...(overrides ?? {}) };
}

function baseGenerateInput() {
  return {
    key: "05" as const,
    locale: "en",
    session_id: "face05_prod_test",
    report_id: "face05_prod_test",
    finalize: {} as never,
    decision_context_snapshot: dc,
    book_judgment_pack: pack,
    chart_fact_pack: "日主甲木…",
    page01_schema: page01,
    page02_schema: page02,
    page04_schema: page04,
    dispatch_attempt: 1,
  };
}

function face05IntegrityCtx() {
  const built = buildFace05ProductionContext({
    report_id: "prod05_integrity",
    locale: "en",
    dc,
    pack,
    page01,
    page02,
    page04,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  return built.ctx;
}

function rejectPathIntegrity(
  mutate: (base: Record<string, unknown>) => Record<string, unknown>,
  label: string,
  expectSubstring: string,
) {
  const base = validFace05Raw();
  const raw = mutate(structuredClone(base));
  const ctx = face05IntegrityCtx();
  const viaValidate = validateFace05Output({
    raw,
    locale: "en",
    registry: ctx.registry,
    knownFactIds: ctx.knownFactIds,
    factStatusById: ctx.factStatusById,
    knownPage01Refs: ctx.knownPage01Refs,
    knownPage02Refs: ctx.knownPage02Refs,
    knownPage04Refs: ctx.knownPage04Refs,
  });
  assert.equal(viaValidate.ok, false, `${label}: validateFace05Output must fail`);
  if (viaValidate.ok) throw new Error("unreachable");
  assert.ok(
    viaValidate.issues.some((i) => i.detail.includes(expectSubstring)),
    `${label}: expected issue containing ${expectSubstring}; got ${viaValidate.issues.map((i) => i.detail).join(" | ")}`,
  );
  const viaProd = validateFace05ProductionOutput({ raw, locale: "en", ctx });
  assert.equal(viaProd.ok, false, `${label}: production validator`);
  const viaCanonical = validatePage05CanonicalPage(raw);
  assert.equal(viaCanonical.ok, false, `${label}: canonical page`);
}

async function buildLabReadyForFace05Body(opts?: {
  includePage04?: boolean;
}): Promise<DeliveryLabSession> {
  process.env.BOOK_JUDGMENT_PACK = "0";
  const includePage04 = opts?.includePage04 !== false;

  const lab = await createDeliveryLab({
    ops_user: "lab_prod_05_wiring",
    source: {
      locale: "en",
      original_question: "Should I leave for the startup offer?",
      desired_outcome: "Preserve runway",
      base_analysis: "{}",
      session_id: `sess_lab05_wire_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      decision_context_snapshot: dc,
    },
    mode: "delivery_only",
  });
  lab.pipeline = "v3_three_step";
  lab.steps = initLabStepsV3();
  lab.artifacts.by_page = lab.artifacts.by_page ?? {};
  lab.artifacts.by_page["01"] = {
    page_schema: page01 as never,
    page_schema_pre_polish: structuredClone(page01),
  };
  lab.artifacts.by_page["02"] = {
    page_schema: page02 as never,
    page_schema_pre_polish: structuredClone(page02),
  };
  if (includePage04) {
    lab.artifacts.by_page["04"] = {
      page_schema: page04 as never,
      page_schema_pre_polish: structuredClone(page04),
    };
  }
  lab.artifacts.by_page["05"] = lab.artifacts.by_page["05"] ?? {};
  lab.artifacts.prealloc = {
    by_page: {},
    pool_source: "chart_fact_pack",
    chart_fact_pack: "dayMaster:甲\nyongJi:木",
  } as never;
  lab.artifacts.book_judgment_pack = pack;

  const defs = labStepDefsV3();
  const bodyIdx = defs.findIndex((d) => d.step_key === "05.content.body");
  assert.ok(bodyIdx >= 0, "05.content.body exists");
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
  console.log("=== Page05 production closure (stubbed LLM) ===");
  assertPage05InputAssemblyCoverage();

  {
    const built = buildFace05ProductionContext({
      report_id: "prod05_payload",
      locale: "en",
      dc,
      pack,
      page01,
      page02,
      page04,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error(built.reason);
    assert.ok(built.ctx.user.includes("## Production payload"));
    assert.ok(built.ctx.user.includes("fact_runway"));
    assert.ok(built.ctx.user.includes("p02_u1"));
    assert.ok(built.ctx.user.includes("u_name"));
    assert.ok(built.ctx.user.includes("claim_u_path_05"));
    assert.ok(built.ctx.user.includes("Keep at least 6 months runway"));
    assert.equal(Object.keys(built.ctx.registry.claims).length, 1);
    console.log("PAYLOAD/REGISTRY PASS");
  }

  // A + H + I
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async (_sys, usr) => {
      invokeCount += 1;
      assert.ok(usr.includes("Production payload"));
      assert.ok(usr.includes("path_staged") === false); // model output, not input
      assert.ok(usr.includes("claim_u_path_05"));
      return stubResult(JSON.stringify(validFace05Raw()));
    });
    try {
      const result = await runContentBodyGenerate(baseGenerateInput());
      assert.equal(result.ok, true);
      if (!result.ok) throw new Error(result.reason);
      assert.equal(invokeCount, 1);
      assert.equal(result.call_trace.phase, "content_body_v3_face05");
      assert.equal(result.face05_meta?.validation, "passed");
      assert.equal(result.face05_meta?.schema_version, "face05-v2");
      const page = result.page as Face05V2;
      assert.equal(page.schema_version, "face05-v2");
      assert.ok(Array.isArray(page.path_units));
      assert.ok(page.path_units.length >= 2);
      assert.ok(page.generation_metadata?.llm_invoked === true);
      assert.equal("first_choice" in page, false);
      for (const f of PAGE05_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM) {
        assert.ok(f in page || f === "description" || f === "path_id" || f === "path_role" || f === "prerequisites" || f === "required_resources" || f === "risks" || f === "success_signals" || f === "reconsideration_conditions", `downstream field ${f}`);
      }
      assert.ok(page.path_units.every((u) => u.path_id && u.path_role));
      assert.ok(page.switching_rules.length >= 1);

      const lab = await createDeliveryLab({
        ops_user: "lab_prod_05_test",
        source: {
          locale: "en",
          original_question: "Should I leave for the startup offer?",
          desired_outcome: "Preserve runway",
          base_analysis: "{}",
          session_id: `sess_lab05_prod_${Date.now()}`,
        },
      });
      lab.artifacts.by_page["05"] = {
        ...(lab.artifacts.by_page["05"] ?? {
          page_key: "05",
          status: "pending",
          attempts: [],
        }),
        page_schema: page as never,
        page_schema_pre_polish: structuredClone(page) as never,
      };
      await saveDeliveryLab(lab);
      const reloaded = await loadDeliveryLab(lab.lab_id);
      const stored = reloaded!.artifacts.by_page["05"]?.page_schema;
      const validated = validatePage05CanonicalPage(stored);
      assert.equal(validated.ok, true);
      if (!validated.ok) throw new Error(validated.detail);
      const reader = assemblePage05SectionsForDisplay(validated.page, "en");
      const pdf = assemblePage05PdfArgumentBodies(validated.page, "en");
      assert.equal(reader.length, PAGE05_SECTION_IDS.length);
      assert.equal(pdf.length, PAGE05_SECTION_IDS.length);
      assert.ok(validated.page.path_units[0]?.path_id);
      console.log("A+H+I PASS — success path + persist + downstream fields");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // B repair success
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      if (invokeCount === 1) {
        return stubResult(
          JSON.stringify(
            validFace05Raw({
              path_units: (
                validFace05Raw().path_units as Array<Record<string, unknown>>
              ).map((u) => ({ ...u, claim_ids: ["claim_fabricated"] })),
            }),
          ),
        );
      }
      return stubResult(JSON.stringify(validFace05Raw()));
    });
    try {
      const result = await runContentBodyGenerate(baseGenerateInput());
      assert.equal(result.ok, true);
      if (!result.ok) throw new Error(result.reason);
      assert.equal(invokeCount, 2);
      assert.equal(result.face05_meta?.validation, "passed_after_repair");
      console.log("B PASS — repair once then success");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // C repair fail
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(
        JSON.stringify(
          validFace05Raw({
            evidence_boundary: {
              claim_ids: ["claim_u_path_05"],
              confirmed_fact_ids: ["fact_salary_guess"],
              hypothesis_notes: [],
              uncertainty_notes: ["x"],
              cautious_absent_note: "none",
            },
          }),
        ),
      );
    });
    try {
      const result = await runContentBodyGenerate(baseGenerateInput());
      assert.equal(result.ok, false);
      if (result.ok) throw new Error("expected fail");
      assert.equal(invokeCount, 2);
      assert.equal(result.reason, "face05_validation_failed");
      console.log("C PASS — repair exhausted");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // D gate
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult("{}");
    });
    try {
      const blocked = await runContentBodyGenerate({
        ...baseGenerateInput(),
        page01_schema: null,
        page02_schema: null,
        page04_schema: null,
      });
      assert.equal(blocked.ok, false);
      assert.equal(blocked.reason, "face05_blocked_on_required_inputs");
      assert.equal(blocked.tokens_used, 0);
      assert.equal(invokeCount, 0);
      console.log("D PASS — required inputs gate");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // E/F/G auth
  {
    const built = buildFace05ProductionContext({
      report_id: "prod05_auth",
      locale: "en",
      dc,
      pack,
      page01,
      page02,
      page04,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error(built.reason);
    const ctx = built.ctx;

    const badClaim = validateFace05Output({
      raw: validFace05Raw({
        path_units: (
          validFace05Raw().path_units as Array<Record<string, unknown>>
        ).map((u) => ({ ...u, claim_ids: ["claim_fabricated"] })),
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      knownPage01Refs: ctx.knownPage01Refs,
      knownPage02Refs: ctx.knownPage02Refs,
      knownPage04Refs: ctx.knownPage04Refs,
    });
    assert.equal(badClaim.ok, false);

    const badEv = validateFace05Output({
      raw: validFace05Raw({
        path_units: (
          validFace05Raw().path_units as Array<Record<string, unknown>>
        ).map((u) => ({ ...u, evidence_ids: ["ev_fabricated"] })),
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      knownPage01Refs: ctx.knownPage01Refs,
      knownPage02Refs: ctx.knownPage02Refs,
      knownPage04Refs: ctx.knownPage04Refs,
    });
    assert.equal(badEv.ok, false);

    const badFact = validateFace05Output({
      raw: validFace05Raw({
        path_units: (
          validFace05Raw().path_units as Array<Record<string, unknown>>
        ).map((u, i) =>
          i === 0
            ? { ...u, related_reality_fact_ids: ["fact_fabricated"] }
            : u,
        ),
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      knownPage01Refs: ctx.knownPage01Refs,
      knownPage02Refs: ctx.knownPage02Refs,
      knownPage04Refs: ctx.knownPage04Refs,
    });
    assert.equal(badFact.ok, false);

    const badP02 = validateFace05Output({
      raw: validFace05Raw({
        path_units: (
          validFace05Raw().path_units as Array<Record<string, unknown>>
        ).map((u, i) =>
          i === 0 ? { ...u, supporting_page02_refs: ["missing_unit"] } : u,
        ),
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      knownPage01Refs: ctx.knownPage01Refs,
      knownPage02Refs: ctx.knownPage02Refs,
      knownPage04Refs: ctx.knownPage04Refs,
    });
    assert.equal(badP02.ok, false);

    const legacy = validateFace05Output({
      raw: validFace05Raw({
        path_units: (
          validFace05Raw().path_units as Array<Record<string, unknown>>
        ).map((u) => ({ ...u, claim_ids: ["legacy_claim_x"] })),
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      knownPage01Refs: ctx.knownPage01Refs,
      knownPage02Refs: ctx.knownPage02Refs,
      knownPage04Refs: ctx.knownPage04Refs,
    });
    assert.equal(legacy.ok, false);

    const upgrade = validateFace05Output({
      raw: validFace05Raw({
        evidence_boundary: {
          claim_ids: ["claim_u_path_05"],
          confirmed_fact_ids: ["fact_declined"],
          hypothesis_notes: [],
          uncertainty_notes: ["x"],
          cautious_absent_note: "none",
        },
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      knownPage01Refs: ctx.knownPage01Refs,
      knownPage02Refs: ctx.knownPage02Refs,
      knownPage04Refs: ctx.knownPage04Refs,
    });
    assert.equal(upgrade.ok, false);

    const dup = validateFace05Output({
      raw: validFace05Raw({
        path_units: [
          ...(validFace05Raw().path_units as unknown[]),
          {
            ...(validFace05Raw().path_units as Array<Record<string, unknown>>)[0],
            path_id: "path_staged",
            path_role: "alternative",
            title: "Dup",
          },
        ],
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      knownPage01Refs: ctx.knownPage01Refs,
      knownPage02Refs: ctx.knownPage02Refs,
      knownPage04Refs: ctx.knownPage04Refs,
    });
    assert.equal(dup.ok, false);

    const badTarget = validateFace05Output({
      raw: validFace05Raw({
        switching_rules: [
          {
            rule_id: "bad",
            source_path_id: "path_staged",
            trigger_condition: "x",
            action: "switch",
            target_path_id: "missing_path",
            rationale: "y",
            claim_ids: ["claim_u_path_05"],
            evidence_ids: [],
            related_reality_fact_ids: [],
          },
        ],
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      knownPage01Refs: ctx.knownPage01Refs,
      knownPage02Refs: ctx.knownPage02Refs,
      knownPage04Refs: ctx.knownPage04Refs,
    });
    assert.equal(badTarget.ok, false);

    const score = validateFace05Output({
      raw: validFace05Raw({
        path_units: (
          validFace05Raw().path_units as Array<Record<string, unknown>>
        ).map((u, i) =>
          i === 0
            ? { ...u, description: "This path has 92% success rate." }
            : u,
        ),
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      knownPage01Refs: ctx.knownPage01Refs,
      knownPage02Refs: ctx.knownPage02Refs,
      knownPage04Refs: ctx.knownPage04Refs,
    });
    assert.equal(score.ok, false);

    assert.equal(parseFace05JsonStrict("```json\n{}\n```"), null);
    const okProd = validateFace05ProductionOutput({
      raw: validFace05Raw(),
      locale: "en",
      ctx,
    });
    assert.equal(okProd.ok, true);
    console.log("E/F/G PASS — refs/fact/path auth");
  }

  // Legacy PDF
  {
    const rawLegacy = {
      page: "05",
      face: "05",
      first_choice: "Staged explore.",
      second_choice: "Hold and clarify.",
      caution_choice: "Cold resign.",
      switch_or_stop: "Stop if forced to resign without terms.",
      contrast: "Explore preserves runway better.",
    };
    assert.equal(isFace05Legacy(rawLegacy), true);
    const projected = projectLegacyFace05ForDisplay(rawLegacy)!;
    const pdf = pageSchemaToArgumentBodies(rawLegacy as never);
    assert.equal(pdf.length, PAGE05_SECTION_IDS.length);
    assert.ok(projected.path_units.length >= 2);
    const ui = readFileSync(
      resolvePath("components/poju/delivery-pages/faces/Face05PageSlots.tsx"),
      "utf8",
    );
    assert.ok(ui.includes("assemblePage05SectionsForDisplay"));
    console.log("LEGACY/READER PASS");
  }

  // R1 reverse integrity A–G (bidirectional list + comparison 1:1)
  {
    const units = () =>
      validFace05Raw().path_units as Array<Record<string, unknown>>;
    const rows = () =>
      (validFace05Raw().path_comparison as { rows: Array<Record<string, unknown>> })
        .rows;

    // A: path_unit not in any role list
    rejectPathIntegrity(
      (raw) => {
        const orphan = {
          ...units()[0]!,
          path_id: "path_orphan",
          path_role: "alternative",
          title: "Orphan path never classified",
          description: "Present in path_units but missing from all role lists.",
        };
        return {
          ...raw,
          path_units: [...units(), orphan],
          path_comparison: {
            rows: [
              ...rows(),
              {
                path_id: "path_orphan",
                benefit: "b",
                cost: "c",
                risk: "r",
                resource_requirement: "res",
                reversibility: "High",
                prerequisites: "none",
              },
            ],
          },
        };
      },
      "A",
      "not referenced by preferred/alternative/cautious",
    );
    console.log("R1-A PASS — unlisted path_unit rejected");

    // B: same path_id in preferred and alternative
    rejectPathIntegrity(
      (raw) => ({
        ...raw,
        preferred_path_ids: ["path_staged"],
        alternative_path_ids: ["path_hold", "path_staged"],
      }),
      "B",
      "appears in both",
    );
    console.log("R1-B PASS — cross-list duplicate rejected");

    // C: path_role=alternative placed in preferred
    rejectPathIntegrity(
      (raw) => ({
        ...raw,
        preferred_path_ids: ["path_hold"],
        alternative_path_ids: ["path_staged"],
      }),
      "C",
      "requires preferred role",
    );
    console.log("R1-C PASS — role/list mismatch rejected");

    // D: path missing comparison row (3 units, only 2 comparison rows)
    rejectPathIntegrity(
      (raw) => {
        const extra = {
          ...units()[1]!,
          path_id: "path_extra",
          path_role: "alternative",
          title: "Extra alternative without comparison",
          description: "Listed as alternative but omitted from comparison table.",
        };
        return {
          ...raw,
          path_units: [...units(), extra],
          alternative_path_ids: ["path_hold", "path_extra"],
          // rows stay at staged+hold only → path_extra missing comparison
        };
      },
      "D",
      "missing path_comparison.rows",
    );
    console.log("R1-D PASS — missing comparison row rejected");

    // E: duplicate comparison path_id
    rejectPathIntegrity(
      (raw) => ({
        ...raw,
        path_comparison: {
          rows: [rows()[0]!, { ...rows()[0]! }],
        },
      }),
      "E",
      "path_comparison duplicate path_id",
    );
    console.log("R1-E PASS — duplicate comparison path_id rejected");

    // F: comparison references unknown path_id
    rejectPathIntegrity(
      (raw) => ({
        ...raw,
        path_comparison: {
          rows: [
            rows()[0]!,
            { ...rows()[1]!, path_id: "path_missing_compare" },
          ],
        },
      }),
      "F",
      "path_comparison unknown path_id",
    );
    console.log("R1-F PASS — unknown comparison path_id rejected");

    // G: full bidirectional integrity passes all three validators
    {
      const ctx = face05IntegrityCtx();
      const raw = validFace05Raw();
      const viaValidate = validateFace05Output({
        raw,
        locale: "en",
        registry: ctx.registry,
        knownFactIds: ctx.knownFactIds,
        factStatusById: ctx.factStatusById,
        knownPage01Refs: ctx.knownPage01Refs,
        knownPage02Refs: ctx.knownPage02Refs,
        knownPage04Refs: ctx.knownPage04Refs,
      });
      assert.equal(viaValidate.ok, true);
      if (!viaValidate.ok) throw new Error("G validate failed");
      assert.deepEqual(assertFace05PathIdIntegrity(viaValidate.page), []);
      const viaProd = validateFace05ProductionOutput({
        raw,
        locale: "en",
        ctx,
      });
      assert.equal(viaProd.ok, true);
      const viaCanonical = validatePage05CanonicalPage(raw);
      assert.equal(viaCanonical.ok, true);
      console.log("R1-G PASS — complete path+comparison integrity accepted");
    }
  }

  // R1-H: real Lab production entry wires Page01/02/04 into Face05 prompt
  {
    let invokeCount = 0;
    let capturedUser = "";
    setContentBodyTestInvokeForTests(async (_sys, usr) => {
      invokeCount += 1;
      capturedUser = usr;
      return stubResult(JSON.stringify(validFace05Raw()));
    });
    try {
      const lab0 = await buildLabReadyForFace05Body({ includePage04: true });
      const current = await loadDeliveryLab(lab0.lab_id);
      assert.ok(current);
      const run = await runLabStepV3(current!, "05.content.body", {
        polish_locale: "en",
      });
      assert.equal(run.ok, true, `H lab step failed: ${run.ok ? "" : run.reason}`);
      assert.equal(invokeCount, 1, "H must invoke LLM once through Lab entry");
      assert.ok(
        capturedUser.includes("## Production payload"),
        "H prompt must include production payload",
      );
      assert.ok(
        capturedUser.includes("Cash-floor panic under offer pressure."),
        "H must include Page04 content_units text via Lab page04_schema",
      );
      assert.ok(
        capturedUser.includes("u_name"),
        "H must include Page04 unit_id",
      );
      assert.ok(
        capturedUser.includes("evidence_boundary") ||
          capturedUser.includes("\"confirmed_fact_ids\""),
        "H must include Page04 evidence_boundary fields",
      );
      assert.ok(
        capturedUser.includes("fact_runway"),
        "H Page04 evidence_boundary confirmed facts must reach prompt",
      );
      assert.ok(
        capturedUser.includes("p02_u1"),
        "H must include Page02 content via Lab page02_schema",
      );
      assert.ok(
        capturedUser.includes("Prefer a staged explore path"),
        "H must include Page01 core_judgment via Lab page01_schema",
      );
      const payload = run.attempt?.input_payload as
        | { pipeline?: string; page04_schema_present?: boolean }
        | undefined;
      assert.equal(payload?.pipeline, "face05_v2");
      assert.equal(payload?.page04_schema_present, true);
      const reloaded = await loadDeliveryLab(lab0.lab_id);
      const stored = reloaded!.artifacts.by_page["05"]?.page_schema;
      const validated = validatePage05CanonicalPage(stored);
      assert.equal(validated.ok, true);
      console.log(
        "R1-H PASS — Lab runLabStepV3(05.content.body) passes Page01/02/04 V2",
      );
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // R1-I: Lab entry missing Page04 blocks before model call
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(JSON.stringify(validFace05Raw()));
    });
    try {
      const lab0 = await buildLabReadyForFace05Body({ includePage04: false });
      assert.equal(
        lab0.artifacts.by_page["04"]?.page_schema,
        undefined,
        "I fixture must omit Page04",
      );
      const current = await loadDeliveryLab(lab0.lab_id);
      assert.ok(current);
      const run = await runLabStepV3(current!, "05.content.body", {
        polish_locale: "en",
      });
      assert.equal(run.ok, false);
      assert.equal(run.reason, "face05_blocked_on_required_inputs");
      assert.equal(invokeCount, 0, "I must not invoke LLM");
      assert.equal(run.attempt?.tokens_used ?? 0, 0);
      const reloaded = await loadDeliveryLab(lab0.lab_id);
      assert.equal(
        reloaded!.artifacts.by_page["05"]?.page_schema,
        undefined,
        "I must not persist Face05 when Page04 missing",
      );
      console.log(
        "R1-I PASS — Lab missing Page04 blocks pre-LLM with tokens_used=0",
      );
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  console.log("ok page05 production closure");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
