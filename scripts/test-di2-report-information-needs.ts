/**
 * DI2 Step 2 — report information needs + budget ledger smoke tests.
 *
 *   pnpm test:di2-report-information-needs
 *
 * Pure / in-memory only — no OpenRouter.
 */
import assert from "node:assert/strict";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import type {
  AdaptiveQuestionPlan,
  DecisionBlueprint,
  SessionBudgetSnapshot,
  UnderstandingState,
} from "../lib/poju/decision-intake/types";
import type { POJUSessionState } from "../lib/poju/types";

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${label}`);
    console.error(e);
  }
}

function draftDc(partial?: Partial<DecisionContext>): DecisionContext {
  return {
    dc_version: "v1",
    status: "draft",
    schema_version: 1,
    definition: {
      decision_question: "是否接受新工作",
      decision_target: "job_choice",
    },
    dirs: [],
    reality_facts: [],
    constraints: [],
    conflicts: [],
    hypotheses: [],
    ...partial,
  } as DecisionContext;
}

function minimalBlueprint(): DecisionBlueprint {
  return {
    blueprint_id: "bp_test",
    dir_ids: ["DIR-DEF-QUESTION", "DIR-DEF-OUTCOME"],
    ddr_ids: ["DDR-P05-01"],
    directions: [
      {
        direction_id: "DIRN-DEFINITION",
        priority: "P0",
        dir_ids: ["DIR-DEF-QUESTION", "DIR-DEF-OUTCOME"],
        scope_boundary: "test",
        depth_soft_cap: 3,
      },
    ],
    question_budget: { soft: 12, hard: 15, depth_per_direction: 3 },
    page_07_emit: false,
    built_at: "2026-11-26T00:00:00.000Z",
  } as DecisionBlueprint;
}

async function main() {
  console.log("DI2 report information needs + budget ledger");

  const {
    assertReportInformationNeedsIntegrity,
    allReportSegmentContracts,
    REPORT_INFORMATION_NEEDS,
    classifyDecisionIntakeComplexity,
    reportInformationNeedById,
  } = await import("../lib/poju/decision-intake/report-information-needs.v1");
  const {
    bumpCoreAfterMaterialWrite,
    claimClarification,
    confirmClarification,
    GLOBAL_CORE_SPENT_CEILING,
    isMaterialDcWrite,
    migrateSessionBudget,
    canAskOrdinary,
  } = await import("../lib/poju/decision-intake/budget-ledger");
  const { isDirBlockingNeedActive, computeReportSectionCoverage } = await import(
    "../lib/poju/decision-intake/report-section-coverage"
  );
  const { applyUnderstandingModelToState } = await import(
    "../lib/poju/decision-intake/understanding-response-model"
  );
  const { validateScopeDepthBudget } = await import(
    "../lib/poju/decision-intake/scope-budget"
  );
  const { buildUnderstandingState } = await import(
    "../lib/poju/decision-intake/understanding-state"
  );
  const {
    attachAuthorizedAssistantQuestion,
    guardAndAttachAuthorizedQuestion,
  } = await import("../lib/poju/decision-intake/adaptive-turn");

  const NOW = "2026-11-26T12:00:00.000Z";

  await check("integrity: assert + 32 units + unique needs", () => {
    assertReportInformationNeedsIntegrity();
    assert.equal(allReportSegmentContracts().length, 32);
    const needIds = new Set(REPORT_INFORMATION_NEEDS.map((n) => n.need_id));
    assert.equal(needIds.size, REPORT_INFORMATION_NEEDS.length);
    const multiUnit = REPORT_INFORMATION_NEEDS.find((n) => n.served_by_units.length > 1);
    assert.ok(multiUnit, "expected at least one need served by multiple units");
  });

  await check("DIR-VALIDATION-CAPACITY not auto-blocking", () => {
    const need = reportInformationNeedById("need:dc:DIR-VALIDATION-CAPACITY");
    assert.ok(need);
    assert.equal(need.readiness_effect, "never_block");
    const dc = draftDc();
    const bp = minimalBlueprint();
    assert.equal(isDirBlockingNeedActive("DIR-VALIDATION-CAPACITY", dc, bp), false);
  });

  await check("model overlay cannot override must_continue", () => {
    const understanding: UnderstandingState = {
      schema_version: 1,
      built_at: NOW,
      current_understanding: { summary: "", confidence: "medium" },
      understood: { items: [] },
      need_to_understand: {
        items: [
          {
            kind: "dir_based",
            dir_id: "DIR-DEF-QUESTION",
            priority: "P0",
            why: "code",
            missing_content: "x",
            gap_type: "unknown",
            ddr_ids: [],
            may_affect_p5_ranking: true,
            must_continue: false,
          },
        ],
      },
      readiness: {
        verdict: "continue",
        can_ask: true,
        reasons: [],
      },
      budget: {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
        core_effective_answer_rounds: 0,
        core_round_hard_cap: 7,
      },
      next_question_plan: null,
      last_sent_question: null,
    };
    const { understanding: merged } = applyUnderstandingModelToState(understanding, null, {
      current_understanding_narrative: "n",
      need_to_understand: [
        {
          label: "invented",
          why_it_matters: "y",
          necessity: "required",
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
      understood_labels: [],
      personal_pattern_insight: { insights: [] },
      next_question: {
        selected_candidate_id: null,
        rationale: null,
      },
    } as Parameters<typeof applyUnderstandingModelToState>[2]);
    const item = merged.need_to_understand.items[0];
    assert.equal(item?.kind === "dir_based" && item.must_continue, false);
    assert.equal(merged.need_to_understand.items.length, 1);
  });

  await check("migrate: 9 material turns preserved across complexity upgrade", () => {
    const turnIds = Array.from({ length: 9 }, (_, i) => `turn_${i}`);
    const facts = turnIds.map((tid, i) => ({
      fact_id: `f${i}`,
      statement: `fact ${i}`,
      status: "confirmed" as const,
      verification_level: "user_stated" as const,
      source_stage: "collecting_context",
      source_turn_id: tid,
      user_confirmed: true,
      fact_roles: ["situation"],
      related_dir_ids: ["DIR-DEF-QUESTION"],
    }));
    const dc = draftDc({
      dirs: [
        {
          dir_id: "DIR-DEF-QUESTION",
          need: "q",
          why: "w",
          required_fact_roles: ["situation"],
          current_state: "partial",
          partial_satisfaction: false,
          agenda_item_ids: [],
          id_lifecycle: "active",
          may_affect_p5_ranking: true,
        },
      ],
      reality_facts: facts,
    });
    const simple = classifyDecisionIntakeComplexity({ option_count: 2 });
    const complex = classifyDecisionIntakeComplexity({
      option_count: 4,
      high_stakes: true,
      irreversible: true,
      multi_topic: true,
    });
    let budget: SessionBudgetSnapshot = {
      soft_budget_limit: 12,
      hard_budget_limit: 15,
      session_asked_count: 0,
      review_cycle: 1,
      cycle_base_asked: 0,
      remaining_hard_budget: 15,
      depth_by_dir: {},
      complexity_band: simple.complexity,
      core_round_hard_cap: simple.core_round_hard_cap,
    };
    budget = migrateSessionBudget(budget, dc);
    assert.equal(budget.core_effective_answer_rounds, 9);
    budget = {
      ...budget,
      complexity_band: complex.complexity,
      core_round_hard_cap: complex.core_round_hard_cap,
    };
    budget = migrateSessionBudget(budget, dc);
    assert.equal(budget.core_effective_answer_rounds, 9);
  });

  await check("orphan material facts fail-closed without turn ids", () => {
    const dc = draftDc({
      reality_facts: [
        {
          fact_id: "orphan",
          statement: "orphan material",
          status: "confirmed",
          verification_level: "user_stated",
          source_stage: "collecting_context",
          user_confirmed: true,
          fact_roles: ["situation"],
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const budget: SessionBudgetSnapshot = {
      soft_budget_limit: 12,
      hard_budget_limit: 15,
      session_asked_count: 0,
      review_cycle: 1,
      cycle_base_asked: 0,
      remaining_hard_budget: 15,
      depth_by_dir: {},
    };
    const migrated = migrateSessionBudget(budget, dc);
    assert.equal(
      migrated.budget_migration_evidence,
      "uncertain_orphan_facts_fail_closed",
    );
    assert.equal(migrated.core_effective_answer_rounds, GLOBAL_CORE_SPENT_CEILING);
  });

  await check("bumpCore: same turn +1, replay +0, non-material +0", () => {
    const dc = draftDc({
      reality_facts: [
        {
          fact_id: "f1",
          statement: "a",
          status: "confirmed",
          verification_level: "user_stated",
          source_stage: "collecting_context",
          source_turn_id: "t1",
          user_confirmed: true,
          fact_roles: ["situation"],
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const session = { decision_context: dc } as POJUSessionState;
    assert.ok(
      isMaterialDcWrite({
        fact_ids_written: ["f1", "f2"],
        constraint_ids_written: [],
        session,
        answer: { classification: "substantive" },
      }),
    );
  let budget: SessionBudgetSnapshot = {
    soft_budget_limit: 12,
    hard_budget_limit: 15,
    session_asked_count: 0,
    review_cycle: 1,
    cycle_base_asked: 0,
    remaining_hard_budget: 15,
    depth_by_dir: {},
    core_effective_answer_rounds: 0,
    core_counted_source_turn_ids: [],
  };
    budget = bumpCoreAfterMaterialWrite(budget, {
      source_turn_id: "t1",
      answer_event_id: "e1",
    });
    assert.equal(budget.core_effective_answer_rounds, 1);
    budget = bumpCoreAfterMaterialWrite(budget, {
      source_turn_id: "t1",
      answer_event_id: "e2",
    });
    assert.equal(budget.core_effective_answer_rounds, 1);
    assert.equal(budget.core_counted_source_turn_ids?.length, 1);
    assert.equal(
      isMaterialDcWrite({
        fact_ids_written: ["f1"],
        constraint_ids_written: [],
        session,
        answer: { classification: "unknown" },
      }),
      false,
    );
  });

  await check("clarification claims: allowance + idempotent plan_id", () => {
    let budget: SessionBudgetSnapshot = {
      soft_budget_limit: 12,
      hard_budget_limit: 15,
      session_asked_count: 0,
      review_cycle: 1,
      cycle_base_asked: 0,
      remaining_hard_budget: 15,
      depth_by_dir: {},
      clarification_allowance: 3,
      clarification_claims: [],
    };
    const claims: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = claimClarification(budget, `plan_${i}`, NOW);
      assert.ok(r.ok, `claim ${i} should succeed`);
      budget = r.budget;
      claims.push(`plan_${i}`);
    }
    const blocked = claimClarification(budget, "plan_overflow", NOW);
    assert.ok(!blocked.ok);
    const again = claimClarification(budget, "plan_0", NOW);
    assert.ok(again.ok);
    assert.equal(
      (again.budget.clarification_claims ?? []).filter(
        (c) => c.status === "claimed" || c.status === "confirmed",
      ).length,
      3,
    );
    budget = confirmClarification(budget, "plan_0", NOW, "send_0");
    const reconfirm = confirmClarification(budget, "plan_0", NOW, "send_0b");
    assert.equal(
      reconfirm.clarification_claims?.find((c) => c.plan_id === "plan_0")?.status,
      "confirmed",
    );
  });

  await check("coverage gap count + core cap alone not delivery_ready", () => {
    const dc = draftDc({
      dirs: [
        {
          dir_id: "DIR-DEF-QUESTION",
          need: "q",
          why: "w",
          required_fact_roles: ["situation"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          id_lifecycle: "active",
          may_affect_p5_ranking: true,
        },
      ],
    });
    const bp = minimalBlueprint();
    const cov = computeReportSectionCoverage({ dc, blueprint: bp, now: NOW });
    assert.ok(cov.missing_required_count >= 1);
    const session = {
      session_id: "s1",
      decision_context: dc,
      decision_blueprint: bp,
      decision_understanding: {
        budget: {
          soft_budget_limit: 12,
          hard_budget_limit: 15,
          session_asked_count: 3,
          review_cycle: 1,
          cycle_base_asked: 0,
          remaining_hard_budget: 12,
          depth_by_dir: {},
          core_effective_answer_rounds: 7,
          core_round_hard_cap: 7,
          core_counted_source_turn_ids: [
            "t0",
            "t1",
            "t2",
            "t3",
            "t4",
            "t5",
            "t6",
          ],
          budget_migration_version: "1",
        },
      },
    } as POJUSessionState;
    const u = buildUnderstandingState({ session, blueprint: bp, now: NOW });
    assert.equal(u.readiness.can_ask, false);
    assert.equal(canAskOrdinary(u.budget), false);
    assert.equal(u.report_coverage?.delivery_ready, false);
    assert.notEqual(u.readiness.verdict, "ready_for_delivery");
  });

  await check("same plan_id resend: asked/core/clarification unchanged", () => {
    const plan: AdaptiveQuestionPlan = {
      plan_id: "qp_resend_test",
      candidate_id: "c1",
      direction_id: "DIRN-DEFINITION",
      ddr_ids: ["DDR-P05-01"],
      dir_ids: ["DIR-DEF-QUESTION"],
      fact_role_codes: ["v1/dir/DIR-DEF-QUESTION/role/situation"],
      missing_info: "unknown",
      decision_value: "decision_critical",
      ask_now_reason: "test",
      expected_info: "info",
      depth: 1,
      budget_cost: 1,
      remaining_hard_budget: 14,
      gate_class: "P0",
      scope_boundary: "test",
      rationale: "test",
      question_text: "问题？",
      built_at: NOW,
      scoring_path: "test",
      collection_mode: "ordinary",
    };
    const baseBudget: SessionBudgetSnapshot = {
      soft_budget_limit: 12,
      hard_budget_limit: 15,
      session_asked_count: 0,
      review_cycle: 1,
      cycle_base_asked: 0,
      remaining_hard_budget: 15,
      depth_by_dir: {},
      core_effective_answer_rounds: 0,
      core_round_hard_cap: 7,
      clarification_allowance: 3,
      clarification_claims: [],
    };
    let session = {
      decision_understanding: {
        budget: { ...baseBudget },
        last_sent_question: null,
      },
    } as POJUSessionState;
    session = attachAuthorizedAssistantQuestion(session, plan, "ask_1", NOW);
    const afterFirst = session.decision_understanding!.budget;
    session = attachAuthorizedAssistantQuestion(session, plan, "ask_2", NOW);
    const afterSecond = session.decision_understanding!.budget;
    assert.equal(afterSecond.session_asked_count, afterFirst.session_asked_count);
    assert.equal(
      afterSecond.core_effective_answer_rounds,
      afterFirst.core_effective_answer_rounds,
    );
    assert.deepEqual(
      afterSecond.clarification_claims,
      afterFirst.clarification_claims,
    );
    const clarPlan: AdaptiveQuestionPlan = {
      ...plan,
      plan_id: "qp_clarify_1",
      scoring_path: "pending_answer_resolution→deterministic",
      collection_mode: "clarification",
    };
    session = {
      decision_understanding: {
        budget: { ...baseBudget, session_asked_count: 1 },
        last_sent_question: null,
      },
    } as POJUSessionState;
    const r1 = guardAndAttachAuthorizedQuestion(session, clarPlan, "t1", NOW);
    assert.ok(r1.attached);
    const r2 = guardAndAttachAuthorizedQuestion(r1.session, clarPlan, "t2", NOW);
    assert.ok(r2.attached);
    assert.equal(
      r2.session.decision_understanding!.budget.session_asked_count,
      r1.session.decision_understanding!.budget.session_asked_count,
    );
  });

  await check("soft-12: validateScopeDepthBudget blocks P2 after soft", () => {
    const bp = minimalBlueprint();
    const budget: SessionBudgetSnapshot = {
      soft_budget_limit: 12,
      hard_budget_limit: 15,
      session_asked_count: 12,
      review_cycle: 1,
      cycle_base_asked: 0,
      remaining_hard_budget: 3,
      depth_by_dir: {},
    };
    const plan: AdaptiveQuestionPlan = {
      plan_id: "qp_p2",
      candidate_id: "c_p2",
      direction_id: "DIRN-DEFINITION",
      ddr_ids: ["DDR-P05-01"],
      dir_ids: ["DIR-DEF-QUESTION"],
      fact_role_codes: [],
      missing_info: "unknown",
      decision_value: "supporting",
      ask_now_reason: "test",
      expected_info: "x",
      depth: 1,
      budget_cost: 1,
      remaining_hard_budget: 3,
      gate_class: "P2",
      scope_boundary: "test",
      rationale: "test",
      question_text: "p2?",
      built_at: NOW,
      scoring_path: "test",
    };
    const verdict = validateScopeDepthBudget({ blueprint: bp, plan, budget });
    assert.equal(verdict.ok, false);
    if (!verdict.ok) {
      assert.equal(verdict.reason_code, "p2_blocked_after_soft_budget");
    }
  });

  console.log(`\nDone: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});