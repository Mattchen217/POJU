/**
 * Segment-2 Call A parallel split:
 *   A-dims (xhigh) ∥ A-spine (xhigh) → merge → A-voice (high)
 *
 * Keeps UI as one breakthrough-core job; orchestration lives in the runner.
 */

import type {
  BreakthroughCore,
  DimensionReckoning,
  EnergyRetuneFrame,
  KeyCrossroadsFrame,
  ModernActionFrame,
  POJUAgentState,
  RhythmFrame,
} from "@/lib/poju/agent-state";
import { formatSegment1UnderstandingForPrompt } from "@/lib/poju/agent-state";
import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import { POJU_IDENTITY, POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { formatBaseAnalysisForPrompt, normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import { resolveAgendaRelationContext } from "@/lib/llm/prompts/relation-closed-set-context";
import { stripRedlineShenshaFromStructured } from "@/lib/glossary/strip-redline-shensha";
import { extractJson, tolerantJsonRepair, tryParseJsonObject } from "@/lib/llm/phases/phase-transport";
import {
  mapBreakthroughCorePayload,
  parseSanitizeBreakthroughCore,
} from "@/lib/llm/deepseek/breakthrough-core";

const SHARED_RECKONING_LAWS = `# 真算三铁律(违反=产品跑偏)
【铁律1】以 desired_outcome 为透镜选维度,绝不锚死用户当前手段。
【铁律2】全维度从命理找依据,再落回现实(工作/决策/性情/关系/时机等按问题类型覆盖)。
【铁律3】命理只解释机制,绝不发明事实;不足标 needs_validation。
命理词只用本次 structured 实例;严禁集外神煞。每条结论可追溯到 structured。
骨架字段一律中文写(内部数据);response 才跟 locale。`;

/** A-dims — multi_dimension_reckoning only (xhigh). */
export const DEEP_RECKONING_DIMS_TASK = `# 角色：多维真算师 · 维度腿（只发散）
【本腿唯一产出：multi_dimension_reckoning】。不要写 energy_structure / situation_conclusion / key_crossroads / frames / response / agenda。
${SHARED_RECKONING_LAWS}

# 任务
先认清问题类型,按类型从命理【多个维度】分别真算,每维一个判断——【绝不】只抓一个点,也【绝不】收敛主辅方向。
- 工作/事业:十神格局→谋生性质;身强弱+用神→独立/依托;大运→攻守;财星→求财;性情→决策盲区;八字宜忌→适合/不适合哪类工作。
- 感情/婚姻:配偶星、桃花、日主性情、大运关系能量等。
- 财富:财星、食伤生财、大运财运、身财平衡等。
- 决策/选择:十神倾向、用神方向、性情盲区等。
各维 judgment 必须彼此不同;chart_basis 点 structured 锚点。

# 篇幅
建议 5–8 维(宁多勿少、勿注水)。每维:dimension 短名 / chart_basis ≤40字 / judgment 2–4句。

# 输出（严格 JSON）
{"multi_dimension_reckoning":[{"dimension":"...","chart_basis":"...","judgment":"..."}]}
【禁止】其它键、markdown 围栏、primary_path/backup_path/agenda。`;

/** A-spine — structure frames without dims / response (xhigh). */
export const DEEP_RECKONING_SPINE_TASK = `# 角色：多维真算师 · 脊柱腿（处境与骨架）
【本腿产出骨架,不含 multi_dimension_reckoning、不含 response】。多维判断由并行另一腿产出,你不要写那张表。
${SHARED_RECKONING_LAWS}

# 职责边界(硬)
- 本腿是【发散观察 + 假设骨架】:写清他是谁、卡在哪、分岔是什么、可能怎么调、节奏怎么切。
- 【不定主辅】:禁止 primary_path / backup_path;modern_action_frames 一律 status:"hypothesis",彼此并列,不说"最建议这条"。
- key_crossroads / energy_retune_frame / rhythm_frame 是给下游(收集/汇总/交付)用的内部骨架,不是给用户念的报告;字段可裸命理词。
- 严禁写具体行动步骤(每天半小时/约谁喝茶…)——那是交付段;timing_ripeness 只写进/守/转条件,不报具体日期。

# 任务字段
0. energy_structure:能量本质/补给/格局感/环境——只讲他是谁(不讲这次问题、不讲怎么调频)。
1. situation_conclusion:困境的结构性原因+阶段趋势(进/守/转);2–4短段,每段≤120字。
2. key_crossroads:{real_fork,path_costs,decision_traits,structural_basis,needs_validation}
   ——真正的分岔与代价;needs_validation=要把分岔变成可落地判断还缺什么现实证据。
3. modern_action_frames:0–3 条【假设】行动骨架(status=hypothesis);每条含 direction/why_fits/structural_basis/needs_validation;本段【不定】主辅。
4. energy_retune_frame:{direction_fit,timing_ripeness,daily_retune,complementary,structural_basis,needs_validation,status:"hypothesis"}
   ——只讲往哪调/靠近避开什么,不讲时序细节。
5. rhythm_frame:{phase1_observe,phase2_adjust,phase3_consolidate}
   ——只讲30天三段节拍(先做什么动作感/再加什么/再固定什么),勿复述 retune 的"养能量"内容。
6. self_check_signals:≥3 条白话自检信号(用户可自测的体感/行为信号)。

# 输出（严格 JSON）
{
  "energy_structure":"...",
  "situation_conclusion":"...",
  "key_crossroads":{"real_fork":"...","path_costs":"...","decision_traits":"...","structural_basis":"...","needs_validation":"..."},
  "modern_action_frames":[{"direction":"...","why_fits":"...","structural_basis":"...","needs_validation":"...","status":"hypothesis"}],
  "energy_retune_frame":{"direction_fit":"...","timing_ripeness":"...","daily_retune":"...","complementary":"...","structural_basis":"...","needs_validation":"...","status":"hypothesis"},
  "rhythm_frame":{"phase1_observe":"...","phase2_adjust":"...","phase3_consolidate":"..."},
  "self_check_signals":["...","...","..."]
}
【禁止】multi_dimension_reckoning / response / primary_path / backup_path / agenda / first_question。`;

/** A-voice — user-facing response only (high). */
export const DEEP_RECKONING_VOICE_TASK = `# 角色：多维观察讲述（只写 response）
你拿到【已合并的方案骨架 JSON】——其中 multi_dimension_reckoning 是真算核心。不要改骨架、不要提问、不定主辅方向。
唯一产出:给用户看的 response——像一位克制而有力的顾问当面把处境讲透。

# 你必须完成的两段(自然衔接,禁报告小标题/编号清单)
1. 【分析处境】基于 situation_conclusion(+必要时 key_crossroads.real_fork):大白话说清"你为什么卡在这里"。口语、有温度,承接用户真实压力;但每一句都要站得住(来自骨架,不是空安慰)。
2. 【讲多维观察】把 multi_dimension_reckoning 里【每一个维度】都翻成一句可读的白话观察,再串成连贯段落——让用户感到"你从好几个侧面看透了我",而不是只共情两句就停。
   - 覆盖表里≥80%的维度(维数≤5则【全部】覆盖;维数>5至少覆盖5个不同侧面)。
   - 各维判断必须彼此不同:禁止同一句换皮;禁止只抓一个点讲到底。
   - 只讲观察,不给方向、不收敛成一主一辅、不写行动步骤/调频处方/30天细节(那些是下游的事)。

# 篇幅(硬下限 · 达不到=失败)
- 中文:【至少 320 字,目标 400–560 字】;英文:【至少 220 words,目标 260–360 words】。
- 短段+空行;像说话,不像报告。
- 【禁止】只写一段共情开场就结束——若字数不够,回去补多维观察,不要灌水形容词。

# 合规语言(硬)
- 纯白话、零裸命理词、零 ⟦t:…⟧ 标记;跟用户 locale 写。
- 凡从命理得出的判断,用【依据感前缀 + 白话结论】:
  前缀只用能量类词:从你的【能量底座】看 / 从你的【能量结构】看 / 按你的【先天配置】 / 你的【底层结构】里……
  结论必须具体、可感,对应骨架里的 judgment / situation_conclusion。【严禁】给一句万能安慰套"从能量底座看"的壳。
- 【禁词】身弱身强、食伤/食神/伤官、官杀/正官/七杀、财星、用神/喜神/忌神、印星/比劫、大运/流年/换运、贵人运/桃花运、日主/五行、合冲刑害、旺衰、命盘/八字/算命/命里/命中注定……
- 【禁止】提问、yes/no 过场、「我最建议你走这条」、破局方向编号、### / **加粗**。
- 结尾可自然收束("接下来还得看你的实际情况"),但【不提具体问题】——提问是议程调用的事。

# 写完自检(心里过一遍再交)
① 用户读完能否说出"他至少从 X、Y、Z 三个不同侧面看了我"?不能→补维。
② 是否只剩情绪安抚、没有结构洞察?是→重写。
③ 有没有普通人看不懂或算命味的词?有→换成带依据感的白话。
④ 字数是否达到硬下限?否→补多维,勿灌水。

# 输出（严格 JSON）
{"response":"..."}
【禁止】其它键、markdown 围栏。`;

function buildSharedChartUserBlock(input: {
  base_analysis: unknown | null;
  agent_v2: POJUAgentState | null | undefined;
  original_question: string;
  locale: string;
}): {
  systemBase: string;
  userHead: string;
  factGuard: string;
} {
  const { base_analysis, agent_v2, original_question, locale } = input;
  if (base_analysis == null) {
    throw new Error("[segment2-a] structured 命盘为空");
  }
  const bundle = normalizeBaseAnalysisInput(base_analysis);
  const structured = bundle.structured ?? null;
  if (structured == null) {
    throw new Error("[segment2-a] structured 命盘为空");
  }
  const cleanStructured = stripRedlineShenshaFromStructured(structured);
  const questionCategory = agent_v2?.question_category ?? null;
  const { directedDynamic, directedInventoryBlock } = resolveAgendaRelationContext(
    cleanStructured,
    questionCategory,
  );
  const contextText = (() => {
    if (!agent_v2) return "（尚无结构化 agent_v2 语境，仅依赖问题。）";
    try {
      return formatContextForPrompt(agent_v2);
    } catch {
      return "（语境结构不完整，已省略格式化块。）";
    }
  })();
  const baseStr = formatBaseAnalysisForPrompt(base_analysis, locale, {
    includeInterpretive: false,
  });
  const factGuard = buildChatFactGuardBlock(cleanStructured, {
    directedRelations: directedDynamic,
    verbose: true,
  });
  const segment1 = agent_v2 ? formatSegment1UnderstandingForPrompt(agent_v2) : "（第1段理解门字段尚未写入。）";
  const systemBase = stitchPromptSections(
    POJU_IDENTITY,
    POJU_KNOWLEDGE_ROOTS,
    buildOutputPolicyForPoju(),
    directedInventoryBlock,
    buildStructuredInstanceInventory(cleanStructured),
  );
  const userHead = `【locale】${locale}

【第1段理解门产出（推演靶心 · 必须显式扣住）】
${segment1}

【能量底座 Layer1（structured + 技术事实 refs/climate · 无通用解读）】
${baseStr}

【用户原始问题】
"${original_question}"

【问题类别】
${questionCategory ?? "other"}

【收集到的具体上下文】
${contextText}

${factGuard}`;
  return { systemBase, userHead, factGuard };
}

export function buildBreakthroughCoreDimsPrompt(input: {
  base_analysis: unknown | null;
  agent_v2: POJUAgentState | null | undefined;
  original_question: string;
  locale: string;
}): { system: string; user: string } {
  const { systemBase, userHead } = buildSharedChartUserBlock(input);
  return {
    system: stitchPromptSections(systemBase, DEEP_RECKONING_DIMS_TASK),
    user: `${userHead}

【任务 · Call A · dims】
只输出 multi_dimension_reckoning JSON。禁止其它骨架字段与 response。`,
  };
}

export function buildBreakthroughCoreSpinePrompt(input: {
  base_analysis: unknown | null;
  agent_v2: POJUAgentState | null | undefined;
  original_question: string;
  locale: string;
}): { system: string; user: string } {
  const { systemBase, userHead } = buildSharedChartUserBlock(input);
  return {
    system: stitchPromptSections(systemBase, DEEP_RECKONING_SPINE_TASK),
    user: `${userHead}

【任务 · Call A · spine】
输出 energy_structure / situation_conclusion / key_crossroads / modern_action_frames? / energy_retune_frame / rhythm_frame / self_check_signals。
【禁止】multi_dimension_reckoning / response / agenda。`,
  };
}

export function buildBreakthroughCoreVoicePrompt(input: {
  merged_core: BreakthroughCore;
  original_question: string;
  locale: string;
}): { system: string; user: string } {
  const coreJson = JSON.stringify(
    {
      energy_structure: input.merged_core.energy_structure,
      situation_conclusion: input.merged_core.situation_conclusion,
      key_crossroads: input.merged_core.key_crossroads,
      multi_dimension_reckoning: input.merged_core.multi_dimension_reckoning,
      modern_action_frames: input.merged_core.modern_action_frames,
      energy_retune_frame: input.merged_core.energy_retune_frame,
      rhythm_frame: input.merged_core.rhythm_frame,
      self_check_signals: input.merged_core.self_check_signals,
    },
    null,
    2,
  );
  return {
    system: stitchPromptSections(POJU_IDENTITY, buildOutputPolicyForPoju(), DEEP_RECKONING_VOICE_TASK),
    user: `【locale】${input.locale}

【用户原始问题】
"${input.original_question}"

【已合并方案骨架（唯一事实源 · 勿改写）】
${coreJson}

【任务 · Call A · voice】
只输出 {"response":"..."}。
硬要求:先处境分析,再把 multi_dimension_reckoning【逐维】翻成白话观察并串起来;中文≥320字/英文≥220 words;禁只写共情开场;禁提问;不定主辅。`,
  };
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const extracted = extractJson(content) || content;
  const repaired = tolerantJsonRepair(extracted);
  const parsed = tryParseJsonObject(repaired) ?? tryParseJsonObject(extracted);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

export function parseDimsPartial(content: string): DimensionReckoning[] {
  const o = parseJsonObject(content);
  if (!o) throw new Error("dims_partial_not_json");
  const raw = o.multi_dimension_reckoning;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("dims_partial_missing_multi_dimension_reckoning");
  }
  const dims: DimensionReckoning[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const dimension = typeof e.dimension === "string" ? e.dimension.trim() : "";
    const judgment = typeof e.judgment === "string" ? e.judgment.trim() : "";
    if (!dimension || !judgment) continue;
    dims.push({
      dimension,
      chart_basis: typeof e.chart_basis === "string" ? e.chart_basis.trim() : "",
      judgment,
    });
  }
  if (dims.length === 0) throw new Error("dims_partial_empty_after_map");
  return dims;
}

export type SpinePartial = {
  energy_structure?: string;
  situation_conclusion: string;
  key_crossroads: KeyCrossroadsFrame;
  modern_action_frames?: ModernActionFrame[];
  energy_retune_frame: EnergyRetuneFrame;
  rhythm_frame: RhythmFrame;
  self_check_signals: string[];
};

export function parseSpinePartial(content: string): SpinePartial {
  const o = parseJsonObject(content);
  if (!o) throw new Error("spine_partial_not_json");
  // Reuse full mapper with a stub dim so required fields validate.
  const stubbed = {
    ...o,
    multi_dimension_reckoning: [
      { dimension: "__merge_stub__", chart_basis: "", judgment: "__merge_stub__" },
    ],
    response: typeof o.response === "string" ? o.response : "",
    _parse_salvaged: true,
  };
  const mapped = mapBreakthroughCorePayload(stubbed);
  const core = mapped.breakthrough_core;
  return {
    energy_structure: core.energy_structure,
    situation_conclusion: core.situation_conclusion,
    key_crossroads: core.key_crossroads,
    modern_action_frames: core.modern_action_frames,
    energy_retune_frame: core.energy_retune_frame,
    rhythm_frame: core.rhythm_frame,
    self_check_signals: core.self_check_signals,
  };
}

export function mergeSegment2APartials(input: {
  dims: DimensionReckoning[];
  spine: SpinePartial;
  response?: string;
}): BreakthroughCore {
  const mergedPayload = {
    energy_structure: input.spine.energy_structure ?? "",
    situation_conclusion: input.spine.situation_conclusion,
    key_crossroads: input.spine.key_crossroads,
    multi_dimension_reckoning: input.dims,
    modern_action_frames: input.spine.modern_action_frames ?? [],
    energy_retune_frame: input.spine.energy_retune_frame,
    rhythm_frame: input.spine.rhythm_frame,
    self_check_signals: input.spine.self_check_signals,
    response: input.response?.trim() || "",
    _parse_salvaged: true,
  };
  return mapBreakthroughCorePayload(mergedPayload).breakthrough_core;
}

export function parseVoiceResponse(content: string): string {
  const o = parseJsonObject(content);
  if (!o) throw new Error("voice_partial_not_json");
  const response = typeof o.response === "string" ? o.response.trim() : "";
  if (!response) throw new Error("voice_partial_empty_response");
  return response;
}

/** When voice wall is gone — build a compliant-enough interim from dims. */
export function fallbackVoiceFromDims(
  dims: DimensionReckoning[],
  situation: string,
  locale: string,
): string {
  const zh = !locale || locale.startsWith("zh");
  const lead = zh
    ? "从你的能量结构看，眼下这件事不是单一卡点，而是几条底层配置叠在一起。"
    : "From your energy structure, this isn’t a single snag — several base patterns are stacking.";
  const sit = situation.trim().slice(0, 160);
  const lines = dims.slice(0, 4).map((d) => {
    const j = d.judgment.replace(/\s+/g, " ").trim().slice(0, 120);
    return zh ? `· ${j}` : `· ${j}`;
  });
  return [lead, sit, "", ...lines].filter(Boolean).join("\n\n");
}

export function finalizeMergedCallA(contentOrCore: BreakthroughCore | string, locale: string): {
  breakthrough_core: BreakthroughCore;
} {
  if (typeof contentOrCore === "string") {
    return { breakthrough_core: parseSanitizeBreakthroughCore(contentOrCore, locale).breakthrough_core };
  }
  // Re-run sanitize path via JSON round-trip for response compliance.
  const asJson = JSON.stringify({
    energy_structure: contentOrCore.energy_structure,
    situation_conclusion: contentOrCore.situation_conclusion,
    key_crossroads: contentOrCore.key_crossroads,
    multi_dimension_reckoning: contentOrCore.multi_dimension_reckoning,
    modern_action_frames: contentOrCore.modern_action_frames,
    energy_retune_frame: contentOrCore.energy_retune_frame,
    rhythm_frame: contentOrCore.rhythm_frame,
    self_check_signals: contentOrCore.self_check_signals,
    response: contentOrCore.response ?? "",
  });
  return { breakthrough_core: parseSanitizeBreakthroughCore(asJson, locale).breakthrough_core };
}
