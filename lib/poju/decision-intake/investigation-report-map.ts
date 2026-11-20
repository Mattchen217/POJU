/**
 * Map investigation DIR / direction candidates → 8-page delivery faces they feed.
 * Candidates with no report purpose and no required-precondition role are excluded
 * from the normal question candidate set (audit + filter helper).
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";

export type InvestigationLayer = "user_problem" | "user_expectation" | "relevant_detail";

export type InvestigationReportMapping = {
  dir_id: string;
  layer: InvestigationLayer;
  report_pages: DecisionPageId[];
  report_purpose_zh: string;
  report_purpose_en: string;
  required_precondition: boolean;
};

/**
 * Closed map for production DIRs used in Blueprint investigation.
 * Pages: 01 direct answer · 02 foundation · 04 science · 05 metaphysics ·
 * 06 risk · 08 signals (shelf faces; 03 appendix / 07 conditional omitted from ask scope).
 */
export const INVESTIGATION_REPORT_MAP: readonly InvestigationReportMapping[] = [
  {
    dir_id: "DIR-DEF-QUESTION",
    layer: "user_problem",
    report_pages: ["01", "02"],
    report_purpose_zh: "锁定真正要解决的决策问题，支撑开篇结论与归因",
    report_purpose_en: "Lock the real decision question for direct answer and foundation",
    required_precondition: true,
  },
  {
    dir_id: "DIR-DEF-OUTCOME",
    layer: "user_expectation",
    report_pages: ["01", "06", "08"],
    report_purpose_zh: "明确期望结果与成功标准，支撑结论、风险与收尾信号",
    report_purpose_en: "Clarify desired outcome for answer, risk, and close signals",
    required_precondition: true,
  },
  {
    dir_id: "DIR-DEF-STAKES",
    layer: "user_expectation",
    report_pages: ["01", "06"],
    report_purpose_zh: "做错会失去什么，支撑结论边界与风险守卫",
    report_purpose_en: "Stakes of being wrong for answer bounds and risk guard",
    required_precondition: true,
  },
  {
    dir_id: "DIR-DEF-PRIORITIES",
    layer: "user_expectation",
    report_pages: ["01", "08"],
    report_purpose_zh: "目标优先级，支撑主辅结论与收尾取舍",
    report_purpose_en: "Goal priority for primary/secondary answer and close",
    required_precondition: true,
  },
  {
    dir_id: "DIR-DEF-UNACCEPTABLE",
    layer: "user_expectation",
    report_pages: ["06", "01"],
    report_purpose_zh: "不可接受结果，支撑风险守卫与结论边界",
    report_purpose_en: "Unacceptable outcomes for risk guard and answer bounds",
    required_precondition: true,
  },
  {
    dir_id: "DIR-STATUS-QUO",
    layer: "user_problem",
    report_pages: ["02", "01"],
    report_purpose_zh: "还原当前现实处境，支撑归因与结论贴地",
    report_purpose_en: "Ground current situation for foundation and answer",
    required_precondition: true,
  },
  {
    dir_id: "DIR-PAST-ATTEMPTS",
    layer: "relevant_detail",
    report_pages: ["02", "06"],
    report_purpose_zh: "过去尝试与教训，避免报告重复旧路径",
    report_purpose_en: "Past attempts/lessons so the report avoids repeating failed paths",
    required_precondition: false,
  },
  {
    dir_id: "DIR-OPT-ON-TABLE",
    layer: "relevant_detail",
    report_pages: ["01", "04", "05"],
    report_purpose_zh: "真实可选方案，支撑结论与行动页比较",
    report_purpose_en: "Real options on the table for answer and action pages",
    required_precondition: true,
  },
  {
    dir_id: "DIR-OPT-CONSTRAINTS",
    layer: "user_expectation",
    report_pages: ["06", "04", "05"],
    report_purpose_zh: "硬性约束（钱/时间/责任），支撑风险与行动可行性",
    report_purpose_en: "Hard constraints for risk and executable actions",
    required_precondition: true,
  },
  {
    dir_id: "DIR-OPT-IRREV",
    layer: "relevant_detail",
    report_pages: ["06", "04"],
    report_purpose_zh: "不可逆/切换成本，支撑风险与执行取舍",
    report_purpose_en: "Irreversibility / switching cost for risk and action tradeoffs",
    required_precondition: false,
  },
  {
    dir_id: "DIR-BIZ-MODEL",
    layer: "relevant_detail",
    report_pages: ["02", "04"],
    report_purpose_zh: "商业模式与关键依赖，支撑创业类归因与科学执行",
    report_purpose_en: "Business model dependencies for foundation and science action",
    required_precondition: false,
  },
  {
    dir_id: "DIR-TIMING-WINDOW",
    layer: "user_expectation",
    report_pages: ["08", "06"],
    report_purpose_zh: "决策落地时间窗，支撑近窗信号与风险时序",
    report_purpose_en: "Timing window for signals and risk sequencing",
    required_precondition: false,
  },
  {
    dir_id: "DIR-RISK-TOLERANCE",
    layer: "user_expectation",
    report_pages: ["06", "05"],
    report_purpose_zh: "可承受最差结果，支撑风险与谋略取舍",
    report_purpose_en: "Risk tolerance for risk guard and metaphysics strategy",
    required_precondition: false,
  },
  {
    dir_id: "DIR-EXIT-CRITERIA",
    layer: "user_expectation",
    report_pages: ["06", "08"],
    report_purpose_zh: "退出/转向触发条件，支撑风险与近窗信号",
    report_purpose_en: "Exit/pivot criteria for risk and near-window signals",
    required_precondition: false,
  },
  {
    dir_id: "DIR-VALIDATION-CAPACITY",
    layer: "relevant_detail",
    report_pages: ["04", "08"],
    report_purpose_zh: "能低成本验证什么，支撑科学执行与近窗信号",
    report_purpose_en: "Low-cost validation capacity for science action and signals",
    required_precondition: false,
  },
] as const;

const BY_DIR = new Map(INVESTIGATION_REPORT_MAP.map((m) => [m.dir_id, m]));

export function reportMappingForDir(dirId: string): InvestigationReportMapping | null {
  return BY_DIR.get(dirId) ?? null;
}

export function candidateHasReportPurpose(dirIds: string[]): boolean {
  return dirIds.some((id) => BY_DIR.has(id));
}

export function formatReportPurposeForPrompt(
  dirIds: string[],
  locale: string,
): {
  layer: InvestigationLayer | null;
  report_pages: DecisionPageId[];
  report_purpose: string;
  required_precondition: boolean;
} {
  const hits = dirIds
    .map((id) => BY_DIR.get(id))
    .filter((m): m is InvestigationReportMapping => Boolean(m));
  if (!hits.length) {
    return {
      layer: null,
      report_pages: [],
      report_purpose: "",
      required_precondition: false,
    };
  }
  const isZh = locale.toLowerCase().startsWith("zh");
  const pages = [...new Set(hits.flatMap((h) => h.report_pages))];
  const layer =
    hits.find((h) => h.layer === "user_expectation")?.layer ??
    hits.find((h) => h.layer === "user_problem")?.layer ??
    hits[0]!.layer;
  return {
    layer,
    report_pages: pages,
    report_purpose: hits
      .map((h) => (isZh ? h.report_purpose_zh : h.report_purpose_en))
      .join(" · "),
    required_precondition: hits.some((h) => h.required_precondition),
  };
}
