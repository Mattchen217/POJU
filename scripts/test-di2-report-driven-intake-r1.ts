/**
 * DI2 Report-Driven Intake R1 — unit matrix A–E (no live OpenRouter).
 * Covers: report map/section contracts, layer gates, coverage statuses,
 * model-autonomous selection among legal candidates, UI projection.
 *
 * Run: pnpm exec tsx scripts/test-di2-report-driven-intake-r1.ts
 */
import assert from "node:assert/strict";
import {
  candidateAllowedForIntakeLayer,
  candidateHasReportPurpose,
  formatReportPurposeForPrompt,
  reportMappingForDir,
} from "../lib/poju/decision-intake/investigation-report-map";
import {
  buildIntakeLayerGateSnapshot,
  evaluateDesiredOutcomeGate,
  evaluateProblemUnderstandingGate,
} from "../lib/poju/decision-intake/intake-layer-gates";
import { computeReportSectionCoverage } from "../lib/poju/decision-intake/report-section-coverage";
import {
  matchOpeningClaims,
  seedOpeningAssertedFacts,
} from "../lib/poju/decision-intake/opening-asserted-facts";
import { projectDecisionUnderstandingBox } from "../lib/poju/decision-intake/ui-projection";
import { runAdaptiveQuestionTurn } from "../lib/poju/decision-intake/adaptive-turn";
import { buildUnderstandingState } from "../lib/poju/decision-intake/understanding-state";
import type { DecisionUnderstandingModelOutput } from "../lib/poju/decision-intake/understanding-response-model";
import type { POJUSessionState } from "../lib/poju/types";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import type { DecisionBlueprint } from "../lib/poju/decision-intake/types";

const STATEMENT =
  "我从上一次的创业失败后，已经好几年没有收入了，一直找不到事情做，怎么办？";

function bareDc(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    context_id: "dc_rdi",
    version: 1,
    status: "draft",
    content_hash: "h",
    reality_facts: [],
    dirs: [
      {
        dir_id: "DIR-DEF-QUESTION",
        need: "question",
        current_state: "unknown",
        id_lifecycle: "active",
        required_fact_roles: ["decision_question"],
        may_affect_p5_ranking: true,
      },
      {
        dir_id: "DIR-STATUS-QUO",
        need: "status",
        current_state: "unknown",
        id_lifecycle: "active",
        required_fact_roles: ["status_quo"],
        may_affect_p5_ranking: true,
      },
      {
        dir_id: "DIR-DEF-OUTCOME",
        need: "outcome",
        current_state: "unknown",
        id_lifecycle: "active",
        required_fact_roles: ["desired_outcome"],
        may_affect_p5_ranking: true,
      },
      {
        dir_id: "DIR-OPT-ON-TABLE",
        need: "options",
        current_state: "unknown",
        id_lifecycle: "active",
        required_fact_roles: ["option"],
        may_affect_p5_ranking: true,
      },
      {
        dir_id: "DIR-BIZ-MODEL",
        need: "biz",
        current_state: "unknown",
        id_lifecycle: "active",
        required_fact_roles: ["business_model"],
        may_affect_p5_ranking: false,
      },
    ],
    conflicts: [],
    constraints: [],
    hypotheses: [],
    definition: {
      decision_question: STATEMENT,
      desired_outcome: null,
      stakes: null,
      concrete_event: null,
    },
    ...overrides,
  } as DecisionContext;
}

function bareBlueprint(): DecisionBlueprint {
  return {
    blueprint_id: "bp_rdi",
    blueprint_version: 1,
    ddr_version: "1.1",
    dir_catalog_version: "1",
    session_id: "sess_rdi",
    context_id: "dc_rdi",
    decision_question: STATEMENT,
    definition_snapshot: bareDc().definition,
    directions: [
      {
        direction_id: "DIRN-DEFINITION",
        label: "Definition",
        priority: "P0",
        dir_ids: [
          "DIR-DEF-QUESTION",
          "DIR-STATUS-QUO",
          "DIR-DEF-OUTCOME",
          "DIR-OPT-ON-TABLE",
          "DIR-BIZ-MODEL",
        ],
        needed_info: "definition",
        completion_criteria: "known",
        depth_soft_cap: 3,
        scope_boundary: "bp",
      },
    ],
    dir_ids: [
      "DIR-DEF-QUESTION",
      "DIR-STATUS-QUO",
      "DIR-DEF-OUTCOME",
      "DIR-OPT-ON-TABLE",
      "DIR-BIZ-MODEL",
    ],
    ddr_ids: [
      "DDR-01-PRIMARY",
      "DDR-02-ATTRIBUTION",
      "DDR-03-CHART-APPENDIX",
      "DDR-05-RANKING",
    ],
    scope_locked: true,
    question_budget: { soft: 6, hard: 12, depth_per_direction: 3 },
    created_at: "2026-11-20T00:00:00.000Z",
    updated_at: "2026-11-20T00:00:00.000Z",
  } as DecisionBlueprint;
}

function bareSession(dc?: DecisionContext): POJUSessionState {
  return {
    session_id: "sess_rdi",
    messages: [],
    original_question: STATEMENT,
    locked_output_locale: "zh",
    decision_context: dc ?? bareDc(),
    decision_blueprint: bareBlueprint(),
  } as POJUSessionState;
}

async function main() {
  console.log("A1 report map + section contracts");
  const qMap = reportMappingForDir("DIR-DEF-QUESTION");
  assert.ok(qMap);
  assert.equal(qMap!.intake_layer, "problem_understanding");
  assert.ok(qMap!.report_pages.includes("01"));
  assert.ok(qMap!.report_section_ids.length >= 1);
  assert.equal(candidateHasReportPurpose(["DIR-BIZ-MODEL"]), true);
  assert.equal(candidateHasReportPurpose(["DIR-UNKNOWN"]), false);
  assert.equal(
    candidateAllowedForIntakeLayer(["DIR-BIZ-MODEL"], "problem_understanding"),
    false,
  );
  assert.equal(
    candidateAllowedForIntakeLayer(["DIR-DEF-QUESTION"], "problem_understanding"),
    true,
  );
  const purpose = formatReportPurposeForPrompt(["DIR-DEF-OUTCOME"], "zh");
  assert.equal(purpose.intake_layer, "desired_outcome");

  console.log("A2 page 03 local / page 07 N/A coverage");
  const cov = computeReportSectionCoverage({
    dc: bareDc(),
    blueprint: bareBlueprint(),
  });
  const page03 = cov.items.find((i) => i.ddr_id === "DDR-03-CHART-APPENDIX");
  assert.ok(page03);
  assert.equal(page03!.status, "satisfied_by_local_profile");
  assert.equal(page03!.asks_user, false);
  const page07 = cov.items.find((i) => i.ddr_id === "DDR-07-TOPIC-DEPTH");
  assert.ok(page07);
  assert.ok(
    page07!.status === "missing_required_information" ||
      page07!.status === "not_applicable" ||
      page07!.status === "optional_missing" ||
      page07!.status === "satisfied_by_user_information" ||
      page07!.status === "satisfied_with_boundary",
  );

  console.log("B1 problem gate fails without grounding");
  const weak = evaluateProblemUnderstandingGate(
    bareDc({
      definition: {
        decision_question: "怎么办",
        desired_outcome: null,
        stakes: null,
        concrete_event: null,
      },
    } as never),
  );
  assert.equal(weak.passed, false);

  console.log("B2 opening asserted facts help status grounding");
  const claims = matchOpeningClaims(STATEMENT);
  assert.ok(claims.length >= 2);
  let seeded = seedOpeningAssertedFacts(
    bareSession(),
    STATEMENT,
    "turn_1",
    "2026-11-20T12:00:00.000Z",
    "zh",
  );
  assert.ok((seeded.decision_context?.reality_facts.length ?? 0) >= 2);
  const problemAfterSeed = evaluateProblemUnderstandingGate(seeded.decision_context!);
  assert.equal(problemAfterSeed.passed, true, JSON.stringify(problemAfterSeed));

  console.log("B3 desired gate blocks until outcome present");
  const desiredFail = evaluateDesiredOutcomeGate(seeded.decision_context!);
  assert.equal(desiredFail.passed, false);
  seeded = {
    ...seeded,
    decision_context: {
      ...seeded.decision_context!,
      definition: {
        ...seeded.decision_context!.definition,
        desired_outcome: "先恢复稳定收入并找到可持续方向",
      },
      dirs: seeded.decision_context!.dirs.map((d) =>
        d.dir_id === "DIR-DEF-OUTCOME"
          ? { ...d, current_state: "known" as const }
          : d,
      ),
    },
  };
  const desiredPass = evaluateDesiredOutcomeGate(seeded.decision_context!);
  assert.equal(desiredPass.passed, true);

  console.log("B4 layer derivation order");
  const snapEarly = buildIntakeLayerGateSnapshot({
    dc: bareDc(),
    report_coverage: computeReportSectionCoverage({
      dc: bareDc(),
      blueprint: bareBlueprint(),
    }),
  });
  assert.equal(snapEarly.current_intake_layer, "problem_understanding");
  const snapMid = buildIntakeLayerGateSnapshot({
    dc: seeded.decision_context!,
    report_coverage: computeReportSectionCoverage({
      dc: seeded.decision_context!,
      blueprint: bareBlueprint(),
    }),
  });
  assert.ok(
    snapMid.current_intake_layer === "report_details" ||
      snapMid.current_intake_layer === "final_understanding_review" ||
      snapMid.current_intake_layer === "desired_outcome",
    snapMid.current_intake_layer,
  );

  console.log("C1 understanding state carries gates + coverage");
  const u = buildUnderstandingState({
    session: seeded,
    blueprint: bareBlueprint(),
    now: "2026-11-20T12:00:00.000Z",
  });
  assert.ok(u.current_intake_layer);
  assert.ok(u.intake_layer_gates);
  assert.ok(u.report_coverage);
  assert.equal(u.intake_layer_gates!.problem_understanding.passed, true);

  console.log("D1 model may select non-code-rank legal candidate");
  const sessionForTurn = bareSession(
    bareDc({
      reality_facts: seeded.decision_context!.reality_facts,
      dirs: seeded.decision_context!.dirs.map((d) =>
        d.dir_id === "DIR-DEF-QUESTION" || d.dir_id === "DIR-STATUS-QUO"
          ? { ...d, current_state: "known" as const }
          : d,
      ),
      definition: {
        ...seeded.decision_context!.definition,
        desired_outcome: null,
      },
    } as never),
  );
  let seenLegal: string[] = [];
  let codeHint: string | null = null;
  const turn = await runAdaptiveQuestionTurn({
    session: sessionForTurn,
    statement: "我想先搞清楚接下来该怎么走",
    source_turn_id: "t_rdi_1",
    now: "2026-11-20T12:01:00.000Z",
    init_only: true,
    locale: "zh",
    test_hooks: {
      understandingResponseModel: async (input) => {
        seenLegal = [...input.legal_candidate_ids];
        codeHint = input.plan?.candidate_id ?? null;
        const pick =
          input.legal_candidate_ids.find((id) => id !== input.plan?.candidate_id) ??
          input.legal_candidate_ids[0] ??
          null;
        assert.ok(pick, "expected at least one legal candidate");
        const out: DecisionUnderstandingModelOutput = {
          current_understanding_narrative:
            "你在创业失败后长期没有收入，核心是恢复方向与现金流的决策。",
          understood_labels: [],
          need_to_understand: [
            {
              label: "你最希望先实现什么结果？",
              priority: "P0",
              necessity: "required",
              why_it_matters: "期望层评价标准",
              related_dir_ids: ["DIR-DEF-OUTCOME"],
            },
          ],
          personal_pattern_insight: { status: "none", insights: [] },
          problem_understanding_assessment: {
            statement: "问题已较清楚",
            supporting_fact_ids: [],
            unresolved_ambiguities: [],
            sufficient_proposal: true,
          },
          desired_outcome_assessment: {
            statement: "期望仍不清",
            supporting_fact_ids: [],
            unresolved_ambiguities: ["desired_outcome"],
            sufficient_proposal: false,
          },
          report_coverage_assessment: {
            missing_required_sections: ["01:A"],
            notes: "outcome missing",
          },
          current_intake_layer: "desired_outcome",
          next_question: {
            selected_candidate_id: pick,
            question_text: "如果只能先做成一件事，你最希望看到什么结果？",
            rationale: "model_autonomous_pick",
          },
          suggested_replies: [
            { label: "恢复收入", value: "我想尽快恢复稳定收入" },
            { label: "找方向", value: "我想先找到长期方向" },
            { label: "还不确定", value: "我还不清楚，想先梳理" },
          ],
          response_text:
            "你的处境已经比较清楚。接下来我想确认期望结果。\n\n如果只能先做成一件事，你最希望看到什么结果？",
        };
        return out;
      },
    },
  });
  assert.equal(turn.outcome, "planned", turn.ask_error ?? turn.outcome);
  assert.ok(turn.plan);
  assert.ok(seenLegal.length >= 1, "legal candidates required");
  assert.ok(turn.plan!.candidate_id);
  assert.equal(turn.authorized_question, turn.plan!.question_text);
  assert.ok(turn.model_response_text);
  assert.equal(turn.suggested_replies?.length, 3);
  if (seenLegal.length > 1 && codeHint && seenLegal.some((id) => id !== codeHint)) {
    assert.notEqual(turn.plan!.candidate_id, codeHint);
  }
  assert.ok(
    turn.understanding?.current_intake_layer === "desired_outcome" ||
      turn.understanding?.current_intake_layer === "problem_understanding" ||
      turn.understanding?.current_intake_layer === "report_details",
  );

  console.log("D2 illegal candidate rejected (no silent code fallback authorize)");
  const illegal = await runAdaptiveQuestionTurn({
    session: sessionForTurn,
    statement: STATEMENT,
    source_turn_id: "t_rdi_illegal",
    now: "2026-11-20T12:02:00.000Z",
    init_only: true,
    locale: "zh",
    test_hooks: {
      understandingResponseModel: async () =>
        ({
          current_understanding_narrative: "综合理解足够长以通过校验。",
          understood_labels: [],
          need_to_understand: [],
          personal_pattern_insight: { status: "none", insights: [] },
          problem_understanding_assessment: {
            statement: "x",
            supporting_fact_ids: [],
            unresolved_ambiguities: [],
            sufficient_proposal: false,
          },
          desired_outcome_assessment: {
            statement: "x",
            supporting_fact_ids: [],
            unresolved_ambiguities: [],
            sufficient_proposal: false,
          },
          report_coverage_assessment: { missing_required_sections: [], notes: "" },
          current_intake_layer: "desired_outcome",
          next_question: {
            selected_candidate_id: "cq_dir_NOT_A_REAL_CANDIDATE",
            question_text: "非法候选问题？",
            rationale: "bad",
          },
          suggested_replies: [
            { label: "a", value: "answer a distinct" },
            { label: "b", value: "answer b distinct" },
            { label: "c", value: "answer c distinct" },
          ],
          response_text: "这是一段足够长的回应文本。",
        }) as DecisionUnderstandingModelOutput,
    },
  });
  assert.equal(illegal.outcome, "understanding_model_failed");
  assert.equal(illegal.authorized_question, null);
  assert.ok(
    (illegal.ask_error ?? "").includes("illegal_candidate") ||
      (illegal.ask_error ?? "").includes("understanding_model_failed"),
  );

  console.log("E1 UI projects asserted + intake layer");
  const box = projectDecisionUnderstandingBox({
    ...seeded,
    decision_understanding: u,
  });
  assert.ok(box.already_understood.length >= 1);
  assert.ok(box.current_intake_layer);

  console.log("ALL DI2 report-driven intake R1 unit checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
