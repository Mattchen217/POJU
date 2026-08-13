/**
 * POJU 报告蓝图 · 全链路单一事实源(SSOT)。
 * 定义第4段交付的8页结构 + 每页的定位/数据需求/主辅角色。
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
    title: { zh: "对你问题的回答", en: "Your Answer" },
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
    title: { zh: "你的底座与为什么卡在这", en: "Your Foundation & Why You're Stuck" },
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
    title: { zh: "行为策略：该怎么做", en: "Behavioral Strategy: What To Do" },
    purpose:
      "用户花钱的核心——'那我到底该怎么办'：从命理各维推出只对他成立的决策策略，再落一层场景示意。",
    writes:
      "主路径决策策略（边界/发力点/该类结构易栽点/主辅切换条件）+ 一层「第一步怎么起」场景示意 + 辅路径退路与切换条件。骨架来自命理，不是清单式执行剧本/话术脚本。",
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
    title: {
      zh: "环境调频：空间·色彩·时段·协同人群",
      en: "Environmental Tuning: Space, Color, Timing, People",
    },
    purpose: "20刀买到别处没有的——只有算了盘才给得出的专属实操。",
    writes:
      "方位适配/朝向、色彩锚定、行业属性方向、日内高效时段、协同人群方位特质——每条从用神喜忌/五行推出(缺什么补什么),不是通用风水。合规包装（空间效能/时机窗口/协同伙伴，禁吉凶/风水/生肖）。",
    chart_inputs: ["metaphysics_pack", "energy_retune_frame"],
    input_role: "needs_reality",
    reality_needs: ["现居/工作空间大致朝向或可调范围（轻，可选）"],
    path_role: "supports_primary",
    delivery_segments: ["metaphysics_action"],
  },
  {
    id: "thirty_day",
    part_no: 5,
    title: { zh: "30天行动路线图", en: "30-Day Action Roadmap" },
    purpose: "给我一张能贴墙、照着走的东西——掌控感；松紧对应当前大运/阶段，不是平均切周。",
    writes:
      "4周甘特：每周（科学动作+环境调频动作）、可勾选、可打印；主路径排期 + 辅路径切换点。按周不按天；宜守/宜进对应 current_da_yun_cycle。",
    chart_inputs: [
      "rhythm_frame",
      "primary_path",
      "backup_path",
      "action_plan",
      "current_da_yun_cycle",
    ],
    input_role: "needs_reality",
    reality_needs: ["用户每周可投入的时间/节奏", "近期固定安排或约束"],
    path_role: "primary_and_backup",
    delivery_segments: ["thirty_day"],
  },
  {
    id: "risk_guard",
    part_no: 6,
    title: { zh: "避坑红线与注意事项", en: "Pitfalls & Guardrails" },
    purpose: "帮我别踩坑——安心感；坑必须是他这类结构特有的，不是通用提醒。",
    writes:
      "这30天【别做】什么、【警惕】哪些信号、身体报警信号——源于忌神/性情盲区的特有坑。用'别做X'清单形式。",
    chart_inputs: ["self_check_signals", "ji_shen", "blind_spots"],
    input_role: "needs_reality",
    reality_needs: ["用户已知会让自己反复踩的坑/触发点"],
    path_role: "supports_primary",
    delivery_segments: ["risk_guard"],
  },
  {
    id: "signals_close",
    part_no: 7,
    title: { zh: "突破信号与总结", en: "Breakthrough Signals & Summary" },
    purpose: "一次性产品——读完要有'我拿到完整打法、可以出发了'的底气，不留悬念。",
    writes: "正向信号自查（怎么知道走对了）+ 一次性独立收尾（无回来追踪钩子）。",
    chart_inputs: ["self_check_signals"],
    input_role: "chart_only",
    path_role: "closing",
    delivery_segments: ["signals_close"],
  },
  {
    id: "appendix",
    part_no: 8,
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

/** 主辅路径展开的页（P3科学 / P5三十天）。 */
export const BLUEPRINT_PRIMARY_BACKUP_PAGES: readonly ReportPage[] =
  REPORT_BLUEPRINT.filter((p) => p.path_role === "primary_and_backup");

export function getBlueprintPage(id: string): ReportPage | undefined {
  return REPORT_BLUEPRINT.find((p) => p.id === id);
}
