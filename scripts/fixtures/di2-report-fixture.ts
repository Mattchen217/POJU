/**
 * DI2 report fixtures for directed tests — scripts/** only.
 * Must never be imported from lib/ or app/ production modules.
 *
 * Decision Context, confirmation events, Blueprint and the raw model JSON the test
 * hooks feed into the production validators (same shapes as the M3 suite).
 */
import { computeContentHash } from "../../lib/poju/decision-context/content-hash";
import type { ConfirmationEvent } from "../../lib/poju/decision-context/confirmation-event";
import type { DecisionContext } from "../../lib/poju/decision-context/types";
import type { DecisionBlueprint } from "../../lib/poju/decision-intake/types";
import type { DecisionPageId } from "../../lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_SCHEMAS } from "../../lib/llm/pro/delivery/page-schema/decision-pages";

export const DI2_FIXTURE_NOW = "2026-11-11T10:00:00.000Z";
export const DI2_FIXTURE_QUESTION = "要不要接受新公司的工作邀请";
export const DI2_FIXTURE_BIRTH = {
  year: 1985,
  month: 7,
  day: 15,
  hour_period: "chou",
  gender: "M",
  timezone: "Asia/Shanghai",
} as const satisfies import("../../lib/profile/types").BirthInfo;

/** Draft DC ready to freeze (ranking-relevant unknowns cleared). */
export function di2DraftDc(context_id: string, question = DI2_FIXTURE_QUESTION): DecisionContext {
  const NOW = DI2_FIXTURE_NOW;
  const dc: DecisionContext = {
    context_id,
    version: 1,
    status: "draft",
    definition: {
      concrete_event: "收到一份新的工作邀请，需要在两周内答复",
      stakes: "收入与家庭节奏",
      desired_outcome: "在不拖垮家庭节奏的前提下提升收入",
      decision_question: question,
      goal_priorities: ["收入", "家庭节奏"],
      unacceptable_outcomes: ["半年内被迫再次换工作"],
    },
    reality_facts: [
      {
        fact_id: "f_conf",
        statement: "现岗位月收入已确认",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t1",
        user_confirmed: true,
      },
      {
        fact_id: "f_unv",
        statement: "新公司团队氛围据说不错",
        status: "unverified",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t2",
        user_confirmed: false,
      },
      {
        fact_id: "f_est",
        statement: "通勤大约多出四十分钟",
        status: "unverified",
        verification_level: "user_estimate",
        source_stage: "collecting",
        source_turn_id: "t3",
        user_confirmed: false,
      },
    ],
    constraints: [
      {
        constraint_id: "c1",
        statement: "两周内必须答复",
        category: "time",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t1",
        rigidity: "hard",
        user_confirmed: true,
      },
    ],
    hypotheses: [
      {
        hypothesis_id: "h1",
        statement: "新岗位的成长空间可能高于现岗",
        supporting_evidence: [],
        counter_evidence: [],
        validation_need: "需要与未来上级谈一次",
        state: "proposed",
        related_dir_ids: ["dir_options"],
      },
    ],
    dirs: [
      {
        dir_id: "dir_options",
        need: "新岗位的真实职责范围",
        why: "决定路径排序",
        required_fact_roles: ["option"],
        current_state: "unknown",
        partial_satisfaction: false,
        agenda_item_ids: [],
        may_affect_p5_ranking: false,
        id_lifecycle: "active",
      },
      {
        dir_id: "dir_status_quo",
        need: "现岗位的稳定性",
        why: "对照基线",
        required_fact_roles: ["status_quo"],
        current_state: "known",
        partial_satisfaction: false,
        agenda_item_ids: [],
        may_affect_p5_ranking: false,
        id_lifecycle: "active",
      },
    ],
    conflicts: [
      {
        conflict_id: "cf1",
        fact_ids: ["f_unv"],
        conflict_field: "团队氛围",
        statements_snapshot: ["据说不错", "面试官显得急躁"],
        source_refs: [{ fact_id: "f_unv", source_stage: "collecting", source_turn_id: "t2" }],
        state: "unresolved_in_final",
        resolution: null,
        user_confirmation: false,
        affects_preferred_path: false,
      },
    ],
    content_hash: null,
    created_at: NOW,
    updated_at: NOW,
    information_boundaries: ["未见到正式合同条款"],
  };
  dc.content_hash = computeContentHash(dc);
  return dc;
}

export function di2ConfirmationEvents(dc: DecisionContext): ConfirmationEvent[] {
  const NOW = DI2_FIXTURE_NOW;
  const facts = dc.reality_facts
    .filter((f) => f.user_confirmed)
    .map((f) => ({
      event_id: `e_${f.fact_id}`,
      target_type: "fact" as const,
      fact_id: f.fact_id,
      source_turn_id: f.source_turn_id!,
      confirmation_turn_id: null,
      confirmation_action_id: `a_${f.fact_id}`,
      event_type: "confirm_fact" as const,
      actor: "user" as const,
      confirmed_at: NOW,
      event_version: 1 as const,
    }));
  const cons = dc.constraints
    .filter((c) => c.user_confirmed)
    .map((c) => ({
      event_id: `e_${c.constraint_id}`,
      target_type: "constraint" as const,
      constraint_id: c.constraint_id,
      source_turn_id: c.source_turn_id!,
      confirmation_turn_id: null,
      confirmation_action_id: `a_${c.constraint_id}`,
      event_type: "confirm_constraint" as const,
      actor: "user" as const,
      confirmed_at: NOW,
      event_version: 1 as const,
    }));
  return [...facts, ...cons] as unknown as ConfirmationEvent[];
}

export function di2Blueprint(session_id: string, dc: DecisionContext): DecisionBlueprint {
  return {
    blueprint_id: `bp_${session_id}`,
    blueprint_version: 1,
    ddr_version: "t",
    dir_catalog_version: "t",
    session_id,
    context_id: dc.context_id,
    decision_question: dc.definition.decision_question,
    definition_snapshot: dc.definition,
    directions: [],
    dir_ids: dc.dirs.map((d) => d.dir_id),
  } as unknown as DecisionBlueprint;
}

/** Raw Personal Analysis JSON (evidence refs resolve against `di2DraftDc`). */
export function di2AnalysisJson(): string {
  const item = (text: string, cls: string, refs: string[], basis = "日主得令，比劫帮身，行动偏主动") => ({
    text,
    traditional_basis: basis,
    science_note: null,
    basis_class: cls,
    evidence_refs: refs,
  });
  return JSON.stringify({
    personal_pattern_analysis: [
      item("你在压力下习惯先稳住节奏再出手，速度不是你的第一反应", "pattern_judgment", ["CFP-01"]),
      item("你更容易被长期确定性打动，而不是短期的额外回报", "pattern_judgment", ["CFP-02"]),
    ],
    personal_strengths: [item("你在需要耐心推进的局面里通常能守住质量", "pattern_judgment", ["CFP-01"])],
    personal_risks: [item("在信息不全时你可能因为想稳而错过窗口", "pattern_judgment", ["CFP-02", "f_unv"])],
    decision_tendencies: [
      item("你倾向用别人口中的团队印象来补足自己没核实的部分", "user_stated_unverified", ["f_unv", "CFP-01"]),
    ],
    constraint_interaction: [
      item("两周的答复期限会放大你想稳的倾向，需要提前安排核实", "confirmed_fact", ["c1", "f_conf"]),
    ],
    decision_path_implications: [
      item("如果成长空间属实，接受邀请更符合你的长期偏好", "analysis_hypothesis", ["h1"]),
      item("多出的通勤时间可能侵蚀家庭节奏，这是估计值需要核实", "user_estimate", ["f_est"]),
    ],
    unresolved_conditions: [
      item("新岗位的职责范围与团队氛围仍未核实，会影响路径排序", "pattern_judgment", ["dir_options", "cf1"]),
    ],
    confidence: { overall: "medium", limits: ["合同条款未见，结论对薪资结构敏感"] },
  });
}

/** Raw page JSON for one decision page. */
export function di2PageJson(pageId: DecisionPageId): string {
  const blocks = DECISION_PAGE_SCHEMAS[pageId].segments.map((seg) => ({
    segment_id: seg.id,
    heading: "",
    body: "这一段给出与当前决策直接相关的白话结论和理由，并说明它依赖哪些已确认的情况。",
    basis: "依据冻结事实与个人分析",
    evidence_refs: ["DEF", "PA-pattern-1"],
  }));
  const out: Record<string, unknown> = { title: `${DECISION_PAGE_SCHEMAS[pageId].title}`, blocks };
  if (pageId === "05") {
    out.paths = [
      {
        path_id: "P1",
        rank: 1,
        label: "先核实再接受",
        conditions: "职责范围与团队情况核实后仍符合预期",
        cost: "需要额外两次沟通",
        risk: "核实期间对方失去耐心",
        reversibility: "答复前可随时撤回",
        exit_condition: "核实结果与描述明显不符",
        ranking_basis: "兼顾收入目标与不可接受结果",
        evidence_refs: ["f_conf", "dir_options", "cf1"],
      },
      {
        path_id: "P2",
        rank: 2,
        label: "维持现岗再观察",
        conditions: "现岗稳定性保持不变",
        cost: "放弃这次收入提升",
        risk: "长期收入停滞",
        reversibility: "可在下个机会出现时再评估",
        exit_condition: "现岗出现裁员信号",
        ranking_basis: "稳定性已知但收入目标落空",
        evidence_refs: ["f_conf", "c1"],
      },
    ];
  }
  if (pageId === "06") {
    out.experiment = {
      hypothesis: "新岗位的职责与描述一致",
      action: "约未来上级做一次三十分钟的职责确认",
      observe: "对方能否具体说出前三个月的交付",
      window: "答复期限之前",
      success: "职责描述具体且与预期一致",
      if_fail: "转向维持现岗路径",
      defer_costs: "等待正式合同再做职责确认",
      evidence_refs: ["dir_options", "c1"],
    };
  }
  if (pageId === "08") {
    out.review = {
      core_metrics: ["职责确认是否完成", "家庭节奏是否被打乱"],
      continue_when: "核实结果符合预期",
      adjust_when: "通勤成本高于估计",
      stop_when: "出现不可接受结果的迹象",
      rerun_when: "出现新的工作邀请或家庭情况变化",
      evidence_refs: ["c1", "dir_options"],
    };
  }
  return JSON.stringify(out);
}
