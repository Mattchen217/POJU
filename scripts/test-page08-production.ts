/**
 * Page08 production closure — stubbed LLM through real runContentBodyGenerate / runLabStepV3.
 * Run: pnpm exec tsx scripts/test-page08-production.ts
 */

import assert from "node:assert/strict";
import {
  runContentBodyGenerate,
  setContentBodyTestInvokeForTests,
} from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import {
  buildFace08ProductionContext,
  validateFace08ProductionOutput,
  parseFace08JsonStrict,
} from "@/lib/llm/pro/delivery/decision-report-v2/page08/production";
import { validateFace08Output } from "@/lib/llm/pro/delivery/decision-report-v2/page08/validate";
import {
  assemblePage08SectionsForDisplay,
  assemblePage08PdfArgumentBodies,
  validatePage08CanonicalPage,
  PAGE08_SECTION_IDS,
  assertPage08InputAssemblyCoverage,
} from "@/lib/llm/pro/delivery/decision-report-v2/page08/architecture";
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
import type { Face08V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import {
  isFace08Legacy,
  projectLegacyFace08ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page08/legacy-adapter";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

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

const dc: DecisionContext = {
  context_id: "dc_prod_08",
  version: 1,
  status: "final",
  content_hash: "hash_prod_08",
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
    {
      fact_id: "fact_unknown_offer",
      statement: "Unknown whether a counter-offer exists.",
      status: "unknown",
      verification_level: "none",
      source_stage: "collecting",
      source_turn_id: "t4",
      user_confirmed: false,
    },
  ],
  dirs: [],
  conflicts: [],
  hypotheses: [],
};

const pack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_prod08",
  zfp_hash: null,
  zfpOmitted: true,
  shot_mode: "one",
  created_at: "2026-01-01T00:00:00Z",
  units: [
    {
      id: "u_mon_08",
      track: "science",
      claim: "Watch the cash floor before widening the explore.",
      anchors: ["runway_buffer"],
      serves_face: ["08"],
      term_ids: [],
      source_domain: "science",
    },
  ],
  by_face: { "08": ["u_mon_08"] },
  pattern_hits_used: [],
  science_tags_used: [],
} as unknown as BookJudgmentPack;

const page01 = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: {
    text: "Prefer a staged explore path that keeps the cash floor intact.",
    claim_ids: ["claim_u_mon_08"],
  },
  why_this_path: [{ text: "Runway buffer supports staged explore.", claim_ids: ["claim_u_mon_08"] }],
  recommendation_conditions: [{ condition: "runway holds", status: "assumed", source_ids: ["fact_runway"] }],
  not_recommended: [
    { option: "Resign cold", reason: "Burns runway", cost_or_conflict: "Irreversible cash shock" },
  ],
  applicability_boundary: {
    current_basis: ["Confirmed runway"],
    invalidation_conditions: ["Runway collapses"],
    page02_evidence_ids: ["u_mon_08"],
    page08_review_refs: [],
  },
};

const page02 = {
  page: "02",
  face: "02",
  schema_version: "face02-v2",
  content_units: [
    {
      unit_id: "p02_fact",
      kind: "reality_fact",
      text: "Runway about 8 months is the stated cash floor.",
      claim_ids: ["claim_u_mon_08"],
      evidence_ids: ["u_mon_08"],
      fact_ids: ["fact_runway"],
    },
  ],
  explanation_boundary: { uncertainty_notes: ["Salary is not confirmed."] },
};

const page04 = {
  page: "04",
  face: "04",
  schema_version: "face04-v2",
  content_units: [
    { unit_id: "p04_cash", kind: "bottleneck", text: "Cash floor is the bottleneck." },
  ],
  evidence_boundary: { uncertainty_notes: ["Equity was declined."] },
};

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
      description: "Explore while keeping runway.",
      risks: ["Runway slips"],
      success_signals: ["A written offer comparison"],
    },
    {
      path_id: "path_hold",
      path_role: "alternative",
      title: "Hold",
      description: "Stay and clarify unknowns.",
    },
  ],
};

const page06 = {
  page: "06",
  face: "06",
  schema_version: "face06-v2",
  primary_path_id: "path_staged",
  first_step: {
    action_id: "act_first",
    what: "Write the comparison",
    path_id: "path_staged",
  },
  execution_actions: [
    { action_id: "act_budget", action: "Set a cash floor check", path_id: "path_staged" },
  ],
  monitoring_contract: {
    path_id: "path_staged",
    action_ids: ["act_first"],
    experiment_ids: [],
    observe_signals: ["Whether the written comparison exists"],
    red_flags: ["Cash floor breached"],
    review_questions: ["Did the comparison stay bounded?"],
    continue_triggers: ["Comparison stays inside the cash floor"],
    adjust_triggers: ["Scope grows past one offer"],
    stop_triggers: ["Runway falls under six months"],
    rerun_triggers: [],
    resource_guardrails: ["Do not resign during the window"],
    defer_costs: ["Waiting without a written comparison"],
    claim_ids: ["claim_u_mon_08"],
    evidence_ids: ["u_mon_08"],
    reality_fact_ids: ["fact_runway"],
  },
};

function page07(status: "applicable" | "not_applicable" | "insufficient_information") {
  return {
    page: "07",
    face: "07",
    schema_version: "face07-v2",
    applicability_status: status,
    applicability_reason:
      status === "applicable"
        ? "A named team budget is already stated."
        : status === "not_applicable"
          ? "No field or relationship is in scope."
          : "Field words appear without a linked fact.",
    participants:
      status === "applicable"
        ? [{ participant_id: "self", display_label: "用户", role: "self" }]
        : [],
    field_units:
      status === "applicable"
        ? [{ unit_id: "f_budget", kind: "field_constraint", text: "UNIQUE_FIELD_TEAM_BUDGET_CAP" }]
        : [],
    relationship_units: [],
    alignment_with_main: {
      changes_page01_recommendation: false,
      changes_page05_path_order: false,
      effect_on_page06_execution:
        status === "applicable" ? "Keep the first step inside the stated budget." : "none",
      summary: status,
      claim_ids: [],
      evidence_ids: [],
      related_page05_path_ids: status === "applicable" ? ["path_staged"] : [],
      related_page06_action_ids: status === "applicable" ? ["act_first"] : [],
    },
    evidence_boundary: {
      claim_ids: [],
      confirmed_fact_ids: status === "applicable" ? ["fact_runway"] : [],
      uncertainty_notes: [],
    },
  };
}

function validFace08(patch?: (base: Record<string, unknown>) => Record<string, unknown>) {
  const base: Record<string, unknown> = {
    page: "08",
    face: "08",
    schema_version: "face08-v2",
    risks: [
      {
        risk_id: "risk_runway",
        risk_title: "Runway can slip during the explore window",
        risk_description:
          "The confirmed runway fact is the cash floor. The salary figure stays unverified.",
        risk_category: "resource_risk",
        current_status: "active",
        related_path_ids: ["path_staged"],
        related_action_ids: ["act_first"],
        reality_fact_ids: ["fact_runway"],
        reality_fact_stances: [
          { fact_id: "fact_runway", stance: "as_confirmed" },
        ],
        claim_ids: ["claim_u_mon_08"],
        evidence_ids: ["u_mon_08"],
      },
    ],
    observation_signals: [
      {
        signal_id: "sig_compare",
        related_risk_ids: ["risk_runway"],
        signal_name: "Written comparison exists",
        what_to_observe: "Whether the written offer comparison exists without a resignation.",
        observation_source: "Page06 monitoring contract",
        observation_method: "Check the written comparison against the cash floor.",
        observation_window: "The current explore window",
        baseline_status: "needs_baseline",
        threshold_status: "defined",
        related_fact_ids: ["fact_runway"],
        reality_fact_stances: [
          { fact_id: "fact_runway", stance: "as_confirmed" },
        ],
      },
    ],
    triggers: [
      {
        trigger_id: "trg_stop_cash",
        related_risk_ids: ["risk_runway"],
        related_signal_ids: ["sig_compare"],
        trigger_condition: "Stop if the cash floor is breached before the comparison is written.",
        trigger_status: "defined",
        decision_response: "pause",
        required_evidence_ids: ["u_mon_08"],
        related_path_ids: ["path_staged"],
        related_action_ids: ["act_first"],
        related_fact_ids: ["fact_runway"],
        reality_fact_stances: [
          { fact_id: "fact_runway", stance: "as_confirmed" },
        ],
      },
    ],
    reassessment_conditions: [
      {
        reassessment_id: "re_runway",
        condition: "Reassess if the confirmed runway statement itself changes.",
        change_type: "fact_change",
        related_fact_ids: ["fact_runway"],
        reality_fact_stances: [
          { fact_id: "fact_runway", stance: "as_confirmed" },
        ],
        related_claim_ids: ["claim_u_mon_08"],
        affected_path_ids: ["path_staged"],
        expected_review_scope: "Review the existing staged path only.",
      },
    ],
    evidence_boundary: {
      confirmed_fact_ids: ["fact_runway"],
      unverified_fact_ids: ["fact_salary_guess"],
      related_claim_ids: ["claim_u_mon_08"],
      related_evidence_ids: ["u_mon_08"],
      unresolved_questions: ["Salary remains unverified."],
      monitoring_limitations: ["This page does not rewrite the main recommendation."],
      reassessment_limitations: ["Reassessment does not invent a new path."],
    },
  };
  return patch ? patch(structuredClone(base)) : base;
}

function emptyMonitoringFace08() {
  return validFace08((base) => {
    base.risks = [];
    base.observation_signals = [];
    base.triggers = [];
    base.reassessment_conditions = [];
    base.evidence_boundary = {
      confirmed_fact_ids: [],
      unverified_fact_ids: ["fact_salary_guess"],
      related_claim_ids: ["claim_u_mon_08"],
      related_evidence_ids: ["u_mon_08"],
      unresolved_questions: [
        "No grounded monitoring trigger can be stated from the current facts alone.",
      ],
      monitoring_limitations: [
        "Insufficient confirmed basis to emit risks, observation signals, or triggers.",
      ],
      reassessment_limitations: ["No reassessment rule was grounded in confirmed facts."],
    };
    return base;
  });
}

function checkFace08(
  raw: unknown,
  ctx: ReturnType<typeof ctxOf>,
) {
  return validateFace08Output({
    raw,
    locale: "en",
    registry: ctx.registry,
    knownFactIds: ctx.knownFactIds,
    factStatusById: ctx.factStatusById,
    factVerificationLevelById: ctx.factVerificationLevelById,
    upstream: ctx.upstream,
    dateCorpus: ctx.dateCorpus,
  });
}

function ctxOf(page07Schema: unknown = page07("applicable")) {
  const built = buildFace08ProductionContext({
    report_id: "prod08",
    locale: "en",
    dc,
    pack,
    page01,
    page02,
    page04,
    page05,
    page06,
    page07: page07Schema,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  return built.ctx;
}

function generateInput(extra?: {
  page05?: unknown;
  page06?: unknown;
  page07?: unknown;
}) {
  return {
    key: "08" as const,
    locale: "en",
    session_id: "face08_prod_test",
    report_id: "face08_prod_test",
    finalize: {} as never,
    decision_context_snapshot: dc,
    book_judgment_pack: pack,
    chart_fact_pack: "dayMaster note",
    page01_schema: page01,
    page02_schema: page02,
    page04_schema: page04,
    page05_schema: extra && "page05" in extra ? extra.page05 : page05,
    page06_schema: extra && "page06" in extra ? extra.page06 : page06,
    page07_schema: extra && "page07" in extra ? extra.page07 : page07("applicable"),
    dispatch_attempt: 1,
  };
}

async function buildLab(opts?: { includePage06?: boolean }): Promise<DeliveryLabSession> {
  process.env.BOOK_JUDGMENT_PACK = "0";
  const lab = await createDeliveryLab({
    ops_user: "lab_prod_08_wiring",
    source: {
      locale: "en",
      original_question: "Should I leave for the startup offer?",
      desired_outcome: "Preserve runway",
      base_analysis: "{}",
      session_id: `sess_lab08_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
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
    ["07", page07("applicable")],
  ] as const) {
    lab.artifacts.by_page[id] = {
      page_schema: schema as never,
      page_schema_pre_polish: structuredClone(schema),
    };
  }
  if (opts?.includePage06 !== false) {
    lab.artifacts.by_page["06"] = {
      page_schema: page06 as never,
      page_schema_pre_polish: structuredClone(page06),
    };
  }
  lab.artifacts.by_page["08"] = lab.artifacts.by_page["08"] ?? {};
  lab.artifacts.prealloc = {
    by_page: {},
    pool_source: "chart_fact_pack",
    chart_fact_pack: "dayMaster:甲",
  } as never;
  lab.artifacts.book_judgment_pack = pack;
  const defs = labStepDefsV3();
  const bodyIdx = defs.findIndex((d) => d.step_key === "08.content.body");
  assert.ok(bodyIdx >= 0, "08.content.body exists");
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
  console.log("=== Page08 production closure (stubbed LLM) ===");
  assertPage08InputAssemblyCoverage();
  assert.equal(parseFace08JsonStrict("```json\n{}\n```"), null);
  assert.equal(parseFace08JsonStrict("{"), null);

  const ready = ctxOf();
  assert.ok(ready.user.includes("## Production payload"));
  assert.ok(ready.user.includes("fact_runway"));
  assert.ok(ready.user.includes("claim_u_mon_08"));
  assert.equal(ready.production_payload.page06.has_monitoring_contract, true);
  assert.equal(Object.keys(ready.registry.claims).length, 1);

  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async (_sys, usr) => {
      invokeCount += 1;
      assert.ok(usr.includes("Production payload"));
      assert.ok(usr.includes("claim_u_mon_08"));
      assert.ok(usr.includes("UNIQUE_FIELD_TEAM_BUDGET_CAP"));
      return stubResult(JSON.stringify(validFace08()));
    });
    try {
      const result = await runContentBodyGenerate(generateInput());
      assert.equal(result.ok, true, result.ok ? "" : result.reason);
      if (!result.ok) throw new Error(result.reason);
      assert.equal(invokeCount, 1);
      assert.equal(result.call_trace.phase, "content_body_v3_face08");
      assert.equal(result.face08_meta?.validation, "passed");
      assert.equal(result.face08_meta?.schema_version, "face08-v2");
      const page = result.page as Face08V2;
      assert.equal(page.schema_version, "face08-v2");
      assert.equal(page.generation_metadata?.llm_invoked, true);
      assert.equal(page.risks[0]?.risk_id, "risk_runway");
      assert.equal(page.triggers[0]?.decision_response, "pause");
      assert.equal(page.reading_order?.length, PAGE08_SECTION_IDS.length);
      const sections = assemblePage08SectionsForDisplay(page, "en");
      assert.equal(sections.length, 5);
      assert.equal(assemblePage08PdfArgumentBodies(page, "en").length, 5);
      const canon = validatePage08CanonicalPage(page, ready.upstream);
      assert.equal(canon.ok, true, canon.ok ? "" : canon.detail);
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("A ok — success path persists monitoring review");
  }

  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      if (invokeCount === 1) {
        return stubResult(JSON.stringify(validFace08((base) => {
          const risks = base.risks as Array<Record<string, unknown>>;
          risks[0]!.claim_ids = ["claim_missing"];
          return base;
        })));
      }
      return stubResult(JSON.stringify(validFace08()));
    });
    try {
      const result = await runContentBodyGenerate(generateInput());
      assert.equal(result.ok, true, result.ok ? "" : result.reason);
      if (!result.ok) throw new Error(result.reason);
      assert.equal(invokeCount, 2);
      assert.equal(result.face08_meta?.validation, "passed_after_repair");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("B ok — repair once then success");
  }

  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(JSON.stringify(validFace08((base) => {
        const risks = base.risks as Array<Record<string, unknown>>;
        risks[0]!.claim_ids = ["claim_missing"];
        return base;
      })));
    });
    try {
      const result = await runContentBodyGenerate(generateInput());
      assert.equal(result.ok, false);
      if (result.ok) throw new Error("expected fail");
      assert.equal(result.reason, "face08_validation_failed");
      assert.equal(invokeCount, 2);
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("C ok — repair once then fail");
  }

  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(JSON.stringify(validFace08()));
    });
    try {
      const result = await runContentBodyGenerate(generateInput({ page05: null }));
      assert.equal(result.ok, false);
      if (result.ok) throw new Error("expected block");
      assert.equal(result.reason, "face08_blocked_on_required_inputs");
      assert.equal(invokeCount, 0);
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("D ok — missing Page05 blocks before LLM");
  }

  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(JSON.stringify(validFace08()));
    });
    try {
      const bare06 = { ...page06, monitoring_contract: undefined };
      const result = await runContentBodyGenerate(generateInput({ page06: bare06 }));
      assert.equal(result.ok, false);
      if (result.ok) throw new Error("expected block");
      assert.equal(result.reason, "face08_blocked_on_required_inputs");
      assert.equal(invokeCount, 0);
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("E ok — missing monitoring_contract blocks before LLM");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.claim_ids = ["claim_not_in_registry"];
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected claim fail");
    assert.ok(checked.issues.some((i) => i.code === "unknown_claim_id"));
    console.log("F ok — unknown claim rejected");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.evidence_ids = ["ev_not_seeded"];
      return base;
    });
    const checked = validateFace08ProductionOutput({ raw: bad, locale: "en", ctx: ready });
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected evidence fail");
    assert.ok(checked.issues.some((i) => i.detail.includes("unknown evidence_id")));
    console.log("G ok — unknown evidence rejected");
  }

  {
    const bad = validFace08((base) => {
      const boundary = base.evidence_boundary as Record<string, unknown>;
      boundary.confirmed_fact_ids = ["fact_salary_guess"];
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected confirmed fail");
    assert.ok(checked.issues.some((i) => i.detail.includes("non-confirmed")));
    console.log("H ok — confirmed_fact_ids reject unverified facts");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.risk_description = "成功概率 80% if you resign this week.";
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected score fail");
    assert.ok(checked.issues.some((i) => i.code === "invented_score_or_probability"));
    console.log("I ok — scores and probabilities banned");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks.push(structuredClone(risks[0]));
      return base;
    });
    const canon = validatePage08CanonicalPage(bad, ready.upstream);
    assert.equal(canon.ok, false);
    if (canon.ok) throw new Error("expected duplicate");
    assert.match(canon.detail, /duplicate risk_id/);
    console.log("J ok — duplicate risk ids rejected");
  }

  {
    const bad = validFace08((base) => {
      const signals = base.observation_signals as Array<Record<string, unknown>>;
      signals[0]!.related_risk_ids = ["risk_missing"];
      return base;
    });
    const canon = validatePage08CanonicalPage(bad, ready.upstream);
    assert.equal(canon.ok, false);
    if (canon.ok) throw new Error("expected signal");
    assert.match(canon.detail, /signal cites unknown risk/);
    console.log("K ok — signal must cite a real risk");
  }

  {
    const bad = validFace08((base) => {
      const triggers = base.triggers as Array<Record<string, unknown>>;
      triggers[0]!.related_signal_ids = ["sig_missing"];
      return base;
    });
    const canon = validatePage08CanonicalPage(bad, ready.upstream);
    assert.equal(canon.ok, false);
    if (canon.ok) throw new Error("expected trigger");
    assert.match(canon.detail, /trigger cites unknown signal/);
    console.log("L ok — trigger must cite a real signal");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.related_path_ids = ["path_invented"];
      return base;
    });
    const canon = validatePage08CanonicalPage(bad, ready.upstream);
    assert.equal(canon.ok, false);
    if (canon.ok) throw new Error("expected path");
    assert.match(canon.detail, /path not in page05/);
    console.log("M ok — path must belong to Page05");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.related_action_ids = ["act_invented"];
      return base;
    });
    const canon = validatePage08CanonicalPage(bad, ready.upstream);
    assert.equal(canon.ok, false);
    if (canon.ok) throw new Error("expected action");
    assert.match(canon.detail, /action not in page06/);
    console.log("N ok — action must belong to Page06");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.claim_ids = ["legacy_claim_08"];
      return base;
    });
    const checked = validateFace08ProductionOutput({ raw: bad, locale: "en", ctx: ready });
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected legacy");
    assert.ok(checked.issues.some((i) => i.code === "legacy_id_forbidden"));
    console.log("O ok — legacy_ ids banned");
  }

  {
    const built = buildFace08ProductionContext({
      report_id: "p07na",
      locale: "en",
      dc,
      pack,
      page01,
      page02,
      page04,
      page05,
      page06,
      page07: page07("not_applicable"),
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error(built.reason);
    assert.equal(built.ctx.may_invoke_llm, true);
    assert.equal(built.ctx.production_payload.page07.presence, "not_applicable");
    assert.equal(built.ctx.production_payload.page07.applicability_status, "not_applicable");
    assert.equal(built.ctx.production_payload.page07.field_units.length, 0);
    assert.equal(built.ctx.user.includes("UNIQUE_FIELD_TEAM_BUDGET_CAP"), false);
    console.log("P ok — Page07 not_applicable is not rewritten");
  }

  {
    const built = buildFace08ProductionContext({
      report_id: "p07thin",
      locale: "en",
      dc,
      pack,
      page01,
      page02,
      page04,
      page05,
      page06,
      page07: page07("insufficient_information"),
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error(built.reason);
    assert.equal(built.ctx.production_payload.page07.applicability_status, "insufficient_information");
    assert.notEqual(built.ctx.production_payload.page07.applicability_status, "applicable");
    assert.ok(
      built.ctx.architecture.missing_inputs.some((g) => g.gap_id === "gap_page07_insufficient_information"),
    );
    console.log("Q ok — Page07 insufficient_information is a gap");
  }

  {
    const built = ctxOf(page07("applicable"));
    assert.equal(built.production_payload.page07.presence, "applicable");
    const units = built.production_payload.page07.field_units as Array<{ text?: string }>;
    assert.equal(units[0]?.text, "UNIQUE_FIELD_TEAM_BUDGET_CAP");
    assert.deepEqual(built.production_payload.page07.related_page05_path_ids, ["path_staged"]);
    assert.deepEqual(built.production_payload.page07.related_page06_action_ids, ["act_first"]);
    console.log("R ok — applicable Page07 uses stored data");
  }

  {
    const built = buildFace08ProductionContext({
      report_id: "p07miss",
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
    assert.equal(built.ctx.may_invoke_llm, true);
    assert.equal(built.ctx.production_payload.page07.presence, "missing");
    assert.ok(
      built.ctx.architecture.missing_inputs.some(
        (g) => g.field_id === "page07_field_payload" && g.status === "missing",
      ),
    );
    console.log("S ok — missing Page07 is a gap and does not block");
  }

  {
    const payload = JSON.stringify(ready.production_payload.reality.all_facts);
    assert.match(payload, /"fact_id":"fact_salary_guess"/);
    assert.match(payload, /"status":"unverified"/);
    assert.match(payload, /"fact_id":"fact_runway"/);
    assert.match(payload, /"status":"confirmed"/);
    assert.match(payload, /"fact_id":"fact_declined"/);
    assert.match(payload, /"status":"declined"/);
    assert.ok(ready.user.includes("Maybe cash is 120k."));
    console.log("T ok — fact status preserved in the payload");
  }

  {
    const legacy = {
      page: "08",
      face: "08",
      page_title: "自检",
      red_lights: ["Irreversible spend before the window ends"],
      review_questions: ["Did the cash floor hold?"],
      when_to_rerun: "When the runway fact itself changes",
      review_decision: "rerun",
      shared_core_metrics: ["Written comparison exists"],
    };
    assert.equal(isFace08Legacy(legacy), true);
    const projected = projectLegacyFace08ForDisplay(legacy);
    assert.ok(projected);
    assert.equal(projected?.schema_version, "face08-v2");
    assert.equal(projected?.triggers[0]?.decision_response, "reassess");
    const pdf = pageSchemaToArgumentBodies(legacy as never);
    assert.equal(pdf.length, PAGE08_SECTION_IDS.length);
    const ui = readFileSync(
      resolvePath("components/poju/delivery-pages/faces/Face08PageSlots.tsx"),
      "utf8",
    );
    assert.ok(ui.includes("assemblePage08SectionsForDisplay"));
    const slots = readFileSync(
      resolvePath("components/poju/delivery-pages/faces/FacePageSlots.tsx"),
      "utf8",
    );
    assert.ok(slots.includes("Face08PageSlots"));
    console.log("U ok — legacy projection and reader wiring");
  }

  {
    let invokeCount = 0;
    let capturedUser = "";
    setContentBodyTestInvokeForTests(async (_sys, usr) => {
      invokeCount += 1;
      capturedUser = usr;
      return stubResult(JSON.stringify(validFace08()));
    });
    try {
      const lab0 = await buildLab({ includePage06: true });
      const current = await loadDeliveryLab(lab0.lab_id);
      assert.ok(current);
      const run = await runLabStepV3(current!, "08.content.body", { polish_locale: "en" });
      assert.equal(run.ok, true, run.ok ? "" : run.reason);
      assert.equal(invokeCount, 1);
      assert.ok(capturedUser.includes("UNIQUE_FIELD_TEAM_BUDGET_CAP"));
      assert.ok(capturedUser.includes("Whether the written comparison exists"));
      assert.ok(capturedUser.includes("fact_salary_guess"));
      assert.ok(capturedUser.includes("unverified"));
      const payload = run.attempt?.input_payload as
        | { pipeline?: string; page07_schema_present?: boolean; face08_meta?: { validation?: string } }
        | undefined;
      assert.equal(payload?.pipeline, "face08_v2");
      assert.equal(payload?.page07_schema_present, true);
      const reloaded = await loadDeliveryLab(lab0.lab_id);
      const meta = (
        reloaded!.artifacts.by_page["08"] as { face08_production_meta?: { validation?: string } }
      ).face08_production_meta;
      assert.equal(meta?.validation, "passed");
      const stored = reloaded!.artifacts.by_page["08"]?.page_schema;
      const canon = validatePage08CanonicalPage(stored, ready.upstream);
      assert.equal(canon.ok, true, canon.ok ? "" : canon.detail);
    } finally {
      setContentBodyTestInvokeForTests(null);
    }

    invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(JSON.stringify(validFace08()));
    });
    try {
      const lab1 = await buildLab({ includePage06: false });
      const current = await loadDeliveryLab(lab1.lab_id);
      assert.ok(current);
      const run = await runLabStepV3(current!, "08.content.body", { polish_locale: "en" });
      assert.equal(run.ok, false);
      if (run.ok) throw new Error("expected block");
      assert.equal(run.reason, "face08_blocked_on_required_inputs");
      assert.equal(invokeCount, 0);
      assert.equal(run.attempt?.tokens_used ?? 0, 0);
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("V ok — Lab wires Page01-07 and blocks when Page06 is missing");
  }

  // ── R1: empty monitoring + structured fact stances ──
  {
    const empty = emptyMonitoringFace08();
    const checked = checkFace08(empty, ready);
    assert.equal(checked.ok, true, checked.ok ? "" : checked.issues.map((i) => i.detail).join(" | "));
    if (!checked.ok) throw new Error("empty monitoring should pass");
    assert.equal(checked.page.risks.length, 0);
    assert.equal(checked.page.observation_signals.length, 0);
    assert.equal(checked.page.triggers.length, 0);
    const sections = assemblePage08SectionsForDisplay(checked.page, "en");
    assert.equal(sections.length, 5);
    assert.equal(sections[0]!.texts.length, 0);
    assert.equal(sections[1]!.texts.length, 0);
    assert.equal(sections[2]!.texts.length, 0);
    const pdf = assemblePage08PdfArgumentBodies(checked.page, "en");
    assert.equal(pdf.length, 5);
    assert.ok(pdf[0]!.body.includes(sections[0]!.empty_display));
    assert.ok(!pdf[0]!.body.includes("risk_runway"));
    console.log("R1-A ok — empty risks/signals/triggers allowed; Reader/PDF do not invent items");
  }

  {
    const bad = validFace08((base) => {
      base.observation_signals = [];
      return base;
    });
    const canon = validatePage08CanonicalPage(bad, ready.upstream);
    assert.equal(canon.ok, false);
    if (canon.ok) throw new Error("expected dangling trigger");
    assert.match(canon.detail, /trigger cites unknown signal/);
    console.log("R1-B ok — trigger without signals is rejected");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.reality_fact_ids = ["fact_salary_guess"];
      risks[0]!.reality_fact_stances = [
        { fact_id: "fact_salary_guess", stance: "as_confirmed" },
      ];
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected unverified→confirmed reject");
    assert.ok(
      checked.issues.some(
        (i) =>
          i.code === "fact_stance_status_mismatch" ||
          i.detail.includes("as_confirmed"),
      ),
    );
    console.log("R1-C ok — unverified fact declared as_confirmed is rejected");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.reality_fact_ids = ["fact_salary_guess"];
      risks[0]!.reality_fact_stances = [
        { fact_id: "fact_salary_guess", stance: "as_independently_verified" },
      ];
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected estimate upgrade reject");
    assert.ok(
      checked.issues.some(
        (i) =>
          i.code === "fact_verification_upgrade" ||
          i.code === "fact_stance_status_mismatch",
      ),
    );
    console.log("R1-D ok — user_estimate declared as_independently_verified is rejected");
  }

  {
    const bad = validFace08((base) => {
      const boundary = base.evidence_boundary as Record<string, unknown>;
      boundary.confirmed_fact_ids = ["fact_declined"];
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected declined in confirmed reject");
    assert.ok(checked.issues.some((i) => i.code === "confirmed_fact_not_confirmed"));
    console.log("R1-E ok — declined fact in confirmed_fact_ids is rejected");
  }

  {
    const bad = validFace08((base) => {
      const triggers = base.triggers as Array<Record<string, unknown>>;
      triggers[0]!.related_fact_ids = ["fact_salary_guess"];
      triggers[0]!.reality_fact_stances = [
        { fact_id: "fact_salary_guess", stance: "as_confirmed" },
      ];
      triggers[0]!.trigger_status = "defined";
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected trigger unverified reject");
    assert.ok(
      checked.issues.some(
        (i) =>
          i.code === "fact_stance_status_mismatch" ||
          i.code === "trigger_non_confirmed_requires_conditional" ||
          i.code === "trigger_fact_stance_required",
      ),
    );
    console.log("R1-F ok — trigger citing unverified without conditional stance is rejected");
  }

  {
    const okCase = validFace08((base) => {
      const triggers = base.triggers as Array<Record<string, unknown>>;
      triggers[0]!.related_fact_ids = ["fact_salary_guess"];
      triggers[0]!.reality_fact_stances = [
        { fact_id: "fact_salary_guess", stance: "as_conditional" },
      ];
      triggers[0]!.trigger_status = "conditional";
      triggers[0]!.trigger_condition =
        "If the salary estimate later confirms below the cash floor, pause the explore.";
      triggers[0]!.required_evidence_ids = [];
      return base;
    });
    const checked = checkFace08(okCase, ready);
    assert.equal(
      checked.ok,
      true,
      checked.ok ? "" : checked.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
    );
    console.log("R1-G ok — conditional trigger citing unverified fact is allowed");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.reality_fact_ids = [];
      risks[0]!.reality_fact_stances = [
        { fact_id: "fact_runway", stance: "as_confirmed" },
      ];
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected orphan confirmed stance reject");
    assert.ok(
      checked.issues.some(
        (i) =>
          i.code === "gate_face_zod_fail" ||
          i.detail.includes("orphan_reality_fact_stance"),
      ),
    );
    console.log("R1-H ok — as_confirmed stance without matching fact id list is rejected");
  }

  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      if (invokeCount === 1) {
        return stubResult(
          JSON.stringify(
            validFace08((base) => {
              const risks = base.risks as Array<Record<string, unknown>>;
              risks[0]!.reality_fact_ids = ["fact_salary_guess"];
              risks[0]!.reality_fact_stances = [
                { fact_id: "fact_salary_guess", stance: "as_confirmed" },
              ];
              return base;
            }),
          ),
        );
      }
      return stubResult(JSON.stringify(validFace08()));
    });
    try {
      const result = await runContentBodyGenerate(generateInput());
      assert.equal(result.ok, true, result.ok ? "" : result.reason);
      if (!result.ok) throw new Error(result.reason);
      assert.equal(invokeCount, 2);
      assert.equal(result.face08_meta?.validation, "passed_after_repair");
      const page = result.page as Face08V2;
      assert.equal(page.risks[0]?.reality_fact_stances?.[0]?.stance, "as_confirmed");
      assert.equal(page.risks[0]?.reality_fact_ids?.[0], "fact_runway");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("R1-I ok — repair success re-runs full stance/reference validation");
  }

  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(
        JSON.stringify(
          validFace08((base) => {
            const risks = base.risks as Array<Record<string, unknown>>;
            risks[0]!.reality_fact_ids = ["fact_salary_guess"];
            risks[0]!.reality_fact_stances = [
              { fact_id: "fact_salary_guess", stance: "as_confirmed" },
            ];
            return base;
          }),
        ),
      );
    });
    try {
      const result = await runContentBodyGenerate(generateInput());
      assert.equal(result.ok, false);
      if (result.ok) throw new Error("expected repair fail");
      assert.equal(result.reason, "face08_validation_failed");
      assert.equal(invokeCount, 2);
      assert.equal(
        (result as { page?: unknown }).page,
        undefined,
      );
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("R1-J ok — repair second failure does not save a success page");
  }

  // ── R2: explicit confirmation prose vs non-confirmed cites ──
  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.reality_fact_ids = ["fact_salary_guess"];
      risks[0]!.reality_fact_stances = [
        { fact_id: "fact_salary_guess", stance: "as_unverified" },
      ];
      risks[0]!.risk_description = "已确认你的收入低于当前生活成本。";
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected R2-A reject");
    assert.ok(
      checked.issues.some(
        (i) => i.code === "explicit_confirmation_on_non_confirmed_fact",
      ),
    );
    console.log("R2-A ok — unverified + as_unverified + 已确认 prose rejected");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.reality_fact_ids = ["fact_salary_guess"];
      risks[0]!.reality_fact_stances = [
        { fact_id: "fact_salary_guess", stance: "as_estimated" },
      ];
      risks[0]!.risk_description = "已经证实现金只有十二万，不足以支撑探索窗口。";
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected R2-B reject");
    assert.ok(
      checked.issues.some(
        (i) => i.code === "explicit_confirmation_on_non_confirmed_fact",
      ),
    );
    console.log("R2-B ok — user_estimate + as_estimated + 已经证实 prose rejected");
  }

  {
    const bad = validFace08((base) => {
      const signals = base.observation_signals as Array<Record<string, unknown>>;
      signals[0]!.related_fact_ids = ["fact_unknown_offer"];
      signals[0]!.reality_fact_stances = [
        { fact_id: "fact_unknown_offer", stance: "as_unknown" },
      ];
      signals[0]!.what_to_observe =
        "Treat the counter-offer as a confirmed fact before widening the explore.";
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected R2-C reject");
    assert.ok(
      checked.issues.some(
        (i) => i.code === "explicit_confirmation_on_non_confirmed_fact",
      ),
    );
    console.log("R2-C ok — unknown + as_unknown + confirmed fact prose rejected");
  }

  {
    const okCase = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.reality_fact_ids = ["fact_runway"];
      risks[0]!.reality_fact_stances = [
        { fact_id: "fact_runway", stance: "as_confirmed" },
      ];
      risks[0]!.risk_description =
        "已确认 runway 约八个月，这是当前探索窗口的现金底线。";
      return base;
    });
    const checked = checkFace08(okCase, ready);
    assert.equal(
      checked.ok,
      true,
      checked.ok ? "" : checked.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
    );
    console.log("R2-D ok — confirmed + as_confirmed + 已确认 prose allowed");
  }

  {
    const okCase = validFace08((base) => {
      const triggers = base.triggers as Array<Record<string, unknown>>;
      triggers[0]!.related_fact_ids = ["fact_salary_guess"];
      triggers[0]!.reality_fact_stances = [
        { fact_id: "fact_salary_guess", stance: "as_conditional" },
      ];
      triggers[0]!.trigger_status = "conditional";
      triggers[0]!.trigger_condition =
        "如果后续核实薪资估计低于现金底线，则暂停探索。";
      triggers[0]!.required_evidence_ids = [];
      return base;
    });
    const checked = checkFace08(okCase, ready);
    assert.equal(
      checked.ok,
      true,
      checked.ok ? "" : checked.issues.map((i) => `${i.code}:${i.detail}`).join(" | "),
    );
    console.log("R2-E ok — unverified + as_conditional + 如果后续核实 allowed");
  }

  {
    const bad = validFace08((base) => {
      const risks = base.risks as Array<Record<string, unknown>>;
      risks[0]!.reality_fact_ids = ["fact_runway", "fact_salary_guess"];
      risks[0]!.reality_fact_stances = [
        { fact_id: "fact_runway", stance: "as_confirmed" },
        { fact_id: "fact_salary_guess", stance: "as_estimated" },
      ];
      risks[0]!.risk_description =
        "已确认 runway 与薪资都支持继续探索，不必再核实。";
      return base;
    });
    const checked = checkFace08(bad, ready);
    assert.equal(checked.ok, false);
    if (checked.ok) throw new Error("expected R2-F conservative reject");
    assert.ok(
      checked.issues.some(
        (i) => i.code === "explicit_confirmation_on_non_confirmed_fact",
      ),
    );
    console.log("R2-F ok — mixed confirmed+unverified with 已确认 prose conservatively rejected");
  }

  {
    // R1 stance suite still green (spot-check the six classes via re-run of key cases).
    const stanceCases: Array<{
      label: string;
      patch: (base: Record<string, unknown>) => Record<string, unknown>;
      expectOk: boolean;
    }> = [
      {
        label: "unverified→as_confirmed",
        expectOk: false,
        patch: (base) => {
          const risks = base.risks as Array<Record<string, unknown>>;
          risks[0]!.reality_fact_ids = ["fact_salary_guess"];
          risks[0]!.reality_fact_stances = [
            { fact_id: "fact_salary_guess", stance: "as_confirmed" },
          ];
          return base;
        },
      },
      {
        label: "estimate→independently_verified",
        expectOk: false,
        patch: (base) => {
          const risks = base.risks as Array<Record<string, unknown>>;
          risks[0]!.reality_fact_ids = ["fact_salary_guess"];
          risks[0]!.reality_fact_stances = [
            { fact_id: "fact_salary_guess", stance: "as_independently_verified" },
          ];
          return base;
        },
      },
      {
        label: "declined in confirmed_fact_ids",
        expectOk: false,
        patch: (base) => {
          const boundary = base.evidence_boundary as Record<string, unknown>;
          boundary.confirmed_fact_ids = ["fact_declined"];
          return base;
        },
      },
      {
        label: "trigger unverified without conditional",
        expectOk: false,
        patch: (base) => {
          const triggers = base.triggers as Array<Record<string, unknown>>;
          triggers[0]!.related_fact_ids = ["fact_salary_guess"];
          triggers[0]!.reality_fact_stances = [
            { fact_id: "fact_salary_guess", stance: "as_confirmed" },
          ];
          triggers[0]!.trigger_status = "defined";
          return base;
        },
      },
      {
        label: "conditional trigger ok",
        expectOk: true,
        patch: (base) => {
          const triggers = base.triggers as Array<Record<string, unknown>>;
          triggers[0]!.related_fact_ids = ["fact_salary_guess"];
          triggers[0]!.reality_fact_stances = [
            { fact_id: "fact_salary_guess", stance: "as_conditional" },
          ];
          triggers[0]!.trigger_status = "conditional";
          triggers[0]!.trigger_condition =
            "如果后续核实薪资估计，再决定是否暂停。";
          triggers[0]!.required_evidence_ids = [];
          return base;
        },
      },
      {
        label: "orphan as_confirmed stance",
        expectOk: false,
        patch: (base) => {
          const risks = base.risks as Array<Record<string, unknown>>;
          risks[0]!.reality_fact_ids = [];
          risks[0]!.reality_fact_stances = [
            { fact_id: "fact_runway", stance: "as_confirmed" },
          ];
          return base;
        },
      },
    ];
    for (const c of stanceCases) {
      const checked = checkFace08(validFace08(c.patch), ready);
      assert.equal(
        checked.ok,
        c.expectOk,
        `R2-G ${c.label}: ${checked.ok ? "ok" : checked.issues.map((i) => i.code).join(",")}`,
      );
    }
    console.log("R2-G ok — R1 six stance/status reverse cases still pass");
  }

  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      if (invokeCount === 1) {
        return stubResult(
          JSON.stringify(
            validFace08((base) => {
              const risks = base.risks as Array<Record<string, unknown>>;
              risks[0]!.reality_fact_ids = ["fact_salary_guess"];
              risks[0]!.reality_fact_stances = [
                { fact_id: "fact_salary_guess", stance: "as_estimated" },
              ];
              risks[0]!.risk_description = "已确认薪资不足以支撑探索。";
              return base;
            }),
          ),
        );
      }
      return stubResult(JSON.stringify(validFace08()));
    });
    try {
      const result = await runContentBodyGenerate(generateInput());
      assert.equal(result.ok, true, result.ok ? "" : result.reason);
      if (!result.ok) throw new Error(result.reason);
      assert.equal(invokeCount, 2);
      assert.equal(result.face08_meta?.validation, "passed_after_repair");
      const page = result.page as Face08V2;
      assert.equal(page.risks[0]?.reality_fact_ids?.[0], "fact_runway");
      assert.equal(page.risks[0]?.reality_fact_stances?.[0]?.stance, "as_confirmed");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("R2-H ok — repair success re-runs stance + prose contradiction checks");
  }

  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(
        JSON.stringify(
          validFace08((base) => {
            const risks = base.risks as Array<Record<string, unknown>>;
            risks[0]!.reality_fact_ids = ["fact_salary_guess"];
            risks[0]!.reality_fact_stances = [
              { fact_id: "fact_salary_guess", stance: "as_estimated" },
            ];
            risks[0]!.risk_description = "已确认薪资不足以支撑探索。";
            return base;
          }),
        ),
      );
    });
    try {
      const result = await runContentBodyGenerate(generateInput());
      assert.equal(result.ok, false);
      if (result.ok) throw new Error("expected repair fail");
      assert.equal(result.reason, "face08_validation_failed");
      assert.equal(invokeCount, 2);
      assert.equal((result as { page?: unknown }).page, undefined);
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
    console.log("R2-I ok — repair second failure does not save a success page");
  }

  console.log("ok page08 production closure");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
