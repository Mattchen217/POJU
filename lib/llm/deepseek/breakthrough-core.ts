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
import { formatBaseAnalysisForPrompt, normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { extractJson, tolerantJsonRepair, tryParseJsonObject } from "@/lib/llm/phases/phase-transport";
import { normalizeAgendaFromLlm } from "@/lib/poju/opening-conversion-payload";
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import { resolveAgendaRelationContext } from "@/lib/llm/prompts/relation-closed-set-context";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { RelationLabel } from "@/lib/calculations/relation-engine";
import {
  auditPaymentLeakResiduals,
  buildTermMarkingPromptBlock,
  sanitizePaymentAuditLeaks,
  type ComplianceViolation,
} from "@/lib/llm/sanitize/compliance-terms";
import { buildDualLayerDeliveryPromptBlock } from "@/lib/llm/prompts/dual-layer-delivery";
import { isCriticalDeliveryAuditFailure } from "@/lib/llm/services/delivery-audit-regen";

/**
 * Call A (xhigh) — report only. NO agenda / first_question rules (those belong to Call B).
 * Splitting rules is as important as splitting the call: dumping both handbooks still blows reasoning.
 */
export const DEEP_RECKONING_REPORT_TASK = `# 角色：破局总设计师（上帝视角 · 零聊天腔）

你不是在跟用户对话。你是在一间没有用户在场的作战室里，对着这个人【真实排算出的命盘结构】
和他的问题，做一次冷静、硬核、不注水的深度推演。你的产出是后续整个破局流程的【唯一推理脊柱】
—— 稍后另一次调用会据此倒推议程；本次【只产出报告】。彻底剥离聊天语气。

# 输入（structured + core_judgments 是你唯一的事实源）
- day_master / pattern / strength / yong_shen / xi_shen / ji_shen
- four_pillars 与 pillars_detail.{year|month|day|hour}.{ten_god, hidden_stems, shen_sha, life_stage}
- da_yun（当前走到第几步、主题、何时转）
- core_judgments（已裁定展开：identity_anchor / drive_mechanism / structural_gap / balance_anchor / exchange_mode / leverage_state / climate_now）——**以它统一口径，禁止改判 structured**
- 用户原始问题 + 已确认处境（第1段他说过的具体词句）

# 任务（仅此两项）
1. relationship_conclusion：把"困境"翻译成结构性原因；点名 structured 具体字段；不许泛泛而谈。
2. breakthrough_directions（2–3 条，宁少而锐）：
   { direction, structural_basis, timing, what_would_confirm }

# timing（硬约束 · 只判进/守/转）
timing 只写【进 / 守 / 转 的时机判断】（如"当前宜守不宜攻，不是硬碰的时候"）。
【严禁】写具体行动步骤（"每天半小时"、"约老同事喝茶"、"写下方法论"…）——
那是第4段【完整交付】的任务；第2段只给【方向 + 结构依据 + 时机判断】。
第2段还没收集任何信息，此时给的"怎么做"必然是万能模板，会毁掉交付价值。

# 维度织入（反"只看五行"）
structural_basis ≥2 个不同维度：十神/格局、五行强弱/用神喜忌、大运时机、本盘实算神煞、十二长生。
≥1 条须带 timing。本盘无实例就跳过，禁编造。

# 硬核标准
- 每条结论/方向可追溯到 structured，否则删掉。
- 两条致命方向 > 三条平庸方向。
- 命理词只用本次 structured 实例；严禁集外神煞。

# 篇幅
- relationship_conclusion：2–4 短段，段间空行，每段 ≤120 字、≤2 个打标。
- structural_basis：一句话点锚点，禁止段落复述。

# 字段=纯内容（前端固定排版）
禁字段内标题/编号/markdown（###、**加粗**、"结构依据："前缀）。direction / structural_basis / timing 直接写句。what_would_confirm 不展示给用户。

# 第1段靶心
显式扣住 core_dilemma + desired_direction。structural_basis 从实例清单锚定 ≥3 项本地结构；【锚定=讲清意思】。

# 合规（用户可见字段 · 加强）
正文【严禁】裸写：大运/流年/年柱/月柱/日柱/时柱/命盘/八字、正印/食神/伤官等十神原名、甲乙…壬癸 + 子丑…亥 / 金木水火土 连写（如"壬水"）、带煞/刃神煞原名、自创生克短语。
reasoning 可裸算；输出必须白话重组（禁抠词替换）。

# 双层 + 打标（软译词不用写）
- **direction / relationship_conclusion**：纯白话、【零标记】。
- **structural_basis / timing**：依据层——可打 \`⟦t:<slug>|<贴题白话>⟧\`（≤3 金字合计）；软译由系统填入。
- 贴题白话【必须引用他亲口说过的东西】；换用户还成立 → 重写。
- 禁自造 slug；无 slug 直接白话。

# reasoning vs content
reasoning 可裸命理词；JSON 可见字段先白话；依据字段按需打标。

# 输出（严格 JSON · 仅报告字段 · 无议程）
键名英文小写 ASCII 双引号，无围栏。
{
  "relationship_conclusion": "...",
  "breakthrough_directions": [
    { "direction": "...", "structural_basis": "...", "timing": "...", "what_would_confirm": "..." }
  ]
}
【禁止】输出 investigation_agenda / first_question —— 另一次调用处理。
`;

/** @deprecated Alias — Call A report task. */
export const DEEP_RECKONING_TASK = DEEP_RECKONING_REPORT_TASK;

/**
 * Call B (high) — agenda + 承上启下提问. Fact source = A JSON only. No chart dump / layout handbook.
 */
export const AGENDA_BRIDGE_TASK = `# 角色：议程与首问撰写（承上启下）

你只拿到【Call A 已定稿的破局报告 JSON】作为唯一事实源。不要重写分析，不要复述命盘。

# 任务
1. investigation_agenda（3–5 项，宁少而锐）：从 A 的 breakthrough_directions 倒推「落地某条方向前必须先知道」的信息。
2. first_question：一条给用户的消息——先承上、再启下、直接问真问题。

# 议程规则
- 严禁通用问卷 / 摸现状（那是第1段的事）。
- 每项议程必须标注它服务于【A 报告里第几条破局方向】：direction_index（1 / 2 / 3）。
  supports 写自然语言说明即可（如「落地方向：先把火浇灭」），【不必照抄】方向原文——锚定以 direction_index 为准。
- ≥2 项 critical=true。
- 每项 { id, label, critical, status:"unexplored", direction_index, supports }。
- **label（用户面板可见）**：必须用【第二人称】短名词短语（如"你的冷却时段"、"能吐槽的人"、"最硬的那块经验"）。
  【禁止】第三人称内部笔记句（"他目前有没有…"、"了解其冷却方式"）。
  【禁止】把完整问句当 label——完整问句只放 first_question。
- 换一个命盘/问题就不成立 → 够具体。

# first_question 硬要求（一条消息搞定）
1) 先承上：一句话呼应上面那份分析（不要复述内容）；
2) 再启下：说明为了落地【A 中某一条具体 direction（引用其原话要点）】，需要先弄清什么；
3) 直接问出第一个议程项的真问题：具体、好回答、可带场景提示。
【禁止】yes/no 过场（「你看完了吗？」「可以开始了吗？」）。
【禁止】把议程 label 直接甩出来当问题。
【禁止】照抄任何固定范文——必须对着这位用户的报告现场写。

# 打标要点（仅对 first_question）
需要时用 \`⟦t:<闭集slug>|软译|白话?⟧\`；白话只进第3格；禁自造 id。议程 label 不打标。

# 输出（严格 JSON）
{
  "investigation_agenda": [
    { "id":"...", "label":"你的冷却时段", "critical":true, "status":"unexplored", "direction_index":1, "supports":"落地方向：先把火浇灭" }
  ],
  "first_question": "…"
}
`;

export type BreakthroughCoreLLMResponse = {
  relationship_conclusion: string;
  breakthrough_directions: Array<{
    direction: string;
    structural_basis: string;
    timing: string;
    what_would_confirm: string;
  }>;
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
只输出报告 JSON（relationship_conclusion + breakthrough_directions）。不要输出 investigation_agenda / first_question。仅 JSON，无 markdown 围栏。`;

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
      relationship_conclusion: breakthrough_core.relationship_conclusion,
      breakthrough_directions: breakthrough_core.breakthrough_directions,
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

【Call A 定稿报告（唯一事实源 · 勿改写结论）】
${coreJson}

【任务 · Call B】
输出 investigation_agenda + first_question（承上启下真问题，禁 yes/no 过场）。仅 JSON。`;

  return { system, user };
}

/**
 * Deterministic Call B anchor: prefer direction_index (1-based).
 * Fallback only when index missing — fuzzy match supports vs direction text
 * (strip punctuation/whitespace; LCS ratio ≥ 0.6). No exact string match.
 */
export function validateAgendaAnchorsToDirections(
  agenda: AgendaItem[],
  directions: BreakthroughCore["breakthrough_directions"],
): { ok: true; agenda: AgendaItem[] } | { ok: false; reason: string } {
  if (!Array.isArray(agenda) || agenda.length === 0) {
    return { ok: false, reason: "empty_agenda" };
  }
  if (!Array.isArray(directions) || directions.length === 0) {
    return { ok: false, reason: "empty_directions" };
  }

  const max = directions.length;
  const resolved: AgendaItem[] = [];

  for (const item of agenda) {
    let idx =
      typeof item.direction_index === "number" && Number.isInteger(item.direction_index)
        ? item.direction_index
        : undefined;

    if (idx == null || idx < 1 || idx > max) {
      const fuzzy = fuzzyMatchDirectionIndex(String(item.supports ?? ""), directions);
      if (fuzzy == null) {
        return { ok: false, reason: `unanchored:${item.id || item.label}` };
      }
      idx = fuzzy;
    }

    resolved.push({ ...item, direction_index: idx });
  }

  return { ok: true, agenda: resolved };
}

/** Strip punctuation / whitespace / common prefixes for fuzzy direction compare. */
function normalizeForDirectionAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/落地方向\s*[:：\-—–]*/g, "")
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

function fuzzyMatchDirectionIndex(
  supports: string,
  directions: BreakthroughCore["breakthrough_directions"],
): number | null {
  const needle = normalizeForDirectionAnchor(supports);
  if (needle.length < 2) return null;

  let bestIdx = -1;
  let bestRatio = 0;
  for (let i = 0; i < directions.length; i++) {
    const hay = normalizeForDirectionAnchor(directions[i]?.direction ?? "");
    if (hay.length < 2) continue;
    const lcs = longestCommonSubstringLen(needle, hay);
    const ratio = lcs / Math.max(needle.length, hay.length);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestIdx = i + 1;
    }
  }
  return bestRatio >= 0.6 ? bestIdx : null;
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
      direction_index: i + 1,
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

  const investigation_agenda =
    parseInvestigationAgenda(o.investigation_agenda) ??
    normalizeAgendaFromLlm(o.investigation_agenda) ??
    [];

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
      ...(d.timing != null ? { timing: scrubUserField(d.timing, locale) } : {}),
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
    ...breakthrough_core.breakthrough_directions.flatMap((d) =>
      [d.direction, d.structural_basis, d.timing, d.what_would_confirm].filter(
        (s): s is string => typeof s === "string" && s.length > 0,
      ),
    ),
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

/** Call B parse + anchor check against A's directions. */
export function parseSanitizeAgendaBridge(
  raw: string,
  locale: string,
  directions: BreakthroughCore["breakthrough_directions"],
): {
  investigation_agenda: AgendaItem[];
  first_question: string;
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
  const scrubbedQ = scrubUserField(first_question, locale);

  const anchor = validateAgendaAnchorsToDirections(scrubbedAgenda, directions);
  if (!anchor.ok) {
    throw new AgendaAnchorError(anchor.reason);
  }

  const violations = auditPaymentLeakResiduals(scrubbedQ, locale);
  if (violations.length > 0 && isCriticalDeliveryAuditFailure(violations)) {
    throw new BreakthroughCoreComplianceError(violations);
  }

  return { investigation_agenda: anchor.agenda, first_question: scrubbedQ };
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
    breakthrough_core.relationship_conclusion.slice(0, 80),
    "directions:",
    breakthrough_core.breakthrough_directions.length,
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
