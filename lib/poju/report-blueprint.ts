/**
 * Eastern OS 报告蓝图 · 运行时模块表（兼容到 W2）。
 * 内容页结构真源已改为 2026-10-27 pageId：
 * `.cursor/docs/decision-report/` + `lib/llm/pro/delivery/page-feed-matrix.ts`。
 * 九模块仍是出稿纸的别名。脸序真源是 `CANONICAL_FACE_BLUEPRINT`。
 * 旧键 → pageId 见 `page-id-remap.ts`。
 * v1 产品边界背景：`.cursor/docs/v1-决策交付-产品边界.md`。
 * 出稿 `delivery_segments` 仍是 v1 十段 key；本表数据不在 W0 改写。
 * 【1→4 阶段】议程真源 = FACE_AGENDA_BLUEPRINT（按脸 reality_needs；禁止六页/主辅纸凑问）。
 * REPORT_BLUEPRINT 九模块表仅 legacy remap；Call B / synthesis 自检勿再读 path_role primary_and_backup。
 * 内容页序改 `.cursor/docs/decision-report/` + page-feed-matrix；不要只改九模块表。
 *
 * 脸序在 `CANONICAL_FACE_BLUEPRINT`。模块表仍可单独 import。
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { remapRowForLegacyKey } from "@/lib/llm/pro/delivery/page-id-remap";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";

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

const FACE_READING_ORDER = ["01", "02", "04", "05", "06", "07", "08", "03"] as const;

export type CanonicalFaceBlueprint = {
  faceId: DecisionPageId;
  title: string;
  /** Modules whose primary page is this face. */
  modules: readonly ReportPage[];
  /** Modules that also land a block on this face. */
  alsoFeeds: readonly ReportPage[];
};

/** Face order is the blueprint source of truth. Module rows are the papers on that face. */
export const CANONICAL_FACE_BLUEPRINT: readonly CanonicalFaceBlueprint[] = FACE_READING_ORDER.map(
  (faceId) => ({
    faceId,
    title: DECISION_PAGE_SCHEMAS[faceId].title,
    modules: REPORT_BLUEPRINT.filter((page) => remapRowForLegacyKey(page.id)?.pageId === faceId),
    alsoFeeds: REPORT_BLUEPRINT.filter((page) =>
      remapRowForLegacyKey(page.id)?.alsoFeeds.includes(faceId),
    ),
  }),
);

/**
 * Stage1–3 议程真源（face-native）。
 * Call B / collecting 只读本表；不再用 REPORT_BLUEPRINT.needs_reality 起草问句。
 * 07 仅 topic 命中时纳入。
 */
export type FaceAgendaBlueprint = {
  faceId: DecisionPageId;
  title: string;
  input_role: BlueprintInputRole;
  reality_needs: readonly string[];
  /** When true, Call B includes this face only if page07Applies(topic). */
  topic_gated?: boolean;
};

export const FACE_AGENDA_BLUEPRINT: readonly FaceAgendaBlueprint[] = [
  {
    faceId: "01",
    title: DECISION_PAGE_SCHEMAS["01"].title,
    input_role: "needs_reality",
    reality_needs: [
      "主推成立的硬条件（不满足则不主张）",
      "明确不选/不碰的边界",
      "期望结果一句话（可核对）",
    ],
  },
  {
    faceId: "02",
    title: DECISION_PAGE_SCHEMAS["02"].title,
    input_role: "chart_only",
    reality_needs: [],
  },
  {
    faceId: "04",
    title: DECISION_PAGE_SCHEMAS["04"].title,
    input_role: "needs_reality",
    reality_needs: ["已知卡点/反复踩的坑", "不可逆成本或硬底线"],
  },
  {
    faceId: "05",
    title: DECISION_PAGE_SCHEMAS["05"].title,
    input_role: "needs_reality",
    reality_needs: [
      "可接受的路径选项偏好（非空泛平衡）",
      "切轨/停止信号",
      "资源与时间缓冲",
    ],
  },
  {
    faceId: "06",
    title: DECISION_PAGE_SCHEMAS["06"].title,
    input_role: "needs_reality",
    reality_needs: [
      "近阶可投入节奏",
      "能执行的动作类型边界（完成样貌，非勾选清单）",
    ],
  },
  {
    faceId: "07",
    title: DECISION_PAGE_SCHEMAS["07"].title,
    input_role: "needs_reality",
    topic_gated: true,
    reality_needs: [
      "场域事实（迁移/合伙/亲密对象与约束）",
      "对方盘是否可提供（无则不编）",
      "边界现实（禁合婚恐吓话术）",
    ],
  },
  {
    faceId: "08",
    title: DECISION_PAGE_SCHEMAS["08"].title,
    input_role: "needs_reality",
    reality_needs: ["自检红灯触发点", "何时应重评/停手"],
  },
  {
    faceId: "03",
    title: DECISION_PAGE_SCHEMAS["03"].title,
    input_role: "chart_only",
    reality_needs: [],
  },
] as const;

/** Call B 默认纳入的 needs_reality 脸（不含 topic_gated 07；07 由调用方按题门追加）。 */
export const FACE_AGENDA_NEEDS_REALITY: readonly FaceAgendaBlueprint[] =
  FACE_AGENDA_BLUEPRINT.filter(
    (r) => r.input_role === "needs_reality" && !r.topic_gated,
  );

/** @deprecated Prefer FACE_AGENDA_NEEDS_REALITY. Kept for legacy adapters that expect ReportPage[]. */
export const BLUEPRINT_PAGES_NEEDING_REALITY: readonly ReportPage[] =
  REPORT_BLUEPRINT.filter((p) => p.input_role === "needs_reality");

/** @deprecated Agenda must not use primary/backup path roles. */
export const BLUEPRINT_PRIMARY_BACKUP_PAGES: readonly ReportPage[] =
  REPORT_BLUEPRINT.filter((p) => p.path_role === "primary_and_backup");

/** 禁止作为新议程 serves_page 输出（chart_only / 简报 / 附录）。 */
export const BLUEPRINT_AGENDA_FORBIDDEN_PAGES = new Set<string>([
  "decision_brief",
  "appendix",
  "direct_answer",
  "02",
  "03",
]);

/** Face ids allowed as new-agenda serves_page. */
export const FACE_AGENDA_SERVES_PAGE_IDS = [
  "01",
  "04",
  "05",
  "06",
  "07",
  "08",
] as const;

export function getBlueprintPage(id: string): ReportPage | undefined {
  const byId = REPORT_BLUEPRINT.find((p) => p.id === id);
  if (byId) return byId;
  const bySegment = REPORT_BLUEPRINT.find((p) =>
    (p.delivery_segments as readonly string[]).includes(id),
  );
  if (bySegment) return bySegment;
  if ((FACE_READING_ORDER as readonly string[]).includes(id)) {
    return CANONICAL_FACE_BLUEPRINT.find((row) => row.faceId === id)?.modules[0];
  }
  return undefined;
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
