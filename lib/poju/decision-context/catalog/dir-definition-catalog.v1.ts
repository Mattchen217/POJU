/**
 * DIR Definition Catalog SSOT — version 1 (Phase 2 dir_catalog_version = 1).
 * Runtime authority: this module only. Do not parse PHASE-2-DIR-CATALOG.md at runtime.
 * Definitions only — never stores live current_state (C3).
 */

export const DIR_DEFINITION_CATALOG_VERSION = "1" as const;

export type DirDefinitionCategory =
  | "definition"
  | "options"
  | "constraints"
  | "timing"
  | "risk"
  | "validation"
  | "topic"
  | "support";

export type DirDefinitionEntry = {
  readonly dir_id: string;
  readonly need: string;
  readonly why: string;
  readonly category: DirDefinitionCategory;
  readonly required_fact_roles: readonly string[];
  readonly may_affect_p5_ranking: boolean;
  readonly default_serves_face: string;
  readonly topic_tags: readonly string[];
};

const CORE_TAGS = ["*"] as const;

const RAW: DirDefinitionEntry[] = [
  {
    dir_id: "DIR-DEF-QUESTION",
    need: "清晰的决策问题",
    why: "没有明确问题无法框定报告与判断",
    category: "definition",
    required_fact_roles: ["decision_question"],
    may_affect_p5_ranking: true,
    default_serves_face: "01",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-DEF-OUTCOME",
    need: "期望达成的结果",
    why: "用于比较选项与成立条件",
    category: "definition",
    required_fact_roles: ["desired_outcome"],
    may_affect_p5_ranking: true,
    default_serves_face: "01",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-DEF-STAKES",
    need: "做错会失去什么",
    why: "决定风险边界与 hold 条件",
    category: "definition",
    required_fact_roles: ["stakes"],
    may_affect_p5_ranking: true,
    default_serves_face: "01",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-DEF-PRIORITIES",
    need: "目标优先级顺序",
    why: "驱动选项排序",
    category: "definition",
    required_fact_roles: ["goal_priority"],
    may_affect_p5_ranking: true,
    default_serves_face: "05",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-DEF-UNACCEPTABLE",
    need: "不可接受的结果",
    why: "用于反路径与边界",
    category: "definition",
    required_fact_roles: ["unacceptable"],
    may_affect_p5_ranking: true,
    default_serves_face: "01",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-OPT-ON-TABLE",
    need: "有哪些真实可选方案",
    why: "没有选项清单无法比较去留",
    category: "options",
    required_fact_roles: ["option"],
    may_affect_p5_ranking: true,
    default_serves_face: "05",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-STATUS-QUO",
    need: "当前工作与生活基线",
    why: "需要对照维持现状的代价与收益",
    category: "options",
    required_fact_roles: ["status_quo"],
    may_affect_p5_ranking: false,
    default_serves_face: "02",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-OPT-CONSTRAINTS",
    need: "硬性/软性约束（钱/时间/责任）",
    why: "硬约束直接砍掉不可行选项",
    category: "constraints",
    required_fact_roles: ["hard_constraint"],
    may_affect_p5_ranking: true,
    default_serves_face: "04",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-OPT-IRREV",
    need: "不可逆/切换成本",
    why: "判断锁死风险与验证窗口",
    category: "constraints",
    required_fact_roles: ["irreversibility"],
    may_affect_p5_ranking: true,
    default_serves_face: "04",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-PAST-ATTEMPTS",
    need: "过去尝试与教训",
    why: "归因与避免重复失败路径",
    category: "options",
    required_fact_roles: ["past_attempt"],
    may_affect_p5_ranking: false,
    default_serves_face: "02",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-TIMING-WINDOW",
    need: "决策必须落地的时间窗口",
    why: "影响 hold 条件与节奏",
    category: "timing",
    required_fact_roles: ["timing_window"],
    may_affect_p5_ranking: true,
    default_serves_face: "06",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-RISK-TOLERANCE",
    need: "可承受的最差结果",
    why: "风险边界决定能否推进高不确定选项",
    category: "risk",
    required_fact_roles: ["risk_tolerance"],
    may_affect_p5_ranking: true,
    default_serves_face: "04",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-EXIT-CRITERIA",
    need: "退出/转向触发条件",
    why: "边界关闭与止损",
    category: "risk",
    required_fact_roles: ["exit_criterion"],
    may_affect_p5_ranking: true,
    default_serves_face: "08",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-VALIDATION-CAPACITY",
    need: "能低成本验证什么",
    why: "决定先试后锁的空间",
    category: "validation",
    required_fact_roles: ["validation_capacity"],
    may_affect_p5_ranking: false,
    default_serves_face: "06",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-STAKEHOLDERS",
    need: "受影响的关键方",
    why: "多方利害影响可行性",
    category: "support",
    required_fact_roles: ["stakeholder"],
    may_affect_p5_ranking: false,
    default_serves_face: "04",
    topic_tags: CORE_TAGS,
  },
  {
    dir_id: "DIR-REL-DYNAMICS",
    need: "关系互动与边界动态",
    why: "关系类决策的主题深度",
    category: "topic",
    required_fact_roles: ["rel_dynamic"],
    may_affect_p5_ranking: true,
    default_serves_face: "07",
    topic_tags: ["relationship"],
  },
  {
    dir_id: "DIR-JOB-OFFER",
    need: "工作机会/角色条件",
    why: "职业类决策的主题深度",
    category: "topic",
    required_fact_roles: ["job_offer"],
    may_affect_p5_ranking: true,
    default_serves_face: "07",
    topic_tags: ["career"],
  },
  {
    dir_id: "DIR-BIZ-MODEL",
    need: "商业模式与关键依赖",
    why: "创业类决策的主题深度",
    category: "topic",
    required_fact_roles: ["biz_model"],
    may_affect_p5_ranking: true,
    default_serves_face: "07",
    topic_tags: ["entrepreneurship"],
  },
  {
    dir_id: "DIR-LOCALE-MOVE",
    need: "搬迁/落地约束",
    why: "搬迁类决策的主题深度",
    category: "topic",
    required_fact_roles: ["locale_move"],
    may_affect_p5_ranking: true,
    default_serves_face: "07",
    topic_tags: ["relocation"],
  },
  {
    dir_id: "DIR-EDU-PATH",
    need: "教育/发展路径条件",
    why: "教育类决策的主题深度",
    category: "topic",
    required_fact_roles: ["edu_path"],
    may_affect_p5_ranking: true,
    default_serves_face: "07",
    topic_tags: ["education"],
  },
];

function freezeEntries(
  entries: DirDefinitionEntry[],
): readonly DirDefinitionEntry[] {
  for (const e of entries) {
    Object.freeze(e.required_fact_roles);
    Object.freeze(e.topic_tags);
    Object.freeze(e);
  }
  return Object.freeze(entries);
}

export const DIR_DEFINITION_CATALOG_V1_ENTRIES: readonly DirDefinitionEntry[] =
  freezeEntries(RAW);

export function dirDefinitionById(
  dirId: string,
): DirDefinitionEntry | undefined {
  return DIR_DEFINITION_CATALOG_V1_ENTRIES.find((e) => e.dir_id === dirId);
}
