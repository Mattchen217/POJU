/**
 * Unit coverage for Understanding Response JSON parse harden + invalid_json retry.
 * Uses a stubbed openRouter path via temporary module monkeypatch is not available;
 * instead we exercise exported generateDecisionUnderstandingTurn with a controlled
 * openrouter mock by injecting through dynamic import after stubbing global fetch.
 */
import assert from "node:assert/strict";

type CallLog = {
  attempt: number;
  max_tokens: number;
  reasoning?: unknown;
};

async function main() {
  const calls: CallLog[] = [];
  let fetchRound = 0;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    fetchRound += 1;
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      max_tokens?: number;
      reasoning?: { effort?: string };
      messages?: Array<{ role: string; content: string }>;
    };
    calls.push({
      attempt: fetchRound,
      max_tokens: body.max_tokens ?? 0,
      reasoning: body.reasoning,
    });

    // Attempt 1: unparseable prose (invalid_json → retry)
    // Attempt 2: valid JSON object matching report-driven schema
    const content =
      fetchRound === 1
        ? "thinking... not json yet"
        : JSON.stringify({
            current_understanding_narrative:
              "用户在两个创业方向之间做选择，且高度厌恶再次失败。",
            understood_labels: [
              { label: "两项目择一", fact_ids: [] },
              { label: "不能再失败", fact_ids: [] },
            ],
            need_to_understand: [
              {
                label: "期望成功标准",
                priority: "P0",
                necessity: "required",
                why_it_matters: "决定评价路径",
                related_dir_ids: [],
              },
            ],
            personal_pattern_insight: { status: "none", insights: [] },
            problem_understanding_assessment: {
              statement: "问题边界基本清楚：二选一创业路径",
              supporting_fact_ids: [],
              unresolved_ambiguities: ["约束与资源未明"],
              sufficient_proposal: false,
            },
            desired_outcome_assessment: {
              statement: "期望结果尚未明确",
              supporting_fact_ids: [],
              unresolved_ambiguities: ["成功标准"],
              sufficient_proposal: false,
            },
            report_coverage_assessment: {
              missing_required_sections: ["01:A"],
              notes: "缺期望层",
            },
            current_intake_layer: "desired_outcome",
            next_question: {
              selected_candidate_id: "cand_expect_1",
              question_text: "如果这次必须成功，你更在意收入稳定、成长空间，还是影响力？",
              rationale: "期望层优先",
            },
            suggested_replies: [
              { label: "收入稳定", value: "我更在意收入稳定，不能再亏。" },
              { label: "成长空间", value: "我更在意成长空间与长期能力。" },
              { label: "影响力", value: "我更在意影响力与组织形态创新。" },
            ],
            response_text:
              "你现在卡在两项目择一，而且对失败的容忍度已经很低。先把「成功」的评价标准钉住——你更在意收入稳定、成长空间，还是影响力？",
          });

    return new Response(
      JSON.stringify({
        id: `gen_test_${fetchRound}`,
        provider: "test-provider",
        model: "test/model",
        choices: [{ message: { content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "test-key-for-retry";

  try {
    // Fresh import after fetch stub.
    const mod = await import("../lib/poju/decision-intake/understanding-response-model");
    const { generateDecisionUnderstandingTurn } = mod;

    const session = {
      session_id: "sess_retry_test",
      locked_provider: null,
      locked_output_locale: "zh",
      original_question: "两项目择一",
      decision_context: { reality_facts: [] },
      profile_structured: null,
    } as unknown as import("../lib/poju/types").POJUSessionState;

    const understanding = {
      understanding_id: "u1",
      current_understanding: {
        decision_question: "两项目择一",
        summary: "code summary do not copy",
        confidence: "low",
      },
      understood: { items: [] },
      need_to_understand: { items: [] },
      personal_pattern_insight: { status: "none" as const, insights: [] },
      next_question_plan: null,
      readiness: { can_ask: true, reasons: [] },
      budget: {
        session_asked_count: 0,
        remaining_hard_budget: 8,
        hard_budget_limit: 10,
        depth_by_dir: {},
      },
      last_answer_event_id: null,
      last_sent_question: null,
      current_intake_layer: "desired_outcome",
      report_coverage: {
        missing_required_count: 1,
        optional_missing_count: 0,
        delivery_ready: false,
        reasons: [],
        items: [],
      },
      layer_gates: {
        problem_understanding: { status: "open" },
        desired_outcome: { status: "open" },
      },
    } as unknown as import("../lib/poju/decision-intake/types").UnderstandingState;

    const plan = {
      plan_id: "qp1",
      candidate_id: "cand_expect_1",
      direction_id: "DIRN-OUTCOME",
      ddr_ids: [],
      dir_ids: ["DIR-DESIRED-OUTCOME"],
      fact_role_codes: [],
      missing_info: "desired_outcome",
      decision_value: "decision_critical",
      ask_now_reason: "hint",
      expected_info: "success criteria",
      depth: 1,
      budget_cost: 1,
      remaining_hard_budget: 8,
      gate_class: "P0" as const,
      scope_boundary: "test",
      rationale: "hint",
      question_text: "hint question",
      built_at: new Date().toISOString(),
      scoring_path: "test",
      intake_layer: "desired_outcome",
    } as unknown as import("../lib/poju/decision-intake/types").AdaptiveQuestionPlan;

    const legal = [
      {
        candidate_id: "cand_expect_1",
        direction_id: "DIRN-OUTCOME",
        dir_ids: ["DIR-DESIRED-OUTCOME"],
        missing_info: "desired_outcome",
        decision_value: "decision_critical",
        expected_info: "success criteria",
        template_question: "hint question",
        intake_layer: "desired_outcome",
        report_page_ids: ["01"],
        report_section_ids: ["01:A"],
      },
    ];

    const result = await generateDecisionUnderstandingTurn({
      session,
      understanding,
      plan,
      legal_candidate_ids: ["cand_expect_1"],
      legal_candidates: legal,
      locale: "zh",
      init_only: true,
      user_statement:
        "现在有2个创业项目，我需要选择一个项目做，但是我已经失败过很多次了，不能再失败了。",
    });

    assert.equal(result.ok, true, "retry must recover from invalid_json");
    if (!result.ok) throw new Error(result.reason);
    assert.equal(result.call_meta.model_status, "model_retry_succeeded");
    assert.equal(result.call_meta.attempt_count, 2);
    assert.equal(calls.length, 2, "exactly two OpenRouter posts");
    assert.equal(calls[0]!.max_tokens, 3200);
    assert.equal(calls[1]!.max_tokens, 6000);
    assert.ok(result.output.response_text.includes("评价标准") || result.output.response_text.length > 8);
    assert.equal(result.output.next_question.selected_candidate_id, "cand_expect_1");
    assert.ok(result.output.problem_understanding_assessment);
    assert.ok(result.output.desired_outcome_assessment);
    assert.ok(result.output.report_coverage_assessment);

    // Fence + balanced extract: second call returns fenced JSON
    fetchRound = 0;
    calls.length = 0;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      fetchRound += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as { max_tokens?: number };
      calls.push({ attempt: fetchRound, max_tokens: body.max_tokens ?? 0 });
      const inner = {
        current_understanding_narrative: "围栏 JSON 也应可解析成完整对象。".padEnd(20, "。"),
        understood_labels: [{ label: "围栏", fact_ids: [] }],
        need_to_understand: [],
        personal_pattern_insight: { status: "none", insights: [] },
        problem_understanding_assessment: {
          statement: "问题清楚",
          supporting_fact_ids: [],
          unresolved_ambiguities: [],
          sufficient_proposal: true,
        },
        desired_outcome_assessment: {
          statement: "期望未明",
          supporting_fact_ids: [],
          unresolved_ambiguities: ["标准"],
          sufficient_proposal: false,
        },
        report_coverage_assessment: { missing_required_sections: [], notes: "" },
        current_intake_layer: "desired_outcome",
        next_question: {
          selected_candidate_id: "cand_expect_1",
          question_text: "你用什么标准判断这次选对了？",
          rationale: "ok",
        },
        suggested_replies: [
          { label: "A", value: "收入稳定优先" },
          { label: "B", value: "成长空间优先" },
          { label: "C", value: "影响力优先" },
        ],
        response_text: "先把成功标准说清楚：你用什么标准判断这次选对了？",
      };
      const content =
        fetchRound === 1
          ? "Here is the JSON:\n```json\n" + JSON.stringify(inner) + "\n```\nthanks"
          : JSON.stringify(inner);
      return new Response(
        JSON.stringify({
          id: `gen_fence_${fetchRound}`,
          provider: "test-provider",
          model: "test/model",
          choices: [{ message: { content }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    // Clear module cache so generate uses new fetch? Same fetch global is fine.
    const fence = await generateDecisionUnderstandingTurn({
      session,
      understanding,
      plan,
      legal_candidate_ids: ["cand_expect_1"],
      legal_candidates: legal,
      locale: "zh",
      init_only: true,
      user_statement: "两项目择一",
    });
    assert.equal(fence.ok, true, "fenced JSON on first attempt should parse");
    if (fence.ok) {
      assert.equal(fence.call_meta.model_status, "model_success");
      assert.equal(fence.call_meta.attempt_count, 1);
    }
    assert.equal(calls.length, 1);

    console.log(
      JSON.stringify(
        {
          ok: true,
          retry_recovered: true,
          fence_first_shot: true,
          calls_retry: 2,
          model_status_retry: "model_retry_succeeded",
        },
        null,
        2,
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
