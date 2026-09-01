/**
 * User-facing expression contract block for phase taskBlocks.
 * SSOT: `.cursor/docs/全局用户可见表达契约-映射表-SSOT.md`
 * Mapping rows: `lib/glossary/vernacular-mapping-ssot.ts`
 *
 * Do NOT inject into POJU_IDENTITY / ungated control plane (phase isolation).
 */

import { formatVernacularMappingForPrompt } from "@/lib/glossary/vernacular-mapping-ssot";
import { formatDayunSemanticForPrompt } from "@/lib/glossary/dayun-semantic-ssot";
import {
  formatTenGodPolicyForPrompt,
  formatTenGodSemanticForPrompt,
} from "@/lib/glossary/tengod-semantic-ssot";

export type ExpressionContractPreset =
  | "voice"
  | "agenda"
  | "collecting"
  | "delivery"
  | "opening"
  | "synthesis";

/** Mapping subsets by phase — keep small for prompt cost / cache hygiene. */
export const EXPRESSION_CONTRACT_MAPPING_IDS: Record<
  ExpressionContractPreset,
  readonly string[]
> = {
  voice: [
    "fire_overheat",
    "water_thin_buffer",
    "wood_scorched",
    "night_forced_wake",
    "authority_pressure",
    "yin_restore",
    "thin_capacity",
    "pressure_band",
    "yong_restore_direction",
    "retune_cadence",
  ],
  agenda: [
    "fire_overheat",
    "night_forced_wake",
    "authority_pressure",
    "thin_capacity",
    "yin_restore",
    "retune_cadence",
  ],
  /** Collecting / opening: contract summary only — no mapping dump. */
  collecting: [],
  opening: [],
  /**
   * Synthesis: direction / why_fits / action_plan are user-visible downstream.
   * Short stress/capacity subset only (cache hygiene).
   */
  synthesis: [
    "authority_pressure",
    "thin_capacity",
    "yin_restore",
    "yong_restore_direction",
    "pressure_band",
    "retune_cadence",
  ],
  /**
   * Delivery body (finalize core_conclusion + narrative body/scan/table).
   * Broader subset: 格局/强弱/用神调候 → 精力/行为系统映射.
   * Does NOT apply to evidence / 「依据与推理」.
   */
  delivery: [
    "fire_overheat",
    "water_thin_buffer",
    "wood_scorched",
    "night_forced_wake",
    "authority_pressure",
    "yin_restore",
    "output_rumination",
    "peer_friction",
    "thin_capacity",
    "pressure_band",
    "yong_restore_direction",
    "retune_cadence",
  ],
};

const CONTRACT_CORE = `# 用户可见表达契约（东方内核 · 行为/精力白话 · 受控映射）
定位:引擎可真算命理;用户看见的是现代行为/精力/决策语言。不是占卜摊,也不是医疗 App。
铁律:
1. 正文禁裸命理专名(十神原名、干支连写、子丑寅时辰名、生克四字格、神煞原名、大运/流年/命盘/八字…).
2. 判断用「能量底座/能量结构/先天配置/底层结构」类依据感 + 可观察结论;必须真对应骨架/structured(禁套壳).
3. 科学/生理词只能来自下方【受控映射】(若有);表外禁止临场发明皮质醇/交感神经检测故事.
4. 可用框架性压力-恢复叙事,禁止伪化验/确诊口吻;禁止定命与具体日期点位预测.
5. 拼音品牌调味(BAZI/QI/WUXING…)允许且首次附英文 gloss;不等于可以裸写命理专名.
6. 金木水火土可作 WUXING 意象/气质词;【禁止】用神调候黑话「补水/补木/补水木/补水补木」——改写为映射语(重建恢复:睡眠、偏冷静环境、放慢节奏…).
反例不合格:「丑时湿土本应收敛」/「火旺木焚所以…」/「给系统补水补木」/「你的皮质醇检测显示…」/全篇通用鸡汤丢掉可追溯判断.`;

export type BuildUserFacingExpressionContractOptions = {
  locale: string;
  /** Which phase preset (mapping subset). */
  preset: ExpressionContractPreset;
  /** Override mapping ids; empty array = no mapping table. */
  mappingIds?: readonly string[];
  /**
   * Optional chart-sliced ten-god names (synthesis/delivery only).
   * When omitted, delivery/synthesis still get compact tengod + dayun policy.
   */
  tenGodNames?: readonly string[];
  /** Optional hint text to select dayun phase polarity (e.g. timing / yong-ji). */
  dayunHint?: string;
};

/**
 * Compact block for VOICE / Call B / collecting task side.
 * Returns "" only if somehow misconfigured — normally always non-empty core.
 */
export function buildUserFacingExpressionContractBlock(
  opts: BuildUserFacingExpressionContractOptions,
): string {
  const ids =
    opts.mappingIds ?? EXPRESSION_CONTRACT_MAPPING_IDS[opts.preset] ?? [];
  const mapping = formatVernacularMappingForPrompt(ids, opts.locale);
  const phaseNotes: Record<ExpressionContractPreset, string> = {
    collecting:
      "本阶段:对话 response / options 全是用户可见——遵守契约;一般不展开全表映射.",
    opening:
      "本阶段:仅 response / options 对用户可见——遵守契约白话+禁裸命理专名;core_dilemma/desired_direction **一律第二人称「你」**(禁用「他/她」叙述当事人);字段用事实大白话;不展开全表映射.",
    agenda:
      "本阶段:agenda label / first_question / options 全是用户可见——遵守契约与映射.",
    synthesis: [
      "本阶段·汇总收敛(可见句 vs 内部锚):",
      "- 用户可见(进交付):direction / why_fits / action_plan →【严格遵守本契约】行为/精力白话+受控映射;禁十神原名/大运流年报幕.",
      "- 内部锚:structural_basis / needs_validation 可保留引擎短锚供下游,勿写成用户可见占卜句.",
      "why_fits 用「能量结构判断 + 用户现实」表述,禁止「十神格局X+大运Y」裸词模板.",
    ].join("\n"),
    delivery: [
      "本阶段·交付双层(Folded Technical Drawer):",
      "- main_body(core_conclusion / arguments[].body / scan / thirty_day_table):【严格遵守本契约】纯白话+受控映射;禁裸命理专名与表外生理发明.",
      "- technical_spine(bazi_basis / evidence /「依据与推理」折叠层):【本契约禁裸词不约束】允许闭集受控专业词与 ⟦w:⟧/⟦t:⟧;给用户展开硬核系统依据.",
      "禁止把依据层真词粘进 main_body;正文通俗可落地,展开有系统依据.",
      "【反物化】五行/用忌→状态属性(润/藏/缓冲/规划/发声/闭环/止损);禁止液态水/绿植/晒太阳/泥土食物/金属饰品等物件主叙事;依据禁止「缺水→去水边」物化因果.",
      "调频语义以 wuxing-semantic-ssot 为准(与校验同源);禁止情节范文教抄.",
      "大运/十神语义以 dayun-semantic-ssot + tengod-semantic-ssot 为准:阶段节奏非年份铁口;动力/负荷非吉凶人设.",
    ].join("\n"),
    voice:
      "本阶段:response 长文用户可见——熔合叙述时用映射语,禁止逐维裸词报幕.",
  };

  const matrixParts: string[] = [];
  if (opts.preset === "synthesis" || opts.preset === "delivery") {
    matrixParts.push(formatDayunSemanticForPrompt(opts.dayunHint));
    matrixParts.push(formatTenGodPolicyForPrompt());
    if (opts.tenGodNames && opts.tenGodNames.length > 0) {
      const sliced = formatTenGodSemanticForPrompt(opts.tenGodNames);
      if (sliced) matrixParts.push(sliced);
    }
  }

  return [CONTRACT_CORE, phaseNotes[opts.preset], mapping, ...matrixParts]
    .filter(Boolean)
    .join("\n\n");
}
