/**
 * Block 2 Phase 3 — 深测算 pass（破局推理脊柱 + 议程倒推）
 * LLM 走 `POST /api/poju/breakthrough-core`；结果写入 `agent_v2.breakthrough_core` + `investigation_agenda`。
 */

import {
  formatSegment1UnderstandingForPrompt,
  type BreakthroughCore,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import { parseInvestigationAgenda, type AgendaItem } from "@/lib/poju/investigation-agenda";
import type { POJUSessionState } from "@/lib/poju/types";
import { pollBreakthroughCoreJobUntilDone, XHIGH_JOB_POLL_MAX_MS } from "@/lib/poju/poll-segment2-xhigh-job";
import { loadSessionProfileBundle } from "@/lib/poju/session-profile";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { POJU_IDENTITY, POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { extractJson, tolerantJsonRepair, tryParseJsonObject } from "@/lib/llm/phases/phase-transport";
import { normalizeAgendaFromLlm } from "@/lib/poju/opening-conversion-payload";
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import { resolveAgendaRelationContext } from "@/lib/llm/prompts/relation-closed-set-context";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { RelationLabel } from "@/lib/calculations/relation-engine";
import {
  auditPaymentLeakResiduals,
  sanitizePaymentAuditLeaks,
  type ComplianceViolation,
} from "@/lib/llm/sanitize/compliance-terms";
import { isCriticalDeliveryAuditFailure } from "@/lib/llm/services/delivery-audit-regen";

export const DEEP_RECKONING_TASK = `# 角色：破局总设计师（上帝视角 · 零聊天腔）

你不是在跟用户对话。你是在一间没有用户在场的作战室里，对着这个人【真实排算出的命盘结构】
和他的问题，做一次冷静、硬核、不注水的深度推演。你的产出是后续整个破局流程的【唯一推理脊柱】
—— 议程、收集、交付全都长在它上面。彻底剥离聊天语气：不寒暄、不安慰、不用第二人称对话腔。
（注意：你仍是身份头里那位博学、有判断力、直指要害的智者——只是此刻不寒暄、不用对话腔，
因为这是内部脊柱，不直接给用户看。人设的"深度与判断力"正是这一步要的。）

# 输入（structured 是你唯一的事实源，引擎确定性算出）
- day_master / pattern / strength / yong_shen / xi_shen / ji_shen
- four_pillars 与 pillars_detail.{year|month|day|hour}.{ten_god, hidden_stems, shen_sha, life_stage}
- da_yun（当前走到第几步、主题、何时转）
- 用户原始问题 + 已确认处境

# 任务：高维度「玄学 × 心理学」交叉推演
1. relationship_conclusion（关系结论）：
   这个人的命盘结构，为什么会让他卡在这个问题上？把"困境"翻译成"结构性原因"。
   必须点名 structured 的具体字段（如 month.ten_god=七杀、strength=weak、da_yun 第三步、ji_shen=X），
   不许只报四个五行词、不许泛泛而谈。这是"人与问题的关系"，不是命盘复述。
2. breakthrough_directions（破局方向，2–3 条，宁少而锐）：
   基于关系结论深思，每条 = {
     direction: 一句话方向（顺势 / 守 / 转 / 立断 的判断，不替用户决定、不预测事件日期）,
     structural_basis: 锚在哪些命盘结构（见下方「维度织入」硬要求）,
     timing: 基于 da_yun 当前这步（顺/逆/进/守），现在是该进、该守、还是该转的窗口
             —— 只说能量节律，禁公历年 / 干支纪年 / 具体日期,
     what_would_confirm: 要验证 / 证伪它成立，需从用户那儿知道什么
   }

# 维度织入（硬要求 · 反"只看五行"）
每条 direction 的 structural_basis 必须整合【至少 2 个不同维度】，不许只报五行 / 强弱：
- 十神 / 格局：驱动力与命局格调（pillars_detail.*.ten_god, pattern）
- 五行强弱 / 用神喜忌：过载还是不足、往哪调（strength, yong_shen / xi_shen / ji_shen）
- 大运时机：当前这步是顺是逆、该进该守（da_yun）—— 破局的"何时"
- 神煞（仅本盘 structured 实例清单实算项、清单外禁写）：点出与所问之事相关的助力或隐忧
  （pillars_detail.*.shen_sha）；本盘没有相关神煞就不提，严禁编造、严禁集外
- 十二长生：相关柱的能量处于旺 / 衰哪一阶段（pillars_detail.*.life_stage）—— 力量的"火候"
至少有 1 条 direction 必须带出 timing（大运视角的进 / 守 / 转判断）。
若某维度本盘确实无可用实例，跳过该维度即可，但不得用其它维度凑数式堆砌，更不得编造。

# 硬核标准（反注水）
- 每条结论/方向都必须能追溯到 structured 的具体字段，否则删掉重写。
- 宁可少而锐：两条致命方向 > 三条平庸方向。
- 命理词只能用本次 structured 实有的实例（见下方实例清单）；
  严禁集外神煞（国印/空亡/元辰/六秀日/阴差阳错…一律禁止）。

# 篇幅节制（硬要求 · 缩短生成、一次跑完）
- relationship_conclusion：3–5 句，只写结构性原因，不注水。
- 每条 direction.structural_basis：一句话点命盘锚点，禁止段落式复述。
- investigation_agenda：3–4 项即可；每项 label ≤20 字，锐而短，直指「落地某条破局方向前必须先知道」的信息。

# 第1段靶心（硬要求 · 必须显式扣住）
输入中会提供 core_dilemma（concrete_event / stakes / sticking_point）与 desired_direction（wants / priority）。
relationship_conclusion 与每条 breakthrough_direction 必须显式对准【他的那件事 + 他想要的方向】，
不许只复述日主/食神/流年三个泛化标签。
structural_basis 必须从实例清单【锚定至少 3 项具体本地结构】（神煞倾向 / 当前人生阶段步伐 / 当前时空效能引动 / 十神张力 / 本命关系等），
用软译白话讲清它们如何作用于 core_dilemma 与 desired_direction。
【锚定 = 讲清那个结构的意思】，不是把 大运/流年/神煞原名/生克短语 原样写进用户可见字段。

# 合规硬要求（用户可见字段 · 过支付审计）
给用户看的字段里（relationship_conclusion / direction.* / timing / what_would_confirm / first_question），
【禁止】出现以下裸词，必须用软译后的白话概念表达：
- 四柱结构词：大运/流年/日柱/月柱/时柱/年柱/命盘/八字/命局/四柱 → 用"当前的人生阶段/这段时期/你的能量结构"等；
- 带"煞/刃"的神煞名（孤鸾煞/寡宿/羊刃等）→ 【只说它的软译白话】（如"情感上容易孤立的倾向"/"执行锋芒"），【绝不出现"煞/刃"字样的原名】；
- 自创的五行生克短语：火金相克/火旺木焚/火金相战/相生相克/水火交战 等 → 【禁止】，改用大白话描述那股张力
  （如"你内在这股劲和外部的压力正较着劲，两边都在耗你"）。
reasoning 里可自由用命理词推演；输出给用户的字段必须软译。

# 输出表达硬要求（从源头保证通顺 · 白话重组，禁止抠词替换）
你在 reasoning 里用命理词深算（食神/正印/大运/火燥金克…）——这是你的推理骨架。
但给用户看的正文，【绝不是把命理词抠掉换成软译词】（那样句子还是命理句式，生硬不通）。
你必须：想通命理逻辑后，【用纯大白话【重新组织】这句话】，让意思由自然的人话承载，
软译词只作【轻锚】自然融入，或根本不出现。

反例（抠词替换·生硬 / 合规漏词）：
  ✗ "你的表达力被火烧，唤醒表达从容的柔性"
  ✗ "命局火燥金克，正印被合走"
  ✗ "大运火金相克，叠孤鸾煞"
正例（白话重组·通顺）：
  ✓ "你那些拿手的方案和想法，本来是你最趁手的武器，现在因为心里太焦躁，反而使不出来了（这在你的结构里叫'表达力'过旺失衡）"
  ✓ "你原本靠十几年经验攒下的底气，在这个新环境里反而被当成'倚老卖老'，让你有口难辩"
  ✓ "你这段时期里，内在那股冲劲和外部约束正较着劲；情感上又容易先把自己孤立开"

自检：读一遍你写的正文——像不像一个人在好好说话？
若有"XX被YY克/合/烧"这种命理句式残留，或裸露 大运/流年/日柱/煞名/相克短语，重写成大白话。
核心：先有通顺的白话正文，软译词是点缀不是主语。通顺在源头保证，不是靠白话解释补救。

# 排版硬要求（金字软译 + [···]；白话按通顺决定）
先写成【通顺、像人话、能一口气读下去】的白话全文。
需要锚定术语时，用 ⟦t:id|简洁软译|白话?⟧：
- 第二格 = 极短软译词（≤6 字），UI 以金字呈现，旁附 [···] 可点开；
- 第三格白话解释按"通顺与否"决定：
  · 若该软译词在你写的句子里已经通顺自然 → 第3格可省（留空；UI 回退固定 gloss 也可接受）；
  · 若该软译词仍生硬/专业、正文里不够自然 → 第3格【必须】写贴他处境的实时白话，不许留空只靠标准答案。
判断标准：一个没学过命理的人，在这句话里能不能顺读懂这个软译词？能→白话可省；不能→必须实时白话。
正确示范：
  "你那些拿手的方案和想法，现在因为太焦躁反而使不出来了⟦t:shi_shen|表达力|⟧。"
  （软译自然融入；白话可空）
  "你面对那套外部规则与考核⟦t:zheng_guan|规则感|就是你面对的'新标准、数字化考核'⟧时，尤其别硬扛。"
  （软译偏生硬时，第3格给贴情景白话）
错误示范（禁止）：
  ✗ "你的表达力被火烧"——命理句式抠词残留
  ✗ "⟦t:shi_shen|食神 · 就是你提的那些方案…|一长串⟧"——软译格塞成长句
原则：通读像人话；金字软译是轻点缀；想深究再点 [···]。

# 术语降噪（首次打标、后续白话 · 一段最多 1–2 个）
同一个术语，仅在【首次出现】时打标；后续再提到，直接用白话，不再打标。
每一段话打标术语控制在 1–2 个；宁可少标、把话说透，也不要密密麻麻。

# reasoning vs content（硬要求 · 真算但合规）
- **reasoning（思考过程）**：可自由使用裸命理术语深算（食神/大运/身弱/日主等），合规不检查 reasoning。
- **输出 JSON 各字符串字段**（relationship_conclusion / direction.* / first_question；agenda.label 除外）：
  先白话重组写通顺正文，再按需打标 ⟦t:<id>|<简洁软译≤6字>|<白话可空>⟧。
  reasoning 里可裸写；JSON 字段一旦引用命理词，必须打标（UI 渲染前 autoMarkBareTerms 会兜底补漏）。

# 输出（严格 JSON，无围栏，内部推理用中文；此输出不直接给用户看）
# 输出格式（硬约束 · 键名不可翻译）
输出必须是严格 JSON：所有键名用【英文小写】原样（relationship_conclusion / breakthrough_directions / investigation_agenda / first_question），
用标准 ASCII 双引号 \`"\`，不得翻译键名、不得用中文引号、不得截断、不得 markdown 围栏。
{
  "relationship_conclusion": "...",
  "breakthrough_directions": [
    { "direction": "...", "structural_basis": "...", "timing": "...", "what_would_confirm": "..." }
  ],
  "investigation_agenda": [ … 见下方议程段 ],
  "first_question": "…"
}

# 任务：从破局方向【倒推所需收集的信息】（Agenda Engine）

第1阶段已经了解了他的处境——【不要再去泛泛了解 / 盘问现状】。
第2阶段你已给出破局方向。议程的唯一目的是：
【列出「为了达成这些破局方向，第3阶段需要向他收集的关键信息」】。

议程仍是"收集信息"，但收集的是【服务于破局方向的信息】
（落地那条方向前必须先知道的事）——
既不是第1阶段那种「泛泛了解处境」，
也不是「敲定怎么执行方案」（那是收集完之后第4阶段综合的事，别拔高）。

## 规则
- 严禁通用问卷。不要"做什么行业 / 试过什么 / 期望什么"这类放之四海皆准的字段。
- 每一项议程都必须从某条 breakthrough_direction 倒推——是【落地那条方向】前必须先知道的一项关键信息。
- 是「为了走通这条方向，我还需要知道的事」，不是「泛泛了解他现状」的问题。
- 换一个命盘 / 问题就不成立（足够扣住他这条方向、这个诉求）。
- 3–5 项（宁少而锐）。其中 ≥2 项 critical=true（不收集就无法落地对应破局方向）。
- 每项 { id, label, critical, status:"unexplored", supports }；
  supports 必须写明它服务于哪条 direction 的落地（例："落地方向：先修复家庭温度再稳工作"）。
- label 是第3阶段要问清的信息目标，可锐利、直指要害；是你的【私有收集计划】，不是逐字念给用户的问题。

## 正反例（硬要求）
反例（严禁 · 这是第1阶段的泛泛了解处境）：
  ✗ "妻子烦躁的具体触发点是什么？"（泛泛了解现状，不扣任何破局方向）
  ✗ "有没有可倾诉的外部支撑？"（摸情况）
  ✗ "独处冷却时间够不够？"（盘问现状）
正例（为落地某条破局方向而收集的信息）：
  ✓ 方向="先修复家庭温度再稳工作" → 收集"你俩现在还有没有能说上话的话题/时间窗口"
    （落地这条方向必须先知道）
  ✓ 方向="用老客户当跳板跳出去" → 收集"这个客户关系深到什么程度、家庭能接受多长过渡期"
    （落地这条方向必须先知道）

## 自检（不通过就重写）
- 每一项议程，问自己："收集这一项信息，是为了达成【哪一条破局方向】？"
  若答案是"只是想更了解他的处境" → 删掉重写（那是第1阶段的事）。
- 把每项盖住 supports 看：它像不像"通用问卷 / 摸情况题"？像 → 删掉重写。
- 这份议程换一个命盘还成立吗？成立 → 太通用，重写。

## 追加进上面的 JSON：
"investigation_agenda": [
  { "id":"...", "label":"...", "critical":true, "status":"unexplored", "supports":"落地方向：…" }
],

# 任务（续）：首问（first_question · 给用户看的引导提问）
investigation_agenda 的 label 是【内部收集清单】——【禁止】直接甩给用户当提问。
额外生成 first_question：针对【第一个议程项】及其服务的破局方向，写一句详细、有温度、引导性的提问。

要求：
- 先用一句话说明"为什么要问这个"（连到它所服务的破局方向），再自然地问出来；
- 具体、引导用户好回答，像顾问在对话，不是甩一个标签；
- 针对 first agenda item（为落地某条破局方向所需收集的信息）；
- 用用户能直接开口回答的口语，可含 1–2 个具体场景提示。

正例（议程 label="现有冷却方式与独处时间"，服务破局方向"建立冷却机制"）：
  "要帮你把『先降火再回家』这个方向落地，我得先了解你现在有没有属于自己的冷却时间——
   比如下班到进家门之间，有没有一段哪怕十分钟、完全不被打扰、能让你缓一口气的空档？
   你现在是怎么给自己降温的，还是基本没有这个环节？"

反例（禁止）：
  ✗ "现有冷却方式与独处时间？"（把内部 label 加问号）
  ✗ "你有冷却时间吗？"（太短、不连破局方向）

"first_question": "…"
`;

export type BreakthroughCoreLLMResponse = {
  relationship_conclusion: string;
  breakthrough_directions: Array<{
    direction: string;
    structural_basis: string;
    timing: string;
    what_would_confirm: string;
  }>;
  investigation_agenda: unknown;
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

  const baseStr = JSON.stringify(base_analysis, null, 2).slice(0, 12000);
  const factGuard = buildChatFactGuardBlock(structured, {
    directedRelations: directedDynamic,
    verbose: true,
  });

  const system = stitchPromptSections(
    POJU_IDENTITY,
    POJU_KNOWLEDGE_ROOTS,
    buildOutputPolicyForPoju(),
    directedInventoryBlock,
    buildStructuredInstanceInventory(structured),
    DEEP_RECKONING_TASK,
  );

  const segment1 = agent_v2 ? formatSegment1UnderstandingForPrompt(agent_v2) : "（第1段理解门字段尚未写入。）";

  const user = `【locale】${locale}

【第1段理解门产出（推演靶心 · 必须显式扣住）】
${segment1}

【命主基础分析（节选/全文）】
${baseStr}

【用户原始问题】
"${original_question}"

【问题类别】
${questionCategory ?? "other"}

【收集到的具体上下文】
${contextText}

${factGuard}

【任务】
输出上述 JSON（relationship_conclusion + breakthrough_directions + investigation_agenda + first_question）。仅 JSON，无 markdown 围栏。`;

  return { system, user, structured, auditRelations: auditAllowlist };
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

function normalizeSalvagedDirections(raw: unknown): Array<Record<string, string>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Record<string, string>> = [];
  for (const d of raw) {
    if (!d || typeof d !== "object") continue;
    const row = d as Record<string, unknown>;
    const direction = typeof row.direction === "string" ? row.direction.trim() : "";
    const structural_basis = typeof row.structural_basis === "string" ? row.structural_basis.trim() : "";
    const timing = typeof row.timing === "string" ? row.timing.trim() : "";
    const what_would_confirm =
      typeof row.what_would_confirm === "string" ? row.what_would_confirm.trim() : "";
    if (!direction && !structural_basis && !timing && !what_would_confirm) continue;
    out.push({
      direction: direction || structural_basis.slice(0, 80) || "待补方向",
      structural_basis: structural_basis || "待补结构依据",
      timing: timing || "当前阶段",
      what_would_confirm: what_would_confirm || direction || "待补验证点",
    });
  }
  return out;
}

function agendaFromSalvagedDirections(
  directions: Array<Record<string, string>>,
): AgendaItem[] | null {
  if (directions.length < 2) return null;
  const items: AgendaItem[] = [];
  for (let i = 0; i < directions.length; i++) {
    const d = directions[i]!;
    const label = (d.what_would_confirm || d.direction).trim().slice(0, 40);
    if (!label) continue;
    items.push({
      id: `agenda_${i + 1}`,
      label,
      critical: i < 2,
      status: "unexplored",
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

  const relationship_conclusion =
    (typeof base.relationship_conclusion === "string" ? base.relationship_conclusion.trim() : "") ||
    grabSalvageStringField(cleaned, ["relationship_conclusion", "关系结论"]) ||
    "";
  if (!relationship_conclusion) return null;

  let directions = normalizeSalvagedDirections(base.breakthrough_directions);
  if (directions.length < 2) {
    const block = extractJsonArrayBlock(cleaned, ["breakthrough_directions", "破局方向"]);
    if (block) directions = normalizeSalvagedDirections(tryParseJsonArray(block));
  }
  if (directions.length < 2) return null;

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
    investigation_agenda = agendaFromSalvagedDirections(directions);
  }
  if (!investigation_agenda) return null;

  const first_question =
    (typeof base.first_question === "string" ? base.first_question.trim() : "") ||
    grabSalvageStringField(cleaned, ["first_question", "首问"]) ||
    "";

  return {
    relationship_conclusion,
    breakthrough_directions: directions,
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
  if (typeof o.relationship_conclusion === "string") parts.push(o.relationship_conclusion);
  const dirs = o.breakthrough_directions;
  if (Array.isArray(dirs)) {
    for (const d of dirs) {
      if (!d || typeof d !== "object") continue;
      const row = d as Record<string, unknown>;
      for (const k of ["direction", "structural_basis", "timing", "what_would_confirm"] as const) {
        if (typeof row[k] === "string") parts.push(row[k]);
      }
    }
  }
  const agenda = parseInvestigationAgenda(o.investigation_agenda);
  if (agenda) {
    for (const item of agenda) parts.push(item.label);
  }
  if (typeof o.first_question === "string") parts.push(o.first_question);
  return parts.join("\n");
}

export function mapBreakthroughCorePayload(parsed: unknown): {
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
} {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Breakthrough core response is not an object");
  }
  const o = parsed as Record<string, unknown>;
  const relationship_conclusion =
    typeof o.relationship_conclusion === "string" ? o.relationship_conclusion.trim() : "";
  if (!relationship_conclusion) {
    throw new Error("Missing relationship_conclusion");
  }

  const rawDirs = o.breakthrough_directions;
  if (!Array.isArray(rawDirs) || rawDirs.length < 2 || rawDirs.length > 3) {
    throw new Error("breakthrough_directions must be an array of 2–3 items");
  }

  const breakthrough_directions = rawDirs.map((d, i) => {
    if (!d || typeof d !== "object") throw new Error(`breakthrough_directions[${i}] invalid`);
    const row = d as Record<string, unknown>;
    const direction = typeof row.direction === "string" ? row.direction.trim() : "";
    const structural_basis = typeof row.structural_basis === "string" ? row.structural_basis.trim() : "";
    const timing = typeof row.timing === "string" ? row.timing.trim() : "";
    const what_would_confirm =
      typeof row.what_would_confirm === "string" ? row.what_would_confirm.trim() : "";
    if (!direction || !structural_basis || !timing || !what_would_confirm) {
      throw new Error(`breakthrough_directions[${i}] missing required fields`);
    }
    return { direction, structural_basis, timing, what_would_confirm, status: "hypothesis" as const };
  });

  const investigation_agenda = parseInvestigationAgenda(o.investigation_agenda);
  if (!investigation_agenda) {
    throw new Error("investigation_agenda failed parseInvestigationAgenda validation");
  }

  const first_question =
    typeof o.first_question === "string" && o.first_question.trim()
      ? o.first_question.trim()
      : undefined;

  const now = new Date().toISOString();
  return {
    breakthrough_core: {
      relationship_conclusion,
      breakthrough_directions,
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
 * Fix B — mutate user-visible breakthrough fields, then hard-block if payment leaks remain.
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
} {
  const core = mapped.breakthrough_core;
  const breakthrough_core: BreakthroughCore = {
    ...core,
    relationship_conclusion: scrubUserField(core.relationship_conclusion, locale),
    breakthrough_directions: core.breakthrough_directions.map((d) => ({
      ...d,
      direction: scrubUserField(d.direction, locale),
      structural_basis: scrubUserField(d.structural_basis, locale),
      timing: scrubUserField(d.timing, locale),
      what_would_confirm: scrubUserField(d.what_would_confirm, locale),
    })),
    ...(core.first_question
      ? { first_question: scrubUserField(core.first_question, locale) }
      : {}),
  };
  const investigation_agenda = mapped.investigation_agenda.map((a) => ({
    ...a,
    label: scrubUserField(a.label, locale),
  }));

  const auditBlob = [
    breakthrough_core.relationship_conclusion,
    ...breakthrough_core.breakthrough_directions.flatMap((d) => [
      d.direction,
      d.structural_basis,
      d.timing,
      d.what_would_confirm,
    ]),
    ...(breakthrough_core.first_question ? [breakthrough_core.first_question] : []),
  ].join("\n");

  const violations = auditPaymentLeakResiduals(auditBlob, locale);
  return { breakthrough_core, investigation_agenda, violations };
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

/** Parse + map + payment-audit sanitize; throws BreakthroughCoreComplianceError on residual leaks. */
export function parseSanitizeBreakthroughCore(
  raw: string,
  locale: string,
): {
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
} {
  const mapped = parseAndMapBreakthroughCore(raw);
  const sanitized = sanitizeBreakthroughCoreMapped(mapped, locale);
  if (
    sanitized.violations.length > 0 &&
    isCriticalDeliveryAuditFailure(sanitized.violations)
  ) {
    throw new BreakthroughCoreComplianceError(sanitized.violations);
  }
  return {
    breakthrough_core: sanitized.breakthrough_core,
    investigation_agenda: sanitized.investigation_agenda,
  };
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

  if (!breakthrough_core || !investigation_agenda) {
    throw new Error("Breakthrough core incomplete after job");
  }

  const nextAgent: POJUAgentState = {
    ...agent,
    breakthrough_core,
    investigation_agenda,
    agenda_generated: true,
    has_situation_analysis: true,
  };

  console.info(
    "[breakthrough-core] persisted:",
    breakthrough_core.relationship_conclusion.slice(0, 80),
    "directions:",
    breakthrough_core.breakthrough_directions.length,
    "agenda:",
    investigation_agenda.map((a) => a.label),
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
