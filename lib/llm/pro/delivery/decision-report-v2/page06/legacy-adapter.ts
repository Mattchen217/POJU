/**
 * Face06 legacy flat ↔ V2 display projection.
 * Historical open only — never used for new production certification.
 */

import {
  Face06LegacySchema,
  type Face06Legacy,
  type Face06V2,
} from "../schemas";
import { PAGE06_SECTION_IDS } from "./architecture/sections";

export function isFace06V2(data: unknown): data is Face06V2 {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.page === "06" &&
    o.face === "06" &&
    (o.schema_version === "face06-v2" ||
      (typeof o.first_step === "object" && o.first_step !== null))
  );
}

export function isFace06Legacy(data: unknown): data is Face06Legacy {
  if (!data || typeof data !== "object") return false;
  if (isFace06V2(data)) return false;
  return Face06LegacySchema.safeParse(data).success;
}

/**
 * Project legacy Face06 into execution Face06V2 for display only.
 * Missing structured fields stay explicit — never invent new paths.
 */
export function projectLegacyFace06ForDisplay(data: unknown): Face06V2 | null {
  if (isFace06V2(data) && (data as Face06V2).first_step) {
    return data as Face06V2;
  }
  const parsed = Face06LegacySchema.safeParse(data);
  if (!parsed.success) return null;
  const leg = parsed.data;
  const experiment = leg.verification_experiment;
  const hasExperiment = Boolean(experiment?.hypothesis && experiment.action);

  return {
    page: "06",
    face: "06",
    schema_version: "face06-v2",
    page_title: leg.page_title,
    page_subtitle: leg.page_subtitle,
    primary_path_id: "legacy_primary",
    fallback_path_ids: [],
    first_step: {
      action_id: "legacy_first_step",
      path_id: "legacy_primary",
      what: leg.near_step_principle.slice(0, 720),
      why_now: "（历史稿未拆分为何现在）",
      required_resources: [],
      expected_observable_result: "（历史稿未提供可观察结果）",
      claim_ids: ["legacy_claim_06"],
      evidence_ids: ["legacy_ev_06"],
      reality_fact_ids: [],
    },
    execution_actions: [
      {
        action_id: "legacy_stage",
        path_id: "legacy_primary",
        sequence: 1,
        action: leg.stage_climate.slice(0, 720),
        rationale: "（历史稿阶段气候未结构化）",
        resources: [],
        dependencies: [],
        observable_result: "（历史稿未提供可观察结果）",
        guardrails: [],
        claim_ids: ["legacy_claim_06"],
        evidence_ids: ["legacy_ev_06"],
        reality_fact_ids: [],
      },
    ],
    validation_experiments: hasExperiment
      ? [
          {
            experiment_id: "legacy_experiment",
            path_id: "legacy_primary",
            hypothesis: experiment!.hypothesis.slice(0, 480),
            action: experiment!.action.slice(0, 480),
            observe: experiment!.observe.slice(0, 480),
            window: experiment!.window.slice(0, 240),
            success_criteria: experiment!.success_criteria.slice(0, 480),
            if_fail: experiment!.if_fail.slice(0, 480),
            defer_costs: experiment!.defer_costs.slice(0, 480),
            claim_ids: ["legacy_claim_06"],
            evidence_ids: ["legacy_ev_06"],
            reality_fact_ids: [],
          },
        ]
      : [],
    experiments_absent_note: hasExperiment
      ? ""
      : "历史稿未提供结构化验证实验。",
    personal_execution_adjustments: [
      {
        adjustment_id: "legacy_retune",
        path_id: "legacy_primary",
        adjustment: leg.self_retune.slice(0, 720),
        supporting_personal_unit_refs: ["legacy_personal_06"],
        supporting_reality_fact_ids: [],
        claim_ids: ["legacy_claim_06"],
        evidence_ids: ["legacy_ev_06"],
      },
    ],
    resource_boundaries: {
      time: "（历史稿未提供）",
      money: "（历史稿未提供）",
      people: "（历史稿未提供）",
      energy: "（历史稿未提供）",
      other: [],
      unknown_or_missing: ["历史 flat Page06 未拆资源边界"],
    },
    phase_rhythm: {
      phases: [
        {
          phase_id: "legacy_rhythm",
          goal: leg.rhythm_note.slice(0, 480),
          enter_triggers: [],
          exit_triggers: ["（历史稿未提供退出条件）"],
        },
      ],
      notes: "历史稿节奏提醒未拆成进入/退出条件。",
    },
    monitoring_contract: {
      path_id: "legacy_primary",
      action_ids: ["legacy_stage"],
      experiment_ids: hasExperiment ? ["legacy_experiment"] : [],
      observe_signals: ["（历史稿未提供观察信号）"],
      red_flags: [],
      review_questions: [],
      continue_triggers: [],
      adjust_triggers: [],
      stop_triggers: ["（历史稿未提供停止条件）"],
      rerun_triggers: [],
      resource_guardrails: [],
      defer_costs: [],
      claim_ids: ["legacy_claim_06"],
      evidence_ids: ["legacy_ev_06"],
      reality_fact_ids: [],
    },
    evidence_boundary: {
      claim_ids: ["legacy_claim_06"],
      confirmed_fact_ids: [],
      hypothesis_notes: [],
      uncertainty_notes: [
        "历史 flat Page06 投影：结构化执行字段缺失，不得当作新稿认证结果。",
      ],
      experiments_absent_note: hasExperiment
        ? ""
        : "历史稿未提供结构化验证实验。",
    },
    reading_order: [...PAGE06_SECTION_IDS],
  };
}
