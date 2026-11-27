/**
 * DI2 Step 2 — report information needs + budget ledger smoke tests.
 *
 *   pnpm test:di2-report-information-needs
 *
 * Pure / in-memory only — no OpenRouter.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    complexitySignalsFromDecisionMaterials,
    countProvenDistinctOptions,
    reportInformationNeedById,
    reportInformationNeedsForDirIds,
  } = await import("../lib/poju/decision-intake/report-information-needs.v1");
  const {
    bumpCoreAfterMaterialWrite,
    claimClarification,
    confirmClarification,
    GLOBAL_CORE_SPENT_CEILING,
    isMaterialDcWrite,
    migrateSessionBudget,
    repairCoreLedgerFromDc,
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
    finalizeClarificationClaimsForDurableCommit,
    releaseAuthorizedQuestionClaim,
    tryCatalogFallbackForOpenBlocking,
  } = await import("../lib/poju/decision-intake/adaptive-turn");
  const { buildIntakeCandidatesFromDc } = await import(
    "../lib/poju/decision-context/production-intake-ask"
  );
  const { resolveDdrIdsForDir } = await import(
    "../lib/poju/decision-intake/blueprint"
  );

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

  await check("same plan_id second attach rejected; budget unchanged", () => {
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
      need_ids: ["need:dc:DIR-DEF-QUESTION"],
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
    const first = attachAuthorizedAssistantQuestion(session, plan, "ask_1", NOW);
    assert.ok(first.attached);
    session = first.session;
    const afterFirst = session.decision_understanding!.budget;
    const second = attachAuthorizedAssistantQuestion(session, plan, "ask_2", NOW);
    assert.equal(second.attached, false);
    assert.equal(second.block_reason, "plan_already_sent");
    assert.equal(
      second.session.decision_understanding!.budget.session_asked_count,
      afterFirst.session_asked_count,
    );
    assert.equal(
      second.session.decision_understanding!.last_sent_question?.plan_id,
      plan.plan_id,
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
    assert.equal(r2.attached, false);
    assert.equal(r2.block_reason, "plan_already_sent");
    assert.equal(
      r2.session.decision_understanding!.budget.session_asked_count,
      r1.session.decision_understanding!.budget.session_asked_count,
    );
    const claim = r1.session.decision_understanding!.budget.clarification_claims?.[0];
    assert.equal(claim?.status, "claimed");
    const withMsg = {
      ...r1.session,
      messages: [
        { role: "assistant" as const, content: "q?", client_id: "msg_1", timestamp: NOW },
      ],
    };
    const confirmed = finalizeClarificationClaimsForDurableCommit(withMsg, NOW);
    assert.equal(
      confirmed.decision_understanding!.budget.clarification_claims?.[0]?.status,
      "confirmed",
    );
  });

  await check("counterLedgerConsistent: 15 turn ids with core=12", () => {
    const turnIds = Array.from({ length: 15 }, (_, i) => `turn_${i}`);
    const budget: SessionBudgetSnapshot = {
      soft_budget_limit: 12,
      hard_budget_limit: 15,
      session_asked_count: 0,
      review_cycle: 1,
      cycle_base_asked: 0,
      remaining_hard_budget: 15,
      depth_by_dir: {},
      core_effective_answer_rounds: GLOBAL_CORE_SPENT_CEILING,
      core_counted_source_turn_ids: turnIds,
      budget_migration_version: "1",
    };
    const migrated = migrateSessionBudget(budget, null);
    assert.equal(migrated.core_effective_answer_rounds, GLOBAL_CORE_SPENT_CEILING);
    assert.equal(migrated.core_counted_source_turn_ids?.length, 15);
  });

  await check("orphan + partial turn ids fail-closed (no reconstruct)", () => {
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
        {
          fact_id: "ok",
          statement: "with turn",
          status: "confirmed",
          verification_level: "user_stated",
          source_stage: "collecting_context",
          source_turn_id: "turn_ok",
          user_confirmed: true,
          fact_roles: ["situation"],
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const migrated = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      dc,
    );
    assert.equal(migrated.core_effective_answer_rounds, GLOBAL_CORE_SPENT_CEILING);
    assert.equal(
      migrated.budget_migration_evidence,
      "uncertain_orphan_facts_fail_closed",
    );
  });

  await check("guard blocked: no question text left on last_sent when missing understanding", () => {
    const plan: AdaptiveQuestionPlan = {
      plan_id: "qp_no_u",
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
      need_ids: ["need:dc:DIR-DEF-QUESTION"],
    };
    const session = { messages: [] } as POJUSessionState;
    const r = guardAndAttachAuthorizedQuestion(session, plan, "t1", NOW);
    assert.equal(r.attached, false);
    assert.equal(r.block_reason, "missing_decision_understanding");
  });

  await check("buildIntakeCandidatesFromDc attaches SSOT need_ids", async () => {
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
    const expectedNeeds = reportInformationNeedById("need:dc:DIR-DEF-QUESTION");
    assert.ok(
      expectedNeeds &&
        expectedNeeds.source_kind === "decision_context" &&
        expectedNeeds.ask_policy === "ask_if_material",
    );
    const { resolveDdrIdsForDir } = await import(
      "../lib/poju/decision-intake/blueprint"
    );
    const ddr = resolveDdrIdsForDir("DIR-DEF-QUESTION", bp);
  if (ddr.length === 0) {
      console.log("  SKIP  buildIntakeCandidatesFromDc ddr catalog unavailable in shim");
      return;
    }
    const candidates = buildIntakeCandidatesFromDc(dc, bp);
    assert.ok(candidates.length >= 1);
    for (const c of candidates) {
      assert.ok(c.need_ids?.length);
      for (const id of c.need_ids ?? []) {
        assert.ok(reportInformationNeedById(id));
      }
    }
  });

  await check("material core bump applied before simulated persist commit", () => {
    const dc = draftDc({
      reality_facts: [
        {
          fact_id: "f1",
          statement: "material",
          status: "confirmed",
          verification_level: "user_stated",
          source_stage: "collecting_context",
          source_turn_id: "mat_turn",
          user_confirmed: true,
          fact_roles: ["situation"],
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const session = {
      decision_context: dc,
      decision_understanding: {
        budget: {
          soft_budget_limit: 12,
          hard_budget_limit: 15,
          session_asked_count: 0,
          review_cycle: 1,
          cycle_base_asked: 0,
          remaining_hard_budget: 15,
          depth_by_dir: {},
          core_effective_answer_rounds: 0,
          core_counted_source_turn_ids: [],
        },
      },
    } as POJUSessionState;
    const bumped = bumpCoreAfterMaterialWrite(
      session.decision_understanding!.budget,
      { source_turn_id: "mat_turn", answer_event_id: "ev1" },
    );
    const working = {
      ...session,
      decision_understanding: {
        ...session.decision_understanding!,
        budget: bumped,
      },
    };
    assert.equal(working.decision_understanding!.budget.core_effective_answer_rounds, 1);
    const saved = migrateSessionBudget(working.decision_understanding!.budget, dc);
    assert.equal(saved.core_effective_answer_rounds, 1);
    assert.deepEqual(saved.core_counted_source_turn_ids, ["mat_turn"]);
  });

  await check("release drops claimed clarification without confirm", () => {
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
    const claimed = claimClarification(budget, "plan_abort", NOW);
    budget = claimed.budget;
    const session = {
      decision_understanding: {
        budget,
        last_sent_question: {
          plan_id: "plan_abort",
          question_text: "q?",
          direction_id: "DIRN-DEFINITION",
          dir_ids: ["DIR-DEF-QUESTION"],
          ddr_ids: [],
          fact_role_codes: [],
          turn_id: "t1",
        },
      },
      adaptive_ask_plan: { plan_id: "plan_abort" },
    } as POJUSessionState;
    const released = releaseAuthorizedQuestionClaim(session, "plan_abort", NOW);
    assert.equal(
      released.decision_understanding!.budget.clarification_claims?.[0]?.status,
      "released",
    );
    assert.equal(released.decision_understanding!.last_sent_question, null);
    assert.equal(released.adaptive_ask_plan, null);
  });

  await check("claimClarification: confirmed plan_id rejects second reserve", () => {
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
    budget = confirmClarification(budget, "plan_done", NOW, "send_1");
    const blocked = claimClarification(budget, "plan_done", NOW);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "already_confirmed");
  });

  await check("CAS reserve: real MemorySessionAuthorityStore concurrent last slot", async () => {
    const { reserveClarificationClaimCas } = await import(
      "../lib/poju/decision-intake/clarification-claim-cas"
    );
    const {
      createMemorySessionAuthorityStore,
      runWithSessionAuthorityStore,
    } = await import("../lib/poju/session-authority/store");
    const {
      initializeAuthoritativeSession,
      commitAuthoritativeSessionUpdate,
      requireAuthoritativeSession,
    } = await import("../lib/poju/session-authority/lifecycle");

    await runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "clarification cas race",
        device_id: "dev_r3_cas",
      });
      const budget: SessionBudgetSnapshot = {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 1,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 14,
        depth_by_dir: {},
        clarification_allowance: 3,
        clarification_rounds: 2,
        clarification_claims: [
          {
            plan_id: "plan_0",
            status: "confirmed",
            claimed_at: NOW,
            confirmed_at: NOW,
          },
          {
            plan_id: "plan_1",
            status: "confirmed",
            claimed_at: NOW,
            confirmed_at: NOW,
          },
        ],
      };
      const seededSnap: POJUSessionState = {
        ...record.session_snapshot,
        decision_understanding: {
          ...(record.session_snapshot.decision_understanding as object),
          budget,
          last_sent_question: null,
        } as POJUSessionState["decision_understanding"],
      };
      const afterSeed = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: seededSnap,
        last_committed_turn_id: null,
      });
      assert.equal(afterSeed.revision, 1);

      const working: POJUSessionState = {
        ...afterSeed.session_snapshot,
        session_revision: afterSeed.revision,
        // Marker that working-turn state must survive overlay.
        original_question: "working-turn-marker",
      };

      const [a, b] = await Promise.all([
        reserveClarificationClaimCas({
          session: working,
          plan_id: "plan_a",
          now: NOW,
        }),
        reserveClarificationClaimCas({
          session: working,
          plan_id: "plan_b",
          now: NOW,
        }),
      ]);
      const wins = [a, b].filter((r) => r.ok);
      const losses = [a, b].filter((r) => !r.ok);
      assert.equal(wins.length, 1, "exactly one concurrent claim must win");
      assert.equal(losses.length, 1);
      assert.equal(wins[0]!.session.original_question, "working-turn-marker");
      assert.equal(wins[0]!.session.session_revision, 2);
      assert.equal(
        losses[0]!.block_reason,
        "clarification_allowance_exhausted",
      );

      const latest = await requireAuthoritativeSession(record.session_id);
      assert.equal(latest.revision, 2);
      const claims =
        latest.session_snapshot.decision_understanding?.budget.clarification_claims ?? [];
      const active = claims.filter(
        (c) => c.status === "claimed" || c.status === "confirmed",
      );
      assert.equal(active.length, 3);
    });
  });

  await check("CAS reserve: authoritative persistence fail-closed (no memory fallback)", async () => {
    const { reserveClarificationClaimCas } = await import(
      "../lib/poju/decision-intake/clarification-claim-cas"
    );
    const {
      createUnavailableSessionAuthorityStore,
      runWithSessionAuthorityStore,
    } = await import("../lib/poju/session-authority/store");
    const { SessionAuthorityError } = await import(
      "../lib/poju/session-authority/lifecycle"
    );

    await runWithSessionAuthorityStore(createUnavailableSessionAuthorityStore(), async () => {
      const session = {
        session_id: "sess_r3_fail_closed",
        session_revision: 0,
        decision_understanding: {
          budget: {
            soft_budget_limit: 12,
            hard_budget_limit: 15,
            session_asked_count: 0,
            review_cycle: 1,
            cycle_base_asked: 0,
            remaining_hard_budget: 15,
            depth_by_dir: {},
            clarification_allowance: 3,
            clarification_claims: [],
          },
          last_sent_question: null,
        },
      } as POJUSessionState;
      await assert.rejects(
        () =>
          reserveClarificationClaimCas({
            session,
            plan_id: "plan_x",
            now: NOW,
          }),
        (err: unknown) =>
          err instanceof SessionAuthorityError &&
          (err.code === "server_persistence_unavailable" ||
            err.code === "session_not_found"),
      );
    });
  });

  await check("reserve reject: stale working budget cannot overwrite authoritative claims", async () => {
    const { reserveClarificationClaimCas } = await import(
      "../lib/poju/decision-intake/clarification-claim-cas"
    );
    const {
      createMemorySessionAuthorityStore,
      runWithSessionAuthorityStore,
    } = await import("../lib/poju/session-authority/store");
    const {
      initializeAuthoritativeSession,
      commitAuthoritativeSessionUpdate,
      requireAuthoritativeSession,
    } = await import("../lib/poju/session-authority/lifecycle");

    await runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "r4 reject merge",
        device_id: "dev_r4_reject",
      });
      const authClaims = [
        {
          plan_id: "plan_0",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_1",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_2",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
      ];
      const authBudget: SessionBudgetSnapshot = {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 3,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 12,
        depth_by_dir: {},
        clarification_allowance: 3,
        clarification_rounds: 3,
        clarification_claims: authClaims,
      };
      const seeded = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: {
          ...record.session_snapshot,
          decision_understanding: {
            budget: authBudget,
            last_sent_question: {
              question_text: "prior clarify",
              plan_id: "plan_2",
              direction_id: "DIRN-DEFINITION",
              dir_ids: [],
              ddr_ids: [],
              fact_role_codes: [],
              turn_id: "t_prior",
            },
          } as POJUSessionState["decision_understanding"],
        },
        last_committed_turn_id: "t_prior",
      });
      assert.equal(seeded.revision, 1);

      // Working copy still holds the pre-concurrency empty budget.
      const staleWorking: POJUSessionState = {
        ...seeded.session_snapshot,
        session_revision: 0,
        original_question: "working-confirm-turn",
        decision_understanding: {
          ...(seeded.session_snapshot.decision_understanding as object),
          budget: {
            soft_budget_limit: 12,
            hard_budget_limit: 15,
            session_asked_count: 0,
            review_cycle: 1,
            cycle_base_asked: 0,
            remaining_hard_budget: 15,
            depth_by_dir: {},
            clarification_allowance: 3,
            clarification_claims: [],
          },
          last_sent_question: null,
        } as POJUSessionState["decision_understanding"],
        messages: [
          {
            role: "user",
            content: "stale worker turn",
            client_id: "u_stale",
            timestamp: NOW,
          },
        ],
      };

      const rejected = await reserveClarificationClaimCas({
        session: staleWorking,
        plan_id: "plan_new",
        now: NOW,
      });
      assert.equal(rejected.ok, false);
      assert.equal(rejected.block_reason, "clarification_allowance_exhausted");
      assert.equal(rejected.session.session_revision, 1);
      assert.equal(rejected.session.original_question, "working-confirm-turn");
      assert.deepEqual(
        rejected.session.decision_understanding?.budget.clarification_claims,
        authClaims,
      );
      assert.equal(
        rejected.session.decision_understanding?.last_sent_question?.plan_id,
        "plan_2",
      );

      // Agent-style soft confirm path must not wipe authoritative claims on commit.
      const released = releaseAuthorizedQuestionClaim(
        rejected.session,
        "plan_new",
        NOW,
      );
      const sessionOut: POJUSessionState = {
        ...released,
        adaptive_ask_plan: null,
        messages: [
          ...(released.messages ?? []),
          {
            role: "assistant",
            content: "【理解确认】enough",
            client_id: "asst_confirm",
            timestamp: NOW,
          },
        ],
      };
      const committed = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: sessionOut.session_revision!,
        expectedGeneration: record.session_generation,
        snapshot: sessionOut,
        last_committed_turn_id: "u_stale",
      });
      assert.equal(committed.revision, 2);
      const latest = await requireAuthoritativeSession(record.session_id);
      assert.deepEqual(
        latest.session_snapshot.decision_understanding?.budget.clarification_claims,
        authClaims,
      );
      assert.equal(
        latest.session_snapshot.decision_understanding?.budget.clarification_rounds,
        3,
      );
    });
  });

  await check("reserve reject: preserves this-turn core increment while keeping auth claims", async () => {
    const { reserveClarificationClaimCas } = await import(
      "../lib/poju/decision-intake/clarification-claim-cas"
    );
    const {
      createMemorySessionAuthorityStore,
      runWithSessionAuthorityStore,
    } = await import("../lib/poju/session-authority/store");
    const {
      initializeAuthoritativeSession,
      commitAuthoritativeSessionUpdate,
      requireAuthoritativeSession,
    } = await import("../lib/poju/session-authority/lifecycle");

    await runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "r5 core preserve",
        device_id: "dev_r5_core",
      });
      const authClaims = [
        {
          plan_id: "plan_0",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_1",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_2",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
      ];
      const authBudget: SessionBudgetSnapshot = {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 4,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 11,
        depth_by_dir: {},
        core_effective_answer_rounds: 4,
        core_counted_source_turn_ids: ["t1", "t2", "t3", "t4"],
        clarification_allowance: 3,
        clarification_rounds: 3,
        clarification_claims: authClaims,
      };
      const seeded = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: {
          ...record.session_snapshot,
          decision_understanding: {
            budget: authBudget,
            last_sent_question: null,
          } as POJUSessionState["decision_understanding"],
        },
        last_committed_turn_id: "t4",
      });

      // This turn already applied a material DC write and bumped core to 5.
      const working: POJUSessionState = {
        ...seeded.session_snapshot,
        session_revision: seeded.revision,
        decision_understanding: {
          ...(seeded.session_snapshot.decision_understanding as object),
          budget: {
            ...authBudget,
            core_effective_answer_rounds: 5,
            core_counted_source_turn_ids: ["t1", "t2", "t3", "t4", "t5_this_turn"],
            // Stale empty claims in working must not win over auth.
            clarification_claims: [],
            clarification_rounds: 0,
          },
          last_sent_question: null,
        } as POJUSessionState["decision_understanding"],
      };

      const rejected = await reserveClarificationClaimCas({
        session: working,
        plan_id: "plan_new",
        now: NOW,
      });
      assert.equal(rejected.ok, false);
      assert.equal(rejected.block_reason, "clarification_allowance_exhausted");
      assert.equal(
        rejected.session.decision_understanding?.budget.core_effective_answer_rounds,
        5,
      );
      assert.deepEqual(
        rejected.session.decision_understanding?.budget.core_counted_source_turn_ids,
        ["t1", "t2", "t3", "t4", "t5_this_turn"],
      );
      assert.deepEqual(
        rejected.session.decision_understanding?.budget.clarification_claims,
        authClaims,
      );

      const committed = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: rejected.session.session_revision!,
        expectedGeneration: record.session_generation,
        snapshot: {
          ...rejected.session,
          messages: [
            ...(rejected.session.messages ?? []),
            {
              role: "assistant",
              content: "【理解确认】",
              client_id: "asst_r5",
              timestamp: NOW,
            },
          ],
        },
        last_committed_turn_id: "t5_this_turn",
      });
      const latest = await requireAuthoritativeSession(record.session_id);
      assert.equal(committed.revision, seeded.revision + 1);
      assert.equal(
        latest.session_snapshot.decision_understanding?.budget.core_effective_answer_rounds,
        5,
      );
      assert.deepEqual(
        latest.session_snapshot.decision_understanding?.budget.clarification_claims,
        authClaims,
      );
    });
  });

  await check("reserve reject: core advance kept without stale asked/depth overwriting auth", async () => {
    const { reserveClarificationClaimCas } = await import(
      "../lib/poju/decision-intake/clarification-claim-cas"
    );
    const {
      createMemorySessionAuthorityStore,
      runWithSessionAuthorityStore,
    } = await import("../lib/poju/session-authority/store");
    const {
      initializeAuthoritativeSession,
      commitAuthoritativeSessionUpdate,
      requireAuthoritativeSession,
    } = await import("../lib/poju/session-authority/lifecycle");

    await runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "r6 field scoped merge",
        device_id: "dev_r6_fields",
      });
      const authClaims = [
        {
          plan_id: "plan_0",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_1",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_2",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
      ];
      const authBudget: SessionBudgetSnapshot = {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 8,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 7,
        depth_by_dir: { "DIR-DEF-QUESTION": 3, "DIR-DEF-OUTCOME": 2 },
        core_effective_answer_rounds: 4,
        core_counted_source_turn_ids: ["t1", "t2", "t3", "t4"],
        clarification_allowance: 3,
        clarification_rounds: 3,
        clarification_claims: authClaims,
      };
      const seeded = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: {
          ...record.session_snapshot,
          decision_understanding: {
            budget: authBudget,
            last_sent_question: null,
          } as POJUSessionState["decision_understanding"],
        },
        last_committed_turn_id: "t4",
      });

      // Working: proven core+1, but asked/remaining/depth are stale behind auth.
      const working: POJUSessionState = {
        ...seeded.session_snapshot,
        session_revision: seeded.revision,
        decision_understanding: {
          ...(seeded.session_snapshot.decision_understanding as object),
          budget: {
            soft_budget_limit: 12,
            hard_budget_limit: 15,
            session_asked_count: 4,
            review_cycle: 1,
            cycle_base_asked: 0,
            remaining_hard_budget: 11,
            depth_by_dir: { "DIR-DEF-QUESTION": 1 },
            core_effective_answer_rounds: 5,
            core_counted_source_turn_ids: ["t1", "t2", "t3", "t4", "t5_this_turn"],
            clarification_allowance: 3,
            clarification_claims: [],
            clarification_rounds: 0,
          },
          last_sent_question: null,
        } as POJUSessionState["decision_understanding"],
      };

      const rejected = await reserveClarificationClaimCas({
        session: working,
        plan_id: "plan_new",
        now: NOW,
      });
      assert.equal(rejected.ok, false);
      const merged = rejected.session.decision_understanding!.budget;
      assert.equal(merged.core_effective_answer_rounds, 5);
      assert.deepEqual(merged.core_counted_source_turn_ids, [
        "t1",
        "t2",
        "t3",
        "t4",
        "t5_this_turn",
      ]);
      assert.equal(merged.session_asked_count, 8);
      assert.equal(merged.remaining_hard_budget, 7);
      assert.deepEqual(merged.depth_by_dir, {
        "DIR-DEF-QUESTION": 3,
        "DIR-DEF-OUTCOME": 2,
      });
      assert.deepEqual(merged.clarification_claims, authClaims);

      const committed = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: rejected.session.session_revision!,
        expectedGeneration: record.session_generation,
        snapshot: rejected.session,
        last_committed_turn_id: "t5_this_turn",
      });
      const latest = await requireAuthoritativeSession(record.session_id);
      assert.equal(committed.revision, seeded.revision + 1);
      assert.equal(
        latest.session_snapshot.decision_understanding?.budget.session_asked_count,
        8,
      );
      assert.equal(
        latest.session_snapshot.decision_understanding?.budget.core_effective_answer_rounds,
        5,
      );
      assert.deepEqual(
        latest.session_snapshot.decision_understanding?.budget.depth_by_dir,
        { "DIR-DEF-QUESTION": 3, "DIR-DEF-OUTCOME": 2 },
      );
    });
  });

  await check("reserve reject: equal-core longer work ledger missing auth turn id keeps auth", async () => {
    const { reserveClarificationClaimCas } = await import(
      "../lib/poju/decision-intake/clarification-claim-cas"
    );
    const {
      createMemorySessionAuthorityStore,
      runWithSessionAuthorityStore,
    } = await import("../lib/poju/session-authority/store");
    const {
      initializeAuthoritativeSession,
      commitAuthoritativeSessionUpdate,
    } = await import("../lib/poju/session-authority/lifecycle");
    const { GLOBAL_CORE_SPENT_CEILING } = await import(
      "../lib/poju/decision-intake/budget-ledger"
    );

    await runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "r7 provenance equal-core",
        device_id: "dev_r7_eq",
      });
      const authTurnIds = Array.from({ length: GLOBAL_CORE_SPENT_CEILING }, (_, i) => `t${i + 1}`);
      const authEventIds = Array.from({ length: GLOBAL_CORE_SPENT_CEILING }, (_, i) => `e${i + 1}`);
      const authClaims = [
        {
          plan_id: "plan_0",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_1",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_2",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
      ];
      const authBudget: SessionBudgetSnapshot = {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 12,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 3,
        depth_by_dir: {},
        core_effective_answer_rounds: GLOBAL_CORE_SPENT_CEILING,
        core_counted_source_turn_ids: authTurnIds,
        core_counted_answer_event_ids: authEventIds,
        clarification_allowance: 3,
        clarification_rounds: 3,
        clarification_claims: authClaims,
      };
      const seeded = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: {
          ...record.session_snapshot,
          decision_understanding: {
            budget: authBudget,
            last_sent_question: null,
          } as POJUSessionState["decision_understanding"],
        },
        last_committed_turn_id: "t12",
      });

      // Longer working ledger still consistent at ceiling, but drops t12.
      const brokenWorkTurns = [
        ...authTurnIds.filter((id) => id !== "t12"),
        "t13",
        "t14",
      ];
      assert.equal(brokenWorkTurns.includes("t12"), false);
      assert.ok(brokenWorkTurns.length > authTurnIds.length);

      const working: POJUSessionState = {
        ...seeded.session_snapshot,
        session_revision: seeded.revision,
        decision_understanding: {
          ...(seeded.session_snapshot.decision_understanding as object),
          budget: {
            ...authBudget,
            core_counted_source_turn_ids: brokenWorkTurns,
            core_counted_answer_event_ids: [...authEventIds, "e13"],
            clarification_claims: [],
          },
          last_sent_question: null,
        } as POJUSessionState["decision_understanding"],
      };

      const rejected = await reserveClarificationClaimCas({
        session: working,
        plan_id: "plan_new",
        now: NOW,
      });
      assert.equal(rejected.ok, false);
      assert.deepEqual(
        rejected.session.decision_understanding?.budget.core_counted_source_turn_ids,
        authTurnIds,
      );
      assert.deepEqual(
        rejected.session.decision_understanding?.budget.core_counted_answer_event_ids,
        authEventIds,
      );
      assert.equal(
        rejected.session.decision_understanding?.budget.core_effective_answer_rounds,
        GLOBAL_CORE_SPENT_CEILING,
      );
    });
  });

  await check("reserve reject: core-advance missing auth event id keeps auth ledger", async () => {
    const { reserveClarificationClaimCas } = await import(
      "../lib/poju/decision-intake/clarification-claim-cas"
    );
    const {
      createMemorySessionAuthorityStore,
      runWithSessionAuthorityStore,
    } = await import("../lib/poju/session-authority/store");
    const {
      initializeAuthoritativeSession,
      commitAuthoritativeSessionUpdate,
    } = await import("../lib/poju/session-authority/lifecycle");

    await runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "r7 provenance events",
        device_id: "dev_r7_ev",
      });
      const authClaims = [
        {
          plan_id: "plan_0",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_1",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_2",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
      ];
      const authBudget: SessionBudgetSnapshot = {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 8,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 7,
        depth_by_dir: { "DIR-DEF-QUESTION": 2 },
        core_effective_answer_rounds: 4,
        core_counted_source_turn_ids: ["t1", "t2", "t3", "t4"],
        core_counted_answer_event_ids: ["e1", "e2", "e3", "e4"],
        clarification_allowance: 3,
        clarification_rounds: 3,
        clarification_claims: authClaims,
      };
      const seeded = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: {
          ...record.session_snapshot,
          decision_understanding: {
            budget: authBudget,
            last_sent_question: null,
          } as POJUSessionState["decision_understanding"],
        },
        last_committed_turn_id: "t4",
      });

      // Turns extend auth, but event ledger drops e4 — must not adopt working core.
      const working: POJUSessionState = {
        ...seeded.session_snapshot,
        session_revision: seeded.revision,
        decision_understanding: {
          ...(seeded.session_snapshot.decision_understanding as object),
          budget: {
            ...authBudget,
            session_asked_count: 4,
            remaining_hard_budget: 11,
            core_effective_answer_rounds: 5,
            core_counted_source_turn_ids: ["t1", "t2", "t3", "t4", "t5_this_turn"],
            core_counted_answer_event_ids: ["e1", "e2", "e3", "e5_new"],
            clarification_claims: [],
          },
          last_sent_question: null,
        } as POJUSessionState["decision_understanding"],
      };

      const rejected = await reserveClarificationClaimCas({
        session: working,
        plan_id: "plan_new",
        now: NOW,
      });
      assert.equal(rejected.ok, false);
      const merged = rejected.session.decision_understanding!.budget;
      assert.equal(merged.core_effective_answer_rounds, 4);
      assert.deepEqual(merged.core_counted_source_turn_ids, ["t1", "t2", "t3", "t4"]);
      assert.deepEqual(merged.core_counted_answer_event_ids, ["e1", "e2", "e3", "e4"]);
      assert.equal(merged.session_asked_count, 8);
      assert.equal(merged.remaining_hard_budget, 7);
    });
  });

  await check("reserve reject: authoritative null last_sent_question clears working residue", async () => {
    const { reserveClarificationClaimCas } = await import(
      "../lib/poju/decision-intake/clarification-claim-cas"
    );
    const {
      createMemorySessionAuthorityStore,
      runWithSessionAuthorityStore,
    } = await import("../lib/poju/session-authority/store");
    const {
      initializeAuthoritativeSession,
      commitAuthoritativeSessionUpdate,
    } = await import("../lib/poju/session-authority/lifecycle");

    await runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "r5 null last_sent",
        device_id: "dev_r5_null",
      });
      const authClaims = [
        {
          plan_id: "plan_0",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_1",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
        {
          plan_id: "plan_2",
          status: "confirmed" as const,
          claimed_at: NOW,
          confirmed_at: NOW,
        },
      ];
      const seeded = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: {
          ...record.session_snapshot,
          decision_understanding: {
            budget: {
              soft_budget_limit: 12,
              hard_budget_limit: 15,
              session_asked_count: 3,
              review_cycle: 1,
              cycle_base_asked: 0,
              remaining_hard_budget: 12,
              depth_by_dir: {},
              clarification_allowance: 3,
              clarification_rounds: 3,
              clarification_claims: authClaims,
            },
            last_sent_question: null,
          } as POJUSessionState["decision_understanding"],
        },
        last_committed_turn_id: null,
      });

      const working: POJUSessionState = {
        ...seeded.session_snapshot,
        session_revision: 0,
        decision_understanding: {
          ...(seeded.session_snapshot.decision_understanding as object),
          budget: {
            soft_budget_limit: 12,
            hard_budget_limit: 15,
            session_asked_count: 0,
            review_cycle: 1,
            cycle_base_asked: 0,
            remaining_hard_budget: 15,
            depth_by_dir: {},
            clarification_allowance: 3,
            clarification_claims: [],
          },
          last_sent_question: {
            question_text: "stale residue",
            plan_id: "plan_stale",
            direction_id: "DIRN-DEFINITION",
            dir_ids: [],
            ddr_ids: [],
            fact_role_codes: [],
            turn_id: "t_stale",
          },
        } as POJUSessionState["decision_understanding"],
      };

      const rejected = await reserveClarificationClaimCas({
        session: working,
        plan_id: "plan_new",
        now: NOW,
      });
      assert.equal(rejected.ok, false);
      assert.equal(rejected.session.decision_understanding?.last_sent_question, null);
      assert.deepEqual(
        rejected.session.decision_understanding?.budget.clarification_claims,
        authClaims,
      );
    });
  });

  await check("e2e: reserve → guard → outbound → finalize → commit uses post-reserve revision", async () => {
    const { reserveClarificationClaimCas } = await import(
      "../lib/poju/decision-intake/clarification-claim-cas"
    );
    const {
      createMemorySessionAuthorityStore,
      runWithSessionAuthorityStore,
    } = await import("../lib/poju/session-authority/store");
    const {
      initializeAuthoritativeSession,
      commitAuthoritativeSessionUpdate,
      requireAuthoritativeSession,
    } = await import("../lib/poju/session-authority/lifecycle");

    await runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "e2e clarification commit",
        device_id: "dev_r3_e2e",
      });
      const budget: SessionBudgetSnapshot = {
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
      const seeded = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: {
          ...record.session_snapshot,
          decision_understanding: {
            budget,
            last_sent_question: null,
          } as POJUSessionState["decision_understanding"],
        },
        last_committed_turn_id: null,
      });
      assert.equal(seeded.revision, 1);

      const clarPlan: AdaptiveQuestionPlan = {
        plan_id: "qp_e2e_clar",
        candidate_id: "c1",
        direction_id: "DIRN-DEFINITION",
        ddr_ids: ["DDR-P05-01"],
        dir_ids: ["DIR-DEF-QUESTION"],
        fact_role_codes: [],
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
        question_text: "clarify e2e?",
        built_at: NOW,
        scoring_path: "pending_answer_resolution",
        collection_mode: "clarification",
      };

      const working: POJUSessionState = {
        ...seeded.session_snapshot,
        session_revision: seeded.revision,
        messages: [
          {
            role: "user",
            content: "need clarify",
            client_id: "u_e2e",
            timestamp: NOW,
          },
        ],
      };
      const reserved = await reserveClarificationClaimCas({
        session: working,
        plan_id: clarPlan.plan_id,
        now: NOW,
      });
      assert.ok(reserved.ok);
      assert.equal(reserved.session.session_revision, 2);

      const guarded = guardAndAttachAuthorizedQuestion(
        reserved.session,
        clarPlan,
        "u_e2e",
        NOW,
      );
      assert.ok(guarded.attached);

      let sessionOut: POJUSessionState = {
        ...guarded.session,
        messages: [
          ...(guarded.session.messages ?? []),
          {
            role: "assistant",
            content: clarPlan.question_text,
            client_id: "asst_e2e",
            timestamp: NOW,
          },
        ],
      };

      // Stale start revision must fail (the R2 P0).
      await assert.rejects(
        () =>
          commitAuthoritativeSessionUpdate({
            sessionId: record.session_id,
            expectedRevision: seeded.revision,
            expectedGeneration: record.session_generation,
            snapshot: sessionOut,
            last_committed_turn_id: "u_e2e",
          }),
        (err: unknown) =>
          err instanceof Error && /stale revision|CAS/i.test(err.message),
      );

      sessionOut = finalizeClarificationClaimsForDurableCommit(sessionOut, NOW);
      assert.equal(
        sessionOut.decision_understanding!.budget.clarification_claims?.[0]?.status,
        "confirmed",
      );

      const committed = await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: sessionOut.session_revision!,
        expectedGeneration: record.session_generation,
        snapshot: sessionOut,
        last_committed_turn_id: "u_e2e",
      });
      assert.equal(committed.revision, 3);

      const latest = await requireAuthoritativeSession(record.session_id);
      assert.equal(
        latest.session_snapshot.decision_understanding?.budget.clarification_claims?.[0]
          ?.status,
        "confirmed",
      );
      const assistantQs = (latest.session_snapshot.messages ?? []).filter(
        (m) => m.role === "assistant" && m.content.includes("clarify e2e"),
      );
      assert.equal(assistantQs.length, 1);

      // Duplicate plan_id attach after durable send must be rejected.
      const dup = guardAndAttachAuthorizedQuestion(
        latest.session_snapshot,
        clarPlan,
        "u_e2e_2",
        NOW,
      );
      assert.equal(dup.attached, false);
      assert.equal(dup.block_reason, "plan_already_sent");
    });
  });

  await check("finalizeClarification: claimed until assistant message on commit", () => {
    const clarPlan: AdaptiveQuestionPlan = {
      plan_id: "qp_finalize",
      candidate_id: "c1",
      direction_id: "DIRN-DEFINITION",
      ddr_ids: ["DDR-P05-01"],
      dir_ids: ["DIR-DEF-QUESTION"],
      fact_role_codes: [],
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
      question_text: "clarify?",
      built_at: NOW,
      scoring_path: "pending_answer_resolution",
      collection_mode: "clarification",
    };
    const baseBudget: SessionBudgetSnapshot = {
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
    let session = {
      decision_understanding: { budget: { ...baseBudget }, last_sent_question: null },
    } as POJUSessionState;
    const guarded = guardAndAttachAuthorizedQuestion(session, clarPlan, "t1", NOW);
    assert.ok(guarded.attached);
    const beforeMsg = finalizeClarificationClaimsForDurableCommit(guarded.session, NOW);
    assert.equal(
      beforeMsg.decision_understanding!.budget.clarification_claims?.[0]?.status,
      "claimed",
    );
    const withMsg = {
      ...guarded.session,
      messages: [
        { role: "assistant" as const, content: "clarify?", client_id: "asst_1", timestamp: NOW },
      ],
    };
    const after = finalizeClarificationClaimsForDurableCommit(withMsg, NOW);
    assert.equal(
      after.decision_understanding!.budget.clarification_claims?.[0]?.status,
      "confirmed",
    );
  });

  await check("unverified fact + statement is non-material for core", () => {
    const dc = draftDc({
      reality_facts: [
        {
          fact_id: "uv",
          statement: "draft only",
          status: "unverified",
          verification_level: "user_stated",
          source_stage: "collecting_context",
          source_turn_id: "t_uv",
          user_confirmed: false,
          fact_roles: ["situation"],
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const session = { decision_context: dc } as POJUSessionState;
    assert.equal(
      isMaterialDcWrite({
        fact_ids_written: ["uv"],
        constraint_ids_written: [],
        session,
        answer: { classification: "substantive" },
      }),
      false,
    );
    const migrated = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      dc,
    );
    assert.equal(migrated.core_effective_answer_rounds ?? 0, 0);
  });

  await check("P1-A: unverified-only Constraint does not consume core rounds", () => {
    const turnId = "t_cst_uv";
    const dc = draftDc({
      constraints: [
        {
          constraint_id: "cst_uv",
          statement: "预算暂定 50 万",
          category: "financial",
          status: "unverified",
          verification_level: "user_asserted",
          source_stage: "collecting_context",
          source_turn_id: turnId,
          rigidity: "hard",
          user_confirmed: false,
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const session = { decision_context: dc } as POJUSessionState;
    assert.equal(
      isMaterialDcWrite({
        fact_ids_written: [],
        constraint_ids_written: ["cst_uv"],
        session,
        answer: { classification: "substantive" },
      }),
      false,
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
    // Production path only bumps after isMaterialDcWrite; still prove bump alone
    // is not invoked for this delta by asserting materiality false above.
    assert.equal(budget.core_effective_answer_rounds, 0);
    const migrated = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      dc,
    );
    assert.equal(migrated.core_effective_answer_rounds ?? 0, 0);
    assert.ok(!(migrated.core_counted_source_turn_ids ?? []).includes(turnId));
  });

  await check("P1-A: confirmed Constraint still counts as material core round", () => {
    const turnId = "t_cst_ok";
    const dc = draftDc({
      constraints: [
        {
          constraint_id: "cst_ok",
          statement: "不能接受降薪",
          category: "financial",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting_context",
          source_turn_id: turnId,
          rigidity: "hard",
          user_confirmed: true,
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const session = { decision_context: dc } as POJUSessionState;
    assert.equal(
      isMaterialDcWrite({
        fact_ids_written: [],
        constraint_ids_written: ["cst_ok"],
        session,
        answer: { classification: "substantive" },
      }),
      true,
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
      source_turn_id: turnId,
      answer_event_id: "e_cst_ok",
    });
    assert.equal(budget.core_effective_answer_rounds, 1);
    assert.deepEqual(budget.core_counted_source_turn_ids, [turnId]);
    const migrated = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      dc,
    );
    assert.equal(migrated.core_effective_answer_rounds, 1);
    assert.deepEqual(migrated.core_counted_source_turn_ids, [turnId]);
  });

  await check("P1-A: mixed unverified Constraint + confirmed Fact counts once", () => {
    const turnId = "t_mix_a";
    const dc = draftDc({
      reality_facts: [
        {
          fact_id: "f_ok",
          statement: "已有 offer",
          status: "confirmed",
          verification_level: "user_stated",
          source_stage: "collecting_context",
          source_turn_id: turnId,
          user_confirmed: true,
          fact_roles: ["situation"],
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
      constraints: [
        {
          constraint_id: "cst_uv",
          statement: "预算未核实",
          category: "financial",
          status: "unverified",
          verification_level: "user_asserted",
          source_stage: "collecting_context",
          source_turn_id: turnId,
          rigidity: "soft",
          user_confirmed: false,
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const session = { decision_context: dc } as POJUSessionState;
    assert.equal(
      isMaterialDcWrite({
        fact_ids_written: ["f_ok"],
        constraint_ids_written: ["cst_uv"],
        session,
        answer: { classification: "substantive" },
      }),
      true,
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
      source_turn_id: turnId,
      answer_event_id: "e_mix_a",
    });
    assert.equal(budget.core_effective_answer_rounds, 1);
    const migrated = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      dc,
    );
    assert.equal(migrated.core_effective_answer_rounds, 1);
    assert.deepEqual(migrated.core_counted_source_turn_ids, [turnId]);
  });

  await check("P1-A: mixed unverified Fact + confirmed Constraint counts once", () => {
    const turnId = "t_mix_b";
    const dc = draftDc({
      reality_facts: [
        {
          fact_id: "f_uv",
          statement: "草稿事实",
          status: "unverified",
          verification_level: "user_stated",
          source_stage: "collecting_context",
          source_turn_id: turnId,
          user_confirmed: false,
          fact_roles: ["situation"],
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
      constraints: [
        {
          constraint_id: "cst_ok",
          statement: "三个月内必须决定",
          category: "time",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting_context",
          source_turn_id: turnId,
          rigidity: "hard",
          user_confirmed: true,
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const session = { decision_context: dc } as POJUSessionState;
    assert.equal(
      isMaterialDcWrite({
        fact_ids_written: ["f_uv"],
        constraint_ids_written: ["cst_ok"],
        session,
        answer: { classification: "substantive" },
      }),
      true,
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
      source_turn_id: turnId,
      answer_event_id: "e_mix_b",
    });
    assert.equal(budget.core_effective_answer_rounds, 1);
    const migrated = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      dc,
    );
    assert.equal(migrated.core_effective_answer_rounds, 1);
    assert.deepEqual(migrated.core_counted_source_turn_ids, [turnId]);
  });

  await check("P1-A: migration/reconstruction excludes unverified Constraint, keeps confirmed", () => {
    const uvTurn = "t_mig_uv";
    const okTurn = "t_mig_ok";
    const dcUvOnly = draftDc({
      constraints: [
        {
          constraint_id: "cst_mig_uv",
          statement: "历史未核实约束",
          category: "financial",
          status: "unverified",
          verification_level: "user_asserted",
          source_stage: "collecting_context",
          source_turn_id: uvTurn,
          rigidity: "hard",
          user_confirmed: false,
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const migratedUv = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      dcUvOnly,
    );
    assert.equal(migratedUv.core_effective_answer_rounds ?? 0, 0);
    assert.ok(!(migratedUv.core_counted_source_turn_ids ?? []).includes(uvTurn));
    assert.equal(migratedUv.budget_migration_evidence, "material_source_turn_ids");

    const dcOk = draftDc({
      constraints: [
        {
          constraint_id: "cst_mig_ok",
          statement: "历史已确认约束",
          category: "time",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting_context",
          source_turn_id: okTurn,
          rigidity: "hard",
          user_confirmed: true,
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const migratedOk = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      dcOk,
    );
    assert.equal(migratedOk.core_effective_answer_rounds, 1);
    assert.deepEqual(migratedOk.core_counted_source_turn_ids, [okTurn]);

    const repaired = repairCoreLedgerFromDc(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
        core_effective_answer_rounds: 1,
        core_counted_source_turn_ids: [okTurn],
      },
      dcOk,
    );
    assert.equal(repaired.core_effective_answer_rounds, 1);
    assert.deepEqual(repaired.core_counted_source_turn_ids, [okTurn]);

    const repairedUv = repairCoreLedgerFromDc(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
        core_effective_answer_rounds: 0,
        core_counted_source_turn_ids: [],
      },
      dcUvOnly,
    );
    assert.equal(repairedUv.core_effective_answer_rounds, 0);
    assert.deepEqual(repairedUv.core_counted_source_turn_ids, []);
  });

  await check("P1-A: confirmed Constraint does not bypass non-material / empty statement", () => {
    const emptyDc = draftDc({
      constraints: [
        {
          constraint_id: "cst_empty",
          statement: "   ",
          category: "financial",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting_context",
          source_turn_id: "t_empty",
          rigidity: "hard",
          user_confirmed: true,
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    assert.equal(
      isMaterialDcWrite({
        fact_ids_written: [],
        constraint_ids_written: ["cst_empty"],
        session: { decision_context: emptyDc } as POJUSessionState,
        answer: { classification: "substantive" },
      }),
      false,
    );
    const migratedEmpty = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      emptyDc,
    );
    assert.equal(migratedEmpty.core_effective_answer_rounds ?? 0, 0);
    assert.ok(!(migratedEmpty.core_counted_source_turn_ids ?? []).includes("t_empty"));

    const okDc = draftDc({
      constraints: [
        {
          constraint_id: "cst_cls",
          statement: "硬约束",
          category: "financial",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting_context",
          source_turn_id: "t_cls",
          rigidity: "hard",
          user_confirmed: true,
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    assert.equal(
      isMaterialDcWrite({
        fact_ids_written: [],
        constraint_ids_written: ["cst_cls"],
        session: { decision_context: okDc } as POJUSessionState,
        answer: { classification: "unknown" },
      }),
      false,
    );
  });

  await check("P1-A: confirmed Constraint without source_turn_id is orphan fail-closed", () => {
    const dc = draftDc({
      constraints: [
        {
          constraint_id: "cst_no_turn",
          statement: "不能降薪",
          category: "financial",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting_context",
          source_turn_id: null,
          rigidity: "hard",
          user_confirmed: true,
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    // Live materiality looks at status/statement of written ids, not turn attribution.
    assert.equal(
      isMaterialDcWrite({
        fact_ids_written: [],
        constraint_ids_written: ["cst_no_turn"],
        session: { decision_context: dc } as POJUSessionState,
        answer: { classification: "substantive" },
      }),
      true,
    );
    const migrated = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      dc,
    );
    assert.equal(
      migrated.budget_migration_evidence,
      "uncertain_orphan_facts_fail_closed",
    );
    assert.equal(migrated.core_effective_answer_rounds, GLOBAL_CORE_SPENT_CEILING);
    // Not a normal attributed material turn — reconstruction yields no turn ids.
    assert.deepEqual(migrated.core_counted_source_turn_ids, []);

    const repaired = repairCoreLedgerFromDc(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
        core_effective_answer_rounds: 0,
        core_counted_source_turn_ids: [],
      },
      dc,
    );
    assert.equal(repaired.core_effective_answer_rounds, 0);
    assert.deepEqual(repaired.core_counted_source_turn_ids, []);
  });

  await check("P1-A: live core path requires source_turn_id; answer_event_id alone is not DC attribution", () => {
    const adaptiveSrc = readFileSync(
      join(process.cwd(), "lib/poju/decision-intake/adaptive-turn.ts"),
      "utf8",
    );
    const wrapperMatch = adaptiveSrc.match(
      /function sessionWithCoreBudgetAfterMaterialWrite\(([\s\S]*?)\): POJUSessionState \{/,
    );
    assert.ok(wrapperMatch, "sessionWithCoreBudgetAfterMaterialWrite must exist");
    assert.match(
      wrapperMatch![1],
      /source_turn_id:\s*string/,
      "production wrapper requires source_turn_id: string",
    );
    assert.match(
      adaptiveSrc,
      /bumpCoreAfterMaterialWrite\(u\.budget,\s*\{\s*source_turn_id,\s*answer_event_id:\s*answer_event\.event_id,\s*\}\)/,
    );
    const callSites = [
      ...adaptiveSrc.matchAll(
        /sessionWithCoreBudgetAfterMaterialWrite\(\s*[\w.]+\s*,\s*[\w.]+\s*,\s*[\w.]+\s*,\s*([\w.]+)\s*,?\s*\)/g,
      ),
    ];
    assert.equal(callSites.length, 3, "expected three production call sites");
    for (const m of callSites) {
      assert.match(
        m[1],
        /source_turn_id$/,
        `call site must forward a source_turn_id, got ${m[1]}`,
      );
    }

    const applySrc = readFileSync(
      join(process.cwd(), "lib/poju/decision-intake/apply-answer-to-dc.ts"),
      "utf8",
    );
    assert.match(
      applySrc,
      /const c: Constraint = \{[\s\S]*?source_turn_id:\s*turnId,/,
      "new Constraints are attributed to the apply turnId",
    );

    // Low-level bump can accept answer_event_id alone, but that does not create
    // a DC-attributable material turn id for reconstruction.
    let eventOnly = bumpCoreAfterMaterialWrite(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
        core_effective_answer_rounds: 0,
        core_counted_source_turn_ids: [],
      },
      { answer_event_id: "ev_only_no_turn" },
    );
    assert.equal(eventOnly.core_effective_answer_rounds, 1);
    assert.deepEqual(eventOnly.core_counted_source_turn_ids, []);
    assert.deepEqual(eventOnly.core_counted_answer_event_ids, ["ev_only_no_turn"]);

    const attributedDc = draftDc({
      constraints: [
        {
          constraint_id: "cst_attr",
          statement: "有 turn 的确认约束",
          category: "time",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting_context",
          source_turn_id: "t_attr",
          rigidity: "hard",
          user_confirmed: true,
          related_dir_ids: ["DIR-DEF-QUESTION"],
        },
      ],
    });
    const reconstructed = migrateSessionBudget(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
      },
      attributedDc,
    );
    assert.equal(reconstructed.core_effective_answer_rounds, 1);
    assert.deepEqual(reconstructed.core_counted_source_turn_ids, ["t_attr"]);
    assert.ok(
      !(reconstructed.core_counted_source_turn_ids ?? []).includes("ev_only_no_turn"),
    );

    // Production-shaped live bump: wrapper always pairs turn id + event id.
    let live = bumpCoreAfterMaterialWrite(
      {
        soft_budget_limit: 12,
        hard_budget_limit: 15,
        session_asked_count: 0,
        review_cycle: 1,
        cycle_base_asked: 0,
        remaining_hard_budget: 15,
        depth_by_dir: {},
        core_effective_answer_rounds: 0,
        core_counted_source_turn_ids: [],
      },
      { source_turn_id: "t_attr", answer_event_id: "ev_live" },
    );
    assert.equal(live.core_effective_answer_rounds, 1);
    assert.deepEqual(live.core_counted_source_turn_ids, ["t_attr"]);
    assert.deepEqual(live.core_counted_answer_event_ids, ["ev_live"]);
  });

  await check("closure P1-1: askable DC needs bind DIR collect paths", () => {
    const askableEmpty = REPORT_INFORMATION_NEEDS.filter(
      (n) =>
        n.source_kind === "decision_context" &&
        n.ask_policy === "ask_if_material" &&
        n.dir_ids.length === 0,
    );
    assert.equal(askableEmpty.length, 0);

    const pastNeeds = reportInformationNeedsForDirIds(["DIR-PAST-ATTEMPTS"]).filter(
      (n) => n.ask_policy === "ask_if_material",
    );
    assert.ok(pastNeeds.some((n) => n.need_id === "need:dc:04b-user-experience"));
    assert.ok(pastNeeds.some((n) => n.need_id === "need:dc:06c-execution-experience"));

    // 06c must collect past_attempt (lived execution), never validation_capacity.
    const n06c = reportInformationNeedById("need:dc:06c-execution-experience");
    assert.ok(n06c);
    assert.deepEqual([...n06c!.dir_ids], ["DIR-PAST-ATTEMPTS"]);
    assert.ok(
      n06c!.fact_role_refs.some(
        (r) => r.dir_id === "DIR-PAST-ATTEMPTS" && r.fact_role === "past_attempt",
      ),
      "06c fact_role_refs must include past_attempt",
    );
    assert.ok(
      !n06c!.fact_role_refs.some((r) => r.fact_role === "validation_capacity"),
      "06c must not bind validation_capacity",
    );
    assert.ok(!n06c!.dir_ids.includes("DIR-VALIDATION-CAPACITY"));

    const n04b = reportInformationNeedById("need:dc:04b-user-experience");
    assert.ok(n04b);
    assert.ok(
      n04b!.fact_role_refs.some(
        (r) => r.dir_id === "DIR-PAST-ATTEMPTS" && r.fact_role === "past_attempt",
      ),
      "04b fact_role_refs must include past_attempt",
    );

    const optNeeds = reportInformationNeedsForDirIds(["DIR-OPT-ON-TABLE"]).filter(
      (n) => n.ask_policy === "ask_if_material",
    );
    assert.ok(optNeeds.some((n) => n.need_id === "need:dc:DIR-OPT-ON-TABLE"));
    assert.ok(optNeeds.some((n) => n.need_id === "need:dc:05c-option-conflict"));
    assert.equal(
      reportInformationNeedById("need:dc:05b-alternative-options")?.ask_policy,
      "never",
    );

    const dc = draftDc({
      dirs: [
        {
          dir_id: "DIR-PAST-ATTEMPTS",
          need: "past",
          why: "w",
          required_fact_roles: ["past_attempt"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          id_lifecycle: "active",
          may_affect_p5_ranking: false,
        },
        {
          dir_id: "DIR-OPT-ON-TABLE",
          need: "opts",
          why: "w",
          required_fact_roles: ["option"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          id_lifecycle: "active",
          may_affect_p5_ranking: true,
        },
      ],
    });
    const bp = {
      ...minimalBlueprint(),
      dir_ids: ["DIR-PAST-ATTEMPTS", "DIR-OPT-ON-TABLE", ...minimalBlueprint().dir_ids],
      ddr_ids: [
        "DDR-01-PRIMARY",
        "DDR-02-ATTRIBUTION",
        "DDR-01-ANTI-PATH",
        ...minimalBlueprint().ddr_ids,
      ],
    };
    const candidates = buildIntakeCandidatesFromDc(dc, bp);
    const pastCand = candidates.find((c) => c.dir_ids.includes("DIR-PAST-ATTEMPTS"));
    assert.ok(pastCand, "DIR-PAST-ATTEMPTS must enter AQE candidates");
    assert.ok(pastCand!.need_ids?.includes("need:dc:04b-user-experience"));
    assert.ok(pastCand!.need_ids?.includes("need:dc:06c-execution-experience"));
    assert.ok(
      pastCand!.fact_role_codes.some((code) =>
        code.includes("/DIR-PAST-ATTEMPTS/role/past_attempt"),
      ),
      "AQE candidate for past attempts must ask past_attempt, not validation_capacity",
    );
    assert.ok(
      !pastCand!.fact_role_codes.some((code) => code.includes("validation_capacity")),
    );
    const optCand = candidates.find((c) => c.dir_ids.includes("DIR-OPT-ON-TABLE"));
    assert.ok(optCand, "DIR-OPT-ON-TABLE must enter AQE candidates");
    assert.ok(optCand!.need_ids?.includes("need:dc:DIR-OPT-ON-TABLE"));
    assert.ok(optCand!.need_ids?.includes("need:dc:05c-option-conflict"));
  });

  await check("closure P1-2: catalog fallback binds SSOT need_ids and validates", () => {
    const bp = {
      ...minimalBlueprint(),
      dir_ids: [...minimalBlueprint().dir_ids, "DIR-STATUS-QUO"],
      ddr_ids: ["DDR-01-PRIMARY", ...minimalBlueprint().ddr_ids],
      directions: [
        ...minimalBlueprint().directions,
        {
          direction_id: "DIRN-STATUS",
          priority: "P0" as const,
          dir_ids: ["DIR-STATUS-QUO"],
          scope_boundary: "test",
          depth_soft_cap: 3,
        },
      ],
    };
    const ddr = resolveDdrIdsForDir("DIR-STATUS-QUO", bp);
    assert.ok(ddr.length > 0 && !ddr.some((id) => id.startsWith("DDR_FOR_")));

    const dc = draftDc({
      dirs: [
        {
          dir_id: "DIR-STATUS-QUO",
          need: "status",
          why: "baseline",
          required_fact_roles: ["status_quo"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          id_lifecycle: "active",
          may_affect_p5_ranking: true,
        },
      ],
    });
    const understanding = {
      need_to_understand: {
        items: [
          {
            kind: "dir_based" as const,
            dir_id: "DIR-STATUS-QUO",
            ddr_ids: ddr,
            direction_id: "DIRN-STATUS",
            priority: "P0" as const,
            why: "blocking",
            missing_content: "status quo unknown",
            may_affect_p5_ranking: true,
            gap_type: "unknown" as const,
            must_continue: true,
            need_id: "need:dc:DIR-STATUS-QUO",
          },
        ],
      },
      last_sent_question: null,
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
        clarification_allowance: 3,
        clarification_claims: [],
      },
    } as UnderstandingState;

    const fb = tryCatalogFallbackForOpenBlocking({
      dc,
      blueprint: bp,
      understanding,
      budget: understanding.budget,
      now: NOW,
      scoring_path: "test→catalog_fallback",
    });
    assert.ok(fb.plan, `fallback must produce plan, last_reject=${fb.last_reject}`);
    assert.ok(fb.plan!.need_ids?.length);
    assert.ok(
      fb.plan!.need_ids!.every((id) => {
        const n = reportInformationNeedById(id);
        return (
          n?.source_kind === "decision_context" && n.ask_policy === "ask_if_material"
        );
      }),
    );
    const scope = validateScopeDepthBudget({
      plan: fb.plan!,
      blueprint: bp,
      budget: understanding.budget,
      dc,
    });
    assert.equal(scope.ok, true, scope.ok ? "" : scope.reason_code);

    const session = {
      decision_understanding: {
        budget: understanding.budget,
        last_sent_question: null,
      },
    } as POJUSessionState;
    const attached = guardAndAttachAuthorizedQuestion(
      session,
      fb.plan!,
      "turn_fb",
      NOW,
    );
    assert.equal(attached.attached, true, attached.block_reason);
  });

  await check("closure P1-3: complexity uses real materials not Blueprint inventory", () => {
    const emptySignals = complexitySignalsFromDecisionMaterials({
      dc: draftDc(),
      page_07_emit: false,
    });
    assert.equal(emptySignals.high_stakes, false);
    assert.equal(emptySignals.irreversible, false);
    assert.equal(emptySignals.option_count, 2);
    const emptyBand = classifyDecisionIntakeComplexity(emptySignals);
    assert.equal(emptyBand.complexity, "simple");
    assert.equal(emptyBand.core_round_hard_cap, 7);

    // Blueprint-like inventory of stakes/irrev DIRs must not upgrade alone.
    const noUpgrade = classifyDecisionIntakeComplexity(
      complexitySignalsFromDecisionMaterials({
        dc: draftDc({
          dirs: [
            {
              dir_id: "DIR-DEF-STAKES",
              need: "s",
              why: "w",
              required_fact_roles: ["loss"],
              current_state: "unknown",
              partial_satisfaction: false,
              agenda_item_ids: [],
              id_lifecycle: "active",
              may_affect_p5_ranking: false,
            },
            {
              dir_id: "DIR-OPT-IRREV",
              need: "i",
              why: "w",
              required_fact_roles: ["cost"],
              current_state: "unknown",
              partial_satisfaction: false,
              agenda_item_ids: [],
              id_lifecycle: "active",
              may_affect_p5_ranking: false,
            },
          ],
        }),
        page_07_emit: false,
      }),
    );
    assert.equal(noUpgrade.complexity, "simple");

    const withStakes = complexitySignalsFromDecisionMaterials({
      dc: draftDc({
        reality_facts: [
          {
            fact_id: "st1",
            statement: "做错会失去住房首付",
            status: "confirmed",
            verification_level: "user_stated",
            source_stage: "collecting_context",
            source_turn_id: "t1",
            user_confirmed: true,
            related_dir_ids: ["DIR-DEF-STAKES"],
          },
        ],
      }),
    });
    assert.equal(withStakes.high_stakes, true);
    assert.equal(classifyDecisionIntakeComplexity(withStakes).complexity, "medium");

    // RealityFact has no durable option identity. Fail-closed: statement /
    // fact_id cardinality must not upgrade option_count above baseline 2.
    const opt = (
      fact_id: string,
      statement: string,
      turn: string,
      extra?: Partial<DecisionContext["reality_facts"][number]>,
    ) => ({
      fact_id,
      statement,
      status: "confirmed" as const,
      verification_level: "user_asserted" as const,
      source_stage: "collecting_context" as const,
      source_turn_id: turn,
      user_confirmed: true,
      fact_roles: ["option"],
      related_dir_ids: ["DIR-OPT-ON-TABLE"],
      ...extra,
    });

    // 1) Two real options, one RealityFact each → baseline 2 (no identity upgrade).
    const twoSingletonFacts = [
      opt("oa", "接受 Offer A", "t1"),
      opt("ob", "维持现状", "t2"),
    ];
    assert.equal(countProvenDistinctOptions({ reality_facts: twoSingletonFacts }), 0);
    assert.equal(
      complexitySignalsFromDecisionMaterials({
        dc: draftDc({ reality_facts: twoSingletonFacts }),
      }).option_count,
      2,
    );

    // 2) Same real option, three different statements (incl. correction links)
    // → still one logical proposition family, but no durable option id → no upgrade.
    const sameOptionParaphrases = [
      opt("p1", "接受 A 公司的 offer", "t1"),
      opt("p2", "加入 A 公司担任产品负责人", "t2", {
        corrects_fact_ids: ["p1"],
      }),
      opt("p3", "去 A 公司工作，接受新的管理职责", "t3", {
        corrects_fact_ids: ["p1", "p2"],
      }),
    ];
    assert.equal(countProvenDistinctOptions({ reality_facts: sameOptionParaphrases }), 0);
    assert.equal(
      complexitySignalsFromDecisionMaterials({
        dc: draftDc({ reality_facts: sameOptionParaphrases }),
      }).option_count,
      2,
      "paraphrases of one option must not become option_count=3",
    );

    // 3) Two real options, each with multiple different descriptions → still 2.
    const twoOptsMultiDesc = [
      opt("a1", "接受 A 公司的 offer", "t1"),
      opt("a2", "加入 A 公司担任产品负责人", "t2", { corrects_fact_ids: ["a1"] }),
      opt("b1", "维持现状", "t3"),
      opt("b2", "继续留在当前岗位观察一年", "t4", { corrects_fact_ids: ["b1"] }),
    ];
    assert.equal(
      complexitySignalsFromDecisionMaterials({
        dc: draftDc({ reality_facts: twoOptsMultiDesc }),
      }).option_count,
      2,
    );

    // 4) Constraints do not increase option_count.
    const withConstraints = complexitySignalsFromDecisionMaterials({
      dc: draftDc({
        reality_facts: [
          opt("oa", "接受 Offer A", "t1"),
          opt("ob", "维持现状", "t2"),
        ],
        constraints: [
          {
            constraint_id: "c1",
            statement: "薪酬不能低于某水平",
            category: "financial",
            status: "confirmed",
            verification_level: "user_asserted",
            source_stage: "collecting_context",
            source_turn_id: "t4",
            rigidity: "hard",
            user_confirmed: true,
            related_dir_ids: ["DIR-OPT-ON-TABLE"],
          },
          {
            constraint_id: "c2",
            statement: "不能搬离当前城市",
            category: "responsibility",
            status: "confirmed",
            verification_level: "user_asserted",
            source_stage: "collecting_context",
            source_turn_id: "t5",
            rigidity: "hard",
            user_confirmed: true,
            related_dir_ids: ["DIR-OPT-ON-TABLE"],
          },
          {
            constraint_id: "c3",
            statement: "必须照顾家庭成员",
            category: "responsibility",
            status: "confirmed",
            verification_level: "user_asserted",
            source_stage: "collecting_context",
            source_turn_id: "t6",
            rigidity: "hard",
            user_confirmed: true,
            related_dir_ids: ["DIR-OPT-ON-TABLE"],
          },
        ],
      }),
    });
    assert.equal(withConstraints.option_count, 2);

    // 5) Missing option role does not increase count.
    assert.equal(
      complexitySignalsFromDecisionMaterials({
        dc: draftDc({
          reality_facts: [
            opt("oa", "接受 Offer A", "t1"),
            opt("ob", "维持现状", "t2"),
            {
              ...opt("non_option", "同事提到过远程岗", "t3"),
              fact_roles: ["situation"],
            },
          ],
        }),
      }).option_count,
      2,
    );

    // 6) unknown / unverified RealityFacts do not increase count.
    assert.equal(
      complexitySignalsFromDecisionMaterials({
        dc: draftDc({
          reality_facts: [
            opt("oa", "接受 Offer A", "t1"),
            opt("ob", "维持现状", "t2"),
            {
              ...opt("uv", "创业", "t3"),
              status: "unverified",
              user_confirmed: false,
            },
            {
              ...opt("unk", "出国读研", "t4"),
              status: "unknown",
              user_confirmed: false,
            },
          ],
        }),
      }).option_count,
      2,
    );

    // 7) Materials without stable option identity must not upgrade complexity.
    const noIdentityUpgrade = classifyDecisionIntakeComplexity(
      complexitySignalsFromDecisionMaterials({
        dc: draftDc({
          reality_facts: [
            opt("o1", "接受 offer A", "t1"),
            opt("o2", "加入 A 公司", "t2"),
            opt("o3", "维持现状", "t3"),
            opt("o4", "创业", "t4"),
          ],
        }),
        page_07_emit: false,
      }),
    );
    assert.equal(noIdentityUpgrade.complexity, "simple");
    assert.equal(noIdentityUpgrade.core_round_hard_cap, 7);

    // 8) Four independent option *statements* without identity stay baseline —
    // complexity must not treat text cardinality as four real options.
    const fourStatementFacts = [
      opt("o1", "接受 offer A", "t1"),
      opt("o2", "接受 offer A", "t2"), // exact duplicate text still no identity
      opt("o3", "维持现状", "t3"),
      opt("o4", "创业", "t4"),
    ];
    assert.equal(countProvenDistinctOptions({ reality_facts: fourStatementFacts }), 0);
    const fourStatements = complexitySignalsFromDecisionMaterials({
      dc: draftDc({ reality_facts: fourStatementFacts }),
    });
    assert.equal(fourStatements.option_count, 2);
    assert.equal(
      classifyDecisionIntakeComplexity(fourStatements).complexity,
      "simple",
    );

    // Non-confirmed stakes material must not flip high_stakes.
    const missingStakes = complexitySignalsFromDecisionMaterials({
      dc: draftDc({
        reality_facts: [
          {
            fact_id: "st_missing",
            statement: "可能失去首付",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting_context",
            source_turn_id: "t1",
            user_confirmed: false,
            related_dir_ids: ["DIR-DEF-STAKES"],
          },
        ],
        constraints: [
          {
            constraint_id: "st_uv",
            statement: "不可逆损失边界未核实",
            category: "unacceptable_outcome",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting_context",
            source_turn_id: "t2",
            rigidity: "hard",
            user_confirmed: false,
            related_dir_ids: ["DIR-DEF-STAKES"],
          },
        ],
      }),
    });
    assert.equal(missingStakes.high_stakes, false);
  });

  await check("closure P2: Page07 ranking needs never_block under freeze rule", () => {
    for (const dirId of [
      "DIR-JOB-OFFER",
      "DIR-BIZ-MODEL",
      "DIR-REL-DYNAMICS",
      "DIR-LOCALE-MOVE",
      "DIR-EDU-PATH",
    ]) {
      const n = reportInformationNeedById(`need:dc:${dirId}`);
      assert.ok(n);
      assert.equal(n!.readiness_effect, "never_block");
      assert.notEqual(n!.decision_materiality, "decision_critical");
    }
    assertReportInformationNeedsIntegrity();
  });

  await check("ordinary guard: invalid need source or ask_policy", () => {
    const badNever: AdaptiveQuestionPlan = {
      plan_id: "qp_never",
      candidate_id: "c1",
      direction_id: "DIRN-DEFINITION",
      ddr_ids: ["DDR-P05-01"],
      dir_ids: ["DIR-DEF-QUESTION"],
      fact_role_codes: [],
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
      need_ids: ["need:upstream:01b-page02-basis"],
    };
    const session = {
      decision_understanding: {
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
        last_sent_question: null,
      },
    } as POJUSessionState;
    const rNever = guardAndAttachAuthorizedQuestion(session, badNever, "t1", NOW);
    assert.equal(rNever.attached, false);
    assert.equal(rNever.block_reason, "invalid_ssot_need_ids");
    const badSource: AdaptiveQuestionPlan = {
      ...badNever,
      plan_id: "qp_src",
      need_ids: ["need:local:02a-profile-relevant"],
    };
    const rSrc = guardAndAttachAuthorizedQuestion(session, badSource, "t1", NOW);
    assert.equal(rSrc.attached, false);
    assert.equal(rSrc.block_reason, "invalid_ssot_need_ids");
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