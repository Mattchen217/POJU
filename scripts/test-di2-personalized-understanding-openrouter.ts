/**
 * Live OpenRouter smoke for DI2 Personalized Understanding turn.
 * Does NOT declare full product acceptance — only proves the model path fires.
 *
 * Run: pnpm exec tsx scripts/test-di2-personalized-understanding-openrouter.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2] ?? "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

async function main() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.error("SKIP: OPENROUTER_API_KEY missing");
    process.exit(2);
  }

  const { generateDecisionUnderstandingTurn } = await import(
    "../lib/poju/decision-intake/understanding-response-model"
  );

  const now = new Date().toISOString();
  const session = {
    session_id: `di2_live_${Date.now()}`,
    original_question:
      "我从上个项目失败后，已经好几年没有任何收入了，都不知道做什么好，我该怎么办？",
    locked_output_locale: "zh",
    messages: [],
    decision_context: {
      context_id: "c_live",
      version: 1,
      status: "draft",
      content_hash: "hash",
      dirs: [
        {
          dir_id: "DIR-DESIRED-OUTCOME",
          need: "期望达成的结果",
          why: "目标决定选项比较",
          required_fact_roles: ["desired_outcome"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          id_lifecycle: "active",
          may_affect_p5_ranking: true,
        },
      ],
      reality_facts: [],
      constraints: [],
      conflicts: [],
      analytical_hypotheses: [],
      definition: {
        decision_question:
          "我从上个项目失败后，已经好几年没有任何收入了，都不知道做什么好，我该怎么办？",
      },
    },
    decision_blueprint: {
      blueprint_id: "bp_live",
      version: 1,
      dir_ids: ["DIR-DESIRED-OUTCOME"],
      directions: [
        {
          direction_id: "DIRN-OUTCOME",
          label: "目标结果",
          priority: "P0",
          dir_ids: ["DIR-DESIRED-OUTCOME"],
          depth_soft_cap: 3,
          scope_boundary: "test",
        },
      ],
      question_budget: {
        depth_per_direction: 3,
        soft_budget: 12,
        hard_budget: 15,
      },
    },
    matrix_payload: null,
    personal_analysis_profile: {
      profile_id: null,
      profile_version: "test",
      profile_hash: null,
      calculated_at: now,
      birth_present: false,
      data_availability: { bazi: "missing", ziwei: "missing" },
      bazi_day_master: null,
      bazi_strength: null,
      bazi_pattern: null,
      ziwei_closed_set: null,
    },
  } as any;

  const understanding = {
    understanding_id: "u_live",
    session_id: session.session_id,
    context_id: "c_live",
    context_version: 1,
    blueprint_version: 1,
    built_at: now,
    current_understanding: {
      summary: "Decision: placeholder · Open needs: 1",
      decision_question: session.original_question,
      confirmed_briefs: [],
      unconfirmed_briefs: [],
      analysis_briefs: [],
      conflict_briefs: [],
      confidence: "low" as const,
    },
    understood: { items: [] },
    need_to_understand: {
      items: [
        {
          kind: "dir_based" as const,
          dir_id: "DIR-DESIRED-OUTCOME",
          ddr_ids: ["DDR_X"],
          direction_id: "DIRN-OUTCOME",
          priority: "P0" as const,
          why: "missing_roles:desired_outcome",
          missing_content: "missing_roles:desired_outcome; 期望达成的结果",
          may_affect_p5_ranking: true,
          gap_type: "unknown" as const,
          must_continue: true,
        },
      ],
    },
    personal_pattern_insight: {
      status: "unavailable" as const,
      insights: [],
      reason: "no_profile",
    },
    next_question_plan: null,
    readiness: { verdict: "continue" as const, can_ask: true, reasons: [] },
    budget: {
      soft_budget_limit: 12,
      hard_budget_limit: 15,
      session_asked_count: 0,
      review_cycle: 1,
      cycle_base_asked: 0,
      remaining_hard_budget: 15,
      depth_by_dir: {},
      refunded_plan_ids: [],
    },
    last_answer_event_id: null,
    last_sent_question: null,
  };

  const plan = {
    plan_id: "qp_live",
    candidate_id: "cand_desired_outcome",
    direction_id: "DIRN-OUTCOME",
    ddr_ids: ["DDR_X"],
    dir_ids: ["DIR-DESIRED-OUTCOME"],
    fact_role_codes: ["v1/dir/DIR-DESIRED-OUTCOME/role/desired_outcome"],
    missing_info: "unknown",
    decision_value: "decision_critical",
    ask_now_reason: "p0",
    expected_info: "期望达成的结果",
    depth: 1,
    budget_cost: 1,
    remaining_hard_budget: 14,
    gate_class: "P0" as const,
    scope_boundary: "test",
    rationale: "live",
    question_text: "模板：期望达成的结果？",
    built_at: now,
    scoring_path: "live",
  };

  console.log("Calling OpenRouter Understanding model…");
  const result = await generateDecisionUnderstandingTurn({
    session,
    understanding: understanding as any,
    plan: plan as any,
    legal_candidate_ids: [plan.candidate_id],
    legal_candidates: [
      {
        candidate_id: plan.candidate_id,
        direction_id: plan.direction_id,
        dir_ids: plan.dir_ids,
        missing_info: plan.missing_info,
        decision_value: plan.decision_value,
        expected_info: plan.expected_info,
        template_question: plan.question_text,
      },
    ],
    locale: "zh",
    init_only: true,
    user_statement: session.original_question,
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        reason: result.ok ? undefined : result.reason,
        detail: result.ok ? undefined : result.detail,
        provider: result.call_meta.provider,
        model: result.call_meta.model,
        latency_ms: result.call_meta.latency_ms,
        profile_hash: result.profile.profile_hash,
        narrative: result.ok
          ? result.output.current_understanding_narrative.slice(0, 200)
          : null,
        response_preview: result.ok
          ? result.output.response_text.slice(0, 240)
          : null,
        question: result.ok ? result.output.next_question.question_text : null,
        suggested: result.ok
          ? result.output.suggested_replies.map((r) => r.label)
          : null,
      },
      null,
      2,
    ),
  );

  assert.equal(
    result.ok,
    true,
    result.ok ? "" : `${result.reason}:${result.detail ?? ""}`,
  );
  if (!result.ok) return;
  assert.ok(result.output.response_text.length > 20);
  assert.equal(result.output.suggested_replies.length, 3);
  assert.ok(
    !/^Decision:/i.test(result.output.current_understanding_narrative),
    "narrative must not be stats summary",
  );
  assert.ok(result.output.next_question.question_text);
  console.log("LIVE_SMOKE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
