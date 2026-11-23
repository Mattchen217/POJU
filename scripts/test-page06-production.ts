/**
 * Page06 production closure — stubbed LLM through real runContentBodyGenerate.
 * Run: pnpm exec tsx scripts/test-page06-production.ts
 */

import assert from "node:assert/strict";
import {
  runContentBodyGenerate,
  setContentBodyTestInvokeForTests,
} from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import {
  buildFace06ProductionContext,
  validateFace06ProductionOutput,
  parseFace06JsonStrict,
} from "@/lib/llm/pro/delivery/decision-report-v2/page06/production";
import { validateFace06Output } from "@/lib/llm/pro/delivery/decision-report-v2/page06/validate";
import { assertFace06PathIntegrity } from "@/lib/llm/pro/delivery/decision-report-v2/page06/path-integrity";
import {
  assemblePage06SectionsForDisplay,
  assemblePage06PdfArgumentBodies,
  validatePage06CanonicalPage,
  PAGE06_SECTION_IDS,
  PAGE06_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM,
  PAGE06_DOWNSTREAM_CONTRACT,
  assertPage06InputAssemblyCoverage,
} from "@/lib/llm/pro/delivery/decision-report-v2/page06/architecture";
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
import type { Face06V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import {
  isFace06Legacy,
  projectLegacyFace06ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page06/legacy-adapter";
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
  context_id: "dc_prod_06",
  version: 1,
  status: "final",
  content_hash: "hash_prod_06",
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
  cfp_hash: "cfp_prod06",
  zfp_hash: null,
  zfpOmitted: true,
  shot_mode: "one",
  created_at: "2026-01-01T00:00:00Z",
  units: [
    {
      id: "u_exec_06",
      track: "science",
      claim: "Staged explore preserves runway better than cold resign.",
      anchors: ["runway_buffer"],
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
  core_judgment: {
    text: "Prefer a staged explore path that keeps the cash floor intact.",
    claim_ids: ["claim_u_exec_06"],
  },
  why_this_path: [
    { text: "Runway buffer supports staged explore.", claim_ids: ["claim_u_exec_06"] },
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
    page02_evidence_ids: ["u_exec_06"],
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
      claim_ids: ["claim_u_exec_06"],
      evidence_ids: ["u_exec_06"],
      related_dir_ids: [],
    },
  ],
  explanation_boundary: {
    claim_ids: ["claim_u_exec_06"],
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
      claim_ids: ["claim_u_exec_06"],
      evidence_ids: [],
      related_reality_fact_ids: ["fact_runway"],
    },
  ],
  evidence_boundary: {
    claim_ids: ["claim_u_exec_06"],
    confirmed_fact_ids: ["fact_runway"],
    hypothesis_notes: [],
    uncertainty_notes: ["x"],
  },
} as unknown;

const page05 = {
  page: "05",
  face: "05",
  schema_version: "face05-v2",
  preferred_path_ids: ["path_staged"],
  alternative_path_ids: ["path_hold"],
  cautious_path_ids: [],
  path_units: [
    {
      path_id: "path_staged",
      path_role: "preferred",
      title: "Staged explore while keeping runway",
      description: "Negotiate terms while keeping the cash floor intact.",
      prerequisites: ["runway holds"],
      required_resources: ["negotiation bandwidth"],
      risks: ["offer window closes"],
      success_signals: ["written runway plan holds for 30 days"],
      reconsideration_conditions: [],
    },
    {
      path_id: "path_hold",
      path_role: "alternative",
      title: "Hold and clarify before any leave decision",
      description: "Defer leave talk until salary and equity facts are clarified.",
      prerequisites: ["can delay response"],
      required_resources: ["time window"],
      risks: ["relationship cooling"],
      success_signals: ["key unknowns become confirmed or declined"],
      reconsideration_conditions: [],
    },
  ],
  switching_rules: [
    {
      rule_id: "sw_to_hold",
      source_path_id: "path_staged",
      trigger_condition: "Runway forecast drops below six months",
      action: "switch",
      target_path_id: "path_hold",
      rationale: "Protect the cash floor.",
    },
  ],
};

const page05Paths = {
  preferred_path_ids: ["path_staged"],
  alternative_path_ids: ["path_hold"],
  all_path_ids: ["path_staged", "path_hold"],
};

function validFace06Raw(overrides?: Record<string, unknown>): Record<string, unknown> {
  const base = {
    page: "06",
    face: "06",
    schema_version: "face06-v2",
    locale: "en",
    primary_path_id: "path_staged",
    fallback_path_ids: ["path_hold"],
    first_step: {
      action_id: "act_first",
      path_id: "path_staged",
      what: "Write the runway floor and the questions still open before any leave talk.",
      why_now: "The preferred path only holds while the cash floor is still explicit.",
      required_resources: ["one sitting"],
      expected_observable_result: "A one-page note with the floor and the open questions.",
      claim_ids: ["claim_u_exec_06"],
      evidence_ids: ["u_exec_06"],
      reality_fact_ids: ["fact_runway"],
    },
    execution_actions: [
      {
        action_id: "act_terms",
        path_id: "path_staged",
        sequence: 1,
        action: "List the terms that must be written before any resignation talk.",
        rationale: "Keeps the staged path reversible.",
        resources: ["notes"],
        dependencies: ["act_first"],
        observable_result: "A term list exists and is dated.",
        guardrails: ["Do not resign in the same sitting"],
        claim_ids: ["claim_u_exec_06"],
        evidence_ids: ["u_exec_06"],
        reality_fact_ids: ["fact_runway"],
      },
      {
        action_id: "act_hold_ready",
        path_id: "path_hold",
        sequence: 2,
        action: "Prepare the hold message if the floor cannot be kept.",
        rationale: "Fallback stays available without starting it now.",
        resources: ["draft"],
        dependencies: ["act_terms"],
        observable_result: "A hold draft exists but is not sent.",
        guardrails: ["Send only if the floor breaks"],
        claim_ids: ["claim_u_exec_06"],
        evidence_ids: ["u_exec_06"],
        reality_fact_ids: ["fact_runway"],
      },
    ],
    validation_experiments: [
      {
        experiment_id: "exp_window",
        path_id: "path_staged",
        hypothesis: "A written floor changes whether leave talk stays reversible.",
        action: "Use the note in one conversation and stop there.",
        observe: "Whether the other side accepts a written floor before resignation.",
        window: "One conversation this week",
        success_criteria: "The floor is acknowledged in writing or the talk stops.",
        if_fail: "Switch toward the hold path instead of resigning.",
        defer_costs: "Defer resignation paperwork until the window closes.",
        claim_ids: ["claim_u_exec_06"],
        evidence_ids: ["u_exec_06"],
        reality_fact_ids: ["fact_runway"],
      },
    ],
    experiments_absent_note: "",
    personal_execution_adjustments: [
      {
        adjustment_id: "adj_cash",
        path_id: "path_staged",
        adjustment: "Slow the leave conversation when cash-floor anxiety spikes.",
        supporting_personal_unit_refs: ["p02_u1"],
        supporting_reality_fact_ids: ["fact_runway"],
        claim_ids: ["claim_u_exec_06"],
        evidence_ids: ["u_exec_06"],
      },
    ],
    resource_boundaries: {
      time: "One sitting plus one conversation this week.",
      money: "No new spend beyond current runway.",
      people: "Only the people already in the offer conversation.",
      energy: "Stop when the note is written; do not stack extra meetings.",
      other: [],
      unknown_or_missing: ["Salary figure is still unverified"],
    },
    phase_rhythm: {
      phases: [
        {
          phase_id: "phase_write",
          goal: "Make the floor explicit before any leave talk.",
          enter_triggers: ["Offer is still open"],
          exit_triggers: ["Note exists or the floor cannot be stated"],
        },
      ],
      notes: "Stay inside this window; do not expand scope.",
    },
    monitoring_contract: {
      path_id: "path_staged",
      action_ids: ["act_terms"],
      experiment_ids: ["exp_window"],
      observe_signals: ["Written floor is acknowledged or refused"],
      red_flags: ["Pressure to resign without written terms"],
      review_questions: ["Did the floor stay explicit?"],
      continue_triggers: ["Floor still holds after the conversation"],
      adjust_triggers: ["Anxiety spikes before the note exists"],
      stop_triggers: ["Asked to resign with no written floor"],
      rerun_triggers: ["Runway statement itself changes"],
      resource_guardrails: ["No resignation paperwork inside the window"],
      defer_costs: ["Defer relocation and resignation until the window closes"],
      claim_ids: ["claim_u_exec_06"],
      evidence_ids: ["u_exec_06"],
      reality_fact_ids: ["fact_runway"],
    },
    evidence_boundary: {
      claim_ids: ["claim_u_exec_06"],
      confirmed_fact_ids: ["fact_runway"],
      hypothesis_notes: ["Salary remains an estimate"],
      uncertainty_notes: ["Equity details were declined and stay unknown"],
      experiments_absent_note: "",
    },
    reading_order: [...PAGE06_SECTION_IDS],
  };
  return { ...base, ...(overrides ?? {}) };
}

function baseGenerateInput(page05Schema: unknown = page05) {
  return {
    key: "06" as const,
    locale: "en",
    session_id: "face06_prod_test",
    report_id: "face06_prod_test",
    finalize: {} as never,
    decision_context_snapshot: dc,
    book_judgment_pack: pack,
    chart_fact_pack: "日主甲木…",
    page01_schema: page01,
    page02_schema: page02,
    page04_schema: page04,
    page05_schema: page05Schema,
    dispatch_attempt: 1,
  };
}

function face06IntegrityCtx() {
  const built = buildFace06ProductionContext({
    report_id: "prod06_integrity",
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
  return built.ctx;
}

function rejectIntegrity(
  mutate: (base: Record<string, unknown>) => Record<string, unknown>,
  label: string,
  expectSubstring: string,
) {
  const raw = mutate(structuredClone(validFace06Raw()));
  const ctx = face06IntegrityCtx();
  const viaValidate = validateFace06Output({
    raw,
    locale: "en",
    registry: ctx.registry,
    knownFactIds: ctx.knownFactIds,
    factStatusById: ctx.factStatusById,
    page05Paths: ctx.knownPage05PathIds,
    knownPersonalUnitRefs: ctx.knownPersonalUnitRefs,
  });
  assert.equal(viaValidate.ok, false, `${label}: validateFace06Output must fail`);
  if (viaValidate.ok) throw new Error("unreachable");
  assert.ok(
    viaValidate.issues.some((i) => i.detail.includes(expectSubstring)),
    `${label}: expected ${expectSubstring}; got ${viaValidate.issues.map((i) => i.detail).join(" | ")}`,
  );
  const viaProd = validateFace06ProductionOutput({ raw, locale: "en", ctx });
  assert.equal(viaProd.ok, false, `${label}: production validator`);
  const viaCanonical = validatePage06CanonicalPage(raw, ctx.knownPage05PathIds);
  if (expectSubstring.includes("claim") || expectSubstring.includes("fact") || expectSubstring.includes("personal")) {
    return;
  }
  assert.equal(viaCanonical.ok, false, `${label}: canonical page`);
}

async function buildLabReadyForFace06Body(opts?: {
  includePage05?: boolean;
}): Promise<DeliveryLabSession> {
  process.env.BOOK_JUDGMENT_PACK = "0";
  const includePage05 = opts?.includePage05 !== false;
  const lab = await createDeliveryLab({
    ops_user: "lab_prod_06_wiring",
    source: {
      locale: "en",
      original_question: "Should I leave for the startup offer?",
      desired_outcome: "Preserve runway",
      base_analysis: "{}",
      session_id: `sess_lab06_wire_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
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
  lab.artifacts.by_page["04"] = {
    page_schema: page04 as never,
    page_schema_pre_polish: structuredClone(page04),
  };
  if (includePage05) {
    lab.artifacts.by_page["05"] = {
      page_schema: page05 as never,
      page_schema_pre_polish: structuredClone(page05),
    };
  }
  lab.artifacts.by_page["06"] = lab.artifacts.by_page["06"] ?? {};
  lab.artifacts.prealloc = {
    by_page: {},
    pool_source: "chart_fact_pack",
    chart_fact_pack: "dayMaster:甲\nyongJi:木",
  } as never;
  lab.artifacts.book_judgment_pack = pack;
  const defs = labStepDefsV3();
  const bodyIdx = defs.findIndex((d) => d.step_key === "06.content.body");
  assert.ok(bodyIdx >= 0, "06.content.body exists");
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
  console.log("=== Page06 production closure (stubbed LLM) ===");
  assertPage06InputAssemblyCoverage();
  assert.equal(PAGE06_DOWNSTREAM_CONTRACT.page08.status, "future");

  {
    const built = buildFace06ProductionContext({
      report_id: "prod06_payload",
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
    assert.ok(built.ctx.user.includes("## Production payload"));
    assert.ok(built.ctx.user.includes("path_staged"));
    assert.ok(built.ctx.user.includes("path_hold"));
    assert.ok(built.ctx.user.includes("fact_runway"));
    assert.ok(built.ctx.user.includes("p02_u1"));
    assert.ok(built.ctx.user.includes("claim_u_exec_06"));
    assert.equal(Object.keys(built.ctx.registry.claims).length, 1);
    assert.ok(built.ctx.knownPersonalUnitRefs.has("p02_u1"));
    console.log("PAYLOAD/REGISTRY PASS");
  }

  // A success + persist + reader/pdf
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async (_sys, usr) => {
      invokeCount += 1;
      assert.ok(usr.includes("Production payload"));
      assert.ok(usr.includes("path_staged"));
      assert.ok(usr.includes("claim_u_exec_06"));
      return stubResult(JSON.stringify(validFace06Raw()));
    });
    try {
      const result = await runContentBodyGenerate(baseGenerateInput());
      assert.equal(result.ok, true, result.ok ? "" : result.reason);
      if (!result.ok) throw new Error(result.reason);
      assert.equal(invokeCount, 1);
      assert.equal(result.call_trace.phase, "content_body_v3_face06");
      assert.equal(result.face06_meta?.validation, "passed");
      assert.equal(result.face06_meta?.schema_version, "face06-v2");
      const page = result.page as Face06V2;
      assert.equal(page.schema_version, "face06-v2");
      assert.equal(page.primary_path_id, "path_staged");
      assert.ok(page.generation_metadata?.llm_invoked === true);
      assert.equal("near_step_principle" in page, false);
      for (const f of ["primary_path_id", "monitoring_contract", "evidence_boundary"]) {
        assert.ok(f in page, f);
      }
      assert.ok(PAGE06_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM.includes("action_ids"));
      const lab = await createDeliveryLab({
        ops_user: "lab_prod_06_test",
        source: {
          locale: "en",
          original_question: "Should I leave for the startup offer?",
          desired_outcome: "Preserve runway",
          base_analysis: "{}",
          session_id: `sess_lab06_prod_${Date.now()}`,
        },
      });
      lab.artifacts.by_page["06"] = {
        ...(lab.artifacts.by_page["06"] ?? {
          page_key: "06",
          status: "pending",
          attempts: [],
        }),
        page_schema: page as never,
        page_schema_pre_polish: structuredClone(page) as never,
      };
      await saveDeliveryLab(lab);
      const reloaded = await loadDeliveryLab(lab.lab_id);
      const stored = reloaded!.artifacts.by_page["06"]?.page_schema;
      const validated = validatePage06CanonicalPage(stored, page05Paths);
      assert.equal(validated.ok, true, validated.ok ? "" : validated.detail);
      if (!validated.ok) throw new Error(validated.detail);
      const reader = assemblePage06SectionsForDisplay(validated.page, "en");
      const pdf = assemblePage06PdfArgumentBodies(validated.page, "en");
      assert.equal(reader.length, PAGE06_SECTION_IDS.length);
      assert.equal(pdf.length, PAGE06_SECTION_IDS.length);
      assert.deepEqual(assertFace06PathIntegrity(validated.page, page05Paths), []);
      console.log("A PASS — success path + persist + downstream fields");
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
        const bad = validFace06Raw();
        const step = bad.first_step as Record<string, unknown>;
        return stubResult(
          JSON.stringify(
            validFace06Raw({
              first_step: { ...step, claim_ids: ["claim_fabricated"] },
            }),
          ),
        );
      }
      return stubResult(JSON.stringify(validFace06Raw()));
    });
    try {
      const result = await runContentBodyGenerate(baseGenerateInput());
      assert.equal(result.ok, true, result.ok ? "" : result.reason);
      if (!result.ok) throw new Error(result.reason);
      assert.equal(invokeCount, 2);
      assert.equal(result.face06_meta?.validation, "passed_after_repair");
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
      const bad = validFace06Raw();
      const step = bad.first_step as Record<string, unknown>;
      return stubResult(
        JSON.stringify(
          validFace06Raw({
            first_step: { ...step, claim_ids: ["claim_fabricated"] },
          }),
        ),
      );
    });
    try {
      const result = await runContentBodyGenerate(baseGenerateInput());
      assert.equal(result.ok, false);
      if (result.ok) throw new Error("expected fail");
      assert.equal(invokeCount, 2);
      assert.equal(result.reason, "face06_validation_failed");
      console.log("C PASS — repair once then fail");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // D gate — missing page05
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(JSON.stringify(validFace06Raw()));
    });
    try {
      const blocked = await runContentBodyGenerate(baseGenerateInput(null));
      assert.equal(blocked.ok, false);
      if (blocked.ok) throw new Error("expected block");
      assert.equal(blocked.reason, "face06_blocked_on_required_inputs");
      assert.equal(blocked.tokens_used, 0);
      assert.equal(invokeCount, 0);
      console.log("D PASS — missing page05 blocks before LLM");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // E claim / evidence
  {
    const ctx = face06IntegrityCtx();
    const badClaim = validateFace06Output({
      raw: validFace06Raw({
        first_step: {
          ...(validFace06Raw().first_step as object),
          claim_ids: ["claim_fabricated"],
        },
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      page05Paths: ctx.knownPage05PathIds,
      knownPersonalUnitRefs: ctx.knownPersonalUnitRefs,
    });
    assert.equal(badClaim.ok, false);
    if (!badClaim.ok) {
      assert.ok(badClaim.issues.some((i) => i.code === "unknown_claim_id"));
    }
    const badEv = validateFace06Output({
      raw: validFace06Raw({
        first_step: {
          ...(validFace06Raw().first_step as object),
          evidence_ids: ["ev_missing"],
        },
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      page05Paths: ctx.knownPage05PathIds,
      knownPersonalUnitRefs: ctx.knownPersonalUnitRefs,
    });
    assert.equal(badEv.ok, false);
    if (!badEv.ok) {
      assert.ok(badEv.issues.some((i) => i.code === "unknown_evidence_id"));
    }
    console.log("E PASS — claim/evidence auth");
  }

  // F fact status + score
  {
    const ctx = face06IntegrityCtx();
    const badFact = validateFace06Output({
      raw: validFace06Raw({
        evidence_boundary: {
          ...(validFace06Raw().evidence_boundary as object),
          confirmed_fact_ids: ["fact_salary_guess"],
        },
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      page05Paths: ctx.knownPage05PathIds,
      knownPersonalUnitRefs: ctx.knownPersonalUnitRefs,
    });
    assert.equal(badFact.ok, false);
    if (!badFact.ok) {
      assert.ok(badFact.issues.some((i) => i.code === "confirmed_fact_status_mismatch"));
    }
    const score = validateFace06Output({
      raw: validFace06Raw({
        first_step: {
          ...(validFace06Raw().first_step as object),
          what: "This step has a success rate 80% if you hurry.",
        },
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
      page05Paths: ctx.knownPage05PathIds,
      knownPersonalUnitRefs: ctx.knownPersonalUnitRefs,
    });
    assert.equal(score.ok, false);
    if (!score.ok) {
      assert.ok(score.issues.some((i) => i.code === "invented_score_or_probability"));
    }
    assert.equal(parseFace06JsonStrict("```json\n{}\n```"), null);
    console.log("F PASS — confirmed facts + score ban");
  }

  // G personal adjustments
  {
    rejectIntegrity(
      (raw) => ({
        ...raw,
        personal_execution_adjustments: [
          {
            ...(
              raw.personal_execution_adjustments as Array<Record<string, unknown>>
            )[0],
            supporting_personal_unit_refs: [],
            supporting_reality_fact_ids: [],
          },
        ],
      }),
      "G-empty",
      "supporting_personal_unit_refs",
    );
    rejectIntegrity(
      (raw) => ({
        ...raw,
        personal_execution_adjustments: [
          {
            ...(
              raw.personal_execution_adjustments as Array<Record<string, unknown>>
            )[0],
            supporting_personal_unit_refs: ["no_such_unit"],
            supporting_reality_fact_ids: [],
          },
        ],
      }),
      "G-missing-ref",
      "unknown personal unit ref",
    );
    console.log("G PASS — personal adjustment refs");
  }

  // H–L path integrity
  {
    rejectIntegrity(
      (raw) => ({
        ...raw,
        primary_path_id: "path_hold",
        first_step: {
          ...(raw.first_step as object),
          path_id: "path_hold",
        },
      }),
      "H",
      "primary_path_id not in page05 preferred_path_ids",
    );
    rejectIntegrity(
      (raw) => ({ ...raw, fallback_path_ids: ["path_staged"] }),
      "I",
      "fallback_path_ids not subset of alternative",
    );
    rejectIntegrity(
      (raw) => ({
        ...raw,
        first_step: { ...(raw.first_step as object), path_id: "path_hold" },
      }),
      "J",
      "first_step.path_id must equal primary_path_id",
    );
    rejectIntegrity(
      (raw) => ({
        ...raw,
        execution_actions: (
          raw.execution_actions as Array<Record<string, unknown>>
        ).map((a, i) => (i === 0 ? { ...a, path_id: "path_invented" } : a)),
      }),
      "K-path",
      "not in page05 all_path_ids",
    );
    rejectIntegrity(
      (raw) => ({
        ...raw,
        execution_actions: (
          raw.execution_actions as Array<Record<string, unknown>>
        ).map((a) => ({ ...a, action_id: "act_first" })),
      }),
      "K-dup",
      "duplicate action_id",
    );
    rejectIntegrity(
      (raw) => ({
        ...raw,
        monitoring_contract: {
          ...(raw.monitoring_contract as object),
          action_ids: ["act_missing"],
        },
      }),
      "L-monitor",
      "monitoring action_ids not subset of execution_actions",
    );
    rejectIntegrity(
      (raw) => ({
        ...raw,
        validation_experiments: [],
        experiments_absent_note: "",
        evidence_boundary: {
          ...(raw.evidence_boundary as object),
          experiments_absent_note: "",
        },
        monitoring_contract: {
          ...(raw.monitoring_contract as object),
          experiment_ids: [],
        },
      }),
      "L-absent",
      "experiments empty requires experiments_absent_note",
    );
    console.log("H–L PASS — path integrity");
  }

  // M legacy reader/pdf
  {
    const rawLegacy = {
      page: "06",
      face: "06",
      near_step_principle: "Write the floor before any leave talk.",
      stage_climate: "Verification window before irreversible spend.",
      self_retune: "Slow down when cash anxiety spikes.",
      rhythm_note: "Do not expand scope during the window.",
    };
    assert.equal(isFace06Legacy(rawLegacy), true);
    const projected = projectLegacyFace06ForDisplay(rawLegacy)!;
    assert.equal(projected.schema_version, "face06-v2");
    assert.ok(projected.experiments_absent_note.trim().length > 0);
    const pdf = pageSchemaToArgumentBodies(rawLegacy as never);
    assert.equal(pdf.length, PAGE06_SECTION_IDS.length);
    const ui = readFileSync(
      resolvePath("components/poju/delivery-pages/faces/Face06PageSlots.tsx"),
      "utf8",
    );
    assert.ok(ui.includes("assemblePage06SectionsForDisplay"));
    const slots = readFileSync(
      resolvePath("components/poju/delivery-pages/faces/FacePageSlots.tsx"),
      "utf8",
    );
    assert.ok(slots.includes("Face06PageSlots"));
    console.log("M PASS — legacy projection + reader wiring");
  }

  // N strict parse + canonical happy path
  {
    const ctx = face06IntegrityCtx();
    const okProd = validateFace06ProductionOutput({
      raw: validFace06Raw(),
      locale: "en",
      ctx,
    });
    assert.equal(okProd.ok, true, okProd.ok ? "" : okProd.issues.map((i) => i.detail).join(" | "));
    if (!okProd.ok) throw new Error("unreachable");
    const canon = validatePage06CanonicalPage(okProd.page, page05Paths);
    assert.equal(canon.ok, true, canon.ok ? "" : canon.detail);
    console.log("N PASS — production + canonical validators");
  }

  // O Lab success
  {
    let invokeCount = 0;
    let capturedUser = "";
    setContentBodyTestInvokeForTests(async (_sys, usr) => {
      invokeCount += 1;
      capturedUser = usr;
      return stubResult(JSON.stringify(validFace06Raw()));
    });
    try {
      const lab0 = await buildLabReadyForFace06Body({ includePage05: true });
      const current = await loadDeliveryLab(lab0.lab_id);
      assert.ok(current);
      const run = await runLabStepV3(current!, "06.content.body", {
        polish_locale: "en",
      });
      assert.equal(run.ok, true, run.ok ? "" : run.reason);
      assert.equal(invokeCount, 1);
      assert.ok(capturedUser.includes("## Production payload"));
      assert.ok(capturedUser.includes("path_staged"));
      assert.ok(capturedUser.includes("path_hold"));
      assert.ok(capturedUser.includes("p02_u1"));
      assert.ok(capturedUser.includes("Cash-floor panic under offer pressure."));
      assert.ok(capturedUser.includes("Prefer a staged explore path"));
      const payload = run.attempt?.input_payload as
        | { pipeline?: string; page05_schema_present?: boolean }
        | undefined;
      assert.equal(payload?.pipeline, "face06_v2");
      assert.equal(payload?.page05_schema_present, true);
      const reloaded = await loadDeliveryLab(lab0.lab_id);
      const stored = reloaded!.artifacts.by_page["06"]?.page_schema;
      const meta = (
        reloaded!.artifacts.by_page["06"] as { face06_production_meta?: { validation?: string } }
      ).face06_production_meta;
      assert.equal(meta?.validation, "passed");
      const validated = validatePage06CanonicalPage(stored, page05Paths);
      assert.equal(validated.ok, true, validated.ok ? "" : validated.detail);
      console.log("O PASS — Lab runLabStepV3(06.content.body) wires Page01/02/04/05");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // P Lab missing page05
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(JSON.stringify(validFace06Raw()));
    });
    try {
      const lab0 = await buildLabReadyForFace06Body({ includePage05: false });
      assert.equal(lab0.artifacts.by_page["05"]?.page_schema, undefined);
      const current = await loadDeliveryLab(lab0.lab_id);
      assert.ok(current);
      const run = await runLabStepV3(current!, "06.content.body", {
        polish_locale: "en",
      });
      assert.equal(run.ok, false);
      assert.equal(run.reason, "face06_blocked_on_required_inputs");
      assert.equal(invokeCount, 0);
      assert.equal(run.attempt?.tokens_used ?? 0, 0);
      const reloaded = await loadDeliveryLab(lab0.lab_id);
      const stored = reloaded!.artifacts.by_page["06"]?.page_schema;
      assert.ok(stored == null || (typeof stored === "object" && !("schema_version" in (stored as object))));
      console.log("P PASS — Lab missing Page05 blocks pre-LLM");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  console.log("ok page06 production closure");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
