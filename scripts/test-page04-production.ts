/**
 * Page04 production closure — stubbed LLM through real runContentBodyGenerate.
 * Proves success / repair / fail / gate / fact+claim auth / Lab persist.
 * Run: pnpm exec tsx scripts/test-page04-production.ts
 */

import assert from "node:assert/strict";
import {
  runContentBodyGenerate,
  setContentBodyTestInvokeForTests,
} from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import {
  buildFace04ProductionContext,
  validateFace04ProductionOutput,
  parseFace04JsonStrict,
} from "@/lib/llm/pro/delivery/decision-report-v2/page04/production";
import { validateFace04Output } from "@/lib/llm/pro/delivery/decision-report-v2/page04/validate";
import {
  assemblePage04SectionsForDisplay,
  assemblePage04PdfArgumentBodies,
  validatePage04CanonicalPage,
  PAGE04_SECTION_IDS,
} from "@/lib/llm/pro/delivery/decision-report-v2/page04/architecture";
import {
  createDeliveryLab,
  loadDeliveryLab,
  saveDeliveryLab,
} from "@/lib/llm/pro/delivery/lab/store";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { CallLLMResult } from "@/lib/llm/router";
import type { Face04V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

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
  context_id: "dc_prod_04",
  version: 1,
  status: "final",
  content_hash: "hash_prod_04",
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
      fact_id: "fact_unknown",
      statement: "Partner stake share unknown.",
      status: "unknown",
      verification_level: "none",
      source_stage: "collecting",
      source_turn_id: "t4",
      user_confirmed: false,
    },
    {
      fact_id: "fact_na",
      statement: "Visa timeline not applicable to this case.",
      status: "not_applicable",
      verification_level: "none",
      source_stage: "collecting",
      source_turn_id: "t5",
      user_confirmed: false,
    },
  ],
  dirs: [],
  conflicts: [
    {
      conflict_id: "c1",
      fact_ids: ["fact_runway", "fact_salary_guess"],
      conflict_field: "timeline",
      statements_snapshot: ["soon", "next year"],
      source_refs: [],
      state: "open",
      resolution: null,
    },
  ],
  hypotheses: [],
};

const pack: BookJudgmentPack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_prod04",
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
    {
      text: "Runway buffer supports staged explore.",
      claim_ids: ["claim_u_bn_04"],
    },
  ],
  recommendation_conditions: [
    {
      condition: "runway holds",
      status: "assumed",
      source_ids: ["fact_runway"],
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

const page02 = {
  page: "02",
  face: "02",
  schema_version: "face02-v2",
  content_units: [
    {
      unit_id: "p02_u1",
      kind: "mechanism",
      text: "Cash-floor anxiety amplifies under offer deadlines.",
      claim_ids: ["claim_u_bn_04"],
      evidence_ids: ["u_bn_04"],
      related_dir_ids: [],
    },
  ],
  explanation_boundary: {
    claim_ids: ["claim_u_bn_04"],
    known_limits: ["Salary unverified"],
    open_questions: ["Equity terms"],
  },
  reading_order: ["mechanism_chain"],
} as unknown;

function validFace04Raw(overrides?: Record<string, unknown>): Record<string, unknown> {
  const base = {
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
        evidence_ids: ["u_bn_04"],
        related_reality_fact_ids: ["fact_runway"],
      },
      {
        unit_id: "u_manif",
        kind: "manifestation",
        text: "When the offer arrives, spending freezes and decisions stall.",
        claim_ids: ["claim_u_bn_04"],
        evidence_ids: ["u_bn_04"],
        related_reality_fact_ids: ["fact_runway"],
      },
      {
        unit_id: "u_force",
        kind: "force_through_cost",
        text: "If forced cold-resign continues, runway may compress under uncertainty.",
        claim_ids: ["claim_u_bn_04"],
        evidence_ids: ["u_bn_04"],
      },
      {
        unit_id: "u_lev",
        kind: "leverage_point",
        text: "Stabilize a cash floor decision rule before expanding offer talks.",
        claim_ids: ["claim_u_bn_04"],
        evidence_ids: ["u_bn_04"],
      },
      {
        unit_id: "u_ev",
        kind: "evidence_note",
        text: "Grounded on confirmed runway fact + pack claim.",
        claim_ids: ["claim_u_bn_04"],
        evidence_ids: ["u_bn_04"],
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
  return { ...base, ...(overrides ?? {}) };
}

function baseGenerateInput() {
  return {
    key: "04" as const,
    locale: "en",
    session_id: "face04_prod_test",
    report_id: "face04_prod_test",
    finalize: {} as never,
    decision_context_snapshot: dc,
    book_judgment_pack: pack,
    chart_fact_pack: "日主甲木…",
    page01_schema: page01,
    page02_schema: page02,
    dispatch_attempt: 1,
  };
}

async function main() {
  console.log("=== Page04 production closure (stubbed LLM) ===");

  // --- Payload + registry readiness ---
  {
    const built = buildFace04ProductionContext({
      report_id: "prod04_payload",
      locale: "en",
      dc,
      pack,
      page01,
      page02,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error(built.reason);
    assert.equal(built.ctx.may_invoke_llm, true);
    assert.ok(built.ctx.user.includes("## Production payload"));
    assert.ok(built.ctx.user.includes("fact_runway"));
    assert.ok(built.ctx.user.includes("fact_salary_guess"));
    assert.ok(built.ctx.user.includes("fact_declined"));
    assert.ok(built.ctx.user.includes("Keep at least 6 months runway"));
    assert.ok(built.ctx.user.includes("claim_u_bn_04"));
    assert.ok(built.ctx.user.includes("p02_u1"));
    assert.ok(built.ctx.user.includes('"confirmed_facts"'));
    assert.ok(built.ctx.user.includes('"unverified_facts"'));
    assert.equal(Object.keys(built.ctx.registry.claims).length, 1);
    assert.ok(built.ctx.registry.claims["claim_u_bn_04"]);
    assert.equal(
      built.ctx.architecture.input_manifest.find(
        (m) => m.field_id === "evidence_registry_claims",
      )?.present,
      true,
    );
    // Must not fake readiness via BJ unit count alone without registry records
    const emptyPackBuilt = buildFace04ProductionContext({
      report_id: "prod04_empty_reg",
      locale: "en",
      dc,
      pack: { ...pack, units: [], by_face: {} } as BookJudgmentPack,
      page01,
    });
    assert.equal(emptyPackBuilt.ok, true);
    if (!emptyPackBuilt.ok) throw new Error(emptyPackBuilt.reason);
    assert.equal(
      Object.keys(emptyPackBuilt.ctx.registry.claims).length,
      0,
    );
    assert.equal(emptyPackBuilt.ctx.may_invoke_llm, false);
    console.log("PAYLOAD/REGISTRY PASS");
  }

  // --- A: Success path via runContentBodyGenerate ---
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async (sys, usr) => {
      invokeCount += 1;
      assert.ok(sys.includes("Page04"));
      assert.ok(usr.includes("Production payload"));
      assert.ok(usr.includes("fact_runway"));
      assert.ok(usr.includes("claim_u_bn_04"));
      return stubResult(JSON.stringify(validFace04Raw()));
    });
    try {
      const result = await runContentBodyGenerate(baseGenerateInput());
      assert.equal(result.ok, true);
      if (!result.ok) throw new Error(result.reason);
      assert.equal(invokeCount, 1);
      assert.equal(result.call_trace.phase, "content_body_v3_face04");
      assert.equal(result.face04_meta?.validation, "passed");
      assert.equal(result.face04_meta?.schema_version, "face04-v2");
      const page = result.page as Face04V2;
      assert.equal(page.schema_version, "face04-v2");
      assert.ok(Array.isArray(page.content_units));
      assert.ok(page.content_units.length >= 5);
      assert.ok(page.generation_status === "generated_complete" || page.generation_status === "generated_with_gaps");
      assert.ok(Array.isArray(page.input_manifest));
      assert.ok(Array.isArray(page.missing_inputs));
      assert.ok(page.generation_metadata?.llm_invoked === true);
      assert.equal(
        "bottleneck_name" in page &&
          typeof (page as { bottleneck_name?: unknown }).bottleneck_name ===
            "string",
        false,
      );
      // Persist F uses this canonical page
      const lab = await createDeliveryLab({
        ops_user: "lab_prod_04_test",
        source: {
          locale: "en",
          original_question: "Should I leave for the startup offer?",
          desired_outcome: "Preserve runway",
          base_analysis: "{}",
          session_id: `sess_lab04_prod_${Date.now()}`,
        },
      });
      lab.artifacts.by_page["04"] = {
        ...(lab.artifacts.by_page["04"] ?? {
          page_key: "04",
          status: "pending",
          attempts: [],
        }),
        page_schema: page as never,
        page_schema_pre_polish: structuredClone(page) as never,
      };
      await saveDeliveryLab(lab);
      const reloaded = await loadDeliveryLab(lab.lab_id);
      const stored = reloaded!.artifacts.by_page["04"]?.page_schema;
      const validated = validatePage04CanonicalPage(stored);
      assert.equal(validated.ok, true);
      if (!validated.ok) throw new Error(validated.detail);
      assert.equal(validated.page.generation_metadata?.llm_invoked, true);
      const reader = assemblePage04SectionsForDisplay(validated.page, "en");
      const pdf = assemblePage04PdfArgumentBodies(validated.page, "en");
      assert.equal(reader.length, PAGE04_SECTION_IDS.length);
      assert.equal(pdf.length, PAGE04_SECTION_IDS.length);
      console.log("A+F PASS — success path + Lab persist from production output");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // --- B: First fail, repair success ---
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      if (invokeCount === 1) {
        // Unknown claim → validation fail
        return stubResult(
          JSON.stringify(
            validFace04Raw({
              content_units: validFace04Raw().content_units.map(
                (u: { claim_ids?: string[] }) => ({
                  ...u,
                  claim_ids: ["claim_fabricated"],
                }),
              ),
              evidence_boundary: {
                claim_ids: ["claim_fabricated"],
                evidence_note_unit_ids: ["u_ev"],
                confirmed_fact_ids: ["fact_runway"],
                hypothesis_notes: [],
                uncertainty_notes: ["x"],
              },
            }),
          ),
        );
      }
      return stubResult(JSON.stringify(validFace04Raw()));
    });
    try {
      const result = await runContentBodyGenerate(baseGenerateInput());
      assert.equal(result.ok, true);
      if (!result.ok) throw new Error(result.reason);
      assert.equal(invokeCount, 2);
      assert.equal(result.face04_meta?.validation, "passed_after_repair");
      assert.equal(
        (result.page as Face04V2).schema_version,
        "face04-v2",
      );
      console.log("B PASS — repair once then success");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // --- C: Repair fail ---
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult(
        JSON.stringify(
          validFace04Raw({
            evidence_boundary: {
              claim_ids: ["claim_u_bn_04"],
              evidence_note_unit_ids: ["u_ev"],
              confirmed_fact_ids: ["fact_salary_guess"],
              hypothesis_notes: [],
              uncertainty_notes: ["x"],
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
      assert.equal(result.reason, "face04_validation_failed");
      assert.ok(!("page" in result && result.page));
      console.log("C PASS — repair exhausted, no bad page");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // --- D: Gate ---
  {
    let invokeCount = 0;
    setContentBodyTestInvokeForTests(async () => {
      invokeCount += 1;
      return stubResult("{}");
    });
    try {
      const blocked = await runContentBodyGenerate({
        ...baseGenerateInput(),
        decision_context_snapshot: {
          ...dc,
          definition: { ...dc.definition!, decision_question: "" },
        },
        page01_schema: null,
      });
      assert.equal(blocked.ok, false);
      assert.equal(blocked.reason, "face04_blocked_on_required_inputs");
      assert.equal(blocked.tokens_used, 0);
      assert.equal(invokeCount, 0);
      console.log("D PASS — required inputs gate, 0 invokes");
    } finally {
      setContentBodyTestInvokeForTests(null);
    }
  }

  // --- E: Evidence / fact / kind ---
  {
    const built = buildFace04ProductionContext({
      report_id: "prod04_auth",
      locale: "en",
      dc,
      pack,
      page01,
      page02,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error(built.reason);
    const ctx = built.ctx;

    const badClaim = validateFace04Output({
      raw: validFace04Raw({
        content_units: (
          validFace04Raw().content_units as Array<Record<string, unknown>>
        ).map((u) => ({ ...u, claim_ids: ["claim_fabricated"] })),
        evidence_boundary: {
          claim_ids: ["claim_fabricated"],
          evidence_note_unit_ids: ["u_ev"],
          confirmed_fact_ids: ["fact_runway"],
          hypothesis_notes: [],
          uncertainty_notes: ["x"],
        },
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
    });
    assert.equal(badClaim.ok, false);
    assert.ok(
      badClaim.ok === false &&
        badClaim.issues.some((i) => i.code === "unknown_claim_id"),
    );

    const badEv = validateFace04Output({
      raw: validFace04Raw({
        content_units: (
          validFace04Raw().content_units as Array<Record<string, unknown>>
        ).map((u) => ({ ...u, evidence_ids: ["ev_fabricated"] })),
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
    });
    assert.equal(badEv.ok, false);
    assert.ok(
      badEv.ok === false &&
        badEv.issues.some((i) => i.code === "unknown_evidence_id"),
    );

    const badFact = validateFace04Output({
      raw: validFace04Raw({
        content_units: (
          validFace04Raw().content_units as Array<Record<string, unknown>>
        ).map((u, idx) =>
          idx === 0
            ? { ...u, related_reality_fact_ids: ["fact_fabricated"] }
            : u,
        ),
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
    });
    assert.equal(badFact.ok, false);
    assert.ok(
      badFact.ok === false &&
        badFact.issues.some((i) => i.code === "unknown_fact_id"),
    );

    for (const badId of [
      "fact_salary_guess",
      "fact_declined",
      "fact_unknown",
      "fact_na",
    ] as const) {
      const upgrade = validateFace04Output({
        raw: validFace04Raw({
          evidence_boundary: {
            claim_ids: ["claim_u_bn_04"],
            evidence_note_unit_ids: ["u_ev"],
            confirmed_fact_ids: [badId],
            hypothesis_notes: [],
            uncertainty_notes: ["x"],
          },
        }),
        locale: "en",
        registry: ctx.registry,
        knownFactIds: ctx.knownFactIds,
        factStatusById: ctx.factStatusById,
      });
      assert.equal(upgrade.ok, false);
      assert.ok(
        upgrade.ok === false &&
          upgrade.issues.some(
            (i) => i.code === "confirmed_fact_status_mismatch",
          ),
      );
    }

    // Fact-status upgrade prose must be rejected on every unit kind that can cite facts
    // (not only manifestation).
    const nonConfirmedFacts = [
      "fact_salary_guess",
      "fact_declined",
      "fact_unknown",
      "fact_na",
    ] as const;
    const unitKindsToGuard = [
      {
        kind: "bottleneck_label",
        unit_id: "u_name",
        text: "Cash-floor panic is a confirmed fact under offer pressure.",
      },
      {
        kind: "force_through_cost",
        unit_id: "u_force",
        text: "Forcing through is confirmed fact cost when salary guess is treated as settled.",
      },
      {
        kind: "leverage_point",
        unit_id: "u_lev",
        text: "Leverage rests on the confirmed fact of partner stake share.",
      },
      {
        kind: "evidence_note",
        unit_id: "u_ev",
        text: "Evidence note treats the declined equity detail as a confirmed fact.",
      },
    ] as const;
    for (let i = 0; i < unitKindsToGuard.length; i++) {
      const row = unitKindsToGuard[i]!;
      const factId = nonConfirmedFacts[i]!;
      const units = (
        validFace04Raw().content_units as Array<Record<string, unknown>>
      ).map((u) =>
        u.unit_id === row.unit_id
          ? {
              ...u,
              kind: row.kind,
              text: row.text,
              related_reality_fact_ids: [factId],
            }
          : u,
      );
      const upgradedKind = validateFace04Output({
        raw: validFace04Raw({ content_units: units }),
        locale: "en",
        registry: ctx.registry,
        knownFactIds: ctx.knownFactIds,
        factStatusById: ctx.factStatusById,
      });
      assert.equal(
        upgradedKind.ok,
        false,
        `expected fact_status_upgrade for ${row.kind} citing ${factId}`,
      );
      assert.ok(
        upgradedKind.ok === false &&
          upgradedKind.issues.some(
            (iss) =>
              iss.code === "fact_status_upgrade" &&
              String(iss.detail).includes(row.kind) &&
              String(iss.detail).includes(factId),
          ),
        `missing fact_status_upgrade for ${row.kind}`,
      );
    }

    const kindMismatch = validateFace04Output({
      raw: validFace04Raw({
        force_through_cost_unit_ids: ["u_lev"],
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
    });
    assert.equal(kindMismatch.ok, false);
    assert.ok(
      kindMismatch.ok === false &&
        kindMismatch.issues.some((i) => i.code === "section_kind_mismatch"),
    );

    const legacyBypass = validateFace04Output({
      raw: validFace04Raw({
        content_units: (
          validFace04Raw().content_units as Array<Record<string, unknown>>
        ).map((u) => ({ ...u, claim_ids: ["legacy_claim_x"] })),
        evidence_boundary: {
          claim_ids: ["legacy_claim_x"],
          evidence_note_unit_ids: ["u_ev"],
          confirmed_fact_ids: ["fact_runway"],
          hypothesis_notes: [],
          uncertainty_notes: ["x"],
        },
      }),
      locale: "en",
      registry: ctx.registry,
      knownFactIds: ctx.knownFactIds,
      factStatusById: ctx.factStatusById,
    });
    assert.equal(legacyBypass.ok, false);
    assert.ok(
      legacyBypass.ok === false &&
        legacyBypass.issues.some((i) => i.code === "legacy_id_forbidden"),
    );

    // Strict JSON reject markdown fences
    assert.equal(parseFace04JsonStrict("```json\n{}\n```"), null);

    const okProd = validateFace04ProductionOutput({
      raw: validFace04Raw(),
      locale: "en",
      ctx,
    });
    assert.equal(okProd.ok, true);
    if (!okProd.ok) throw new Error(okProd.reason);
    assert.equal(okProd.page.schema_version, "face04-v2");
    assert.equal(okProd.page.generation_metadata?.llm_invoked, true);

    console.log("E PASS — claim/evidence/fact/kind/legacy auth");
  }

  console.log("ok page04 production closure");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
