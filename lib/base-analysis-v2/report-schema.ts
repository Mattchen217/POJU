/**
 * POJU 底座 2.0 · 报告计算结果的单一事实源（SSOT）。
 *
 * 这是三次调用的接口契约，定死后不再动：
 *   第1次真算 → 产出 ReportComputed（本类型）
 *   第2次正文 → 逐段读 core_conclusion（钥匙A），扩成白话
 *   第3次依据 → 逐段读 core_conclusion + bazi_basis（钥匙A+B），照单打标
 *
 * 双钥匙（Dual-Key）：每段两把钥匙锁死"正文"和"依据"围绕同一结论、各取所需、不脱节。
 *   钥匙A core_conclusion —— 白话结论（第2、3次都锚它 → 绝不两张皮）
 *   钥匙B bazi_basis      —— 命理真词清单（第3次照单打标 → 不猜、不幻觉）
 */

/** 一段的双钥匙。每个报告段落都是这个结构。 */
export interface SegmentComputed {
  /**
   * 钥匙A · 白话结论。这一段要传达的核心判断，已是中立白话（不含命理术语）。
   * 第2次据此扩写正文；第3次据此锚定依据要证明的结论。
   * 例:"属于典型的深度专业输出型,靠独立专业壁垒创造价值,而非团队层级管理。"
   */
  core_conclusion: string;
  /**
   * 钥匙B · 命理真词清单。支撑上面结论的原始命理依据（真词，不软译、不打标）。
   * 只第3次用——照这个清单打标 ⟦t:slug|⟧，不用自己从白话里猜。
   * 例:["食神吐秀","日主偏旺","无官杀混杂"]
   * ⚠️ 用全称,不用简称/合称(不写"官杀",写"正官""七杀")。
   * ⚠️ 恐吓宿命词不入(十恶大败/孤鸾煞…);时间锚不入(2026年/35岁/第三步大运)。
   */
  bazi_basis: readonly string[];
}

/** 模块一 · 先天能量图谱与性格原型 */
export interface EnergyMapModule {
  day_master_nature: SegmentComputed; // 1.1/1.2 日主本质+能量底色(纯文字,无图)
  wuxing_distribution: SegmentComputed; // 1.2 五行最旺最缺、整体偏旺偏弱
  cognitive_archetype: SegmentComputed; // 1.3 认知模式+优势+盲区
  regulator: SegmentComputed; // 1.4 用神喜忌=补给/干扰能量
}

/** 模块二 · 工作效能与决策风格(去金融化) */
export interface WorkStyleModule {
  value_creation: SegmentComputed; // 2.1 效能转化:独立输出vs系统协同
  decision_style: SegmentComputed; // 2.2 决策稳健度+适应力+疲劳根因
  focus_drain: SegmentComputed; // 2.3 精力聚焦点+耗损点
}

/** 模块三 · 沟通原型与人际协同(去婚恋宿命) */
export interface InterpersonalModule {
  comm_archetype: SegmentComputed; // 3.1 沟通互动原型
  friction_point: SegmentComputed; // 3.2 关系磨合点
  synergy: SegmentComputed; // 3.3 协同互补建议
}

/**
 * 模块四 · 阶段性状态演进(时间轴改造版)
 * ⚠️ reasoning 层可用大运流年真算,但这里的 core_conclusion/bazi_basis
 *    【绝对不能出现】2026年/35岁/丙午年/第三步大运等时间锚。
 *    只描述"蓄能/高能/调整"三态的触发条件+应对策略,用条件句"当你感到X时"。
 */
export interface PhaseStatesModule {
  baseline: SegmentComputed; // 4.0 底层能量基底
  rest_phase: SegmentComputed; // 4.A 蓄能沉淀态:特征识别+策略
  peak_phase: SegmentComputed; // 4.B 高能释放态:特征识别+策略
  transition_phase: SegmentComputed; // 4.C 结构调整态:特征识别+策略
}

/** 模块五 · 环境与日常行为调频 */
export interface RetuneModule {
  color: SegmentComputed; // 5.1 视觉与色彩
  space: SegmentComputed; // 5.2 空间与方位
  habits: SegmentComputed; // 5.3 行为微习惯
  awareness: SegmentComputed; // 5.4 反直觉觉察
}

/**
 * 模块六 · 一页纸摘要
 * 卡片正文(keywords/theme/dos/donts)是极简总结,不逐条带依据;
 * card_basis 是卡片底部【统一的核心依据折叠块】= 日主格局+核心用神喜神+阶段能量场特征。
 */
export interface SummaryModule {
  keywords: readonly string[]; // 核心性格关键词（2-4）
  current_theme: string; // 当下阶段主旋律(状态,非时间)
  dos: readonly string[]; // Do's（正好 3）
  donts: readonly string[]; // Don'ts（正好 3）
  card_basis: SegmentComputed; // 卡片底部统一折叠依据(双钥匙)
}

/** 第1次真算的完整输出 · v2 三次调用的 SSOT */
export interface ReportComputed {
  energy_map: EnergyMapModule;
  work_style: WorkStyleModule;
  interpersonal: InterpersonalModule;
  phase_states: PhaseStatesModule;
  retune: RetuneModule;
  summary: SummaryModule;
}

/** 遍历所有"带双钥匙的段落"的路径(第2/3次逐段处理、校验用)。 */
export const SEGMENT_PATHS = [
  "energy_map.day_master_nature",
  "energy_map.wuxing_distribution",
  "energy_map.cognitive_archetype",
  "energy_map.regulator",
  "work_style.value_creation",
  "work_style.decision_style",
  "work_style.focus_drain",
  "interpersonal.comm_archetype",
  "interpersonal.friction_point",
  "interpersonal.synergy",
  "phase_states.baseline",
  "phase_states.rest_phase",
  "phase_states.peak_phase",
  "phase_states.transition_phase",
  "retune.color",
  "retune.space",
  "retune.habits",
  "retune.awareness",
  "summary.card_basis",
] as const;

export type SegmentPath = (typeof SEGMENT_PATHS)[number];

/** Dot-path lookup on ReportComputed (compile-time only). */
type GetByPath<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? GetByPath<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * Compile-time lock: every SEGMENT_PATHS entry must resolve to SegmentComputed.
 * If you add a segment to the interfaces, update SEGMENT_PATHS (and vice versa).
 */
type AssertSegmentPaths = {
  [P in SegmentPath]: GetByPath<ReportComputed, P> extends SegmentComputed ? true : never;
};
const _segmentPathLock: AssertSegmentPaths = {
  "energy_map.day_master_nature": true,
  "energy_map.wuxing_distribution": true,
  "energy_map.cognitive_archetype": true,
  "energy_map.regulator": true,
  "work_style.value_creation": true,
  "work_style.decision_style": true,
  "work_style.focus_drain": true,
  "interpersonal.comm_archetype": true,
  "interpersonal.friction_point": true,
  "interpersonal.synergy": true,
  "phase_states.baseline": true,
  "phase_states.rest_phase": true,
  "phase_states.peak_phase": true,
  "phase_states.transition_phase": true,
  "retune.color": true,
  "retune.space": true,
  "retune.habits": true,
  "retune.awareness": true,
  "summary.card_basis": true,
};
void _segmentPathLock;

function readPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, obj);
}

function writePath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (!cur[key] || typeof cur[key] !== "object" || Array.isArray(cur[key])) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

function isSegmentOk(seg: unknown): boolean {
  if (!seg || typeof seg !== "object") return false;
  const record = seg as Record<string, unknown>;
  if (typeof record.core_conclusion !== "string" || !record.core_conclusion.trim()) return false;
  if (!Array.isArray(record.bazi_basis) || record.bazi_basis.length === 0) return false;
  return true;
}

function isSummaryOk(summary: unknown): boolean {
  if (!summary || typeof summary !== "object") return false;
  const s = summary as Record<string, unknown>;
  if (!Array.isArray(s.keywords) || s.keywords.length === 0) return false;
  if (typeof s.current_theme !== "string" || !s.current_theme.trim()) return false;
  if (!Array.isArray(s.dos) || s.dos.length === 0) return false;
  if (!Array.isArray(s.donts) || s.donts.length === 0) return false;
  return true;
}

const PLACEHOLDER_SEG: SegmentComputed = {
  core_conclusion: "（本段结论暂缺，其余段落仍保留首生成内容。）",
  bazi_basis: ["（依据暂缺）"],
};

/**
 * 缺段占位：保住已有黄金段落，缺的填最小占位。
 */
export function fillMissingSegments(obj: unknown): ReportComputed {
  const root: Record<string, unknown> =
    obj && typeof obj === "object" && !Array.isArray(obj)
      ? structuredClone(obj as Record<string, unknown>)
      : {};

  for (const path of SEGMENT_PATHS) {
    if (!isSegmentOk(readPath(root, path))) {
      writePath(root, path, { ...PLACEHOLDER_SEG });
    }
  }

  const summary =
    root.summary && typeof root.summary === "object"
      ? (root.summary as Record<string, unknown>)
      : {};
  if (!Array.isArray(summary.keywords) || summary.keywords.length === 0) {
    summary.keywords = ["待补"];
  }
  if (typeof summary.current_theme !== "string" || !summary.current_theme.trim()) {
    summary.current_theme = "（主旋律暂缺）";
  }
  if (!Array.isArray(summary.dos) || summary.dos.length === 0) {
    summary.dos = ["（建议暂缺）"];
  }
  if (!Array.isArray(summary.donts) || summary.donts.length === 0) {
    summary.donts = ["（避项暂缺）"];
  }
  if (!isSegmentOk(summary.card_basis)) {
    summary.card_basis = { ...PLACEHOLDER_SEG };
  }
  root.summary = summary;

  return root as unknown as ReportComputed;
}

export type ValidateReportComputedResult =
  | { ok: true; value: ReportComputed }
  | {
      ok: false;
      reason: string;
      /** fatal = 结构严重损坏(<50% 可用)→可重试；soft = 个别段缺→占位放行 */
      severity: "fatal" | "soft";
      value?: ReportComputed;
    };

/**
 * 运行时校验。缺段不再一律 fatal——补全率 ≥50% 标 soft，由调用方占位放行。
 */
export function validateReportComputed(obj: unknown): ValidateReportComputedResult {
  if (!obj || typeof obj !== "object") {
    return { ok: false, reason: "not an object", severity: "fatal" };
  }

  let okCount = 0;
  const missing: string[] = [];
  for (const path of SEGMENT_PATHS) {
    if (isSegmentOk(readPath(obj, path))) okCount += 1;
    else missing.push(path);
  }

  const summaryOk = isSummaryOk((obj as Record<string, unknown>).summary);
  if (missing.length === 0 && summaryOk) {
    return { ok: true, value: obj as ReportComputed };
  }

  const rate = okCount / SEGMENT_PATHS.length;
  const reasonParts = [...missing];
  if (!summaryOk) reasonParts.push("summary incomplete");
  const reason = reasonParts.join("; ") || "incomplete";

  if (rate < 0.5) {
    return { ok: false, reason, severity: "fatal" };
  }

  return {
    ok: false,
    reason,
    severity: "soft",
    value: obj as ReportComputed,
  };
}
