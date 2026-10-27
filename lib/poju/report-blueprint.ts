/**
 * Eastern OS 报告蓝图 · 全链路单一事实源(SSOT)。
 * v1：**9 内容模块 + 附录**（见 `.cursor/docs/v1-决策交付-产品边界.md`）。
 * 出稿 `delivery_segments` 已切 v1 十段 key（见迁移映射）；承重链路（fill sanitize /
 * 独立 duty / 双轨必填）按落地计划接通中。
 * 【1→4 阶段都 import 这里】——第2段真算据此确认主方向撑得起报告；
 * 2.1议程据此问「缺什么现实料」（议程 5–6 问，≠ 一模块一问）；第4段据此路由。
 * 改模块结构只改这一处，全链自动对齐。
 *
 * 无外部依赖，可被任何阶段安全 import（不产生循环）。
 */

/** 这一页需要哪种输入。 */
export type BlueprintInputRole =
  | "chart_only" // 纯命理/收敛判断，命理料就能写准，【不需要议程收集】
  | "needs_reality"; // 命理给方向，但要用户现实信息才写得可执行，【需要议程收集】

/** 这一页在"主/辅路径"里的角色。 */
export type BlueprintPathRole =
  | "verdict" // 定调：给结论
  | "evidence" // 依据：论证结论
  | "primary_and_backup" // 行动：主路径 + 辅路径都展开
  | "supports_primary" // 服务/护住主路径
  | "closing" // 收尾
  | "appendix";

/**
 * 蓝图页上曾用的出稿段 key（含 foundation 等 legacy）。
 * 现行出稿 SSOT = segment-key-alias V1_DELIVERY_SEGMENT_KEYS。
 */
export type LegacyDeliverySegmentKey =
  | "decision_brief"
  | "foundation"
  | "execution_guidance"
  | "self_regulation"
  | "validation_risk"
  | "validation_close"
  | "appendix";

/** v1 九内容模块 id（+ appendix）。 */
export type V1ReportModuleId =
  | "decision_brief"
  | "situation_analysis"
  | "personal_decision_patterns"
  | "bottleneck_analysis"
  | "strategic_options"
  | "recommended_strategy"
  | "execution_guidance"
  | "self_regulation"
  | "validation_review"
  | "appendix";

export interface ReportPage {
  /** 稳定 id（v1 模块 id；议程 serves_page 对齐此 id）。 */
  id: V1ReportModuleId | string;
  part_no: number;
  title: { zh: string; en: string };
  /** 用户为什么要这一页（产品定位，倒推内容的依据）。 */
  purpose: string;
  /** 这一页要写什么（定位的展开）。 */
  writes: string;
  /** 命理料需求：从 breakthrough_core / structured 取哪几块（按需，不硬凑）。 */
  chart_inputs: readonly string[];
  /** 输入角色：纯命理能写准，还是需要议程补现实料。 */
  input_role: BlueprintInputRole;
  /** 若 needs_reality：为写准这页，议程该收集什么现实信息。 */
  reality_needs?: readonly string[];
  /** 主辅角色。 */
  path_role: BlueprintPathRole;
  /**
   * 出稿段 key（v1 十段；见迁移映射）。Layer2 / fill 按此路由。
   */
  delivery_segments: readonly string[];
  /** 是否挂折叠双轨依据（命理 + 科学）。decision_brief / appendix = false。 */
  hangs_dual_evidence: boolean;
  /** 科学轨优先学科（提示词选科；每页 1–3 个，禁止八科全开）。 */
  science_disciplines?: readonly string[];
}

export const REPORT_BLUEPRINT: readonly ReportPage[] = [
  {
    id: "decision_brief",
    part_no: 1,
    title: { zh: "决策简报", en: "Decision Brief" },
    purpose: "两分钟抓住：真问题、主矛盾、推荐方向、最近一步。不替代后续完整分析。",
    writes:
      "一句话定义问题 + 核心判断 + 建议方向及其成立条件 + 接下来最值得采取的一步。" +
      "正面直答 original_question（阶段趋势+条件成熟，不报日期）+ 主路径一句 + 为什么一句。",
    chart_inputs: ["situation_conclusion", "key_crossroads", "primary_path", "desired_outcome"],
    input_role: "chart_only",
    path_role: "verdict",
    delivery_segments: ["decision_brief"],
    hangs_dual_evidence: false,
  },
  {
    id: "situation_analysis",
    part_no: 2,
    title: { zh: "处境与问题诊断", en: "Situation Analysis" },
    purpose: "证明系统理解的是真实问题结构，而非只复述表面诉求。",
    writes:
      "现状与期望差距；资源/责任/时间/资金/外部限制；已确认事实 vs 待验证假设 vs 信息缺口；表层与深层问题关系。",
    chart_inputs: [
      "energy_structure",
      "element_scores",
      "four_pillars_ten_gods",
      "multi_dimension_reckoning",
      "original_question",
      "desired_outcome",
    ],
    input_role: "needs_reality",
    reality_needs: [
      "已确认的硬约束（资金/时间/法律责任等）",
      "仍缺、会影响选项质量的关键信息缺口",
    ],
    path_role: "evidence",
    delivery_segments: ["situation_analysis"],
    hangs_dual_evidence: true,
    science_disciplines: ["决策科学", "系统思维"],
  },
  {
    id: "personal_decision_patterns",
    part_no: 3,
    title: { zh: "个人决策模式", en: "Personal Decision Patterns" },
    purpose: "解释用户在这类问题上如何判断、反应与行动（与本题相关，非泛人格报告）。",
    writes:
      "本题相关的价值排序、风险承受、冲突应对；压力下偏差/反复模式；传统命理解释须标明体系内；区分事实/行为证据/假设/命理解释。",
    chart_inputs: [
      "energy_structure",
      "four_pillars_ten_gods",
      "shen_sha_life_stage",
      "multi_dimension_reckoning",
    ],
    input_role: "needs_reality",
    reality_needs: [
      "与本题相关的过往类似决策经历或行为证据",
      "压力下典型反应（用户自述，可纠正）",
    ],
    path_role: "evidence",
    delivery_segments: ["personal_decision_patterns"],
    hangs_dual_evidence: true,
    science_disciplines: ["心理学", "行为科学", "认知科学"],
  },
  {
    id: "bottleneck_analysis",
    part_no: 4,
    title: { zh: "核心障碍分析", en: "Bottleneck Analysis" },
    purpose: "从大量问题中识别最值得优先处理的 1–3 个障碍。",
    writes:
      "1–3 个关键障碍；成因/维持机制/相互影响；可控/可影响/暂不可控；解除哪个最可能改局面。不复读处境章。",
    chart_inputs: [
      "energy_structure",
      "current_da_yun_cycle",
      "multi_dimension_reckoning",
      "key_crossroads",
      "blind_spots",
    ],
    input_role: "needs_reality",
    reality_needs: [
      "用户已知会让自己反复卡住的触发点",
      "对方近期可观察行为（二元案，可选）",
    ],
    path_role: "evidence",
    delivery_segments: ["bottleneck_analysis"],
    hangs_dual_evidence: true,
    science_disciplines: ["行为科学", "认知科学", "系统思维"],
  },
  {
    id: "strategic_options",
    part_no: 5,
    title: { zh: "战略选项比较", en: "Strategic Options" },
    purpose: "让用户看清不同道路的真实代价，而非直接接受单一答案。",
    writes:
      "2–4 个现实可行选项（可含维持现状/小试验/暂缓）；收益/成本/风险/时间/可逆性；成立前提与失效条件；可小行动验证的信息缺口。",
    chart_inputs: [
      "primary_path",
      "backup_path",
      "multi_dimension_reckoning",
      "modern_action_frames",
      "key_crossroads",
    ],
    input_role: "needs_reality",
    reality_needs: [
      "手上已有的资源/技能/积累",
      "可投入的时间与精力",
      "对关键路径的接受度（校准主辅是否对调）",
    ],
    path_role: "primary_and_backup",
    delivery_segments: ["strategic_options"],
    hangs_dual_evidence: true,
    science_disciplines: ["决策科学", "经济学", "统计学与概率"],
  },
  {
    id: "recommended_strategy",
    part_no: 6,
    title: { zh: "主策略与备选", en: "Recommended Strategy" },
    purpose: "有理由、有边界的主路径 + 切换/退出条件——付费核心之一。",
    writes:
      "推荐主路径及理由；备选与何时切换；前提/依赖/资源；应放弃或暂缓什么；停止/退出/重新决策触发条件。",
    chart_inputs: [
      "primary_path",
      "backup_path",
      "action_plan",
      "path_costs",
      "multi_dimension_reckoning",
    ],
    input_role: "needs_reality",
    reality_needs: [
      "执行力短板与经济缓冲",
      "对方角色与权力位（二元案）",
      "你在关系中的硬底线或不可逆成本（二元案）",
    ],
    path_role: "primary_and_backup",
    delivery_segments: ["recommended_strategy"],
    hangs_dual_evidence: true,
    science_disciplines: ["决策科学", "经济学", "社会学"],
  },
  {
    id: "execution_guidance",
    part_no: 7,
    title: { zh: "行动策略与执行原则", en: "Execution Guidance" },
    purpose: "把策略落实为可开始、可检查的原则与示例动作——禁止固定 30 天任务表。",
    writes:
      "当前阶段优先推进/验证什么；可立即采取的示例动作及理由；先验证/暂缓顺序；推进/调整/停止条件；降低风险与偏差的执行原则。【禁止】按日/按周任务表。",
    chart_inputs: [
      "primary_path",
      "backup_path",
      "action_plan",
      "modern_action_frames",
      "multi_dimension_reckoning",
    ],
    input_role: "needs_reality",
    reality_needs: [
      "对主路径关键动作的接受度",
      "对方可观察行为/态度（二元案）",
    ],
    path_role: "primary_and_backup",
    delivery_segments: ["execution_guidance"],
    hangs_dual_evidence: true,
    science_disciplines: ["行为科学", "决策科学", "认知科学"],
  },
  {
    id: "self_regulation",
    part_no: 8,
    title: { zh: "自我调频", en: "Self-Regulation" },
    purpose: "执行过程中如何管理自己的状态与节奏（对己），不是第二份任务清单。",
    writes:
      "本题下压力反应与行为风险；识别冲动/拖延/反复犹豫；反思/休息/信息限制/重大决定前暂停；东方调候须个性化并标明传统属性。禁复读执行章；禁声称五行确定改结果。",
    chart_inputs: [
      "metaphysics_pack",
      "energy_retune_frame",
      "multi_dimension_reckoning",
      "original_question",
      "desired_outcome",
    ],
    input_role: "needs_reality",
    reality_needs: ["现居/工作空间大致朝向或可调范围（轻，可选）"],
    path_role: "supports_primary",
    delivery_segments: ["self_regulation"],
    hangs_dual_evidence: true,
    science_disciplines: ["心理学", "行为科学", "认知科学"],
  },
  {
    id: "validation_review",
    part_no: 9,
    title: { zh: "风险、验证与复盘", en: "Validation & Review" },
    purpose: "绿灯/红灯、退出条件、自检信号；大变则新购 PASS，非系统回访改旧报告。",
    writes:
      "奏效信号；原判断可能错的信号；风险/预警/退出；复盘应自问的问题；重大变化时哪些结论需自行重评（产品口径=新 PASS）。" +
      "可含今晚一件事/近阶微清单（一次性收尾，无回来追踪钩子）。禁止四周甘特。",
    chart_inputs: [
      "self_check_signals",
      "ji_shen",
      "blind_spots",
      "path_costs",
      "rhythm_frame",
      "action_plan",
      "original_question",
      "desired_outcome",
    ],
    input_role: "needs_reality",
    reality_needs: [
      "用户已知会让自己反复踩的坑/触发点",
      "用户近7日可投入的时间/节奏",
      "近期固定安排或约束",
    ],
    path_role: "closing",
    delivery_segments: ["validation_risk", "validation_close"],
    hangs_dual_evidence: true,
    science_disciplines: ["统计学与概率", "决策科学", "认知科学"],
  },
  {
    id: "appendix",
    part_no: 10,
    title: { zh: "附录 · 结构数据与术语说明", en: "Appendix · Structural Data & Terms" },
    purpose: "透明存档，可复盘。",
    writes: "时机窗口 + 本案路径摘要 + 命盘结构数据 + 引擎实例清单 + 本报告金字表。",
    chart_inputs: ["structured_raw"],
    input_role: "chart_only",
    path_role: "appendix",
    delivery_segments: ["appendix"],
    hangs_dual_evidence: false,
  },
] as const;

/** 需要议程收集的模块（Call B 只为这些生成 agenda；且总数仍 5–6，非一模块一问）。 */
export const BLUEPRINT_PAGES_NEEDING_REALITY: readonly ReportPage[] =
  REPORT_BLUEPRINT.filter((p) => p.input_role === "needs_reality");

/** 主辅路径展开相关模块。 */
export const BLUEPRINT_PRIMARY_BACKUP_PAGES: readonly ReportPage[] =
  REPORT_BLUEPRINT.filter((p) => p.path_role === "primary_and_backup");

/** 禁止作为 serves_page 的模块（简报不靠议程凑）。 */
export const BLUEPRINT_AGENDA_FORBIDDEN_PAGES = new Set<string>([
  "decision_brief",
  "appendix",
  // legacy aliases
  "decision_brief",
]);

export function getBlueprintPage(id: string): ReportPage | undefined {
  const byId = REPORT_BLUEPRINT.find((p) => p.id === id);
  if (byId) return byId;
  // Legacy six-page key → first v1 module that routes delivery_segments there
  return REPORT_BLUEPRINT.find((p) =>
    (p.delivery_segments as readonly string[]).includes(id),
  );
}

/** 九模块 id → 现网出稿主 key（取 delivery_segments[0]）。 */
export function toDeliverySegmentKey(moduleId: string): string | undefined {
  const page = getBlueprintPage(moduleId);
  if (page?.delivery_segments?.[0]) return page.delivery_segments[0];
  // already a legacy key?
  const legacy = new Set([
    "decision_brief",
    "foundation",
    "execution_guidance",
    "self_regulation",
    "validation_risk",
    "validation_close",
    "appendix",
  ]);
  return legacy.has(moduleId) ? moduleId : undefined;
}

/** 出稿 segment key → 科学轨优先学科（1–3；禁八科全开）。 */
export function scienceDisciplinesForSegment(
  segmentKey: string,
): readonly string[] {
  const page = getBlueprintPage(segmentKey);
  if (page?.science_disciplines?.length) return page.science_disciplines;
  // validation_review splits into two keys — both hang dual evidence
  if (
    segmentKey === "validation_risk" ||
    segmentKey === "validation_close" ||
    segmentKey === "risk_guard" ||
    segmentKey === "signals_close"
  ) {
    const vr = getBlueprintPage("validation_review");
    return vr?.science_disciplines ?? [];
  }
  return [];
}

export function hangsDualEvidenceForSegment(segmentKey: string): boolean {
  if (
    segmentKey === "decision_brief" ||
    segmentKey === "direct_answer" ||
    segmentKey === "appendix"
  ) {
    return false;
  }
  const page = getBlueprintPage(segmentKey);
  if (page) return page.hangs_dual_evidence;
  if (
    segmentKey === "validation_risk" ||
    segmentKey === "validation_close" ||
    segmentKey === "risk_guard" ||
    segmentKey === "signals_close"
  ) {
    return true;
  }
  return false;
}
