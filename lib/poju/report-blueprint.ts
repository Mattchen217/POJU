/**
 * POJU 报告蓝图 · 全链路单一事实源(SSOT)。
 * 定义第4段交付的 **6 页正文 + 附录**（原八页；已退役独立 thirty_day）。
 * 【1→4 阶段都 import 这里】——第2段真算据此确认主方向撑得起报告；
 * 2.1议程据此逐页问"缺什么现实料"；第4段据此渲染。
 * 改页结构只改这一处，全链自动对齐（单一事实源，永不漂移）。
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

export interface ReportPage {
  /** 稳定 id（也用作交付段 key 的对齐锚）。 */
  id: string;
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
  /** 当前对应的交付段 key（Layer2 合并后会对齐；P2 现在跨多个旧段）。 */
  delivery_segments: readonly string[];
}

export const REPORT_BLUEPRINT: readonly ReportPage[] = [
  {
    id: "direct_answer",
    part_no: 1,
    title: { zh: "核心直答", en: "Core Answer" },
    purpose: "用户耐心答完多轮，一打开最想要的是直面答案，不是铺垫。",
    writes:
      "正面直答 original_question（何时好/该不该继续 = 阶段趋势+条件成熟，不报日期）+ 一句话点明主路径（我最建议你走这条）+ 一句话为什么。这是'结论的头'。",
    chart_inputs: ["situation_conclusion", "key_crossroads", "primary_path", "desired_outcome"],
    input_role: "chart_only",
    path_role: "verdict",
    delivery_segments: ["direct_answer"],
  },
  {
    id: "foundation",
    part_no: 2,
    title: { zh: "归因诊断", en: "Root Diagnosis" },
    purpose: "论证 P1 那个结论——用命理讲透'你为什么会卡在这困境里'，让用户信后面的方案。",
    writes:
      "按【论证需要】放底座料（能量结构/十神驱动/优势与阶段/周期窗口里，哪几块支撑'为什么卡'就放哪几块，不为凑齐而凑、不放无关的），内部用小标题分块（论证的几个支点），最后收敛到'所以你卡在这'。P1给结论、P2给论证，不重复。",
    chart_inputs: [
      "energy_structure",
      "element_scores",
      "four_pillars_ten_gods",
      "shen_sha_life_stage",
      "current_da_yun_cycle",
    ],
    input_role: "chart_only",
    path_role: "evidence",
    delivery_segments: ["foundation"],
  },
  {
    id: "science_action",
    part_no: 3,
    title: { zh: "显性操盘", en: "Explicit Playbook" },
    purpose:
      "用户花钱的核心——科学这一套「怎么办」：从命理推出只对他成立的【策略+手段】（白话行为域），不是半套只有策略。",
    writes:
      "【每条论点=策略+手段成套】从多维+主辅长出多条科学维(边界/发力/易栽/切换等);每条必须同时有决策策略与可对照科学手段(资源精力/沟通原则/节奏杠杆/一层示意)。骨架来自命理；禁合同/话术剧本；禁整页只推销主路径。",
    chart_inputs: [
      "primary_path",
      "backup_path",
      "action_plan",
      "multi_dimension_reckoning",
      "modern_action_frames",
    ],
    input_role: "needs_reality",
    reality_needs: [
      "手上已有的资源/技能/积累",
      "可投入的时间与精力",
      "执行力短板与经济缓冲",
      "对主路径关键动作的接受度（校准主辅是否对调）",
    ],
    path_role: "primary_and_backup",
    delivery_segments: ["science_action"],
  },
  {
    id: "metaphysics_action",
    part_no: 4,
    title: { zh: "隐性借势", en: "Implicit Leverage" },
    purpose:
      "20刀买到别处没有的——锚定【用户问题+期望】，从本地真算抽相关维，给出可实操东方策略+手段+依据（不挂主辅轨；主辅已由 P3 锚定）。",
    writes:
      "question_anchor + desired_outcome；dimensions=与这件事情相关的真算维（用神喜忌借势、仪表、行业、方位、时段/色彩/协同——有关才写）；每维策略+手段；leverage/avoid；合规包装；禁整页方位清单；禁复读科学页；禁再写主辅双轨。",
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
    delivery_segments: ["metaphysics_action"],
  },
  {
    id: "risk_guard",
    part_no: 5,
    title: { zh: "风险预警", en: "Risk Guard" },
    purpose: "帮我别踩坑——安心感；坑必须是他这类结构特有的，不是通用提醒。",
    writes:
      "每条熔断=出现→该做→注意→禁做；红灯/特有坑/切辅/防护；可选短边界句。源于忌神/盲区/相关负向多维。",
    chart_inputs: [
      "self_check_signals",
      "ji_shen",
      "blind_spots",
      "path_costs",
      "multi_dimension_reckoning",
      "original_question",
      "desired_outcome",
    ],
    input_role: "needs_reality",
    reality_needs: ["用户已知会让自己反复踩的坑/触发点"],
    path_role: "supports_primary",
    delivery_segments: ["risk_guard"],
  },
  {
    id: "signals_close",
    part_no: 6,
    title: { zh: "行动指引", en: "Action Guide" },
    purpose:
      "一次性产品——读完要有'我拿到完整打法、可以出发了'的底气；含今晚一件事 + 近7日微清单（吸收原30天页价值）。",
    writes:
      "身份对照 + 金句 + 今晚一件事 + 近7日可勾选微清单（可追溯药方）；正向信号自查；一次性独立收尾（无回来追踪钩子）。禁止四周甘特。",
    chart_inputs: ["self_check_signals", "action_plan", "rhythm_frame"],
    input_role: "needs_reality",
    reality_needs: ["用户近7日可投入的时间/节奏", "近期固定安排或约束"],
    path_role: "closing",
    delivery_segments: ["signals_close"],
  },
  {
    id: "appendix",
    part_no: 7,
    title: { zh: "附录 · 结构数据与术语说明", en: "Appendix · Structural Data & Terms" },
    purpose: "透明存档，可复盘。",
    writes: "命盘结构数据（折叠）+ 术语说明。",
    chart_inputs: ["structured_raw"],
    input_role: "chart_only",
    path_role: "appendix",
    delivery_segments: ["appendix"],
  },
] as const;

/** 需要议程收集的页（2.1议程只为这些页生成 agenda）。 */
export const BLUEPRINT_PAGES_NEEDING_REALITY: readonly ReportPage[] =
  REPORT_BLUEPRINT.filter((p) => p.input_role === "needs_reality");

/** 主辅路径展开的页（P3 科学药方）。 */
export const BLUEPRINT_PRIMARY_BACKUP_PAGES: readonly ReportPage[] =
  REPORT_BLUEPRINT.filter((p) => p.path_role === "primary_and_backup");

export function getBlueprintPage(id: string): ReportPage | undefined {
  return REPORT_BLUEPRINT.find((p) => p.id === id);
}
