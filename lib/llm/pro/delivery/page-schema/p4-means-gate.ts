/**
 * P4 means gate — anti-literal wuxing + moat coverage (timing/polarity/archetype).
 * Uses wuxing-semantic-ssot (same table as prompt injection).
 *
 * Moat pass/fail is PAGE-level (see gateP4PageMoatCoverage). Per-dimension gate
 * only strips literals and normalizes means list — no rhythm-first / symbol-cap.
 */

import {
  classifyMeansActionType,
  inferWuxingElementsFromText,
  isP4MoatMeansType,
  textHitsBlacklist,
  type MeansActionType,
  type P4MoatMeansType,
  type WuxingElement,
} from "@/lib/glossary/wuxing-semantic-ssot";
import { CLOSED_TEN_GODS } from "@/lib/glossary/term-closed-set";

/** Sixty-jiazi pillar used as dayun/liunian primary (丁酉 / 丙午). */
const GANZHI_PILLAR_RE =
  /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;

/**
 * True when locked chart_anchors already serve the unit's moat_class.
 * Timing: phase keywords OR bare cycle pillar (大运/流年干支本身).
 */
export function anchorsServeMoatClass(
  anchors: readonly string[],
  moat: P4MoatMeansType,
): boolean {
  const blob = anchors.join(" ");
  if (moat === "timing") {
    if (/大运|流年|岁运|气候交织|交运|起运|运程|岁环|纪元/.test(blob)) {
      return true;
    }
    return anchors.some((a) => GANZHI_PILLAR_RE.test(a.trim()));
  }
  if (moat === "polarity") {
    // 身弱/用忌关键词，或裸五行（忌土/用神水等极性元素）
    if (/用神|忌神|喜神|身弱|身强|补泄|五行/.test(blob)) return true;
    return anchors.some((a) => /^[木火土金水]$/.test(a.trim()));
  }
  // archetype：十神/官杀气质 — 禁叙述壳「格局」单独承重（方案 A #7）
  return /(比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印|十神|官杀)/.test(
    blob,
  );
}

export type RawMeansItem =
  | string
  | {
      text?: unknown;
      type?: unknown;
      body?: unknown;
      action?: unknown;
    };

function asMeansText(raw: RawMeansItem): { text: string; declared: MeansActionType | null } {
  if (typeof raw === "string") {
    return { text: raw.trim(), declared: null };
  }
  if (raw && typeof raw === "object") {
    const text = String(raw.text ?? raw.body ?? raw.action ?? "").trim();
    const ty = String(raw.type ?? "").trim().toLowerCase();
    const declared =
      ty === "timing" ||
      ty === "polarity" ||
      ty === "archetype" ||
      ty === "rhythm" ||
      ty === "mindset" ||
      ty === "symbol" ||
      ty === "field"
        ? (ty as MeansActionType)
        : null;
    return { text, declared };
  }
  return { text: "", declared: null };
}

export type P4MeansGateResult = {
  means: string[];
  notes: string[];
  /** Types kept after literal drop (for page-level moat tally). */
  kept_types: MeansActionType[];
  /** True when fill should retry (literal primary / empty after drops). */
  structural: boolean;
  structural_reason?: string;
};

/**
 * Infer which moat dimensions have real calc support in the eastern fill slice.
 * Conservative: ban-list / instruction lines alone do not count.
 */
export function inferP4MoatEligibleTypes(
  slice: string | null | undefined,
): Set<P4MoatMeansType> {
  const text = (slice ?? "").trim();
  const out = new Set<P4MoatMeansType>();
  if (!text) return out;

  const withoutBanLine = text.replace(/【用户可见禁词】[^\n]*/g, "");

  const yongMatch = withoutBanLine.match(/(?:^|\n)-?\s*yong:\s*([^\n;]+)/i);
  const yongVal = (yongMatch?.[1] ?? "").trim();
  if (yongVal && yongVal !== "(无)" && !yongVal.startsWith("(缺失")) {
    out.add("polarity");
  } else if (
    /pack_polarity:/.test(withoutBanLine) &&
    /(?:yong|ji|用神|忌神)\s*[:=：]/.test(withoutBanLine)
  ) {
    out.add("polarity");
  }

  const timingLine =
    withoutBanLine.match(/timing_ripeness:\s*([^\n]+)/) ??
    withoutBanLine.match(/(?:^|\n)-?\s*timing:\s*([^\n]+)/);
  const timingVal = (timingLine?.[1] ?? "").trim();
  const hasTimingVal =
    Boolean(timingVal) && timingVal !== "(缺失)" && timingVal !== "(无)";
  const hasPhaseDims = /阶段相关多维:\n\s*- 【/.test(withoutBanLine);
  const hasDayunSemantic =
    /【大运语义|大运语义 SSOT|dayun_semantic|【大运\/阶段节奏 SSOT|【大运\/阶段节奏/.test(
      withoutBanLine,
    ) && /干支|起运|岁|转折|阶段|冲|藏|守/.test(withoutBanLine);
  if (
    hasTimingVal ||
    hasPhaseDims ||
    hasDayunSemantic ||
    /current_da_yun_cycle/.test(withoutBanLine)
  ) {
    out.add("timing");
  }

  if (
    /【十神语义|十神语义 SSOT|tengod_semantic/.test(withoutBanLine) ||
    /(比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印)/.test(withoutBanLine)
  ) {
    out.add("archetype");
  }

  return out;
}

function classifyMeansList(
  meansRaw: unknown,
  chart_anchors: readonly string[],
  strategy: string,
  notes: string[],
): {
  kept: Array<{ text: string; type: MeansActionType }>;
  droppedLiteral: number;
} {
  const elements: WuxingElement[] = inferWuxingElementsFromText(
    [...chart_anchors, strategy].join(" "),
  );
  const rawList = Array.isArray(meansRaw) ? meansRaw : [];
  const classified: Array<{ text: string; type: MeansActionType | "literal_object" }> = [];

  for (const item of rawList.slice(0, 8)) {
    const { text, declared } = asMeansText(item as RawMeansItem);
    if (!text) continue;
    const hit = textHitsBlacklist(text, elements);
    if (hit) {
      notes.push(`p4_literal_wuxing:${hit}`);
      classified.push({ text, type: "literal_object" });
      continue;
    }
    const type = classifyMeansActionType(text, declared, elements);
    if (type === "literal_object") {
      notes.push("p4_literal_wuxing:classified");
      classified.push({ text, type });
      continue;
    }
    if (declared && declared !== type && (declared === "field" || declared === "symbol")) {
      notes.push(`p4_means_type_override:${declared}->${type}`);
    }
    classified.push({ text: text.slice(0, 240), type });
  }

  const kept = classified.filter(
    (c): c is { text: string; type: MeansActionType } => c.type !== "literal_object",
  );
  const droppedLiteral = classified.length - kept.length;
  if (droppedLiteral > 0) {
    notes.push(`p4_literal_means_dropped:${droppedLiteral}`);
  }
  return { kept, droppedLiteral };
}

/**
 * Per-dimension: drop literal-object lines; keep all other types (no symbol/field cap,
 * no rhythm/mindset primacy). Empty after drops → structural.
 */
export function gateP4DimensionMeans(input: {
  meansRaw: unknown;
  chart_anchors: readonly string[];
  strategy: string;
  notes: string[];
}): P4MeansGateResult {
  const notes = [...input.notes];
  const { kept, droppedLiteral } = classifyMeansList(
    input.meansRaw,
    input.chart_anchors,
    input.strategy,
    notes,
  );

  if (kept.length === 0) {
    return {
      means: [],
      notes,
      kept_types: [],
      structural: true,
      structural_reason:
        droppedLiteral > 0 ? "p4_literal_wuxing_means" : "p4_means_empty",
    };
  }

  // Prefer moat means first in list, then rhythm/mindset, then symbol/field — soft order only
  const rank = (t: MeansActionType): number => {
    if (isP4MoatMeansType(t)) return 0;
    if (t === "rhythm" || t === "mindset") return 1;
    return 2;
  };
  const ordered = [...kept].sort((a, b) => rank(a.type) - rank(b.type)).slice(0, 8);

  return {
    means: ordered.map((c) => c.text),
    notes,
    kept_types: ordered.map((c) => c.type),
    structural: false,
  };
}

export type P4PageMoatGateResult = {
  notes: string[];
  structural: boolean;
  structural_reason?: string;
  eligible: P4MoatMeansType[];
  covered: P4MoatMeansType[];
};

const P3_SCIENCE_EXEC =
  /邮件|话术|授权|日历|Slack|谈判|战绩夹|现金缓冲|buffer|calendar|email|script|ownership|副手|STAR|MVP|清单勾选|周报模板|KPI仪表|架构文档|系统文档|系统架构|技术决策|交付计划|技术交付|可见交付|技术记录|书面化|合作提案|验证期|最低交付|逐步渗透|硬性安全网|安全网|积累话语权|索要名分|股权条件|不可替代性/i;

/** True when means is P3 science/exec shell (project/docs/negotiation), not self-retune. */
export function isP4ScienceExecMean(text: string): boolean {
  return P3_SCIENCE_EXEC.test(text.trim());
}

/** Project-management / life-coach stems that must not dominate P4 means (东方药方页). */
export const P3_COACH_PM =
  /兼职顾问|全职创业|止损线|应急储备|财务安全垫|安全垫增厚|安全垫|收入安全线|安全线|保底资金|周固定独处|深度独处|试水计划|试水期限|试水期|验证期|里程碑|工时约定|每周\s*\d|每周固定|辞职|追加资金|副业收入|写一份.{0,12}计划|合同协商|创业伙伴协商|KPI|项目管理|找律师|律师|权责利|白纸黑字|股权谈判|文档化|技术决策备忘录|备忘录|书面文档|三个月后|三个月试水|兼职身份交付|保护.{0,6}收入|观察期|缓冲期|股权设计|谈判筹码|个人博客|技术社区|著作权归/;

/** Hard coach stems — always strip even when Eastern markers co-occur.
 * Trial-period / validation-period PM framing = synonym family of 试水期限 (not Lab chase).
 */
const P3_COACH_PM_HARD =
  /找律师|律师|文档化|技术决策备忘录|备忘录|书面文档|里程碑|安全垫|收入安全线|安全线|保底资金|观察期|缓冲期|股权设计|试水期限|试水计划|试水期|验证期|财务安全垫|周固定独处|深度独处|工时约定|KPI|权责利|白纸黑字|个人博客|著作权归/;

/** Eastern / moat signal that disambiguates soft coach hits (e.g. 谈判筹码 in 借势 means). */
const P4_EASTERN_MEAN_SIGNAL =
  /火旺|水旺|金旺|木旺|土旺|用神|忌神|喜神|大运|流年|岁运|运程|未熟|窗口|阶段窗|阶段切换|补给|过耗|借势|以泄代克|角色定位|角色站位|靠近|远离|补泻|泄成|结构节奏|加码|调频|守成|技术输出|站位|以柔克刚|观察者|策略提供者|侧翼|姿态进入|借.{0,6}平台/;

/**
 * Coach/PM mean? Soft stems (e.g. incidental 谈判筹码) kept when Eastern signal present.
 */
export function isP4CoachPmMean(text: string): boolean {
  const t = text.trim();
  if (!t || !P3_COACH_PM.test(t)) return false;
  if (P3_COACH_PM_HARD.test(t)) return true;
  if (P4_EASTERN_MEAN_SIGNAL.test(t)) return false;
  return true;
}

/**
 * Generic leverage class — swap-chart still works (P3/鸡汤 shape, not Eastern retune).
 * Category regex only; no case-specific stems.
 */
export const P4_GENERIC_LEVERAGE =
  /不把所有鸡蛋|鸡蛋放在一个篮子|分散.{0,8}依赖|降低对单一.{0,8}依赖|小项目或技能|核心技术模块|不一次性全部交出|持续交付来?维持|知识产权归属|模块的独立性|内心平静.{0,16}再谈|感到平静.{0,16}再|思路清晰时再谈|情绪.{0,8}再谈|平静.{0,6}再谈条款/;

export const P4_MIN_STRATEGY_CHARS = 80;
export const P4_MIN_MEANS_PER_DIM = 2;
/** Prompt/自检：strategy 句数下限（闸门以字数计，提示词双钉）。 */
export const P4_MIN_STRATEGY_SENTENCES = 3;

const GANZHI_IN_TEXT =
  /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;

/** Strip closed-set structure + Eastern mechanism markers for de-calc test. */
export function stripStructureForDeCalc(text: string): string {
  let t = text;
  const gods = [...CLOSED_TEN_GODS].sort((a, b) => b.length - a.length);
  for (const tg of gods) {
    if (t.includes(tg)) t = t.split(tg).join("");
  }
  t = t.replace(GANZHI_IN_TEXT, "");
  t = t.replace(
    /用神|忌神|喜神|日主|身强|身弱|大运|流年|岁运|十神|合冲|刑害|半合|相刑|相害|相冲|印克|克食神|泄秀|食神泄/g,
    "",
  );
  t = t.replace(/[木火土金水](?:旺|弱|能量|势|土)?/g, "");
  t = t.replace(
    /补给场|过耗场|可切换的?窗口|阶段窗|阶段切换|窗口期|借势|以泄代克|角色定位|靠近|远离|补泻|泄成|运程|结构节奏|未熟|加码/g,
    "",
  );
  return t.replace(/[\s，。、；：""''「」（）()·…]/g, "").trim();
}

/**
 * True when means still reads as standalone workplace tip after structure strip
 * (换盘仍成立). Means that already carry Eastern mechanism markers are kept —
 * de-calc must not gut 火旺/水旺/窗口/借势 timing lines (attempt #5 over-strip).
 */
export function meansFailsDeCalcTest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Load-bearing Eastern / moat signal in the original line → not generic.
  if (
    /火旺|水旺|金旺|木旺|土旺|用神|忌神|喜神|大运|流年|岁运|运程|未熟|窗口|阶段切换|补给|过耗|借势|以泄代克|角色定位|角色站位|靠近|远离|补泻|泄成|结构节奏|加码|调频|守成|技术输出|站位|以柔克刚|观察者|策略提供者|侧翼|姿态进入|借.{0,6}平台/.test(
      t,
    )
  ) {
    return false;
  }
  const stripped = stripStructureForDeCalc(t);
  if (stripped.length < 18) return false;
  return (
    /应该|需要|可以|保持|发展|降低|避免|选择|同时|不要|一起|自己的|小项目|模块|交付|平静|清晰时|谈条款|谈关键/.test(
      t,
    ) && stripped.length >= 18
  );
}

function meanTextOf(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object") {
    const o = item as { text?: unknown; body?: unknown; action?: unknown };
    return String(o.text ?? o.body ?? o.action ?? "").trim();
  }
  return "";
}

/**
 * Strip menu/prompt ban tails the model pasted into means (「禁…」「勿写…」).
 * Those belong in menu *rules*, not inside copyable means — copying them
 * falsely trips coach/PM hard stems (试水期/验证期/KPI/安全线…).
 */
export function scrubP4MeansInstructionNoise(text: string): string {
  let t = text.trim();
  if (!t) return t;
  t = t.replace(/[；;，,、。]?\s*(?:禁|勿写)[^。；;\n]*/g, "");
  t = t
    .replace(/[；;，,、\s]+$/u, "")
    .replace(/^[；;，,、\s]+/u, "")
    .replace(/[；;，,]{2,}/g, "；")
    .trim();
  return t;
}

function withMeansText(item: unknown, text: string): unknown {
  if (typeof item === "string") return text;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    if ("text" in o) return { ...o, text };
    if ("body" in o) return { ...o, body: text };
    if ("action" in o) return { ...o, action: text };
    return { ...o, text };
  }
  return text;
}

/**
 * Deterministic: drop means lines that are pure P3 coach/PM stems (rule 11).
 * Scrubs instructional ban tails first so menu「禁验证期」paste does not gut retune lines.
 * Keeps Eastern retune lines; empty dims after strip are removed.
 */
export function softStripP4CoachPmMeans(
  dimensions: readonly Record<string, unknown>[],
): { dimensions: Record<string, unknown>[]; notes: string[]; stripped: number } {
  const notes: string[] = [];
  let stripped = 0;
  const next: Record<string, unknown>[] = [];
  for (let di = 0; di < dimensions.length; di++) {
    const d = dimensions[di]!;
    const meansRaw = Array.isArray(d.means) ? d.means : [];
    const kept: unknown[] = [];
    for (let mi = 0; mi < meansRaw.length; mi++) {
      const item = meansRaw[mi];
      const text = meanTextOf(item);
      if (!text) continue;
      const cleaned = scrubP4MeansInstructionNoise(text);
      if (!cleaned) {
        notes.push(`p4_coach_pm_mean_stripped:${di}:${mi}`);
        stripped += 1;
        continue;
      }
      if (cleaned !== text) {
        notes.push(`p4_means_instruction_scrubbed:${di}:${mi}`);
      }
      if (isP4CoachPmMean(cleaned)) {
        notes.push(`p4_coach_pm_mean_stripped:${di}:${mi}`);
        stripped += 1;
        continue;
      }
      kept.push(cleaned === text ? item : withMeansText(item, cleaned));
    }
    if (kept.length === 0) {
      notes.push(`p4_dim_empty_after_coach_strip:${di}`);
      continue;
    }
    next.push({ ...d, means: kept });
  }
  return { dimensions: next, notes, stripped };
}

/** Drop P3 science/exec shells (docs/delivery/negotiation) posing as P4 retune. */
export function softStripP4ScienceExecMeans(
  dimensions: readonly Record<string, unknown>[],
): { dimensions: Record<string, unknown>[]; notes: string[]; stripped: number } {
  return softStripP4MeansByPredicate(
    dimensions,
    (text) => isP4ScienceExecMean(text),
    "p4_science_exec_mean_stripped",
    "p4_dim_empty_after_science_strip",
  );
}

/** Drop generic-leverage-class means (category, not case blacklist). */
export function softStripP4GenericLeverageMeans(
  dimensions: readonly Record<string, unknown>[],
): { dimensions: Record<string, unknown>[]; notes: string[]; stripped: number } {
  return softStripP4MeansByPredicate(
    dimensions,
    (text) => P4_GENERIC_LEVERAGE.test(text),
    "p4_generic_leverage_stripped",
    "p4_dim_empty_after_generic_strip",
  );
}

/** Drop means that fail de-calc (structure-independent advice). */
export function softStripP4DeCalcGenericMeans(
  dimensions: readonly Record<string, unknown>[],
): { dimensions: Record<string, unknown>[]; notes: string[]; stripped: number } {
  return softStripP4MeansByPredicate(
    dimensions,
    (text) => meansFailsDeCalcTest(text),
    "p4_decalc_generic_stripped",
    "p4_dim_empty_after_decalc_strip",
  );
}

function softStripP4MeansByPredicate(
  dimensions: readonly Record<string, unknown>[],
  dropIf: (text: string) => boolean,
  stripNote: string,
  emptyNote: string,
): { dimensions: Record<string, unknown>[]; notes: string[]; stripped: number } {
  const notes: string[] = [];
  let stripped = 0;
  const next: Record<string, unknown>[] = [];
  for (let di = 0; di < dimensions.length; di++) {
    const d = dimensions[di]!;
    const meansRaw = Array.isArray(d.means) ? d.means : [];
    const kept: unknown[] = [];
    for (let mi = 0; mi < meansRaw.length; mi++) {
      const item = meansRaw[mi];
      const text = meanTextOf(item);
      if (!text) continue;
      if (dropIf(text)) {
        notes.push(`${stripNote}:${di}:${mi}`);
        stripped += 1;
        continue;
      }
      kept.push(item);
    }
    if (kept.length === 0) {
      notes.push(`${emptyNote}:${di}`);
      continue;
    }
    next.push({ ...d, means: kept });
  }
  return { dimensions: next, notes, stripped };
}

/** Density: strategy long enough + means≥2 per surviving dim. */
export function gateP4DimensionDensity(input: {
  dimensions: readonly {
    means?: unknown;
    strategy?: unknown;
  }[];
  notes?: string[];
}): {
  notes: string[];
  structural: boolean;
  structural_reason?: string;
} {
  const notes = [...(input.notes ?? [])];
  let thinDims = 0;
  let shortStrategy = 0;
  for (let di = 0; di < input.dimensions.length; di++) {
    const d = input.dimensions[di]!;
    const strategy = String(d.strategy ?? "").trim();
    const meansRaw = Array.isArray(d.means) ? d.means : [];
    const meanCount = meansRaw.filter((m) => meanTextOf(m).length > 0).length;
    if (strategy.length < P4_MIN_STRATEGY_CHARS) {
      shortStrategy += 1;
      notes.push(`p4_strategy_thin:${di}:${strategy.length}`);
    }
    if (meanCount < P4_MIN_MEANS_PER_DIM) {
      thinDims += 1;
      notes.push(`p4_means_thin:${di}:${meanCount}`);
    }
  }
  notes.push(
    `p4_density_thin_means_dims:${thinDims}`,
    `p4_density_short_strategy_dims:${shortStrategy}`,
  );
  if (thinDims > 0) {
    return {
      notes,
      structural: true,
      structural_reason: "p4_means_thin",
    };
  }
  if (shortStrategy >= Math.max(1, Math.ceil(input.dimensions.length / 2))) {
    return {
      notes,
      structural: true,
      structural_reason: "p4_density",
    };
  }
  return { notes, structural: false };
}

/** Strategy+means blob must cite mechanism — not atmosphere-only “纪元”. */
export function blobMentionsMoatMechanism(
  blob: string,
  cls: P4MoatMeansType,
): boolean {
  const t = blob ?? "";
  if (cls === "timing") {
    // Compress fill bans 大运/流年专名 — accept vernacular era markers too.
    const hasEra =
      /大运|岁运|流年|运程|阶段窗|纪元|岁环|运势|时机窗口|气候交织|阶段气候|较长阶段|这一年|能量交织|未熟|守成窗口|运岁|阶段节奏|最佳窗口/.test(
        t,
      );
    if (!hasEra) return false;
    // Feeling-window alone is not timing moat.
    if (
      /感觉.{0,8}安定|内心更安定|不那么焦躁/.test(t) &&
      !/转折|切换|窗口|起运|交运|后移|守成|加码|未熟/.test(t)
    ) {
      return false;
    }
    return /多久|转折|切换|窗口|起运|交运|换运|阶段切换|等待|再图|节奏变化|运势转折|岁运交接|策略切换|节点后移|守成|加码|未熟|最低接触|破窗/.test(
      t,
    );
  }
  if (cls === "polarity") {
    return /用神|忌神|喜神|补泄|补给|消耗|虚旺|五行|靠近|远离|补泻/.test(t);
  }
  return /(比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印|十神|官杀|格局|借势|开创|角色|角色定位|官杀气质|技术输出|观察守序|站位)/.test(
    t,
  );
}

function dimStrategyMeansBlob(dim: {
  means?: unknown;
  chart_anchors?: unknown;
  strategy?: unknown;
}): string {
  const strategy = String(dim.strategy ?? "");
  const anchors = Array.isArray(dim.chart_anchors)
    ? dim.chart_anchors.map(String).join(" ")
    : "";
  const meansBits: string[] = [];
  if (Array.isArray(dim.means)) {
    for (const m of dim.means) {
      if (typeof m === "string") meansBits.push(m);
      else if (m && typeof m === "object") {
        const o = m as Record<string, unknown>;
        meansBits.push(String(o.text ?? o.body ?? o.action ?? ""));
      }
    }
  }
  return `${strategy}\n${anchors}\n${meansBits.join("\n")}`;
}

/**
 * Batch3 B: strategy+means must carry ≥2 moat *mechanism* classes (when eligible),
 * and must not be dominated by P3 science-execution stems.
 */
export function gateP4StrategyMoat(input: {
  dimensions: readonly {
    means?: unknown;
    chart_anchors?: unknown;
    strategy?: unknown;
  }[];
  eastern_calc_slice?: string | null;
  /** Optional P3 page prose for coarse echo detection. */
  p3_body_excerpt?: string | null;
  notes?: string[];
}): P4PageMoatGateResult {
  const notes = [...(input.notes ?? [])];
  const eligible = inferP4MoatEligibleTypes(input.eastern_calc_slice);
  const covered = new Set<P4MoatMeansType>();
  let scienceHitDims = 0;
  let coachPmHitDims = 0;

  for (const dim of input.dimensions) {
    const blob = dimStrategyMeansBlob(dim);
    for (const cls of ["timing", "polarity", "archetype"] as const) {
      if (blobMentionsMoatMechanism(blob, cls)) covered.add(cls);
    }
    if (P3_SCIENCE_EXEC.test(blob) || isP4ScienceExecMean(blob)) scienceHitDims += 1;
    // Same scale as softStrip — Eastern+soft-stem must not inflate coachPmHitDims.
    if (isP4CoachPmMean(blob)) coachPmHitDims += 1;
  }

  const eligibleList = [...eligible];
  const coveredList = [...covered];
  notes.push(
    `p4_strategy_moat_eligible:${eligibleList.join(",") || "(none)"}`,
    `p4_strategy_moat_covered:${coveredList.join(",") || "(none)"}`,
    `p4_strategy_science_dims:${scienceHitDims}`,
    `p4_strategy_coach_pm_dims:${coachPmHitDims}`,
  );

  // Coarse P3 body echo (optional excerpt)
  const p3 = (input.p3_body_excerpt ?? "").trim();
  if (p3.length >= 40 && input.dimensions.length >= 2) {
    const p4Join = input.dimensions.map((d) => dimStrategyMeansBlob(d)).join("\n");
    const norm = (s: string) => s.replace(/\s+/g, "").slice(0, 800);
    const A = norm(p4Join);
    const B = norm(p3);
    let inter = 0;
    const grams = new Set<string>();
    for (let i = 0; i < B.length - 1; i++) grams.add(B.slice(i, i + 2));
    for (let i = 0; i < A.length - 1; i++) {
      if (grams.has(A.slice(i, i + 2))) inter++;
    }
    const denom = Math.max(1, A.length - 1);
    const ratio = inter / denom;
    notes.push(`p4_body_echo_p3_ratio:${ratio.toFixed(2)}`);
    if (ratio >= 0.35) {
      return {
        notes,
        structural: true,
        structural_reason: "p4_body_echo_p3",
        eligible: eligibleList,
        covered: coveredList,
      };
    }
  }

  if (scienceHitDims >= 2 && covered.size < 2) {
    return {
      notes,
      structural: true,
      structural_reason: "p4_science_exec_means",
      eligible: eligibleList,
      covered: coveredList,
    };
  }

  // Coach/PM stems dominating means — even if strategy name-drops 补给/窗口.
  if (coachPmHitDims >= 2) {
    return {
      notes,
      structural: true,
      structural_reason: "p4_coach_pm_means",
      eligible: eligibleList,
      covered: coveredList,
    };
  }

  if (eligible.size >= 2) {
    const hit = eligibleList.filter((t) => covered.has(t)).length;
    if (hit < 2) {
      return {
        notes,
        structural: true,
        structural_reason: "p4_strategy_moat_thin",
        eligible: eligibleList,
        covered: coveredList,
      };
    }
  } else if (eligible.size === 1) {
    const only = eligibleList[0]!;
    if (!covered.has(only)) {
      return {
        notes,
        structural: true,
        structural_reason: "p4_strategy_moat_thin",
        eligible: eligibleList,
        covered: coveredList,
      };
    }
  }

  return {
    notes,
    structural: false,
    eligible: eligibleList,
    covered: coveredList,
  };
}

/**
 * Page-level moat coverage: when eastern slice supports ≥2 moat classes, means across
 * all dimensions must cover ≥2 of those eligible classes. Thin data → do not invent.
 * Also runs gateP4StrategyMoat (mechanism semantics + anti P3 echo).
 */
export function gateP4PageMoatCoverage(input: {
  dimensions: readonly {
    means?: unknown;
    chart_anchors?: unknown;
    strategy?: unknown;
  }[];
  eastern_calc_slice?: string | null;
  p3_body_excerpt?: string | null;
  notes?: string[];
}): P4PageMoatGateResult {
  const notes = [...(input.notes ?? [])];
  const eligible = inferP4MoatEligibleTypes(input.eastern_calc_slice);
  const covered = new Set<P4MoatMeansType>();

  for (const dim of input.dimensions) {
    const anchors = Array.isArray(dim.chart_anchors)
      ? dim.chart_anchors.map((a) => String(a))
      : [];
    const strategy = String(dim.strategy ?? "");
    const { kept } = classifyMeansList(dim.means, anchors, strategy, notes);
    for (const k of kept) {
      if (isP4MoatMeansType(k.type)) covered.add(k.type);
    }
  }

  const eligibleList = [...eligible];
  const coveredList = [...covered];
  notes.push(
    `p4_moat_eligible:${eligibleList.join(",") || "(none)"}`,
    `p4_moat_covered:${coveredList.join(",") || "(none)"}`,
  );

  if (eligible.size >= 2) {
    const hit = eligibleList.filter((t) => covered.has(t)).length;
    if (hit < 2) {
      return {
        notes,
        structural: true,
        structural_reason: "p4_missing_moat_means",
        eligible: eligibleList,
        covered: coveredList,
      };
    }
  } else if (eligible.size === 1) {
    const only = eligibleList[0]!;
    if (!covered.has(only)) {
      return {
        notes,
        structural: true,
        structural_reason: "p4_missing_moat_means",
        eligible: eligibleList,
        covered: coveredList,
      };
    }
  }

  const strategyMoat = gateP4StrategyMoat({
    dimensions: input.dimensions,
    eastern_calc_slice: input.eastern_calc_slice,
    p3_body_excerpt: input.p3_body_excerpt,
    notes: [],
  });
  notes.push(...strategyMoat.notes);
  if (strategyMoat.structural) {
    return {
      notes,
      structural: true,
      structural_reason: strategyMoat.structural_reason,
      eligible: eligibleList,
      covered: coveredList,
    };
  }

  return {
    notes,
    structural: false,
    eligible: eligibleList,
    covered: coveredList,
  };
}

/**
 * Note stamped moat types whose strategy+means still lack mechanism markers.
 * Does NOT append template seeds — that previously faked gate coverage
 * (「按借势角色定位推进，不开创硬刚」) while coach stems stayed intact.
 */
export function noteP4MissingMoatMechanism(
  root: Record<string, unknown>,
): string[] {
  const notes: string[] = [];
  const dimsRaw = root.dimensions ?? root.dims_list ?? root.angles;
  if (!Array.isArray(dimsRaw)) return notes;

  for (let di = 0; di < dimsRaw.length; di++) {
    const d = dimsRaw[di];
    if (!d || typeof d !== "object" || Array.isArray(d)) continue;
    const dim = d as Record<string, unknown>;
    const meansRaw = Array.isArray(dim.means) ? dim.means : [];
    if (meansRaw.length === 0) continue;
    const strategy = String(dim.strategy ?? "");
    for (let mi = 0; mi < meansRaw.length; mi++) {
      const { text, declared } = asMeansText(meansRaw[mi] as RawMeansItem);
      if (!text || !declared || !isP4MoatMeansType(declared)) continue;
      const blob = `${strategy}\n${text}`;
      if (blobMentionsMoatMechanism(blob, declared)) continue;
      notes.push(`p4_moat_mechanism_missing:${di}:${mi}:${declared}`);
    }
  }
  return notes;
}

/** @deprecated Prefer noteP4MissingMoatMechanism — seed append removed (gate theater). */
export function enrichP4StampedMeansVernacular(
  root: Record<string, unknown>,
): string[] {
  return noteP4MissingMoatMechanism(root);
}

/**
 * Code guarantee: deep assign already locked path → moat_class.
 * Stamp means.type from that table before sanitize/moat gates so coverage
 * does not depend on the model copying type into JSON.
 *
 * Mutates a shallow-cloned dimensions list on the page root; returns notes.
 */
export function stampP4MeansTypesFromDeepPlan(
  root: Record<string, unknown>,
  plan: {
    page?: string;
    units: readonly { path: string; moat_class?: P4MoatMeansType | null }[];
  } | null | undefined,
): string[] {
  const notes: string[] = [];
  if (!plan?.units?.length) return notes;
  if (plan.page && plan.page !== "metaphysics_action") return notes;

  const locks = new Map<number, P4MoatMeansType>();
  for (const u of plan.units) {
    if (!u.moat_class || !isP4MoatMeansType(u.moat_class)) continue;
    const m = /dimensions\[(\d+)\]/.exec(u.path);
    if (!m) continue;
    locks.set(Number(m[1]), u.moat_class);
  }
  if (locks.size === 0) return notes;

  const dimsRaw = root.dimensions ?? root.dims_list ?? root.angles;
  if (!Array.isArray(dimsRaw) || dimsRaw.length === 0) return notes;

  const nextDims = dimsRaw.map((d, i) => {
    const moat = locks.get(i);
    if (!moat) return d;
    if (!d || typeof d !== "object" || Array.isArray(d)) return d;
    const dim = { ...(d as Record<string, unknown>) };
    const meansRaw = Array.isArray(dim.means) ? [...dim.means] : [];
    if (meansRaw.length === 0) {
      notes.push(`p4_moat_type_stamp_skip_empty:${i}:${moat}`);
      return dim;
    }

    // Stamp *all* means of this locked dim to assign moat_class (type coverage SSOT).
    const stampedMeans = meansRaw.map((item, mi) => {
      if (typeof item === "string") {
        const text = item.trim();
        if (!text) return item;
        const prev = "";
        notes.push(
          prev
            ? `p4_moat_type_stamped:${i}:${mi}:${prev}->${moat}`
            : `p4_moat_type_stamped:${i}:${mi}:${moat}:str`,
        );
        return { text, type: moat };
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const text = String(o.text ?? o.body ?? o.action ?? "").trim();
        if (!text) return item;
        const prev = String(o.type ?? "").trim().toLowerCase();
        if (prev === moat) {
          notes.push(`p4_moat_type_already:${i}:${mi}:${moat}`);
          return item;
        }
        notes.push(
          prev
            ? `p4_moat_type_stamped:${i}:${mi}:${prev}->${moat}`
            : `p4_moat_type_stamped:${i}:${mi}:${moat}:obj`,
        );
        return { ...o, text, type: moat };
      }
      return item;
    });

    dim.means = stampedMeans;
    return dim;
  });

  if (Array.isArray(root.dimensions)) root.dimensions = nextDims;
  else if (Array.isArray(root.dims_list)) root.dims_list = nextDims;
  else if (Array.isArray(root.angles)) root.angles = nextDims;
  else root.dimensions = nextDims;

  return notes;
}

