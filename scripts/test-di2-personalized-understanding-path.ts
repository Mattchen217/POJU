/**
 * Focused DI2 Personalized Understanding path checks (no live OpenRouter).
 * Run: pnpm exec tsx scripts/test-di2-personalized-understanding-path.ts
 */
import assert from "node:assert/strict";
import { computeReadinessProgress } from "../lib/poju/decision-intake/understanding-state";
import { applyUnderstandingModelToState } from "../lib/poju/decision-intake/understanding-response-model";
import { projectDecisionUnderstandingBox } from "../lib/poju/decision-intake/ui-projection";
import type {
  AdaptiveQuestionPlan,
  UnderstandingState,
} from "../lib/poju/decision-intake/types";
import type { DecisionBlueprint } from "../lib/poju/decision-intake/blueprint";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import type { POJUSessionState } from "../lib/poju/types";

function emptySufficiency() {
  return {
    verdict: "insufficient" as const,
    canStop: false,
    reasons: ["test"],
  };
}

function testFreshReadinessNotInflated() {
  const dc = {
    dirs: [
      {
        dir_id: "DIR_DESIRED_OUTCOME",
        need: "期望达成的结果",
        current_state: "unknown",
        id_lifecycle: "active",
        may_affect_p5_ranking: true,
        required_fact_roles: ["desired_outcome"],
      },
    ],
    constraints: [],
    conflicts: [],
    reality_facts: [],
  } as unknown as DecisionContext;
  const blueprint = {
    directions: [
      {
        direction_id: "DIRN_OUTCOME",
        label: "目标",
        priority: "P0",
        dir_ids: ["DIR_DESIRED_OUTCOME"],
        depth_soft_cap: 3,
        scope_boundary: "test",
      },
    ],
    dir_ids: ["DIR_DESIRED_OUTCOME"],
    question_budget: { depth_per_direction: 3, soft_budget: 12, hard_budget: 15 },
  } as unknown as DecisionBlueprint;

  const progress = computeReadinessProgress({
    dc,
    blueprint,
    sufficiency: {
      verdict: "insufficient",
      canStop: false,
      blocking_dir_ids: ["DIR_DESIRED_OUTCOME"],
      reasons: ["open_p0"],
    } as any,
  });

  assert.ok(
    progress.percent < 30,
    `Fresh session progress should be low, got ${progress.percent}%`,
  );
  assert.equal(progress.complete, false);
  assert.equal(progress.components.constraints, 0);
  assert.equal(progress.components.conflicts, 0);
  void emptySufficiency;
  console.log("PASS fresh readiness not inflated:", progress.percent);
}

function testApplyModelNarrative() {
  const plan: AdaptiveQuestionPlan = {
    plan_id: "qp_test",
    candidate_id: "cand_1",
    direction_id: "DIRN_OUTCOME",
    ddr_ids: ["DDR_1"],
    dir_ids: ["DIR_DESIRED_OUTCOME"],
    fact_role_codes: ["v1/dir/DIR_DESIRED_OUTCOME/role/desired_outcome"],
    missing_info: "unknown",
    decision_value: "decision_critical",
    ask_now_reason: "test",
    expected_info: "期望达成的结果",
    depth: 1,
    budget_cost: 1,
    remaining_hard_budget: 14,
    gate_class: "P0",
    scope_boundary: "test",
    rationale: "test",
    question_text: "模板问题：期望达成的结果？",
    built_at: new Date().toISOString(),
    scoring_path: "test",
  };

  const understanding = {
    understanding_id: "u1",
    session_id: "s1",
    context_id: "c1",
    context_version: 1,
    blueprint_version: 1,
    built_at: new Date().toISOString(),
    current_understanding: {
      summary: "Decision: raw · Open needs: 13",
      decision_question: "我该怎么办？",
      confirmed_briefs: [],
      unconfirmed_briefs: [],
      analysis_briefs: [],
      conflict_briefs: [],
      confidence: "low",
    },
    understood: { items: [] },
    need_to_understand: {
      items: [
        {
          kind: "dir_based",
          dir_id: "DIR_DESIRED_OUTCOME",
          ddr_ids: ["DDR_1"],
          direction_id: "DIRN_OUTCOME",
          priority: "P0",
          why: "missing_roles:desired_outcome; 期望达成的结果",
          missing_content: "missing_roles:desired_outcome; 期望达成的结果",
          may_affect_p5_ranking: true,
          gap_type: "unknown",
          must_continue: true,
        },
      ],
    },
    personal_pattern_insight: { status: "none", insights: [] },
    next_question_plan: plan,
    readiness: {
      verdict: "continue",
      can_ask: true,
      reasons: [],
    },
    budget: {
      session_asked_count: 0,
      remaining_hard_budget: 14,
      hard_budget_limit: 15,
      soft_budget_limit: 12,
      depth_by_dir: {},
      refunded_plan_ids: [],
    },
    last_answer_event_id: null,
    last_sent_question: null,
  } as unknown as UnderstandingState;

  const applied = applyUnderstandingModelToState(understanding, plan, {
    current_understanding_narrative:
      "你经历过项目失败后多年没有收入，当前卡在「恢复现金流」和「找长期方向」之间，还不能下结论。",
    understood_labels: [],
    need_to_understand: [
      {
        label: "你最想先解决的是收入，还是长期方向？",
        priority: "P0",
        necessity: "required",
        why_it_matters: "决定调查优先级",
        related_dir_ids: ["DIR_DESIRED_OUTCOME"],
      },
    ],
    personal_pattern_insight: { status: "none", insights: [] },
    next_question: {
      selected_candidate_id: "cand_1",
      question_text: "如果接下来只能优先一件事，你最希望先实现什么？",
      rationale: "先锁目标再比选项",
    },
    suggested_replies: [
      { label: "尽快恢复收入", value: "我想尽快恢复稳定收入" },
      { label: "找长期方向", value: "我想先找到长期适合自己的方向" },
      { label: "先弄清自己", value: "我还不清楚，想先梳理自己适合做什么" },
    ],
    response_text:
      "你提到项目失败后多年没有收入，现在的核心不是立刻给答案，而是先确认优先目标。\n\n如果接下来只能优先一件事，你最希望先实现什么？",
  });

  assert.ok(
    !applied.understanding.current_understanding.summary.startsWith("Decision:"),
  );
  assert.equal(
    applied.plan?.question_text,
    "如果接下来只能优先一件事，你最希望先实现什么？",
  );
  assert.equal(
    applied.understanding.need_to_understand.items[0]?.kind === "dir_based"
      ? applied.understanding.need_to_understand.items[0].missing_content
      : "",
    "你最想先解决的是收入，还是长期方向？",
  );
  console.log("PASS apply model narrative / question override");
}

function testUiSanitizeNeedLabels() {
  const session = {
    decision_understanding: {
      current_understanding: {
        summary: "综合理解：优先弄清目标与约束。",
        decision_question: "q",
        confirmed_briefs: [],
        unconfirmed_briefs: [],
        analysis_briefs: [],
        conflict_briefs: [],
        confidence: "medium",
      },
      understood: { items: [] },
      need_to_understand: {
        items: [
          {
            kind: "dir_based",
            dir_id: "DIR_X",
            ddr_ids: [],
            direction_id: "D1",
            priority: "P0",
            why: "x",
            missing_content: "missing_roles:desired_outcome; 期望达成的结果",
            may_affect_p5_ranking: true,
            gap_type: "unknown",
            must_continue: true,
          },
        ],
      },
      personal_pattern_insight: { status: "none", insights: [] },
      readiness: { verdict: "continue", can_ask: true, reasons: [] },
      readiness_progress: {
        percent: 8,
        complete: false,
        basis: "ddr_dir_gate",
        components: {
          ddr: 0,
          p0_dir: 0,
          p1_dir: 0,
          constraints: 0,
          conflicts: 0,
          sufficiency: 0,
        },
      },
      budget: {
        session_asked_count: 0,
        remaining_hard_budget: 14,
        hard_budget_limit: 15,
        soft_budget_limit: 12,
        depth_by_dir: {},
        refunded_plan_ids: [],
      },
      last_answer_event_id: null,
      last_sent_question: null,
      next_question_plan: null,
      understanding_id: "u",
      session_id: "s",
      context_id: "c",
      context_version: 1,
      blueprint_version: 1,
      built_at: new Date().toISOString(),
    },
    decision_context: { conflicts: [], dirs: [] },
    decision_blueprint: { directions: [] },
  } as unknown as POJUSessionState;

  const box = projectDecisionUnderstandingBox(session);
  assert.ok(!box.still_need.some((x) => /missing_roles/i.test(x)));
  assert.ok(box.still_need.some((x) => x.includes("期望达成的结果")));
  console.log("PASS UI sanitize need labels");
}

testFreshReadinessNotInflated();
testApplyModelNarrative();
testUiSanitizeNeedLabels();
console.log("ALL PASS");
