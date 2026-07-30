/**
 * Block 2 Phase 3 — 深测算 pass（破局推理脊柱 + 议程倒推）
 * LLM 走 `POST /api/poju/breakthrough-core`；结果写入 `agent_v2.breakthrough_core` + `investigation_agenda`。
 */

import {
  formatSegment1UnderstandingForPrompt,
  type BreakthroughCore,
  type EnergyRetuneFrame,
  type KeyCrossroadsFrame,
  type ModernActionFrame,
  type POJUAgentState,
  type RhythmFrame,
} from "@/lib/poju/agent-state";
import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import { parseInvestigationAgenda, type AgendaFrameKind, type AgendaItem } from "@/lib/poju/investigation-agenda";
import type { POJUSessionState } from "@/lib/poju/types";
import { pollBreakthroughCoreJobUntilDone, XHIGH_JOB_POLL_MAX_MS } from "@/lib/poju/poll-segment2-xhigh-job";
import { loadSessionProfileBundle } from "@/lib/poju/session-profile";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { POJU_IDENTITY, POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { formatBaseAnalysisForPrompt, normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { extractJson, tolerantJsonRepair, tryParseJsonObject } from "@/lib/llm/phases/phase-transport";
import { normalizeAgendaFromLlm } from "@/lib/poju/opening-conversion-payload";
import { sanitizeReplyOptions } from "@/lib/poju/reply-options";
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import { resolveAgendaRelationContext } from "@/lib/llm/prompts/relation-closed-set-context";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { RelationLabel } from "@/lib/calculations/relation-engine";
import {
  auditPaymentLeakResiduals,
  buildTermMarkingPromptBlock,
  degradeMarkersToPlain,
  sanitizePaymentAuditLeaks,
  type ComplianceViolation,
} from "@/lib/llm/sanitize/compliance-terms";
import { buildDualLayerDeliveryPromptBlock } from "@/lib/llm/prompts/dual-layer-delivery";
import { isCriticalDeliveryAuditFailure } from "@/lib/llm/services/delivery-audit-regen";

/**
 * Call A (xhigh) — 6-frame skeleton (backend) + user-facing `response`
 * (analysis + breakthrough directions in natural language; NO questions).
 * Agenda / first_question belong to Call B.
 */
export const DEEP_RECKONING_REPORT_TASK = `# 角色：破局总设计师（真算 · 分析 + 破局方向）

你不是在跟用户闲聊寒暄。你先对【真实排算出的命盘结构】和他的问题做冷静、硬核、不注水的深度推演，
产出后续流程的【唯一推理脊柱】（6类骨架，后台用）。同时，把【分析 + 破局方向】用【自然语言】讲给用户听——
不是报告小标题清单，而是像高人跟你说话。稍后另一次调用会据此倒推议程并提问；
本次【只产出骨架 + response（分析+方向）】，【禁止】输出 investigation_agenda / first_question，【禁止】在 response 里提问。

# 输入（structured + core_judgments 是你唯一的事实源）
- day_master / pattern / strength / yong_shen / xi_shen / ji_shen
- four_pillars 与 pillars_detail.{year|month|day|hour}.{ten_god, hidden_stems, shen_sha, life_stage}
- da_yun（当前走到第几步、主题、何时转）
- core_judgments（已裁定展开：identity_anchor / drive_mechanism / structural_gap / balance_anchor / exchange_mode / leverage_state / climate_now）——**以它统一口径，禁止改判 structured**
- 用户原始问题 + 已确认处境（第1段他说过的具体词句）

# 任务:产出【方案骨架】(覆盖后续交付6段,但只出骨架不出具体步骤)

你要基于命盘 + 用户问题,推理出一套【破局方案的骨架】。
【骨架】= 方向 + 命理为什么 + 需验证什么现实证据。
【不是】具体行动步骤("每天半小时""约谁喝茶")——那是收集信息后第4段的事,
现在给具体步骤必然是万能模板,会毁掉价值。你只出骨架。

产出这6类(对应最终交付的6段):

1. situation_conclusion(处境洞察):
   把困境翻译成结构性原因,点名 structured 具体字段;直答他问题的阶段趋势(进/守/转)。

2. key_crossroads(关键抉择):
   - real_fork:这个问题真正的分岔点(往往不是用户以为的A还是B,而是更深一层);
   - path_costs:每条路径的能量代价与收益(命理视角);
   - decision_traits:他这类人做这种决定的天生优势与盲区;
   - structural_basis:命理依据;
   - needs_validation:要确认这个抉择,还需要知道他的什么现实情况?

3. modern_action_frames(现代行动方案骨架,2-3条):每条 {
   - direction:一个行动方向(骨架,如"靠专业深度建立壁垒",不是具体步骤);
   - why_fits:为什么这个方向适合他这个问题(可以用现实/行为角度表述,但根在命理);
   - structural_basis:命理为什么(食伤为用/印星护身…);
   - needs_validation:要落地这个方向,还需要知道他的什么现实情况?
     (如"他现有专业积累到什么程度""有没有可依托的平台")
   - status:先标 "hypothesis"(假设,待收集验证)
   }

4. energy_retune_frame(能量调频方案骨架):
   - direction_fit:能量最该往哪个方向使力;
   - timing_ripeness:什么状态/条件成熟了再推进(阶段,不报日期);
   - daily_retune:日常怎么调频养能量的方向(方位/颜色/习惯,骨架);
   - complementary:该靠近什么能量特质的人、避开什么消耗;
   - structural_basis:命理为什么;
   - needs_validation:要给他贴合的调频建议,还需要知道他的什么现实情况?
   - status:"hypothesis"

5. rhythm_frame(30天节奏骨架):
   phase1_observe / phase2_adjust / phase3_consolidate 各写一个方向(骨架)。

6. self_check_signals(自检信号,3-4条):
   以后他遇到什么信号=在往对的方向走 / 该停下调整。

# 额外产出:一段自然语言的分析 + 破局方向（给用户看的）

你已经真算出完整骨架(6类)。骨架字段本身是后台数据；给用户看的是【分析 + 破局方向】，
用【自然语言】讲，不是"报告格式"（不用"破局方向一 · XX"这种小标题清单）。

这段 response 两部分，自然衔接、像高人跟你说话：

1. 【分析处境】:大白话说清"你为什么卡在这里"(基于 situation_conclusion)，
   口语化、有温度。

2. 【讲破局方向】:把 modern_action_frames 几条方向，用【自然语言】讲给用户：
   ——方向【要给用户看】(第二阶段核心价值，不能省)；
   ——【不用编号小标题】，用自然的话串:"我看到几条路。一条是…；另一条是…；还有一条是…"；
   ——每条讲"是什么方向 + 为什么适合他"(direction+why_fits)，【不给具体步骤】(留第四阶段)。

# 铁律:自然语言，不是报告；给方向，但不提问
- 【禁止】"破局方向一/二/三"编号小标题、###、清单——用自然语言串；
- 【但方向内容要保留】——"一条是…另一条是…"讲给用户，不能删、不能收进后台不说；
- 【禁止在这段提问】——不问用户问题，不说"你过去是…还是…?"。提问是议程调用(Call B)的事。
  你这步只【分析+给方向+收尾定调】，把提问交给下一步；
- 结尾可自然收束("这几条路具体怎么走，还得看你的实际情况")，但【不提具体问题】；
- 纯白话、零命理标记、禁 ### / **加粗**。

# 不剧透具体步骤(但方向要给)
- 方向【要给】；具体行动步骤 / 调频方案 / 30天节奏 / 抉择细节【不给】(留第四阶段)；
- 即:告诉"有哪几条路、为什么适合你"，但不告诉"每条路第一步做什么"。

# 关于 needs_validation(重要·连接第三阶段)
每个骨架的 needs_validation,是"要把这个骨架变成具体方案,还缺哪些【现实证据】"。
这些会变成第三阶段要向用户收集的东西。所以要具体、可收集:
- 好:"他过去独立做事 vs 团队协作,哪个成果更好"(可问、可验证命理假设);
- 差:"他的整体人生规划"(太大、没法收集、不针对性验证)。
needs_validation 不展示给用户,是给第三阶段议程用的(由 Call B 倒推提问)。

# 骨架≠步骤（硬约束）
【严禁】写具体行动步骤（"每天半小时"、"约老同事喝茶"、"写下方法论"…）——
那是第4段【完整交付】的任务；第2段骨架只给【方向 + 结构依据 + 需验证什么】。
timing_ripeness 只写【进 / 守 / 转 的阶段条件】，【严禁】报具体日期。

# 维度织入（反"只看五行"）
structural_basis ≥2 个不同维度：十神/格局、五行强弱/用神喜忌、大运时机、本盘实算神煞、十二长生。
本盘无实例就跳过，禁编造。≥1 条 modern_action_frames 或 energy_retune_frame 须带阶段判断。

# 硬核标准
- 每条结论/方向可追溯到 structured，否则删掉。
- 两条致命行动骨架 > 三条平庸骨架。
- 命理词只用本次 structured 实例；严禁集外神煞。
- 命理为主：骨架的根都是 structural_basis；科学角度只在 why_fits 里作辅助表述。

# 篇幅
- situation_conclusion：2–4 短段，段间空行，每段 ≤120 字（内部数据，可裸命理词）。
- structural_basis：一句话点锚点，禁止段落复述；直接用命理术语写清逻辑。
- response：分析 + 几条方向的自然语言，约 280–560 字（中文）/ 180–360 words（英文），短段空行即可；禁报告小标题、禁提问。

# 字段=纯内容（前端固定排版）
禁字段内标题/编号/markdown（###、**加粗**、"结构依据："前缀）。直接写句。needs_validation 不展示给用户。

# 第1段靶心
显式扣住 core_dilemma + desired_direction。structural_basis 从实例清单锚定 ≥3 项本地结构；【锚定=讲清意思】。

# 合规范围（硬边界）
【只有 response（给用户看的）要合规】：纯白话、零裸命理词、零 \`⟦t:…⟧\` 标记。
骨架字段（situation_conclusion / key_crossroads / modern_action_frames / energy_retune_frame / rhythm_frame / self_check_signals / structural_basis / needs_validation）是【内部数据】，原始字段不直接展示 → 【不合规、不打标】，可用裸命理词写清楚。
（response 会用白话复述分析+方向给用户看——那部分必须合规。）

response【严禁】裸写：大运/流年/年柱/月柱/日柱/时柱/命盘/八字、正印/食神/伤官等十神原名、甲乙…壬癸 + 子丑…亥 / 金木水火土 连写（如"壬水"）、带煞/刃神煞原名、自创生克短语。
reasoning 可裸算；response 必须白话重组（禁抠词替换）。

# structural_basis（内部依据 · 不打标）
命理依据，【直接用命理术语写清楚】（裸词无妨：内部数据，不展示、不打标）。
要说清"为什么这个方向/判断成立"，用真实命理逻辑；【禁止】为骨架纠结 slug、【禁止】打 \`⟦t:…⟧\`。

# reasoning vs content
reasoning 可裸命理词；骨架字段可裸命理词；【仅 response】必须白话、零标记。

# 输出（严格 JSON · 骨架 + response · 无议程）
键名英文小写 ASCII 双引号，无围栏。
{
  "situation_conclusion": "...",
  "key_crossroads": { "real_fork":"...", "path_costs":"...", "decision_traits":"...", "structural_basis":"...", "needs_validation":"..." },
  "modern_action_frames": [
    { "direction":"...", "why_fits":"...", "structural_basis":"...", "needs_validation":"...", "status":"hypothesis" }
  ],
  "energy_retune_frame": { "direction_fit":"...", "timing_ripeness":"...", "daily_retune":"...", "complementary":"...", "structural_basis":"...", "needs_validation":"...", "status":"hypothesis" },
  "rhythm_frame": { "phase1_observe":"...", "phase2_adjust":"...", "phase3_consolidate":"..." },
  "self_check_signals": ["...", "..."],
  "response": "自然语言:分析处境 + 几条破局方向(一条是…另一条是…);不提问"
}
【禁止】输出 investigation_agenda / first_question —— 另一次调用(Call B)处理提问。
`;

/** @deprecated Alias — Call A deep reckoning task. */
export const DEEP_RECKONING_TASK = DEEP_RECKONING_REPORT_TASK;

export const AGENDA_BRIDGE_TASK = `# 角色：议程与首问撰写（承上启下）

你只拿到【Call A 已定稿的方案骨架 JSON】作为唯一事实源。不要重写分析，不要复述命盘。

# 任务:从方案骨架的 needs_validation 倒推议程
每个骨架(key_crossroads/modern_action_frames/energy_retune_frame)都有 needs_validation
(要把骨架变具体、要验证命理假设,还缺什么现实证据)。
你的议程 = 把这些 needs_validation 变成向用户收集的问题。
1. investigation_agenda（3–5 项，宁少而锐）。
2. first_question：一条给用户的消息——先承上、再启下、直接问真问题。

# 议程规则
- 严禁通用问卷 / 摸现状（那是第1段的事）。
- 每项议程必须标注它验证哪个骨架：frame_kind（"key_crossroads" | "modern_action" | "energy_retune"）。
  若 frame_kind 是 modern_action，再写 frame_index（1 / 2 / 3，对应 A 报告里第几条行动骨架）。
  supports 写自然语言说明即可（如「验证行动骨架：靠专业深度建壁垒」），【不必照抄】needs_validation 原文——锚定以 frame_kind(+frame_index) 为准。
- 优先收集能【验证/推翻命理假设】的现实行为信息(印证导向,不是泛泛了解)。
- ≥2 项 critical=true。
- 每项 { id, label, critical, status:"unexplored", frame_kind, frame_index?, supports }。
- **label（用户面板可见）**：必须用【第二人称】短名词短语（如"你的冷却时段"、"能吐槽的人"、"最硬的那块经验"）。
  【禁止】第三人称内部笔记句（"他目前有没有…"、"了解其冷却方式"）。
  【禁止】把完整问句当 label——完整问句只放 first_question。
- 换一个命盘/问题就不成立 → 够具体。

# first_question 硬要求（一条消息搞定）
1) 先承上：一句话呼应上面那段复盘对话（不要复述内容）；
2) 再启下：说明为了验证/落地【A 中某一条具体骨架】，需要先弄清什么；
3) 直接问出第一个议程项的真问题：具体、好回答、可带场景提示。
【禁止】yes/no 过场（「你看完了吗？」「可以开始了吗？」）。
【禁止】把议程 label 直接甩出来当问题。
【禁止】照抄任何固定范文——必须对着这位用户的复盘对话与骨架现场写。

# 零标记（硬约束）
first_question 与议程 label 都是【正文层】——**一个标记都不许写**，全部白话。
本次调用没有注入实例闭集，你写的任何 slug 都是猜的；代码会剥掉标记，只会让句子变难读。

# 输出（严格 JSON）
{
  "investigation_agenda": [
    { "id":"...", "label":"你的冷却时段", "critical":true, "status":"unexplored", "frame_kind":"modern_action", "frame_index":1, "supports":"验证行动骨架：先把火浇灭" }
  ],
  "first_question": "…",
  "options": ["选项一的话", "选项二的话", "选项三的话"]
}

# first_question 配一组选项(帮用户回答第一个问题)

你的 first_question 是第三阶段的第一个问题。给它配2-3个选项,帮用户快速回答。

选项要求(和收集阶段一致):
- options 是【字符串数组】,每个元素直接是一句给用户看的话(字符串);
  【禁止】包成对象 {"text":"..."}——错:[{"text":"..."}];对:["..."]。
- 选项从第一个议程项的 needs_validation 出发(first_question 问的就是它);
- 要有【这个命盘特有的指纹】,不是通用的(禁放之四海皆准);
- 三个选项有【真实区分度】,对应不同可能(用户选主推=印证假设,选别的=真实修正);
- 保留开放出口(用户可无视选项,在输入框写自己的情况)。

例:first_question 问"过去有没有合作顺利的经历" →
  选项覆盖"有,某次合作让事情推动起来了""基本没有,大多是自己单干""有但最后还是散了"。
  (讲选项设计逻辑,不是照抄这三句。)

# options 格式(硬要求)
字符串数组,每个是一句大白话。禁止对象。用户点了就等于说了这句话。
`;

export type BreakthroughCoreLLMResponse = {
  situation_conclusion: string;
  response?: string;
  key_crossroads: {
    real_fork: string;
    path_costs: string;
    decision_traits: string;
    structural_basis: string;
    needs_validation: string;
  };
  modern_action_frames: Array<{
    direction: string;
    why_fits: string;
    structural_basis: string;
    needs_validation: string;
    status: string;
  }>;
  energy_retune_frame: {
    direction_fit: string;
    timing_ripeness: string;
    daily_retune: string;
    complementary: string;
    structural_basis: string;
    needs_validation: string;
    status: string;
  };
  rhythm_frame: {
    phase1_observe: string;
    phase2_adjust: string;
    phase3_consolidate: string;
  };
  self_check_signals: string[];
  investigation_agenda?: unknown;
  first_question?: string;
};

export function buildBreakthroughCorePrompt(input: {
  base_analysis: unknown | null;
  agent_v2: POJUAgentState | null | undefined;
  original_question: string;
  locale: string;
}): { system: string; user: string; structured: ProfileStructured; auditRelations: RelationLabel[] } {
  const { base_analysis, agent_v2, original_question, locale } = input;
  if (base_analysis == null) {
    throw new Error("[breakthrough-core] structured 命盘为空，拒绝生成脊柱（必锚命盘）。");
  }
  const bundle = normalizeBaseAnalysisInput(base_analysis);
  const structured = bundle.structured ?? null;
  if (structured == null) {
    throw new Error("[breakthrough-core] structured 命盘为空，拒绝生成脊柱（必锚命盘）。");
  }

  const questionCategory = agent_v2?.question_category ?? null;
  const { directedDynamic, auditAllowlist, directedInventoryBlock } = resolveAgendaRelationContext(
    structured,
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

  // Layer 1 only — structured + core_judgments; never inject display_text narrative.
  const baseStr = formatBaseAnalysisForPrompt(base_analysis, locale);
  const factGuard = buildChatFactGuardBlock(structured, {
    directedRelations: directedDynamic,
    verbose: true,
  });

  const system = stitchPromptSections(
    POJU_IDENTITY,
    POJU_KNOWLEDGE_ROOTS,
    buildOutputPolicyForPoju(),
    buildDualLayerDeliveryPromptBlock(locale),
    buildTermMarkingPromptBlock(locale, { principlesOnly: true }),
    directedInventoryBlock,
    buildStructuredInstanceInventory(structured),
    DEEP_RECKONING_REPORT_TASK,
  );

  const segment1 = agent_v2 ? formatSegment1UnderstandingForPrompt(agent_v2) : "（第1段理解门字段尚未写入。）";

  const user = `【locale】${locale}

【第1段理解门产出（推演靶心 · 必须显式扣住）】
${segment1}

【能量底座 Layer1（structured + core_judgments · 无用户叙事）】
${baseStr}

【用户原始问题】
"${original_question}"

【问题类别】
${questionCategory ?? "other"}

【收集到的具体上下文】
${contextText}

${factGuard}

【任务 · Call A】
只输出骨架+对话 JSON（situation_conclusion + key_crossroads + modern_action_frames + energy_retune_frame + rhythm_frame + self_check_signals + response）。不要输出 investigation_agenda / first_question。仅 JSON，无 markdown 围栏。`;

  return { system, user, structured, auditRelations: auditAllowlist };
}

/** Call B — A JSON is sole fact source; no full chart / layout handbook. */
export function buildAgendaBridgePrompt(input: {
  breakthrough_core: BreakthroughCore;
  original_question: string;
  locale: string;
}): { system: string; user: string } {
  const { breakthrough_core, original_question, locale } = input;
  const coreJson = JSON.stringify(
    {
      response: breakthrough_core.response,
      situation_conclusion: breakthrough_core.situation_conclusion,
      key_crossroads: breakthrough_core.key_crossroads,
      modern_action_frames: breakthrough_core.modern_action_frames,
      energy_retune_frame: breakthrough_core.energy_retune_frame,
      rhythm_frame: breakthrough_core.rhythm_frame,
      self_check_signals: breakthrough_core.self_check_signals,
    },
    null,
    2,
  );

  const system = stitchPromptSections(
    POJU_IDENTITY,
    buildOutputPolicyForPoju(),
    AGENDA_BRIDGE_TASK,
  );

  const user = `【locale】${locale}

【用户原始问题（语境）】
"${original_question}"

【Call A 定稿方案骨架（唯一事实源 · 勿改写结论）】
${coreJson}

【任务 · Call B】
从 needs_validation 倒推 investigation_agenda + first_question（承上启下真问题，禁 yes/no 过场）+ options（字符串数组，对应 first_question）。仅 JSON。`;

  return { system, user };
}

/**
 * Deterministic Call B anchor: prefer frame_kind (+ frame_index for modern_action).
 * Fallback only when kind missing — fuzzy match supports vs frame direction / needs_validation text.
 */
export function validateAgendaAnchorsToFrames(
  agenda: AgendaItem[],
  core: BreakthroughCore,
): { ok: true; agenda: AgendaItem[] } | { ok: false; reason: string } {
  if (!Array.isArray(agenda) || agenda.length === 0) {
    return { ok: false, reason: "empty_agenda" };
  }
  const maxAction = core.modern_action_frames?.length ?? 0;
  if (maxAction < 1) {
    return { ok: false, reason: "empty_action_frames" };
  }

  const resolved: AgendaItem[] = [];

  for (const item of agenda) {
    let kind = item.frame_kind;
    let idx = item.frame_index;

    if (!kind) {
      const fuzzy = fuzzyMatchFrameRef(String(item.supports ?? ""), core);
      if (!fuzzy) {
        return { ok: false, reason: `unanchored:${item.id || item.label}` };
      }
      kind = fuzzy.frame_kind;
      idx = fuzzy.frame_index;
    }

    if (kind === "modern_action") {
      if (idx == null || idx < 1 || idx > maxAction) {
        const fuzzy = fuzzyMatchFrameRef(String(item.supports ?? ""), core);
        if (!fuzzy || fuzzy.frame_kind !== "modern_action") {
          return { ok: false, reason: `bad_frame_index:${item.id || item.label}` };
        }
        idx = fuzzy.frame_index;
      }
    }

    resolved.push({
      ...item,
      frame_kind: kind,
      ...(kind === "modern_action" && idx != null ? { frame_index: idx } : {}),
    });
  }

  return { ok: true, agenda: resolved };
}

/** @deprecated Use validateAgendaAnchorsToFrames. */
export function validateAgendaAnchorsToDirections(
  agenda: AgendaItem[],
  directions: BreakthroughCore["modern_action_frames"],
): { ok: true; agenda: AgendaItem[] } | { ok: false; reason: string } {
  const stubCore: BreakthroughCore = {
    situation_conclusion: "",
    key_crossroads: {
      real_fork: "",
      path_costs: "",
      decision_traits: "",
      structural_basis: "",
      needs_validation: "",
    },
    modern_action_frames: directions,
    energy_retune_frame: {
      direction_fit: "",
      timing_ripeness: "",
      daily_retune: "",
      complementary: "",
      structural_basis: "",
      needs_validation: "",
      status: "hypothesis",
    },
    rhythm_frame: { phase1_observe: "", phase2_adjust: "", phase3_consolidate: "" },
    self_check_signals: [],
    generated_at: new Date().toISOString(),
  };
  return validateAgendaAnchorsToFrames(agenda, stubCore);
}

/** Strip punctuation / whitespace / common prefixes for fuzzy frame compare. */
function normalizeForDirectionAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/落地方向\s*[:：\-—–]*/g, "")
    .replace(/验证行动骨架\s*[:：\-—–]*/g, "")
    .replace(/验证骨架\s*[:：\-—–]*/g, "")
    .replace(/方向\s*[123一二三]\s*[:：\-—–]*/g, "")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，。、“”‘’！？：；、·•\-—–~～'".,:;!?()（）【】\[\]{}<>《》/\\|+*=]/g, "");
}

function longestCommonSubstringLen(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= m; i++) {
    const cur = new Array<number>(n + 1).fill(0);
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1]! + 1;
        if (cur[j]! > best) best = cur[j]!;
      }
    }
    prev = cur;
  }
  return best;
}

type FrameAnchor = { frame_kind: AgendaFrameKind; frame_index?: number };

function fuzzyMatchFrameRef(supports: string, core: BreakthroughCore): FrameAnchor | null {
  const needle = normalizeForDirectionAnchor(supports);
  if (needle.length < 2) return null;

  const candidates: Array<{ hay: string; ref: FrameAnchor }> = [];
  const xc = core.key_crossroads;
  if (xc) {
    candidates.push({
      hay: normalizeForDirectionAnchor(
        [xc.real_fork, xc.needs_validation, xc.decision_traits].filter(Boolean).join(" "),
      ),
      ref: { frame_kind: "key_crossroads" },
    });
  }
  core.modern_action_frames.forEach((f, i) => {
    candidates.push({
      hay: normalizeForDirectionAnchor(
        [f.direction, f.needs_validation, f.why_fits].filter(Boolean).join(" "),
      ),
      ref: { frame_kind: "modern_action", frame_index: i + 1 },
    });
  });
  const er = core.energy_retune_frame;
  if (er) {
    candidates.push({
      hay: normalizeForDirectionAnchor(
        [er.direction_fit, er.needs_validation, er.daily_retune].filter(Boolean).join(" "),
      ),
      ref: { frame_kind: "energy_retune" },
    });
  }

  let best: FrameAnchor | null = null;
  let bestRatio = 0;
  for (const c of candidates) {
    if (c.hay.length < 2) continue;
    const lcs = longestCommonSubstringLen(needle, c.hay);
    const ratio = lcs / Math.max(needle.length, c.hay.length);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = c.ref;
    }
  }
  return bestRatio >= 0.6 ? best : null;
}

export class BreakthroughCoreParseError extends Error {
  constructor(message = "core_parse_failed") {
    super(message);
    this.name = "BreakthroughCoreParseError";
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function grabSalvageStringField(text: string, keyAliases: string[]): string | undefined {
  for (const k of keyAliases) {
    const key = escapeRegExp(k);
    const re = new RegExp(
      `["'「」]?${key}["'「」]?\\s*[:：]\\s*["'「」]((?:[^"'「」\\\\]|\\\\.)*)["'「」]`,
      "i",
    );
    const m = text.match(re);
    if (m?.[1]?.trim()) {
      return m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
    }
  }
  return undefined;
}

function extractJsonArrayBlock(text: string, containerAliases: string[]): string | null {
  for (const key of containerAliases) {
    const re = new RegExp(`["'「」]?${escapeRegExp(key)}["'「」]?\\s*[:：]\\s*\\[`, "i");
    const m = re.exec(text);
    if (!m || m.index === undefined) continue;
    const start = text.indexOf("[", m.index);
    if (start < 0) continue;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "[") depth++;
      else if (text[i] === "]") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    if (depth > 0) return text.slice(start);
  }
  return null;
}

function tryParseJsonArray(raw: string): unknown[] | null {
  const attempts = [
    raw,
    raw.replace(/,(\s*[}\]])/g, "$1"),
    tolerantJsonRepair(raw),
    tolerantJsonRepair(raw.replace(/,(\s*[}\]])/g, "$1")),
  ];
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* next */
    }
  }
  return null;
}

function normalizeSalvagedActionFrames(raw: unknown): ModernActionFrame[] {
  if (!Array.isArray(raw)) return [];
  const out: ModernActionFrame[] = [];
  for (const d of raw) {
    if (!d || typeof d !== "object") continue;
    const row = d as Record<string, unknown>;
    const direction = typeof row.direction === "string" ? row.direction.trim() : "";
    const structural_basis = typeof row.structural_basis === "string" ? row.structural_basis.trim() : "";
    const why_fits = typeof row.why_fits === "string" ? row.why_fits.trim() : "";
    const needs_validation =
      (typeof row.needs_validation === "string" ? row.needs_validation.trim() : "") ||
      (typeof row.what_would_confirm === "string" ? row.what_would_confirm.trim() : "");
    if (!direction && !structural_basis && !needs_validation) continue;
    out.push({
      direction: direction || structural_basis.slice(0, 80) || "待补方向",
      why_fits: why_fits || "待补适配理由",
      structural_basis: structural_basis || "待补结构依据",
      needs_validation: needs_validation || direction || "待补验证点",
      status: "hypothesis",
    });
  }
  return out;
}

function placeholderKeyCrossroads(needs: string): KeyCrossroadsFrame {
  return {
    real_fork: "待补真正分岔点",
    path_costs: "待补路径代价",
    decision_traits: "待补决策特质",
    structural_basis: "待补结构依据",
    needs_validation: needs || "待补验证点",
  };
}

function placeholderEnergyRetune(needs: string): EnergyRetuneFrame {
  return {
    direction_fit: "待补使力方向",
    timing_ripeness: "条件成熟后再推进",
    daily_retune: "待补日常调频方向",
    complementary: "待补互补/避开",
    structural_basis: "待补结构依据",
    needs_validation: needs || "待补验证点",
    status: "hypothesis",
  };
}

function placeholderRhythm(): RhythmFrame {
  return {
    phase1_observe: "先观察关键信号",
    phase2_adjust: "再做小幅调整",
    phase3_consolidate: "巩固已验证方向",
  };
}

function agendaFromSalvagedFrames(frames: ModernActionFrame[]): AgendaItem[] | null {
  if (frames.length < 2) return null;
  const items: AgendaItem[] = [];
  for (let i = 0; i < frames.length; i++) {
    const d = frames[i]!;
    const label = (d.needs_validation || d.direction).trim().slice(0, 40);
    if (!label) continue;
    items.push({
      id: `agenda_${i + 1}`,
      label,
      critical: i < 2,
      status: "unexplored",
      frame_kind: "modern_action",
      frame_index: i + 1,
      supports: d.direction,
    });
  }
  if (items.length < 2) return null;
  while (items.length < 3) {
    items.push({
      id: `agenda_${items.length + 1}`,
      label: "待补关键信息",
      critical: false,
      status: "unexplored",
    });
  }
  return items;
}

/** Field-level salvage when xhigh JSON is malformed but content is present. */
export function salvageBreakthroughFields(cleaned: string): Record<string, unknown> | null {
  const base = tryParseJsonObject(cleaned) ?? {};

  const situation_conclusion =
    (typeof base.situation_conclusion === "string" ? base.situation_conclusion.trim() : "") ||
    (typeof base.relationship_conclusion === "string" ? base.relationship_conclusion.trim() : "") ||
    grabSalvageStringField(cleaned, [
      "situation_conclusion",
      "relationship_conclusion",
      "处境洞察",
      "关系结论",
    ]) ||
    "";
  if (!situation_conclusion) return null;

  let frames = normalizeSalvagedActionFrames(base.modern_action_frames);
  if (frames.length < 2) {
    frames = normalizeSalvagedActionFrames(base.breakthrough_directions);
  }
  if (frames.length < 2) {
    const block = extractJsonArrayBlock(cleaned, [
      "modern_action_frames",
      "breakthrough_directions",
      "破局方向",
      "行动骨架",
    ]);
    if (block) frames = normalizeSalvagedActionFrames(tryParseJsonArray(block));
  }
  if (frames.length < 2) return null;

  let investigation_agenda =
    parseInvestigationAgenda(base.investigation_agenda) ??
    normalizeAgendaFromLlm(base.investigation_agenda);
  if (!investigation_agenda) {
    const agendaBlock = extractJsonArrayBlock(cleaned, ["investigation_agenda", "调查议程"]);
    if (agendaBlock) {
      investigation_agenda = normalizeAgendaFromLlm(tryParseJsonArray(agendaBlock));
    }
  }
  if (!investigation_agenda) {
    investigation_agenda = agendaFromSalvagedFrames(frames);
  }
  if (!investigation_agenda) return null;

  const first_question =
    (typeof base.first_question === "string" ? base.first_question.trim() : "") ||
    grabSalvageStringField(cleaned, ["first_question", "首问"]) ||
    "";

  const needsSeed = frames[0]?.needs_validation || "";

  return {
    situation_conclusion,
    key_crossroads:
      base.key_crossroads && typeof base.key_crossroads === "object"
        ? base.key_crossroads
        : placeholderKeyCrossroads(needsSeed),
    modern_action_frames: frames,
    energy_retune_frame:
      base.energy_retune_frame && typeof base.energy_retune_frame === "object"
        ? base.energy_retune_frame
        : placeholderEnergyRetune(needsSeed),
    rhythm_frame:
      base.rhythm_frame && typeof base.rhythm_frame === "object"
        ? base.rhythm_frame
        : placeholderRhythm(),
    self_check_signals: Array.isArray(base.self_check_signals)
      ? base.self_check_signals
      : ["走对了的信号待补", "该停下调整的信号待补", "外部反馈信号待补"],
    investigation_agenda,
    ...(first_question ? { first_question } : {}),
    _parse_salvaged: true,
  };
}

export function parseBreakthroughCoreResponseText(raw: string): unknown {
  const jsonStr = extractJson(raw);
  const direct = tryParseJsonObject(jsonStr);
  if (direct) return direct;

  const salvaged = salvageBreakthroughFields(jsonStr);
  if (salvaged) {
    console.info("[breakthrough-core] salvaged partial JSON from xhigh output");
    return salvaged;
  }

  throw new BreakthroughCoreParseError();
}

/** Parse + map with salvage retry when strict map fails on loosely-parsed JSON. */
export function parseAndMapBreakthroughCore(raw: string): ReturnType<typeof mapBreakthroughCorePayload> {
  let parsed: unknown;
  try {
    parsed = parseBreakthroughCoreResponseText(raw);
  } catch (e) {
    throw e instanceof BreakthroughCoreParseError ? e : new BreakthroughCoreParseError();
  }
  try {
    return mapBreakthroughCorePayload(parsed);
  } catch (firstError) {
    const salvaged = salvageBreakthroughFields(extractJson(raw));
    if (!salvaged) throw firstError;
    console.info("[breakthrough-core] map retry after field salvage");
    return mapBreakthroughCorePayload(salvaged);
  }
}

export function buildBreakthroughCoreAuditText(parsed: unknown): string {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
  const o = parsed as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.situation_conclusion === "string") parts.push(o.situation_conclusion);
  if (typeof o.relationship_conclusion === "string") parts.push(o.relationship_conclusion);
  const xc = o.key_crossroads;
  if (xc && typeof xc === "object" && !Array.isArray(xc)) {
    for (const v of Object.values(xc as Record<string, unknown>)) {
      if (typeof v === "string") parts.push(v);
    }
  }
  const frames = o.modern_action_frames ?? o.breakthrough_directions;
  if (Array.isArray(frames)) {
    for (const d of frames) {
      if (!d || typeof d !== "object") continue;
      const row = d as Record<string, unknown>;
      for (const k of [
        "direction",
        "why_fits",
        "structural_basis",
        "needs_validation",
        "timing",
        "what_would_confirm",
      ] as const) {
        if (typeof row[k] === "string") parts.push(row[k]);
      }
    }
  }
  const er = o.energy_retune_frame;
  if (er && typeof er === "object" && !Array.isArray(er)) {
    for (const v of Object.values(er as Record<string, unknown>)) {
      if (typeof v === "string") parts.push(v);
    }
  }
  const rhythm = o.rhythm_frame;
  if (rhythm && typeof rhythm === "object" && !Array.isArray(rhythm)) {
    for (const v of Object.values(rhythm as Record<string, unknown>)) {
      if (typeof v === "string") parts.push(v);
    }
  }
  if (Array.isArray(o.self_check_signals)) {
    for (const s of o.self_check_signals) {
      if (typeof s === "string") parts.push(s);
    }
  }
  const agenda = parseInvestigationAgenda(o.investigation_agenda);
  if (agenda) {
    for (const item of agenda) parts.push(item.label);
  }
  if (typeof o.first_question === "string") parts.push(o.first_question);
  return parts.join("\n");
}

function requireStringField(row: Record<string, unknown>, key: string, ctx: string): string {
  const v = typeof row[key] === "string" ? row[key].trim() : "";
  if (!v) throw new Error(`${ctx} missing ${key}`);
  return v;
}

function mapKeyCrossroads(raw: unknown): KeyCrossroadsFrame {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Missing key_crossroads");
  }
  const row = raw as Record<string, unknown>;
  return {
    real_fork: requireStringField(row, "real_fork", "key_crossroads"),
    path_costs: requireStringField(row, "path_costs", "key_crossroads"),
    decision_traits: requireStringField(row, "decision_traits", "key_crossroads"),
    structural_basis: requireStringField(row, "structural_basis", "key_crossroads"),
    needs_validation: requireStringField(row, "needs_validation", "key_crossroads"),
  };
}

function mapEnergyRetune(raw: unknown): EnergyRetuneFrame {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Missing energy_retune_frame");
  }
  const row = raw as Record<string, unknown>;
  return {
    direction_fit: requireStringField(row, "direction_fit", "energy_retune_frame"),
    timing_ripeness: requireStringField(row, "timing_ripeness", "energy_retune_frame"),
    daily_retune: requireStringField(row, "daily_retune", "energy_retune_frame"),
    complementary: requireStringField(row, "complementary", "energy_retune_frame"),
    structural_basis: requireStringField(row, "structural_basis", "energy_retune_frame"),
    needs_validation: requireStringField(row, "needs_validation", "energy_retune_frame"),
    status: "hypothesis",
  };
}

function mapRhythm(raw: unknown): RhythmFrame {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Missing rhythm_frame");
  }
  const row = raw as Record<string, unknown>;
  return {
    phase1_observe: requireStringField(row, "phase1_observe", "rhythm_frame"),
    phase2_adjust: requireStringField(row, "phase2_adjust", "rhythm_frame"),
    phase3_consolidate: requireStringField(row, "phase3_consolidate", "rhythm_frame"),
  };
}

export function mapBreakthroughCorePayload(parsed: unknown): {
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
} {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Breakthrough core response is not an object");
  }
  const o = parsed as Record<string, unknown>;
  const situation_conclusion =
    (typeof o.situation_conclusion === "string" ? o.situation_conclusion.trim() : "") ||
    (typeof o.relationship_conclusion === "string" ? o.relationship_conclusion.trim() : "");
  if (!situation_conclusion) {
    throw new Error("Missing situation_conclusion");
  }

  const rawFrames = o.modern_action_frames ?? o.breakthrough_directions;
  if (!Array.isArray(rawFrames) || rawFrames.length < 2 || rawFrames.length > 3) {
    throw new Error("modern_action_frames must be an array of 2–3 items");
  }

  const modern_action_frames = rawFrames.map((d, i) => {
    if (!d || typeof d !== "object") throw new Error(`modern_action_frames[${i}] invalid`);
    const row = d as Record<string, unknown>;
    const direction = typeof row.direction === "string" ? row.direction.trim() : "";
    const structural_basis = typeof row.structural_basis === "string" ? row.structural_basis.trim() : "";
    const why_fits = typeof row.why_fits === "string" ? row.why_fits.trim() : "";
    const needs_validation =
      (typeof row.needs_validation === "string" ? row.needs_validation.trim() : "") ||
      (typeof row.what_would_confirm === "string" ? row.what_would_confirm.trim() : "");
    if (!direction || !structural_basis || !needs_validation) {
      throw new Error(`modern_action_frames[${i}] missing required fields`);
    }
    return {
      direction,
      why_fits: why_fits || "与本盘结构相合",
      structural_basis,
      needs_validation,
      status: "hypothesis" as const,
    };
  });

  const salvaged = Boolean(o._parse_salvaged);
  const key_crossroads = salvaged
    ? o.key_crossroads && typeof o.key_crossroads === "object"
      ? {
          ...placeholderKeyCrossroads(modern_action_frames[0]?.needs_validation ?? ""),
          ...(o.key_crossroads as Partial<KeyCrossroadsFrame>),
          real_fork:
            typeof (o.key_crossroads as KeyCrossroadsFrame).real_fork === "string" &&
            (o.key_crossroads as KeyCrossroadsFrame).real_fork.trim()
              ? (o.key_crossroads as KeyCrossroadsFrame).real_fork.trim()
              : "待补真正分岔点",
          path_costs:
            typeof (o.key_crossroads as KeyCrossroadsFrame).path_costs === "string" &&
            (o.key_crossroads as KeyCrossroadsFrame).path_costs.trim()
              ? (o.key_crossroads as KeyCrossroadsFrame).path_costs.trim()
              : "待补路径代价",
          decision_traits:
            typeof (o.key_crossroads as KeyCrossroadsFrame).decision_traits === "string" &&
            (o.key_crossroads as KeyCrossroadsFrame).decision_traits.trim()
              ? (o.key_crossroads as KeyCrossroadsFrame).decision_traits.trim()
              : "待补决策特质",
          structural_basis:
            typeof (o.key_crossroads as KeyCrossroadsFrame).structural_basis === "string" &&
            (o.key_crossroads as KeyCrossroadsFrame).structural_basis.trim()
              ? (o.key_crossroads as KeyCrossroadsFrame).structural_basis.trim()
              : "待补结构依据",
          needs_validation:
            typeof (o.key_crossroads as KeyCrossroadsFrame).needs_validation === "string" &&
            (o.key_crossroads as KeyCrossroadsFrame).needs_validation.trim()
              ? (o.key_crossroads as KeyCrossroadsFrame).needs_validation.trim()
              : modern_action_frames[0]?.needs_validation || "待补验证点",
        }
      : placeholderKeyCrossroads(modern_action_frames[0]?.needs_validation ?? "")
    : mapKeyCrossroads(o.key_crossroads);

  const energy_retune_frame = salvaged
    ? o.energy_retune_frame && typeof o.energy_retune_frame === "object"
      ? {
          ...placeholderEnergyRetune(modern_action_frames[0]?.needs_validation ?? ""),
          ...(o.energy_retune_frame as Partial<EnergyRetuneFrame>),
          status: "hypothesis" as const,
        }
      : placeholderEnergyRetune(modern_action_frames[0]?.needs_validation ?? "")
    : mapEnergyRetune(o.energy_retune_frame);

  const rhythm_frame = salvaged
    ? o.rhythm_frame && typeof o.rhythm_frame === "object"
      ? { ...placeholderRhythm(), ...(o.rhythm_frame as Partial<RhythmFrame>) }
      : placeholderRhythm()
    : mapRhythm(o.rhythm_frame);

  let self_check_signals: string[] = [];
  if (Array.isArray(o.self_check_signals)) {
    self_check_signals = o.self_check_signals
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
  }
  if (self_check_signals.length < 3) {
    if (!salvaged) throw new Error("self_check_signals must have 3–4 items");
    while (self_check_signals.length < 3) {
      self_check_signals.push(`待补自检信号${self_check_signals.length + 1}`);
    }
  }

  const investigation_agenda =
    parseInvestigationAgenda(o.investigation_agenda) ??
    normalizeAgendaFromLlm(o.investigation_agenda) ??
    [];

  const first_question =
    typeof o.first_question === "string" && o.first_question.trim()
      ? o.first_question.trim()
      : undefined;

  const responseRaw = typeof o.response === "string" ? o.response.trim() : "";
  const response = responseRaw || undefined;

  const now = new Date().toISOString();
  return {
    breakthrough_core: {
      situation_conclusion,
      ...(response ? { response } : {}),
      key_crossroads,
      modern_action_frames,
      energy_retune_frame,
      rhythm_frame,
      self_check_signals: self_check_signals.slice(0, 4),
      ...(first_question ? { first_question } : {}),
      generated_at: now,
    },
    investigation_agenda,
  };
}

function scrubUserField(s: string, locale: string): string {
  return sanitizePaymentAuditLeaks(s, locale);
}

/**
 * 用户可见正文（response / first_question）：合规清洗后【物理剥掉】所有标记，只留白话。
 * 提示词禁标记不够 —— 「提示词禁 ≠ 代码禁」，出口必须代码焊死。
 * 泄漏必须响亮：静默降级 = 提示词被稀释了也没人知道。
 */
function scrubBodyField(
  s: string,
  locale: string,
  field: string,
): { text: string; leaks: number } {
  const scrubbed = scrubUserField(s, locale);
  const markers = scrubbed.match(/⟦t:[^⟧]+⟧/g);
  if (!markers?.length) return { text: scrubbed, leaks: 0 };
  console.warn(
    `[breakthrough-core] BODY MARKER LEAK — ${field} 用户可见正文出现 ${markers.length} 个标记，已降级为白话。` +
      `模型违反「仅 response 合规、零标记」（见 DEEP_RECKONING_REPORT_TASK「合规范围」段）。`,
    { field, sample: markers.slice(0, 3) },
  );
  return { text: degradeMarkersToPlain(scrubbed, locale), leaks: markers.length };
}

/**
 * Call A sanitize：骨架是内部资料 → 原样保留（不合规、不打标）。
 * 只 scrub + 审计【response】（唯一给用户看的）；first_question 若误入也按用户可见处理。
 * agenda label 仍 scrub（面板可见）。
 */
export function sanitizeBreakthroughCoreMapped(
  mapped: {
    breakthrough_core: BreakthroughCore;
    investigation_agenda: AgendaItem[];
  },
  locale: string,
): {
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
  violations: ComplianceViolation[];
  body_marker_leaks: number;
} {
  const core = mapped.breakthrough_core;
  let bodyLeaks = 0;
  const body = (s: string, field: string): string => {
    const r = scrubBodyField(s, locale, field);
    bodyLeaks += r.leaks;
    return r.text;
  };

  const breakthrough_core: BreakthroughCore = {
    ...core,
    // 骨架字段：内部资料，不 scrub、不打标、不审计
    situation_conclusion: core.situation_conclusion,
    key_crossroads: core.key_crossroads,
    modern_action_frames: core.modern_action_frames,
    energy_retune_frame: core.energy_retune_frame,
    rhythm_frame: core.rhythm_frame,
    self_check_signals: core.self_check_signals,
    ...(core.response ? { response: body(core.response, "response") } : {}),
    ...(core.first_question
      ? { first_question: body(core.first_question, "first_question") }
      : {}),
  };
  const investigation_agenda = mapped.investigation_agenda.map((a) => ({
    ...a,
    label: scrubUserField(a.label, locale),
  }));

  // 只审 response（给用户看的）；骨架字段不审——内部资料，裸命理词无妨
  const auditBlob = breakthrough_core.response ?? "";

  const violations = auditPaymentLeakResiduals(auditBlob, locale);
  if (bodyLeaks > 0) {
    console.warn(
      `[breakthrough-core] 本轮共 ${bodyLeaks} 处用户可见正文标记被降级 —— 持续出现则回查提示词「合规范围」段是否被稀释。`,
    );
  }
  return { breakthrough_core, investigation_agenda, violations, body_marker_leaks: bodyLeaks };
}

export class BreakthroughCoreComplianceError extends Error {
  readonly violations: ComplianceViolation[];
  constructor(violations: ComplianceViolation[]) {
    const labels = [...new Set(violations.map((v) => v.label))].slice(0, 8).join(",");
    super(`compliance_block: ${labels}`);
    this.name = "BreakthroughCoreComplianceError";
    this.violations = violations;
  }
}

/** Parse + map; payment-audit only response. Throws BreakthroughCoreComplianceError if response still leaks. */
export function parseSanitizeBreakthroughCore(
  raw: string,
  locale: string,
): {
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
} {
  const mapped = parseAndMapBreakthroughCore(raw);
  // Call A: drop any accidental agenda / first_question — B owns those.
  const reportOnly = {
    breakthrough_core: {
      ...mapped.breakthrough_core,
      first_question: undefined,
    },
    investigation_agenda: [] as AgendaItem[],
  };
  const sanitized = sanitizeBreakthroughCoreMapped(reportOnly, locale);
  if (
    sanitized.violations.length > 0 &&
    isCriticalDeliveryAuditFailure(sanitized.violations)
  ) {
    throw new BreakthroughCoreComplianceError(sanitized.violations);
  }
  return {
    breakthrough_core: sanitized.breakthrough_core,
    investigation_agenda: [],
  };
}

export class AgendaBridgeParseError extends Error {
  constructor(message = "agenda_bridge_parse_failed") {
    super(message);
    this.name = "AgendaBridgeParseError";
  }
}

export class AgendaAnchorError extends Error {
  constructor(message = "agenda_anchor_failed") {
    super(message);
    this.name = "AgendaAnchorError";
  }
}

/** Call B parse + anchor check against A's scheme skeletons. */
export function parseSanitizeAgendaBridge(
  raw: string,
  locale: string,
  core: BreakthroughCore,
): {
  investigation_agenda: AgendaItem[];
  first_question: string;
  options?: string[];
} {
  const cleaned = extractJson(raw) || raw;
  const repaired = tolerantJsonRepair(cleaned);
  const parsed = tryParseJsonObject(repaired) ?? tryParseJsonObject(cleaned);
  if (!parsed || typeof parsed !== "object") {
    throw new AgendaBridgeParseError("invalid_json");
  }
  const o = parsed as Record<string, unknown>;
  const investigation_agenda =
    parseInvestigationAgenda(o.investigation_agenda) ??
    normalizeAgendaFromLlm(o.investigation_agenda);
  if (!investigation_agenda || investigation_agenda.length === 0) {
    throw new AgendaBridgeParseError("missing_agenda");
  }
  const first_question =
    typeof o.first_question === "string" ? o.first_question.trim() : "";
  if (!first_question) {
    throw new AgendaBridgeParseError("missing_first_question");
  }
  // Reject yes/no 过场
  if (
    /看完了吗|阅读了吗|可以开始了吗|准备好了吗|did you (already )?read|ready to (start|continue)\?/i.test(
      first_question,
    )
  ) {
    throw new AgendaBridgeParseError("yes_no_bridge_forbidden");
  }

  const scrubbedAgenda = investigation_agenda.map((a) => ({
    ...a,
    label: scrubUserField(a.label, locale),
    ...(a.supports ? { supports: scrubUserField(a.supports, locale) } : {}),
  }));
  // first_question 是发给用户的正文 —— 零金字。
  const scrubbedQ = scrubBodyField(first_question, locale, "first_question").text;

  const anchor = validateAgendaAnchorsToFrames(scrubbedAgenda, core);
  if (!anchor.ok) {
    throw new AgendaAnchorError(anchor.reason);
  }

  const violations = auditPaymentLeakResiduals(scrubbedQ, locale);
  if (violations.length > 0 && isCriticalDeliveryAuditFailure(violations)) {
    throw new BreakthroughCoreComplianceError(violations);
  }

  const options = sanitizeReplyOptions(o.options);

  return { investigation_agenda: anchor.agenda, first_question: scrubbedQ, options };
}

export async function resolveBaseAnalysisForBreakthrough(
  session: POJUSessionState,
): Promise<unknown | null> {
  const id =
    uuidLike(session.selected_stored_profile_id) ??
    uuidLike(session.agent_v2?.selected_profile_id);
  if (id) {
    const stored = await getStoredProfile(id);
    const ba = stored?.base_analysis?.content ?? stored?.base_analysis ?? null;
    if (ba != null) return ba;
  }
  const { base_analysis } = await loadSessionProfileBundle(session);
  return base_analysis ?? null;
}

function uuidLike(s: string | null | undefined): string | null {
  if (!s || s === "active_user_profile") return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return s;
  return null;
}

export async function requestBreakthroughCore(
  session: POJUSessionState,
  locale: string,
  options?: {
    base_analysis?: unknown | null;
    onProgress?: (accumulated_chars: number) => void;
  },
): Promise<{
  session: POJUSessionState;
  tokens_used: number;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
  model?: string;
}> {
  if (typeof window === "undefined") {
    throw new Error("requestBreakthroughCore is browser-only");
  }

  const agent = session.agent_v2;
  if (!agent) throw new Error("agent_v2 required for breakthrough-core");
  if (agent.breakthrough_core != null) {
    return { session, tokens_used: 0 };
  }

  let base_analysis = options?.base_analysis;
  if (base_analysis === undefined) {
    base_analysis = await resolveBaseAnalysisForBreakthrough(session);
  }
  if (base_analysis == null) {
    throw new Error(
      "[breakthrough-core] 命主基础分析缺失，无法锚定深测算（必锚命盘）。selected_stored_profile_id=" +
        (session.selected_stored_profile_id ?? "null"),
    );
  }

  const profileId =
    session.selected_stored_profile_id?.trim() ?? uuidLike(agent.selected_profile_id) ?? "";

  const original_question =
    session.agent_v2?.original_question?.trim() || session.original_question?.trim() || "";
  if (!original_question) {
    throw new Error(
      "[breakthrough-core] original_question empty — cannot anchor deep analysis to user dilemma",
    );
  }
  console.info("[breakthrough-core] input original_question:", original_question.slice(0, 120));

  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), XHIGH_JOB_POLL_MAX_MS);

  let breakthrough_core: BreakthroughCore | undefined;
  let investigation_agenda: AgendaItem[] | undefined;
  let tokens_used = 0;
  let llm_debug: import("@/lib/llm/llm-debug").LLMCallDebug | undefined;
  let model: string | undefined;

  try {
    const res = await fetch("/api/poju/breakthrough-core", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: session.session_id,
        original_question,
        agent_v2: agent,
        base_analysis,
        locale,
        selected_stored_profile_id: profileId || null,
      }),
      signal: ac.signal,
    });
    const createPayload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      job_id?: string;
      status?: string;
      retryable?: boolean;
      reason?: string;
      breakthrough_core?: BreakthroughCore;
      investigation_agenda?: AgendaItem[];
      model?: string;
      tokens_used?: number;
      llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
      error?: string;
    };
    if (!res.ok && !createPayload.job_id) {
      throw new Error(createPayload.error || `Breakthrough core create failed (${res.status})`);
    }

    breakthrough_core = createPayload.breakthrough_core;
    investigation_agenda = createPayload.investigation_agenda;
    tokens_used = typeof createPayload.tokens_used === "number" ? createPayload.tokens_used : 0;
    llm_debug = createPayload.llm_debug;
    model = createPayload.model;

    if (!breakthrough_core || !investigation_agenda) {
      const job_id = createPayload.job_id;
      if (!job_id) {
        if (createPayload.ok === false && createPayload.retryable) {
          console.warn("[breakthrough-core] soft failure (retryable):", createPayload.reason, createPayload.error);
          return { session, tokens_used: 0 };
        }
        throw new Error(createPayload.error || "Breakthrough core job missing job_id");
      }

      console.info("[breakthrough-core] async xhigh job started:", job_id);
      const polled = await pollBreakthroughCoreJobUntilDone({
        job_id,
        signal: ac.signal,
        callbacks: {
          onProgress: (chars) => options?.onProgress?.(chars),
        },
      });

      if (!polled.ok) {
        console.warn("[breakthrough-core] job failed (retryable):", polled.reason, polled.error);
        return { session, tokens_used: 0 };
      }

      breakthrough_core = polled.breakthrough_core;
      investigation_agenda = polled.investigation_agenda;
      tokens_used = typeof polled.tokens_used === "number" ? polled.tokens_used : 0;
      llm_debug = polled.llm_debug;
      model = polled.model;
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        locale.startsWith("zh")
          ? "深测算超时未完成，请点「重新生成分析」再试。"
          : "Deep analysis timed out — tap Regenerate analysis to retry.",
      );
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }

  if (!breakthrough_core) {
    throw new Error("Breakthrough core incomplete after job");
  }
  const agenda = investigation_agenda ?? [];

  const nextAgent: POJUAgentState = {
    ...agent,
    breakthrough_core,
    investigation_agenda: agenda,
    agenda_generated: true,
    has_situation_analysis: true,
  };

  console.info(
    "[breakthrough-core] persisted:",
    breakthrough_core.situation_conclusion.slice(0, 80),
    "action_frames:",
    breakthrough_core.modern_action_frames.length,
    "agenda:",
    agenda.map((a) => a.label),
  );

  return {
    session: {
      ...session,
      agent_v2: nextAgent,
      tokens_used: session.tokens_used + tokens_used,
    },
    tokens_used,
    llm_debug,
    model,
  };
}
