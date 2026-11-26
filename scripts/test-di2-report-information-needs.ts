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
    finalizeClarificationClaimsForDurableCommit,
    releaseAuthorizedQuestionClaim,
  } = await import("../lib/poju/decision-intake/adaptive-turn");
  const { buildIntakeCandidatesFromDc } = await import(
    "../lib/poju/decision-context/production-intake-ask"
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