/**
 * Report paragraph information needs SSOT (DI2 Step 2).
 *
 * Paragraph structure: `DECISION_PAGE_SCHEMAS` (@/lib/llm/pro/delivery/page-schema/decision-pages).
 * Duties align with `.cursor/docs/decision-report/内容规格-SoT-2026-10-27.md` and the 2026-11-26 matrix.
 *
 * Necessity is evidence for report claims — not a user questionnaire checklist.
 * - required: judgment needs evidence; may ask if material; unknown/declined → preserve boundary.
 * - conditional: only when applicability holds.
 * - optional: depth only, never blocks delivery.
 * - defaultable: neutral wording or upstream derivation; never ask.
 * - none: no new user reality input.
 *
 * DDR `report_section_id` is not the paragraph owner; use `served_by_units` here.
 */

import type { DecisionPageId, PageSegmentId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import {
  DDR_CATALOG_V1_ENTRIES,
  DIR_TO_DDR_INDEX_V1,
} from "@/lib/poju/decision-context/catalog/ddr-catalog.v1";
import {
  DIR_DEFINITION_CATALOG_V1_ENTRIES,
  dirDefinitionById,
} from "@/lib/poju/decision-context/catalog/dir-definition-catalog.v1";
import type { DecisionBlueprint } from "@/lib/poju/decision-intake/types";

export const REPORT_INFORMATION_NEEDS_VERSION = "1" as const;

export type ReportOutputMode = "always_emit" | "topic_gated" | "code_generated";

export type ReportInformationSourceKind =
  | "decision_context"
  | "local_profile"
  | "personal_analysis"
  | "upstream_report"
  | "derived";

export type ReportInformationNecessity =
  | "required"
  | "conditional"
  | "optional"
  | "defaultable"
  | "none";

export type ReportInformationApplicability =
  | "always"
  | "page_07_topic_active"
  | "model_judged"
  | "system_derived";

export type ReportAskPolicy = "ask_if_material" | "never";

export type ReportReadinessEffect =
  | "never_block"
  | "block_when_missing"
  | "block_when_page_active";

export type ReportMissingBehavior =
  | "preserve_boundary"
  | "omit_specific_claim"
  | "neutral_qualitative_default"
  | "derive_from_upstream"
  | "omit_if_not_applicable"
  | "keep_blocking_after_boundary";

export type ReportCollectionCluster =
  | "problem_and_current_state"
  | "desired_outcome"
  | "options_and_tradeoffs"
  | "constraints_and_resources"
  | "risk_and_exit"
  | "experience_and_blockers"
  | "validation_and_execution"
  | "topic_specific"
  | "none";

export type ReportDecisionMateriality =
  | "decision_critical"
  | "ranking_relevant"
  | "supporting"
  | "narrative_only";

export type FactRoleRef = { dir_id: string; fact_role: string };

export type ReportSegmentContract = {
  unit_id: string;
  page_id: DecisionPageId;
  segment_id: PageSegmentId;
  output_role_zh: string;
  output_role_en: string;
  output_mode: ReportOutputMode;
  need_ids: readonly string[];
};

export type ReportInformationNeed = {
  need_id: string;
  served_by_units: readonly string[];
  collection_cluster: ReportCollectionCluster;
  decision_materiality: ReportDecisionMateriality;
  source_kind: ReportInformationSourceKind;
  fact_role_refs: readonly FactRoleRef[];
  necessity: ReportInformationNecessity;
  ask_policy: ReportAskPolicy;
  missing_behavior: ReportMissingBehavior;
  sufficient_when_zh: string;
  applicability: ReportInformationApplicability;
  readiness_effect: ReportReadinessEffect;
  description_zh: string;
  why_it_matters_zh: string;
  dir_ids: readonly string[];
  related_ddr_ids: readonly string[];
};

export type IntakeComplexity = "simple" | "medium" | "complex";

export type IntakeComplexityDecision = {
  complexity: IntakeComplexity;
  reasons: string[];
  core_round_target_min: number;
  core_round_soft_cap: number;
  core_round_hard_cap: number;
  clarification_allowance: number;
};

export type DecisionIntakeComplexitySignals = {
  option_count?: number;
  high_stakes?: boolean;
  irreversible?: boolean;
  multi_topic?: boolean;
  open_conflicts?: boolean;
};

const BLOCKING_DECISION_DIR_IDS = new Set<string>([
  "DIR-DEF-QUESTION",
  "DIR-DEF-OUTCOME",
  "DIR-STATUS-QUO",
  "DIR-OPT-ON-TABLE",
  "DIR-OPT-CONSTRAINTS",
]);

function unitId(pageId: DecisionPageId, segmentId: PageSegmentId): string {
  return `${pageId}:${segmentId}`;
}

function ddrIdsForDirs(dirIds: readonly string[]): string[] {
  const out = new Set<string>();
  for (const dirId of dirIds) {
    for (const ddrId of DIR_TO_DDR_INDEX_V1.get(dirId) ?? []) {
      out.add(ddrId);
    }
  }
  return [...out];
}

function factRolesForDir(dirId: string): readonly FactRoleRef[] {
  const def = dirDefinitionById(dirId);
  if (!def) return [];
  return def.required_fact_roles.map((fact_role) => ({ dir_id: dirId, fact_role }));
}

function dcNeedId(dirId: string): string {
  return `need:dc:${dirId}`;
}

type DirNeedSpec = Omit<
  ReportInformationNeed,
  "need_id" | "fact_role_refs" | "related_ddr_ids" | "dir_ids" | "source_kind"
> & { dir_id: string };

function buildDirNeed(spec: DirNeedSpec): ReportInformationNeed {
  const dir_ids = [spec.dir_id] as const;
  return {
    need_id: dcNeedId(spec.dir_id),
    served_by_units: spec.served_by_units,
    collection_cluster: spec.collection_cluster,
    decision_materiality: spec.decision_materiality,
    source_kind: "decision_context",
    fact_role_refs: factRolesForDir(spec.dir_id),
    necessity: spec.necessity,
    ask_policy: spec.ask_policy,
    missing_behavior: spec.missing_behavior,
    sufficient_when_zh: spec.sufficient_when_zh,
    applicability: spec.applicability,
    readiness_effect: spec.readiness_effect,
    description_zh: spec.description_zh,
    why_it_matters_zh: spec.why_it_matters_zh,
    dir_ids,
    related_ddr_ids: ddrIdsForDirs(dir_ids),
  };
}

function synthNeed(
  partial: Omit<ReportInformationNeed, "related_ddr_ids" | "fact_role_refs"> & {
    fact_role_refs?: readonly FactRoleRef[];
  },
): ReportInformationNeed {
  return {
    ...partial,
    fact_role_refs: partial.fact_role_refs ?? [],
    related_ddr_ids: ddrIdsForDirs(partial.dir_ids),
  };
}

const DIR_NEEDS: readonly ReportInformationNeed[] = [
  buildDirNeed({
    dir_id: "DIR-DEF-QUESTION",
    served_by_units: [unitId("01", "A")],
    collection_cluster: "problem_and_current_state",
    decision_materiality: "decision_critical",
    necessity: "required",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "决策问题已确认或用户已明确边界",
    applicability: "always",
    readiness_effect: "block_when_missing",
    description_zh: "清晰的决策问题",
    why_it_matters_zh: "无明确问题无法框定结论与路径",
  }),
  buildDirNeed({
    dir_id: "DIR-DEF-OUTCOME",
    served_by_units: [unitId("01", "A"), unitId("05", "A"), unitId("08", "A")],
    collection_cluster: "desired_outcome",
    decision_materiality: "decision_critical",
    necessity: "required",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "期望结果或成功标准已知、N/A 或边界已记录",
    applicability: "always",
    readiness_effect: "block_when_missing",
    description_zh: "期望达成的结果",
    why_it_matters_zh: "用于比较选项与成立条件、红灯信号",
  }),
  buildDirNeed({
    dir_id: "DIR-STATUS-QUO",
    served_by_units: [unitId("01", "A"), unitId("02", "B"), unitId("02", "C")],
    collection_cluster: "problem_and_current_state",
    decision_materiality: "decision_critical",
    necessity: "required",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "当前处境基线已确认或边界已记录",
    applicability: "always",
    readiness_effect: "block_when_missing",
    description_zh: "当前工作与生活基线",
    why_it_matters_zh: "对照维持现状的代价与核心判断",
  }),
  buildDirNeed({
    dir_id: "DIR-OPT-ON-TABLE",
    served_by_units: [
      unitId("01", "A"),
      unitId("05", "A"),
      unitId("05", "B"),
      unitId("01", "D"),
    ],
    collection_cluster: "options_and_tradeoffs",
    decision_materiality: "decision_critical",
    necessity: "required",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "真实可选方案已列出或明确仅单一选项",
    applicability: "always",
    readiness_effect: "block_when_missing",
    description_zh: "真实可选方案",
    why_it_matters_zh: "不能虚构机会；路径排序依赖真实选项",
  }),
  buildDirNeed({
    dir_id: "DIR-OPT-CONSTRAINTS",
    served_by_units: [
      unitId("01", "B"),
      unitId("01", "C"),
      unitId("02", "B"),
      unitId("02", "C"),
      unitId("04", "A"),
      unitId("04", "C"),
      unitId("05", "A"),
      unitId("05", "C"),
      unitId("06", "A"),
      unitId("08", "A"),
    ],
    collection_cluster: "constraints_and_resources",
    decision_materiality: "decision_critical",
    necessity: "required",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "硬性/软性约束已知、部分已知或边界已记录",
    applicability: "always",
    readiness_effect: "block_when_missing",
    description_zh: "钱/时间/责任等约束",
    why_it_matters_zh: "硬约束直接砍掉不可行路径并定义成立条件",
  }),
  buildDirNeed({
    dir_id: "DIR-DEF-PRIORITIES",
    served_by_units: [unitId("01", "B"), unitId("05", "A"), unitId("08", "B")],
    collection_cluster: "desired_outcome",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "neutral_qualitative_default",
    sufficient_when_zh: "目标优先级已知或可由已述目标推断",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "目标优先级顺序",
    why_it_matters_zh: "解释为何优先某路径、复盘问句对齐衡量维度",
  }),
  buildDirNeed({
    dir_id: "DIR-DEF-UNACCEPTABLE",
    served_by_units: [unitId("01", "D"), unitId("05", "C"), unitId("08", "A")],
    collection_cluster: "risk_and_exit",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "omit_specific_claim",
    sufficient_when_zh: "不可接受结果已陈述或确认无显著反路径",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "不可接受的结果",
    why_it_matters_zh: "定义慎选路径与红灯边界",
  }),
  buildDirNeed({
    dir_id: "DIR-DEF-STAKES",
    served_by_units: [unitId("04", "C")],
    collection_cluster: "risk_and_exit",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "omit_specific_claim",
    sufficient_when_zh: "重要损失/代价已确认或边界已记录",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "做错会失去什么",
    why_it_matters_zh: "硬顶代价须基于真实利害而非恐吓",
  }),
  buildDirNeed({
    dir_id: "DIR-TIMING-WINDOW",
    served_by_units: [unitId("01", "C"), unitId("05", "D"), unitId("06", "D")],
    collection_cluster: "constraints_and_resources",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "neutral_qualitative_default",
    sufficient_when_zh: "时间窗口已知或可用定性节奏描述",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "决策必须落地的时间窗口",
    why_it_matters_zh: "成立条件、切轨与节奏提醒的时间锚点",
  }),
  buildDirNeed({
    dir_id: "DIR-PAST-ATTEMPTS",
    served_by_units: [
      unitId("02", "B"),
      unitId("04", "A"),
      unitId("04", "B"),
      unitId("06", "C"),
    ],
    collection_cluster: "experience_and_blockers",
    decision_materiality: "supporting",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "omit_specific_claim",
    sufficient_when_zh: "过去尝试与教训已述或确认不适用",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "过去尝试与教训",
    why_it_matters_zh: "卡点命名与现实表现须基于真实经历",
  }),
  buildDirNeed({
    dir_id: "DIR-OPT-IRREV",
    served_by_units: [unitId("04", "C"), unitId("05", "A"), unitId("05", "D")],
    collection_cluster: "risk_and_exit",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "不可逆/切换成本已确认或边界已记录",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "不可逆与切换成本",
    why_it_matters_zh: "影响路径排序与切轨定性触发",
  }),
  buildDirNeed({
    dir_id: "DIR-RISK-TOLERANCE",
    served_by_units: [
      unitId("04", "C"),
      unitId("05", "A"),
      unitId("05", "C"),
      unitId("05", "D"),
      unitId("08", "A"),
    ],
    collection_cluster: "risk_and_exit",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "可承受最差结果或风险边界已述",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "可承受的最差结果",
    why_it_matters_zh: "决定能否推进高不确定选项与红灯阈值来源",
  }),
  buildDirNeed({
    dir_id: "DIR-EXIT-CRITERIA",
    served_by_units: [unitId("01", "E"), unitId("05", "D"), unitId("08", "A")],
    collection_cluster: "risk_and_exit",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "neutral_qualitative_default",
    sufficient_when_zh: "退出/转向条件已知或可用定性观察信号",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "退出与转向触发条件",
    why_it_matters_zh: "判断边界、切轨与红灯须有止损逻辑",
  }),
  buildDirNeed({
    dir_id: "DIR-VALIDATION-CAPACITY",
    served_by_units: [unitId("06", "A")],
    collection_cluster: "validation_and_execution",
    decision_materiality: "ranking_relevant",
    necessity: "required",
    ask_policy: "ask_if_material",
    missing_behavior: "neutral_qualitative_default",
    sufficient_when_zh: "可低成本验证的能力已确认或边界已记录",
    applicability: "always",
    readiness_effect: "never_block",
    description_zh: "能低成本验证什么",
    why_it_matters_zh: "近步原则依赖可逆验证，但 P1 非决策关键不单独阻塞交付",
  }),
  buildDirNeed({
    dir_id: "DIR-STAKEHOLDERS",
    served_by_units: [unitId("07", "B")],
    collection_cluster: "topic_specific",
    decision_materiality: "supporting",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "关键利益方与边界已述",
    applicability: "page_07_topic_active",
    readiness_effect: "never_block",
    description_zh: "受影响的关键方",
    why_it_matters_zh: "关系/场域互动的多方利害",
  }),
  buildDirNeed({
    dir_id: "DIR-JOB-OFFER",
    served_by_units: [unitId("07", "A")],
    collection_cluster: "topic_specific",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "职业主题下角色/薪酬/组织条件已知或边界已记录",
    applicability: "page_07_topic_active",
    readiness_effect: "never_block",
    description_zh: "工作机会与角色条件",
    why_it_matters_zh: "07 职业主题场域判断的证据",
  }),
  buildDirNeed({
    dir_id: "DIR-BIZ-MODEL",
    served_by_units: [unitId("07", "A")],
    collection_cluster: "topic_specific",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "创业主题下商业模式与依赖已知或边界已记录",
    applicability: "page_07_topic_active",
    readiness_effect: "never_block",
    description_zh: "商业模式与关键依赖",
    why_it_matters_zh: "07 创业主题场域判断的证据",
  }),
  buildDirNeed({
    dir_id: "DIR-REL-DYNAMICS",
    served_by_units: [unitId("07", "A"), unitId("07", "B")],
    collection_cluster: "topic_specific",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "关系互动与边界动态已述或边界已记录",
    applicability: "page_07_topic_active",
    readiness_effect: "never_block",
    description_zh: "关系互动与边界动态",
    why_it_matters_zh: "07 关系主题的场域与互动段落",
  }),
  buildDirNeed({
    dir_id: "DIR-LOCALE-MOVE",
    served_by_units: [unitId("07", "A")],
    collection_cluster: "topic_specific",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "迁移主题下落地约束已知或边界已记录",
    applicability: "page_07_topic_active",
    readiness_effect: "never_block",
    description_zh: "搬迁与落地约束",
    why_it_matters_zh: "07 迁移主题场域判断",
  }),
  buildDirNeed({
    dir_id: "DIR-EDU-PATH",
    served_by_units: [unitId("07", "A")],
    collection_cluster: "topic_specific",
    decision_materiality: "ranking_relevant",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "教育/发展路径条件已知或边界已记录",
    applicability: "page_07_topic_active",
    readiness_effect: "never_block",
    description_zh: "教育与发展路径条件",
    why_it_matters_zh: "07 教育主题场域判断",
  }),
];

const SYNTHETIC_NEEDS: readonly ReportInformationNeed[] = [
  synthNeed({
    need_id: "need:upstream:01b-page02-basis",
    served_by_units: [unitId("01", "B")],
    collection_cluster: "none",
    decision_materiality: "narrative_only",
    source_kind: "upstream_report",
    necessity: "defaultable",
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "Page02 依据段已生成或标记待生成",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "指向 Page02 的具体依据摘要",
    why_it_matters_zh: "推荐理由不重复追问已由 02 承担的个人化依据",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:default:01e-judgment-boundary",
    served_by_units: [unitId("01", "E")],
    collection_cluster: "risk_and_exit",
    decision_materiality: "supporting",
    source_kind: "derived",
    necessity: "defaultable",
    ask_policy: "never",
    missing_behavior: "neutral_qualitative_default",
    sufficient_when_zh: "DC 状态与已知条件足以写出定性边界",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "判断适用边界与失效信号",
    why_it_matters_zh: "由已确认、未知、冲突状态构建边界，不造数字阈值",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:local:02a-profile-relevant",
    served_by_units: [unitId("02", "A")],
    collection_cluster: "none",
    decision_materiality: "supporting",
    source_kind: "local_profile",
    necessity: "conditional",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "本地 Profile 有与本题相关的结构化字段",
    applicability: "always",
    readiness_effect: "never_block",
    description_zh: "与本题相关的本地命盘结构",
    why_it_matters_zh: "个人结构段仅使用系统已算资料",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:pa:02a-pattern-analysis",
    served_by_units: [unitId("02", "A")],
    collection_cluster: "none",
    decision_materiality: "supporting",
    source_kind: "personal_analysis",
    necessity: "conditional",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "Personal Analysis 有 pattern 类证据",
    applicability: "always",
    readiness_effect: "never_block",
    description_zh: "个人模式分析锚点",
    why_it_matters_zh: "解释为何判断与此人有关",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:pa:02c-analysis-anchor",
    served_by_units: [unitId("02", "C")],
    collection_cluster: "none",
    decision_materiality: "supporting",
    source_kind: "personal_analysis",
    necessity: "conditional",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "有双方证据锚点可对照",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "个人分析与传统依据锚点",
    why_it_matters_zh: "交汇段须区分现实事实与分析判断",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:local:02c-profile-anchor",
    served_by_units: [unitId("02", "C")],
    collection_cluster: "none",
    decision_materiality: "supporting",
    source_kind: "local_profile",
    necessity: "conditional",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "本地 Profile 字段可用",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "本地 Profile 对照锚点",
    why_it_matters_zh: "个人与现实交汇的结构侧证据",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:derived:02d-evidence-refs",
    served_by_units: [unitId("02", "D")],
    collection_cluster: "none",
    decision_materiality: "narrative_only",
    source_kind: "derived",
    necessity: "none",
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "PA 与 DC 证据引用可组织",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "可核对依据与证据引用组织",
    why_it_matters_zh: "证据展示段不新增问答",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:default:02e-explain-boundary",
    served_by_units: [unitId("02", "E")],
    collection_cluster: "none",
    decision_materiality: "narrative_only",
    source_kind: "derived",
    necessity: "defaultable",
    ask_policy: "never",
    missing_behavior: "neutral_qualitative_default",
    sufficient_when_zh: "来源可用性状态已知",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "解释边界与不确定性声明",
    why_it_matters_zh: "保留未知/未核实/拒绝边界",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:dc:04a-open-conflicts",
    served_by_units: [unitId("04", "A")],
    collection_cluster: "experience_and_blockers",
    decision_materiality: "supporting",
    source_kind: "decision_context",
    necessity: "conditional",
    // Collected via conflict-clarification path, not ordinary DIR AQE candidates.
    ask_policy: "never",
    missing_behavior: "omit_specific_claim",
    sufficient_when_zh: "开放冲突或相关假设已记录",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "开放冲突与相关假设",
    why_it_matters_zh: "卡点机制命名须有现实摩擦证据",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:pa:04a-relevant",
    served_by_units: [unitId("04", "A")],
    collection_cluster: "none",
    decision_materiality: "supporting",
    source_kind: "personal_analysis",
    necessity: "conditional",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "有相关个人分析证据",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "卡点相关的个人分析依据",
    why_it_matters_zh: "不得仅凭盘面贴人格标签",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:dc:04b-user-experience",
    served_by_units: [unitId("04", "B")],
    collection_cluster: "experience_and_blockers",
    decision_materiality: "supporting",
    source_kind: "decision_context",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "omit_specific_claim",
    sufficient_when_zh: "用户已述具体场景或行为",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "用户真实经历与实际表现",
    why_it_matters_zh: "缺少事实时不推断行为",
    // Same collect path as past attempts / lived experience DIR.
    dir_ids: ["DIR-PAST-ATTEMPTS"],
    fact_role_refs: factRolesForDir("DIR-PAST-ATTEMPTS"),
  }),
  synthNeed({
    need_id: "need:derived:04d-leverage",
    served_by_units: [unitId("04", "D")],
    collection_cluster: "none",
    decision_materiality: "narrative_only",
    source_kind: "derived",
    necessity: "defaultable",
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "04:A/B 与约束分析已存在",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "最值得撬动的杠杆点推导",
    why_it_matters_zh: "由已有障碍与可改变条件推导",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:pa:05a-ranking-context",
    served_by_units: [unitId("05", "A")],
    collection_cluster: "none",
    decision_materiality: "ranking_relevant",
    source_kind: "personal_analysis",
    necessity: "conditional",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "个人分析对排序有证据支持",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "路径排序相关的个人分析",
    why_it_matters_zh: "排序须建立在现实条件上，分析仅作补充",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:dc:05b-alternative-options",
    served_by_units: [unitId("05", "B")],
    collection_cluster: "options_and_tradeoffs",
    decision_materiality: "ranking_relevant",
    source_kind: "decision_context",
    necessity: "conditional",
    // Real options are collected only via DIR-OPT-ON-TABLE (unit 05:B now served by that DIR).
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "存在真实替代选项或用户确认仅一条现实路径",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "真实替代选项",
    why_it_matters_zh: "不能为凑数编造机会；与 DIR-OPT-ON-TABLE 同一收集路径",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:derived:05b-stage-strategy",
    served_by_units: [unitId("05", "B")],
    collection_cluster: "options_and_tradeoffs",
    decision_materiality: "supporting",
    source_kind: "derived",
    necessity: "optional",
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "可由已知事实构造阶段化/验证策略",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "阶段化或低成本试验策略路径",
    why_it_matters_zh: "策略路径不等于声称用户拥有多个机会",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:dc:05c-option-conflict",
    served_by_units: [unitId("05", "C")],
    collection_cluster: "options_and_tradeoffs",
    decision_materiality: "supporting",
    source_kind: "decision_context",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "omit_specific_claim",
    sufficient_when_zh: "选项间真实冲突已确认",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "选项之间的真实冲突",
    why_it_matters_zh: "无冲突时不制造慎选路径",
    dir_ids: ["DIR-OPT-ON-TABLE"],
  }),
  synthNeed({
    need_id: "need:default:05d-qualitative-exit",
    served_by_units: [unitId("05", "D")],
    collection_cluster: "risk_and_exit",
    decision_materiality: "supporting",
    source_kind: "derived",
    necessity: "defaultable",
    ask_policy: "never",
    missing_behavior: "neutral_qualitative_default",
    sufficient_when_zh: "目标与路径足以给出定性切轨信号",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "定性切轨/停止观察信号",
    why_it_matters_zh: "缺少数阈值时用可观察定性触发",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:derived:05e-path-compare",
    served_by_units: [unitId("05", "E")],
    collection_cluster: "none",
    decision_materiality: "narrative_only",
    source_kind: "derived",
    necessity: "none",
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "05:A–D 路径内容已生成",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "路径对照一句摘要",
    why_it_matters_zh: "不重复收集路径信息",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:upstream:06a-page05-primary",
    served_by_units: [unitId("06", "A")],
    collection_cluster: "validation_and_execution",
    decision_materiality: "decision_critical",
    source_kind: "upstream_report",
    necessity: "required",
    ask_policy: "never",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "Page05 首选路径已产出",
    applicability: "always",
    readiness_effect: "never_block",
    description_zh: "Page05 已选首选路径",
    why_it_matters_zh: "近步必须对齐已排序方案",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:local:06b-da-yun",
    served_by_units: [unitId("06", "B")],
    collection_cluster: "none",
    decision_materiality: "supporting",
    source_kind: "local_profile",
    necessity: "conditional",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "本地大运序列可用",
    applicability: "always",
    readiness_effect: "never_block",
    description_zh: "八字大运阶段资料",
    why_it_matters_zh: "阶段节奏来自本地计算",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:local:06b-ziwei-stage",
    served_by_units: [unitId("06", "B")],
    collection_cluster: "none",
    decision_materiality: "supporting",
    source_kind: "local_profile",
    necessity: "conditional",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "紫微大限等 Closed Set 可用且与本题相关",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "紫微阶段资料（相关时）",
    why_it_matters_zh: "不播流日、不解释命盘",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:dc:06c-execution-experience",
    served_by_units: [unitId("06", "C")],
    collection_cluster: "experience_and_blockers",
    decision_materiality: "supporting",
    source_kind: "decision_context",
    necessity: "optional",
    ask_policy: "ask_if_material",
    missing_behavior: "omit_specific_claim",
    sufficient_when_zh: "用户已述执行困难或经验",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "真实执行经历与困难",
    why_it_matters_zh: "自我调节 optional，禁止固定人格标签；与过去尝试同一收集路径",
    // Execution experience is lived attempt history — not validation_capacity.
    dir_ids: ["DIR-PAST-ATTEMPTS"],
    fact_role_refs: factRolesForDir("DIR-PAST-ATTEMPTS"),
  }),
  synthNeed({
    need_id: "need:pa:06c-self-regulation",
    served_by_units: [unitId("06", "C")],
    collection_cluster: "none",
    decision_materiality: "supporting",
    source_kind: "personal_analysis",
    necessity: "optional",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "分析有证据支持的执行倾向",
    applicability: "model_judged",
    readiness_effect: "never_block",
    description_zh: "有证据的自我调频提示",
    why_it_matters_zh: "optional 个人化，不问命盘解释",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:default:06d-rhythm",
    served_by_units: [unitId("06", "D")],
    collection_cluster: "validation_and_execution",
    decision_materiality: "narrative_only",
    source_kind: "derived",
    necessity: "defaultable",
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "05 路径与 06 实验可推导节奏",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "阶段节奏提醒",
    why_it_matters_zh: "不虚构日历或打卡清单",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:dc:07b-observed-interaction",
    served_by_units: [unitId("07", "B")],
    collection_cluster: "topic_specific",
    decision_materiality: "supporting",
    source_kind: "decision_context",
    necessity: "conditional",
    ask_policy: "ask_if_material",
    missing_behavior: "preserve_boundary",
    sufficient_when_zh: "用户已述观察到的互动与边界",
    applicability: "page_07_topic_active",
    readiness_effect: "never_block",
    description_zh: "用户观察到的关系互动",
    why_it_matters_zh: "不要求他人命盘补洞",
    dir_ids: ["DIR-REL-DYNAMICS"],
  }),
  synthNeed({
    need_id: "need:local:07b-counterparty-profile",
    served_by_units: [unitId("07", "B")],
    collection_cluster: "topic_specific",
    decision_materiality: "supporting",
    source_kind: "local_profile",
    necessity: "optional",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "系统已拥有对方资料",
    applicability: "page_07_topic_active",
    readiness_effect: "never_block",
    description_zh: "已持有的他人资料（若有）",
    why_it_matters_zh: "可选系统输入，不向用户索要命盘",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:derived:07c-fold",
    served_by_units: [unitId("07", "C")],
    collection_cluster: "none",
    decision_materiality: "narrative_only",
    source_kind: "derived",
    necessity: "none",
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "07:A/B 证据可折叠",
    applicability: "page_07_topic_active",
    readiness_effect: "never_block",
    description_zh: "场域依据折叠",
    why_it_matters_zh: "不新增用户信息",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:derived:07d-align-01-05",
    served_by_units: [unitId("07", "D")],
    collection_cluster: "none",
    decision_materiality: "narrative_only",
    source_kind: "derived",
    necessity: "none",
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "Page01 与 Page05 输出存在",
    applicability: "page_07_topic_active",
    readiness_effect: "never_block",
    description_zh: "与主结论和路径对齐",
    why_it_matters_zh: "不喂新字段",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:default:08b-reuse-06-metrics",
    served_by_units: [unitId("08", "B")],
    collection_cluster: "validation_and_execution",
    decision_materiality: "supporting",
    source_kind: "derived",
    necessity: "defaultable",
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "Page06 实验指标已定义",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "复用验证实验与观察指标",
    why_it_matters_zh: "复盘问句优先复用 P6 指标",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:default:08c-rerun-triggers",
    served_by_units: [unitId("08", "C")],
    collection_cluster: "risk_and_exit",
    decision_materiality: "supporting",
    source_kind: "derived",
    necessity: "defaultable",
    ask_policy: "never",
    missing_behavior: "derive_from_upstream",
    sufficient_when_zh: "目标/约束/路径变化可推导重跑条件",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "何时重跑本题的定性触发",
    why_it_matters_zh: "从决策边界推导，不新增问卷",
    dir_ids: [],
  }),
  synthNeed({
    need_id: "need:derived:03-terminology-appendix",
    served_by_units: [unitId("03", "A"), unitId("03", "B")],
    collection_cluster: "none",
    decision_materiality: "narrative_only",
    source_kind: "derived",
    necessity: "none",
    ask_policy: "never",
    missing_behavior: "omit_if_not_applicable",
    sufficient_when_zh: "依据层出现术语 marker 时由代码汇总",
    applicability: "system_derived",
    readiness_effect: "never_block",
    description_zh: "术语附录生成",
    why_it_matters_zh: "Page03 不参与用户问答",
    dir_ids: [],
  }),
];

export const REPORT_INFORMATION_NEEDS: readonly ReportInformationNeed[] = Object.freeze([
  ...DIR_NEEDS,
  ...SYNTHETIC_NEEDS,
]);

const NEED_IDS_BY_UNIT: Record<string, readonly string[]> = {
  "01:A": [
    dcNeedId("DIR-DEF-QUESTION"),
    dcNeedId("DIR-DEF-OUTCOME"),
    dcNeedId("DIR-STATUS-QUO"),
    dcNeedId("DIR-OPT-ON-TABLE"),
  ],
  "01:B": [
    dcNeedId("DIR-DEF-PRIORITIES"),
    dcNeedId("DIR-OPT-CONSTRAINTS"),
    "need:upstream:01b-page02-basis",
  ],
  "01:C": [dcNeedId("DIR-OPT-CONSTRAINTS"), dcNeedId("DIR-TIMING-WINDOW")],
  "01:D": [dcNeedId("DIR-DEF-UNACCEPTABLE"), dcNeedId("DIR-OPT-ON-TABLE")],
  "01:E": [
    dcNeedId("DIR-EXIT-CRITERIA"),
    "need:default:01e-judgment-boundary",
  ],
  "02:A": ["need:local:02a-profile-relevant", "need:pa:02a-pattern-analysis"],
  "02:B": [
    dcNeedId("DIR-STATUS-QUO"),
    dcNeedId("DIR-PAST-ATTEMPTS"),
    dcNeedId("DIR-OPT-CONSTRAINTS"),
  ],
  "02:C": [
    dcNeedId("DIR-STATUS-QUO"),
    dcNeedId("DIR-OPT-CONSTRAINTS"),
    "need:local:02c-profile-anchor",
    "need:pa:02c-analysis-anchor",
  ],
  "02:D": ["need:derived:02d-evidence-refs"],
  "02:E": ["need:default:02e-explain-boundary"],
  "04:A": [
    dcNeedId("DIR-OPT-CONSTRAINTS"),
    "need:dc:04a-open-conflicts",
    dcNeedId("DIR-PAST-ATTEMPTS"),
    "need:pa:04a-relevant",
  ],
  "04:B": [dcNeedId("DIR-PAST-ATTEMPTS"), "need:dc:04b-user-experience"],
  "04:C": [
    dcNeedId("DIR-DEF-STAKES"),
    dcNeedId("DIR-OPT-CONSTRAINTS"),
    dcNeedId("DIR-RISK-TOLERANCE"),
    dcNeedId("DIR-OPT-IRREV"),
  ],
  "04:D": ["need:derived:04d-leverage"],
  "05:A": [
    dcNeedId("DIR-OPT-ON-TABLE"),
    dcNeedId("DIR-DEF-OUTCOME"),
    dcNeedId("DIR-DEF-PRIORITIES"),
    dcNeedId("DIR-OPT-CONSTRAINTS"),
    dcNeedId("DIR-RISK-TOLERANCE"),
    dcNeedId("DIR-OPT-IRREV"),
    "need:pa:05a-ranking-context",
  ],
  "05:B": [
    dcNeedId("DIR-OPT-ON-TABLE"),
    "need:dc:05b-alternative-options",
    "need:derived:05b-stage-strategy",
  ],
  "05:C": [
    dcNeedId("DIR-DEF-UNACCEPTABLE"),
    dcNeedId("DIR-OPT-CONSTRAINTS"),
    dcNeedId("DIR-RISK-TOLERANCE"),
    "need:dc:05c-option-conflict",
  ],
  "05:D": [
    dcNeedId("DIR-EXIT-CRITERIA"),
    dcNeedId("DIR-TIMING-WINDOW"),
    dcNeedId("DIR-RISK-TOLERANCE"),
    dcNeedId("DIR-OPT-IRREV"),
    "need:default:05d-qualitative-exit",
  ],
  "05:E": ["need:derived:05e-path-compare"],
  "06:A": [
    "need:upstream:06a-page05-primary",
    dcNeedId("DIR-OPT-CONSTRAINTS"),
    dcNeedId("DIR-VALIDATION-CAPACITY"),
  ],
  "06:B": ["need:local:06b-da-yun", "need:local:06b-ziwei-stage"],
  "06:C": [
    dcNeedId("DIR-PAST-ATTEMPTS"),
    "need:dc:06c-execution-experience",
    "need:pa:06c-self-regulation",
  ],
  "06:D": ["need:default:06d-rhythm", dcNeedId("DIR-TIMING-WINDOW")],
  "07:A": [
    dcNeedId("DIR-JOB-OFFER"),
    dcNeedId("DIR-BIZ-MODEL"),
    dcNeedId("DIR-REL-DYNAMICS"),
    dcNeedId("DIR-LOCALE-MOVE"),
    dcNeedId("DIR-EDU-PATH"),
  ],
  "07:B": [
    dcNeedId("DIR-REL-DYNAMICS"),
    dcNeedId("DIR-STAKEHOLDERS"),
    "need:dc:07b-observed-interaction",
    "need:local:07b-counterparty-profile",
  ],
  "07:C": ["need:derived:07c-fold"],
  "07:D": ["need:derived:07d-align-01-05"],
  "08:A": [
    dcNeedId("DIR-DEF-OUTCOME"),
    dcNeedId("DIR-DEF-UNACCEPTABLE"),
    dcNeedId("DIR-OPT-CONSTRAINTS"),
    dcNeedId("DIR-RISK-TOLERANCE"),
    dcNeedId("DIR-EXIT-CRITERIA"),
  ],
  "08:B": ["need:default:08b-reuse-06-metrics", dcNeedId("DIR-DEF-PRIORITIES")],
  "08:C": ["need:default:08c-rerun-triggers"],
  "03:A": ["need:derived:03-terminology-appendix"],
  "03:B": ["need:derived:03-terminology-appendix"],
};

function segmentOutputMode(pageId: DecisionPageId): ReportOutputMode {
  if (pageId === "07") return "topic_gated";
  if (pageId === "03") return "code_generated";
  return "always_emit";
}

function buildSegmentContracts(): readonly ReportSegmentContract[] {
  const contracts: ReportSegmentContract[] = [];
  for (const pageId of Object.keys(DECISION_PAGE_SCHEMAS) as DecisionPageId[]) {
    const schema = DECISION_PAGE_SCHEMAS[pageId];
    for (const seg of schema.segments) {
      const uid = unitId(pageId, seg.id);
      const need_ids = NEED_IDS_BY_UNIT[uid];
      if (!need_ids) {
        throw new Error(`Missing NEED_IDS_BY_UNIT for ${uid}`);
      }
      contracts.push({
        unit_id: uid,
        page_id: pageId,
        segment_id: seg.id,
        output_role_zh: seg.label,
        output_role_en: `${schema.title} · ${seg.id}`,
        output_mode: segmentOutputMode(pageId),
        need_ids,
      });
    }
  }
  return Object.freeze(contracts);
}

export const REPORT_SEGMENT_CONTRACTS: readonly ReportSegmentContract[] =
  buildSegmentContracts();

const NEED_BY_ID = new Map<string, ReportInformationNeed>(
  REPORT_INFORMATION_NEEDS.map((n) => [n.need_id, n]),
);

const CONTRACT_BY_UNIT = new Map<string, ReportSegmentContract>(
  REPORT_SEGMENT_CONTRACTS.map((c) => [c.unit_id, c]),
);

export function reportSegmentContract(
  pageId: DecisionPageId,
  segmentId: PageSegmentId,
): ReportSegmentContract | undefined {
  return CONTRACT_BY_UNIT.get(unitId(pageId, segmentId));
}

export function allReportSegmentContracts(): readonly ReportSegmentContract[] {
  return REPORT_SEGMENT_CONTRACTS;
}

export function reportInformationNeedById(
  needId: string,
): ReportInformationNeed | undefined {
  return NEED_BY_ID.get(needId);
}

export function reportInformationNeedsForUnit(
  unitIdKey: string,
): readonly ReportInformationNeed[] {
  const contract = CONTRACT_BY_UNIT.get(unitIdKey);
  if (!contract) return [];
  return contract.need_ids
    .map((id) => NEED_BY_ID.get(id))
    .filter((n): n is ReportInformationNeed => Boolean(n));
}

export function reportInformationNeedsForDirIds(
  dirIds: readonly string[],
  options?: { unitId?: string },
): readonly ReportInformationNeed[] {
  const dirSet = new Set(dirIds);
  return REPORT_INFORMATION_NEEDS.filter((need) => {
    if (!need.dir_ids.some((d) => dirSet.has(d))) return false;
    if (options?.unitId && !need.served_by_units.includes(options.unitId)) {
      return false;
    }
    return true;
  });
}

export function blockingReportNeeds(): readonly ReportInformationNeed[] {
  return REPORT_INFORMATION_NEEDS.filter(
    (n) =>
      n.source_kind === "decision_context" &&
      n.decision_materiality === "decision_critical" &&
      n.ask_policy === "ask_if_material" &&
      n.readiness_effect === "block_when_missing",
  );
}

export function isReportDirBlocking(
  dirId: string,
  blueprint: DecisionBlueprint | null | undefined,
): boolean {
  if (!BLOCKING_DECISION_DIR_IDS.has(dirId)) return false;
  if (!blueprint?.dir_ids?.length) return true;
  return blueprint.dir_ids.includes(dirId);
}

export function requiredReportDirIds(
  blueprint: DecisionBlueprint | null | undefined,
): string[] {
  const blocking = [...BLOCKING_DECISION_DIR_IDS];
  if (!blueprint?.dir_ids?.length) return blocking;
  return blocking.filter((id) => blueprint.dir_ids.includes(id));
}

export function formatReportInformationNeedsForPrompt(
  dirIds: readonly string[],
  locale: "zh" | "en" = "zh",
): string {
  const needs = reportInformationNeedsForDirIds(dirIds);
  if (needs.length === 0) {
    return locale === "zh" ? "（无匹配的报告信息需求）" : "(no matching report information needs)";
  }
  const lines = needs.map((n) => {
    const units = n.served_by_units.join(", ");
    if (locale === "en") {
      return [
        `- ${n.need_id}`,
        `  units: ${units}`,
        `  necessity: ${n.necessity}`,
        `  source: ${n.source_kind}`,
        `  materiality: ${n.decision_materiality}`,
        `  ask: ${n.ask_policy}`,
        `  readiness: ${n.readiness_effect}`,
        `  missing: ${n.missing_behavior}`,
        `  dirs: ${n.dir_ids.join(", ") || "—"}`,
      ].join("\n");
    }
    return [
      `- ${n.need_id}`,
      `  段落: ${units}`,
      `  必要性: ${n.necessity}`,
      `  来源: ${n.source_kind}`,
      `  决策影响: ${n.decision_materiality}`,
      `  追问策略: ${n.ask_policy}`,
      `  就绪影响: ${n.readiness_effect}`,
      `  缺失处理: ${n.missing_behavior}`,
      `  充分条件: ${n.sufficient_when_zh}`,
      `  说明: ${n.description_zh}`,
      `  为何重要: ${n.why_it_matters_zh}`,
      `  DIR: ${n.dir_ids.join(", ") || "—"}`,
    ].join("\n");
  });
  return lines.join("\n");
}

type ComplexityFact = {
  statement?: string;
  status?: string;
  related_dir_ids?: string[] | null;
  fact_roles?: string[] | null;
};

type ComplexityConstraint = {
  statement?: string;
  status?: string;
  related_dir_ids?: string[] | null;
};

/** Stakes / irreversibility: confirmed RealityFacts + Constraints only. */
function confirmedMaterialStatementsForDir(
  dc: {
    reality_facts?: ReadonlyArray<ComplexityFact>;
    constraints?: ReadonlyArray<ComplexityConstraint>;
  } | null | undefined,
  dirId: string,
): string[] {
  const out: string[] = [];
  for (const f of dc?.reality_facts ?? []) {
    if (f.status !== "confirmed") continue;
    if (!(f.related_dir_ids ?? []).includes(dirId)) continue;
    const s = f.statement?.trim();
    if (s) out.push(s);
  }
  for (const c of dc?.constraints ?? []) {
    if (c.status !== "confirmed") continue;
    if (!(c.related_dir_ids ?? []).includes(dirId)) continue;
    const s = c.statement?.trim();
    if (s) out.push(s);
  }
  return out;
}

/**
 * Distinct real options on DIR-OPT-ON-TABLE.
 * Only confirmed RealityFacts with the catalog `option` role count —
 * Constraints never inflate option_count.
 */
function distinctConfirmedOptionStatements(
  dc: {
    reality_facts?: ReadonlyArray<ComplexityFact>;
  } | null | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const f of dc?.reality_facts ?? []) {
    if (f.status !== "confirmed") continue;
    if (!(f.related_dir_ids ?? []).includes("DIR-OPT-ON-TABLE")) continue;
    if (!(f.fact_roles ?? []).includes("option")) continue;
    const s = f.statement?.trim();
    if (s) out.add(s);
  }
  return out;
}

/**
 * Complexity signals from durable decision materials — never from Blueprint DIR
 * inventory alone (always-on DDRs would otherwise force medium+ for every session).
 */
export function complexitySignalsFromDecisionMaterials(input: {
  dc?: {
    reality_facts?: ReadonlyArray<ComplexityFact>;
    constraints?: ReadonlyArray<ComplexityConstraint>;
    conflicts?: ReadonlyArray<{ state?: string }>;
  } | null;
  /** True only when this session actually activates Page07 topic packs. */
  page_07_emit?: boolean;
}): DecisionIntakeComplexitySignals {
  const dc = input.dc;
  const optionStatements = distinctConfirmedOptionStatements(dc);
  let option_count = 2;
  if (optionStatements.size >= 4) option_count = 4;
  else if (optionStatements.size >= 3) option_count = 3;

  const high_stakes =
    confirmedMaterialStatementsForDir(dc, "DIR-DEF-STAKES").length > 0;
  const irreversible =
    confirmedMaterialStatementsForDir(dc, "DIR-OPT-IRREV").length > 0 ||
    confirmedMaterialStatementsForDir(dc, "DIR-EXIT-CRITERIA").length > 0;
  const open_conflicts = (dc?.conflicts ?? []).some((c) => c.state === "open");
  const multi_topic = input.page_07_emit === true;

  return {
    option_count,
    high_stakes,
    irreversible,
    multi_topic,
    open_conflicts,
  };
}

export function classifyDecisionIntakeComplexity(
  signals: DecisionIntakeComplexitySignals,
): IntakeComplexityDecision {
  const reasons: string[] = [];
  let score = 0;

  const options = signals.option_count ?? 2;
  if (options >= 4) {
    score += 2;
    reasons.push(`option_count=${options}`);
  } else if (options >= 3) {
    score += 1;
    reasons.push(`option_count=${options}`);
  }

  if (signals.high_stakes) {
    score += 2;
    reasons.push("high_stakes");
  }
  if (signals.irreversible) {
    score += 2;
    reasons.push("irreversible");
  }
  if (signals.multi_topic) {
    score += 2;
    reasons.push("multi_topic");
  }
  if (signals.open_conflicts) {
    score += 1;
    reasons.push("open_conflicts");
  }

  let complexity: IntakeComplexity = "simple";
  if (score >= 5) complexity = "complex";
  else if (score >= 2) complexity = "medium";

  const caps: Record<
    IntakeComplexity,
    { min: number; soft: number; hard: number }
  > = {
    simple: { min: 5, soft: 7, hard: 7 },
    medium: { min: 8, soft: 10, hard: 10 },
    complex: { min: 10, soft: 12, hard: 12 },
  };
  const cap = caps[complexity];

  return {
    complexity,
    reasons,
    core_round_target_min: cap.min,
    core_round_soft_cap: cap.soft,
    core_round_hard_cap: cap.hard,
    clarification_allowance: 3,
  };
}

export function assertReportInformationNeedsIntegrity(): void {
  const catalogDirIds = new Set(
    DIR_DEFINITION_CATALOG_V1_ENTRIES.map((e) => e.dir_id),
  );
  const catalogDdrIds = new Set(DDR_CATALOG_V1_ENTRIES.map((e) => e.ddr_id));

  const needIds = new Set<string>();
  for (const need of REPORT_INFORMATION_NEEDS) {
    if (needIds.has(need.need_id)) {
      throw new Error(`Duplicate need_id: ${need.need_id}`);
    }
    needIds.add(need.need_id);

    for (const dirId of need.dir_ids) {
      if (!catalogDirIds.has(dirId)) {
        throw new Error(`Unknown dir_id in need ${need.need_id}: ${dirId}`);
      }
    }
    for (const ddrId of need.related_ddr_ids) {
      if (!catalogDdrIds.has(ddrId)) {
        throw new Error(`Unknown ddr_id in need ${need.need_id}: ${ddrId}`);
      }
    }

    if (need.source_kind !== "decision_context" && need.ask_policy !== "never") {
      throw new Error(`Non-DC need must never ask: ${need.need_id}`);
    }
    if (
      need.source_kind !== "decision_context" &&
      need.readiness_effect !== "never_block"
    ) {
      throw new Error(`Non-DC need must never block: ${need.need_id}`);
    }
    if (
      (need.necessity === "optional" ||
        need.necessity === "defaultable" ||
        need.necessity === "none") &&
      need.readiness_effect !== "never_block"
    ) {
      throw new Error(`optional/defaultable/none must never_block: ${need.need_id}`);
    }
    if (
      need.readiness_effect === "block_when_missing" &&
      need.source_kind !== "decision_context"
    ) {
      throw new Error(`Only DC may block_when_missing: ${need.need_id}`);
    }
    if (
      need.source_kind === "decision_context" &&
      need.ask_policy === "ask_if_material" &&
      need.dir_ids.length === 0
    ) {
      throw new Error(
        `Askable DC need must bind at least one DIR collect path: ${need.need_id}`,
      );
    }
    if (
      need.readiness_effect === "block_when_page_active" &&
      need.decision_materiality !== "decision_critical"
    ) {
      throw new Error(
        `block_when_page_active requires decision_critical (freeze rule): ${need.need_id}`,
      );
    }

    if (need.served_by_units.some((u) => u.startsWith("07:"))) {
      if (need.applicability !== "page_07_topic_active") {
        throw new Error(`Page07 need must use page_07_topic_active: ${need.need_id}`);
      }
    }

    if (need.served_by_units.some((u) => u.startsWith("03:"))) {
      if (
        need.necessity !== "none" ||
        need.ask_policy !== "never" ||
        need.readiness_effect !== "never_block"
      ) {
        throw new Error(`Page03 need must be none/never/never_block: ${need.need_id}`);
      }
    }
  }

  if (REPORT_SEGMENT_CONTRACTS.length !== 32) {
    throw new Error(
      `Expected 32 segment contracts, got ${REPORT_SEGMENT_CONTRACTS.length}`,
    );
  }

  const unitIds = new Set<string>();
  for (const contract of REPORT_SEGMENT_CONTRACTS) {
    if (unitIds.has(contract.unit_id)) {
      throw new Error(`Duplicate unit_id: ${contract.unit_id}`);
    }
    unitIds.add(contract.unit_id);

    const schema = DECISION_PAGE_SCHEMAS[contract.page_id];
    if (!schema) {
      throw new Error(`Unknown page_id in contract: ${contract.page_id}`);
    }
    if (!schema.segments.some((s) => s.id === contract.segment_id)) {
      throw new Error(
        `Unknown segment ${contract.page_id}:${contract.segment_id}`,
      );
    }
    for (const needId of contract.need_ids) {
      if (!needIds.has(needId)) {
        throw new Error(`Contract ${contract.unit_id} references unknown need ${needId}`);
      }
    }
  }

  for (const pageId of Object.keys(DECISION_PAGE_SCHEMAS) as DecisionPageId[]) {
    for (const seg of DECISION_PAGE_SCHEMAS[pageId].segments) {
      const uid = unitId(pageId, seg.id);
      if (!unitIds.has(uid)) {
        throw new Error(`Missing segment contract for ${uid}`);
      }
    }
  }

  for (const need of REPORT_INFORMATION_NEEDS) {
    for (const uid of need.served_by_units) {
      if (!unitIds.has(uid)) {
        throw new Error(`Need ${need.need_id} references unknown unit ${uid}`);
      }
    }
  }

  for (const dirId of BLOCKING_DECISION_DIR_IDS) {
    const need = NEED_BY_ID.get(dcNeedId(dirId));
    if (!need) throw new Error(`Missing blocking need for ${dirId}`);
    if (need.decision_materiality !== "decision_critical") {
      throw new Error(`Blocking dir ${dirId} must be decision_critical`);
    }
    if (need.readiness_effect !== "block_when_missing") {
      throw new Error(`Blocking dir ${dirId} must block_when_missing`);
    }
  }

  const validation = NEED_BY_ID.get(dcNeedId("DIR-VALIDATION-CAPACITY"));
  if (!validation) throw new Error("Missing DIR-VALIDATION-CAPACITY need");
  if (validation.necessity !== "required") {
    throw new Error("DIR-VALIDATION-CAPACITY must be required");
  }
  if (validation.readiness_effect !== "never_block") {
    throw new Error("DIR-VALIDATION-CAPACITY must never_block");
  }
  if (validation.decision_materiality === "decision_critical") {
    throw new Error("DIR-VALIDATION-CAPACITY must not be decision_critical");
  }

  for (const need of DIR_NEEDS) {
    for (const ref of need.fact_role_refs) {
      const def = dirDefinitionById(ref.dir_id);
      if (!def?.required_fact_roles.includes(ref.fact_role)) {
        throw new Error(
          `Invalid fact_role ${ref.fact_role} for ${ref.dir_id} in ${need.need_id}`,
        );
      }
    }
  }
}

// Fail fast at module load in development builds.
assertReportInformationNeedsIntegrity();