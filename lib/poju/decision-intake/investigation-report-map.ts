/**
 * DIR → investigation layer → 8-page report faces/sections.
 * Candidates with no report purpose are excluded from ordinary investigation.
 * Section ids come from DDR catalog (SSOT); this map adds layer + purpose prose.
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import {
  DDR_CATALOG_V1_ENTRIES,
  DIR_TO_DDR_INDEX_V1,
} from "@/lib/poju/decision-context/catalog/ddr-catalog.v1";

/** Scheduling layers for report-driven intake (Q&A focus, not a second fact store). */
export type IntakeLayerFocus =
  | "problem_understanding"
  | "desired_outcome"
  | "report_details"
  | "final_understanding_review";

/** DIR-level investigation taxonomy used by the report map. */
export type InvestigationLayer =
  | "user_problem"
  | "user_expectation"
  | "relevant_detail";

export type InvestigationReportMapping = {
  dir_id: string;
  layer: InvestigationLayer;
  intake_layer: IntakeLayerFocus;
  report_pages: DecisionPageId[];
  report_section_ids: string[];
  ddr_ids: string[];
  report_purpose_zh: string;
  report_purpose_en: string;
  required_precondition: boolean;
};

function sectionsForDir(dirId: string): {
  pages: DecisionPageId[];
  sections: string[];
  ddr_ids: string[];
} {
  const ddrIds = [...(DIR_TO_DDR_INDEX_V1.get(dirId) ?? [])];
  const pages: DecisionPageId[] = [];
  const sections: string[] = [];
  for (const ddrId of ddrIds) {
    const ddr = DDR_CATALOG_V1_ENTRIES.find((e) => e.ddr_id === ddrId);
    if (!ddr) continue;
    const page = ddr.report_page_id as DecisionPageId;
    if (!pages.includes(page)) pages.push(page);
    const sectionKey = `${ddr.report_page_id}:${ddr.report_section_id}`;
    if (!sections.includes(sectionKey)) sections.push(sectionKey);
  }
  return { pages, sections, ddr_ids: ddrIds };
}

function mapping(
  dir_id: string,
  layer: InvestigationLayer,
  purpose_zh: string,
  purpose_en: string,
  required_precondition: boolean,
  pageFallback: DecisionPageId[] = [],
): InvestigationReportMapping {
  const fromDdr = sectionsForDir(dir_id);
  const report_pages =
    fromDdr.pages.length > 0 ? fromDdr.pages : pageFallback;
  const intake_layer: IntakeLayerFocus =
    layer === "user_problem"
      ? "problem_understanding"
      : layer === "user_expectation"
        ? "desired_outcome"
        : "report_details";
  return {
    dir_id,
    layer,
    intake_layer,
    report_pages,
    report_section_ids: fromDdr.sections,
    ddr_ids: fromDdr.ddr_ids,
    report_purpose_zh: purpose_zh,
    report_purpose_en: purpose_en,
    required_precondition,
  };
}

/**
 * Closed map for production DIRs used in Blueprint investigation.
 * Pages: 01/02/04/05/06/08 main narrative; 03 chart = local calc (no ask);
 * 07 topic-gated only when applicable.
 */
export const INVESTIGATION_REPORT_MAP: readonly InvestigationReportMapping[] = [
  mapping(
    "DIR-DEF-QUESTION",
    "user_problem",
    "锁定真正要解决的决策问题，支撑开篇结论与归因",
    "Lock the real decision question for direct answer and foundation",
    true,
    ["01", "02"],
  ),
  mapping(
    "DIR-STATUS-QUO",
    "user_problem",
    "还原当前现实处境，支撑归因与结论贴地",
    "Ground current situation for foundation and answer",
    true,
    ["02", "01"],
  ),
  mapping(
    "DIR-DEF-OUTCOME",
    "user_expectation",
    "明确期望结果与成功标准，支撑结论、风险与收尾信号",
    "Clarify desired outcome for answer, risk, and close signals",
    true,
    ["01", "06", "08"],
  ),
  mapping(
    "DIR-DEF-STAKES",
    "user_expectation",
    "做错会失去什么，支撑结论边界与风险守卫",
    "Stakes of being wrong for answer bounds and risk guard",
    true,
    ["01", "06"],
  ),
  mapping(
    "DIR-DEF-PRIORITIES",
    "user_expectation",
    "目标优先级，支撑主辅结论与收尾取舍",
    "Goal priority for primary/secondary answer and close",
    true,
    ["01", "08"],
  ),
  mapping(
    "DIR-DEF-UNACCEPTABLE",
    "user_expectation",
    "不可接受结果，支撑风险守卫与结论边界",
    "Unacceptable outcomes for risk guard and answer bounds",
    true,
    ["06", "01"],
  ),
  mapping(
    "DIR-OPT-CONSTRAINTS",
    "user_expectation",
    "硬性约束（钱/时间/责任），支撑风险与行动可行性",
    "Hard constraints for risk and executable actions",
    true,
    ["06", "04", "05"],
  ),
  mapping(
    "DIR-TIMING-WINDOW",
    "user_expectation",
    "决策落地时间窗，支撑近窗信号与风险时序",
    "Timing window for signals and risk sequencing",
    false,
    ["08", "06"],
  ),
  mapping(
    "DIR-RISK-TOLERANCE",
    "user_expectation",
    "可承受最差结果，支撑风险与谋略取舍",
    "Risk tolerance for risk guard and metaphysics strategy",
    false,
    ["06", "05"],
  ),
  mapping(
    "DIR-EXIT-CRITERIA",
    "user_expectation",
    "退出/转向触发条件，支撑风险与近窗信号",
    "Exit/pivot criteria for risk and near-window signals",
    false,
    ["06", "08"],
  ),
  mapping(
    "DIR-PAST-ATTEMPTS",
    "relevant_detail",
    "过去尝试与教训，避免报告重复旧路径",
    "Past attempts/lessons so the report avoids repeating failed paths",
    false,
    ["02", "06"],
  ),
  mapping(
    "DIR-OPT-ON-TABLE",
    "relevant_detail",
    "真实可选方案，支撑结论与行动页比较",
    "Real options on the table for answer and action pages",
    true,
    ["01", "04", "05"],
  ),
  mapping(
    "DIR-OPT-IRREV",
    "relevant_detail",
    "不可逆/切换成本，支撑风险与执行取舍",
    "Irreversibility / switching cost for risk and action tradeoffs",
    false,
    ["06", "04"],
  ),
  mapping(
    "DIR-BIZ-MODEL",
    "relevant_detail",
    "商业模式与关键依赖，支撑创业类归因与科学执行",
    "Business model dependencies for foundation and science action",
    false,
    ["02", "04"],
  ),
  mapping(
    "DIR-VALIDATION-CAPACITY",
    "relevant_detail",
    "能低成本验证什么，支撑科学执行与近窗信号",
    "Low-cost validation capacity for science action and signals",
    false,
    ["04", "08"],
  ),
  mapping(
    "DIR-REL-DYNAMICS",
    "relevant_detail",
    "关系动态（适用时），支撑专题深度与归因",
    "Relationship dynamics when applicable for topic depth",
    false,
    ["07", "02"],
  ),
  mapping(
    "DIR-JOB-OFFER",
    "relevant_detail",
    "工作邀约细节（适用时），支撑专题比较",
    "Job-offer details when applicable for topic comparison",
    false,
    ["07", "05"],
  ),
  mapping(
    "DIR-LOCALE-MOVE",
    "relevant_detail",
    "迁移/地域约束（适用时），支撑专题与执行边界",
    "Locale/move constraints when applicable",
    false,
    ["07", "06"],
  ),
  mapping(
    "DIR-EDU-PATH",
    "relevant_detail",
    "教育路径选项（适用时），支撑专题比较",
    "Education-path options when applicable",
    false,
    ["07", "05"],
  ),
] as const;

const BY_DIR = new Map(INVESTIGATION_REPORT_MAP.map((m) => [m.dir_id, m]));

export function reportMappingForDir(
  dirId: string,
): InvestigationReportMapping | null {
  return BY_DIR.get(dirId) ?? null;
}

export function candidateHasReportPurpose(dirIds: string[]): boolean {
  return dirIds.some((id) => BY_DIR.has(id));
}

export function intakeLayerForDir(dirId: string): IntakeLayerFocus | null {
  return BY_DIR.get(dirId)?.intake_layer ?? null;
}

export function candidateAllowedForIntakeLayer(
  dirIds: string[],
  layer: IntakeLayerFocus,
): boolean {
  if (layer === "final_understanding_review") return false;
  if (layer === "report_details") {
    // Detail layer may still ask remaining expectation gaps that are report-bound,
    // but never re-open pure problem DIRs unless gate reopened upstream.
    return dirIds.some((id) => {
      const m = BY_DIR.get(id);
      if (!m) return false;
      return (
        m.intake_layer === "report_details" ||
        m.intake_layer === "desired_outcome"
      );
    });
  }
  return dirIds.some((id) => BY_DIR.get(id)?.intake_layer === layer);
}

export function formatReportPurposeForPrompt(
  dirIds: string[],
  locale: string,
): {
  layer: InvestigationLayer | null;
  intake_layer: IntakeLayerFocus | null;
  report_pages: DecisionPageId[];
  report_section_ids: string[];
  ddr_ids: string[];
  report_purpose: string;
  required_precondition: boolean;
} {
  const hits = dirIds
    .map((id) => BY_DIR.get(id))
    .filter((m): m is InvestigationReportMapping => Boolean(m));
  if (!hits.length) {
    return {
      layer: null,
      intake_layer: null,
      report_pages: [],
      report_section_ids: [],
      ddr_ids: [],
      report_purpose: "",
      required_precondition: false,
    };
  }
  const isZh = locale.toLowerCase().startsWith("zh");
  const pages = [...new Set(hits.flatMap((h) => h.report_pages))];
  const sections = [...new Set(hits.flatMap((h) => h.report_section_ids))];
  const ddr_ids = [...new Set(hits.flatMap((h) => h.ddr_ids))];
  const layer =
    hits.find((h) => h.layer === "user_expectation")?.layer ??
    hits.find((h) => h.layer === "user_problem")?.layer ??
    hits[0]!.layer;
  const intake_layer =
    hits.find((h) => h.intake_layer === "desired_outcome")?.intake_layer ??
    hits.find((h) => h.intake_layer === "problem_understanding")?.intake_layer ??
    hits[0]!.intake_layer;
  return {
    layer,
    intake_layer,
    report_pages: pages,
    report_section_ids: sections,
    ddr_ids,
    report_purpose: hits
      .map((h) => (isZh ? h.report_purpose_zh : h.report_purpose_en))
      .join(" · "),
    required_precondition: hits.some((h) => h.required_precondition),
  };
}
