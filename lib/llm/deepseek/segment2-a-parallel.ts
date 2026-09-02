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
import { scrubInternalRetuneJargon } from "@/lib/poju/scrub-retune-jargon";
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
import { ensureSegment2CallAReadiness } from "@/lib/llm/deepseek/segment2-spine-readiness";
import { buildUserFacingExpressionContractBlock } from "@/lib/llm/prompts/user-facing-expression-contract";

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

# judgment 纪律（硬 · 备料不定稿）
- 只写结构机制、卡点如何叠在一起、对当下的解释力;【禁止】行动处方。
- 【禁止】judgment 里出现「你可以/你应该/建议/不妨试试/不妨/先把…当作副线/离职/创业/咨询/写作/协商/试水」等可执行动词。
- 具体手段、节奏表、30天细节留给汇总(synthesis)与交付;本腿只把维算全、算准,供 P2 论证与 P4 过滤选题。

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

# 六页备料（内部 · 本段只备料、不定稿）
本段 JSON 是六页交付的【原料池】,不是报告正文。分工:
- energy_structure + (并行腿)multi_dim → P2 foundation 论证
- situation_conclusion + key_crossroads → 供 synthesis 收敛 P1 直答(本段不定结论)
- modern_action_frames(hypothesis) → P3 science_action 候选; needs_validation 必填
- energy_retune_frame(hypothesis) → P4 metaphysics_action 候选; needs_validation 必填
- self_check_signals → 交付时拆 P5 负向 / P6 正向
- rhythm_frame → P6 signals_close 近阶节拍
- primary_path / backup_path / action_plan → 【仅 synthesis 产出;本段禁止】
VOICE 只给用户「被看透」的预告式理解,不能替交付定药方或定主辅。

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

# 这一步是什么(硬)
上游真算腿已经算完多维表——用户经历了【长等待】。你写的 response 是他此刻唯一看见的交付:
必须让他感到"等值得了":有分量、被看透、有温度——【不是】把多维表翻译成流水账念给他听。
你的工作=把表里的判断【重新组织】成一段或多段连贯、有温度的自然语言(像懂他的人当面讲清),用小节小标题托住结构。

唯一产出:response 字符串。

# 从「表」到「话」的写法(硬 · 核心)
1. 先在心里读完 multi_dimension_reckoning + situation_conclusion,找出对本题【最致命的 3–5 个洞察】与它们如何叠在一起造成当下卡住。
2. 再动笔:把这些洞察【熔进】自然语言——可以同一段里先后点到事业节奏、关系、身心、决策习惯等侧面,用转折/递进连起来("与此同时""更麻烦的是""这些叠在一起…")。
3. 【禁止】按表顺序一维一段;"从A看…从B看…从C看…"报幕;编号清单;把 judgment 原文略改语气就贴上。
4. 读感目标:用户合上屏能复述【一个总判断 + 两三个咬合在一起的侧面】,而不是"他讲了八个点"。
5. 温度来自贴他的处境与身体感受,锋利来自结构判断——两者都要;只有安慰或只有术语翻译都失败。

# 文章结构(硬 · 必须用小标题组织)
用 ### 小标题分成【正好 3 节】(标题跟 locale;中文例如下,英文自拟同构):
1. ### 你卡在哪里
   1–2 个扎实【段落】(每段多句连成片):承接真实压力后立刻说清结构性原因(situation_conclusion / real_fork)。禁整节只有共情。
2. ### 几个关键侧面
   用【1–3 个自然段】织入精选多维洞察(可选用 #### 或段首短题+冒号标侧面,但正文仍是连贯叙述)。
   - 精选 3–5 个最致命维度深织;其余最多一句带过。【禁止】表里每一维都开一段。
   - 只讲观察,不给方向、不定主辅、不写行动步骤/调频/30天细节/「补水补木」类配方。
3. ### 此刻真正要看清的
   一个收束段:点明存在多条分岔、多种压力叠在一起(来自 key_crossroads.real_fork / path_costs),以及「结构已看清、走法还缺现实对齐」这一事实。
   【禁止】替用户选好路、推荐「中间路线/最聪明的做法/我最建议你…」;
   【禁止】具体行动动词与手段预告:咨询/副业/写作/协商/离职/创业/转行/跳槽/试水/孵化/品牌/远程/备孕/结婚/Shadow/影子项目等;
   【禁止】把 modern_action_frames / rhythm_frame / energy_retune_frame 里的步骤或配方翻译成用户可见建议;
   【禁止】点名第三段要问的具体项(储蓄/市场/家人反对/每周几小时等)——最多一句「还要看你的实际情况」带过,不问具体问题。

节与节空一行;节内用完整段落(每段 2–5 句)。【禁止】一句一段、【禁止】一段只有一句套话。

# 反流水账(硬)
- 「从你的能量底座/能量结构/先天配置/底层结构看」全篇【最多 2 次】,其余直接说人话判断。
- 【禁止】检查清单/报幕/无 ### 的碎长文/三节重复同一句"先停下来喘气"。
- 若你发现自己在逐条翻译维度表——停下来,删掉重写成【熔合叙述】。

# 篇幅与分量(配得上长等待)
- 中文:【至少 360 字,目标 450–680 字】;英文:【至少 240 words,目标 300–450 words】。
- 要有信息密度:删掉任何一段后若不影响理解→说明原段是水,应合并或换成新洞察。
- 宁锋利简洁,勿同义反复。

# 合规语言(硬)
- 纯白话、零裸命理词、零 ⟦t:…⟧;跟 locale 写。
- 依据感前缀(限上列能量类词)必须真对应骨架 judgment,禁套壳安慰。
- 【禁词】身弱身强、食伤/食神/伤官、官杀/正官/七杀、财星、用神/喜神/忌神、印星/比劫、大运/流年/换运、贵人运/桃花运、日主、合冲刑害、旺衰、命盘/八字/算命/命里/命中注定、补水补木/补水木/补水/补木(作调候黑话)……
- 金木水火土可作 WUXING 气质意象(勿写成「补X」公式);「五行」二字勿作术语报幕。
- 【禁止】提问、yes/no、「我最建议你走这条」、破局方向编号、**加粗**正文。
- 必须用 ###(可选 ####)做小标题——为排版与阅读节奏,不是堆砌。

# 写完自检
① 三个 ### 小节是否齐全?
② 出声读第二节:像不像在念维度表?像→熔成自然语言重写。
③ 「从你的…看」是否≤2?一句一段是否已消灭?
④ 用户能否感到"长等待值了"(有总判断+咬合侧面),而不是"听完一串点"?
⑤ 是否仍不定方向、不提问、第三节无行动处方/无路线推荐?
⑥ 删掉命理依据后,VOICE 是否仍像通用职场/情感鸡汤?若是→加结构咬合,勿加行动建议。

# 输出（严格 JSON）
{"response":"..."}
【禁止】其它键、markdown 围栏(### 写在 response 字符串内即可)。`;
function buildSharedChartUserBlock(input: {
  base_analysis: unknown | null;
  agent_v2: POJUAgentState | null | undefined;
  original_question: string;
  locale: string;
  /** When set (Call A0 slice), replaces full structured JSON dump in user block. */
  calcSlice?: string;
}): {
  systemBase: string;
  userHead: string;
  factGuard: string;
} {
  const { base_analysis, agent_v2, original_question, locale, calcSlice } = input;
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

  const inventoryBlock = calcSlice?.trim()
    ? "【实例闭集】见 user 侧优先切片与兜底索引；禁止引用切片外实例。"
    : buildStructuredInstanceInventory(cleanStructured, { questionCategory });

  const systemBase = stitchPromptSections(
    POJU_IDENTITY,
    POJU_KNOWLEDGE_ROOTS,
    buildOutputPolicyForPoju(),
    calcSlice?.trim() ? directedInventoryBlock : directedInventoryBlock,
    inventoryBlock,
  );

  const calcBlock = calcSlice?.trim()
    ? `【优先真算切片 + 闭集兜底 · Call A0】\n${calcSlice.trim()}`
    : `【能量底座 Layer1（structured + 技术事实 refs/climate · 无通用解读）】\n${baseStr}`;

  const userHead = `【locale】${locale}

【第1段理解门产出（推演靶心 · 必须显式扣住）】
${segment1}

${calcBlock}

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
  calcSlice?: string;
}): { system: string; user: string } {
  const { systemBase, userHead } = buildSharedChartUserBlock(input);
  return {
    system: stitchPromptSections(systemBase, DEEP_RECKONING_DIMS_TASK),
    user: `${userHead}

【任务 · Call A · dims】
只输出 multi_dimension_reckoning JSON。若 A0 已给拟多维方向,须覆盖且 chart_basis 锚定切片闭集。
禁止其它骨架字段与 response。`,
  };
}

export function buildBreakthroughCoreSpinePrompt(input: {
  base_analysis: unknown | null;
  agent_v2: POJUAgentState | null | undefined;
  original_question: string;
  locale: string;
  calcSlice?: string;
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
  const expressionContract = buildUserFacingExpressionContractBlock({
    locale: input.locale,
    preset: "voice",
  });
  return {
    system: stitchPromptSections(
      POJU_IDENTITY,
      buildOutputPolicyForPoju(),
      DEEP_RECKONING_VOICE_TASK,
      expressionContract,
    ),
    user: `【locale】${input.locale}

【用户原始问题】
"${input.original_question}"

【已合并方案骨架（唯一事实源 · 勿改写）】
${coreJson}

【任务 · Call A · voice】
只输出 {"response":"..."}。
硬要求:这是长等待后的可见交付——把多维表【熔成】有温度的自然语言段落(非逐维报幕);三个 ### 小节;精选 3–5 维织入;「从你的…看」≤2次;中文≥360字;禁提问;不定主辅;第三节禁行动处方与路线推荐;遵守用户可见表达契约与受控映射。`,
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
  return scrubInternalRetuneJargon(response);
}

/** When voice wall is gone — build a compliant-enough interim from dims. */
export function fallbackVoiceFromDims(
  dims: DimensionReckoning[],
  situation: string,
  locale: string,
): string {
  const zh = !locale || locale.startsWith("zh");
  const lead = zh
    ? "眼下这件事不是单一卡点，而是几条底层配置叠在一起。"
    : "This isn’t a single snag — several base patterns are stacking.";
  const sit = situation.trim().slice(0, 160);
  const lines = dims.slice(0, 4).map((d) => {
    const j = d.judgment.replace(/\s+/g, " ").trim().slice(0, 120);
    return j;
  });
  const sides = lines.join(zh ? " " : " ");
  const close = zh
    ? "结构已经看清，但具体走法还缺你的现实对齐；此刻不必在脑子里一次性选死路。"
    : "The structure is clearer, but the path still needs your real-world alignment — you don’t have to lock one route in your head yet.";
  return [
    `### ${zh ? "你卡在哪里" : "Where you are stuck"}`,
    [lead, sit].filter(Boolean).join("\n\n"),
    "",
    `### ${zh ? "几个关键侧面" : "Key sides"}`,
    sides || (zh ? "几个侧面仍在叠压。" : "Several sides are still stacking."),
    "",
    `### ${zh ? "此刻真正要看清的" : "What to see clearly now"}`,
    close,
  ].join("\n");
}

export function finalizeMergedCallA(contentOrCore: BreakthroughCore | string, locale: string): {
  breakthrough_core: BreakthroughCore;
} {
  if (typeof contentOrCore === "string") {
    const parsed = parseSanitizeBreakthroughCore(contentOrCore, locale);
    return { breakthrough_core: ensureSegment2CallAReadiness(parsed.breakthrough_core) };
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
  const sanitized = parseSanitizeBreakthroughCore(asJson, locale);
  return { breakthrough_core: ensureSegment2CallAReadiness(sanitized.breakthrough_core) };
}
