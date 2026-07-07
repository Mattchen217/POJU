/**
 * Block 2 Phase 3 — 深测算 pass（破局推理脊柱 + 议程倒推）
 * LLM 走 `POST /api/poju/breakthrough-core`；结果写入 `agent_v2.breakthrough_core` + `investigation_agenda`。
 */

import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import { parseInvestigationAgenda, type AgendaItem } from "@/lib/poju/investigation-agenda";
import type { POJUSessionState } from "@/lib/poju/types";
import { loadSessionProfileBundle } from "@/lib/poju/session-profile";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { POJU_IDENTITY, POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { extractJson } from "@/lib/llm/phases/phase-transport";
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import { resolveAgendaRelationContext } from "@/lib/llm/prompts/relation-closed-set-context";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { RelationLabel } from "@/lib/calculations/relation-engine";

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
- 神煞（仅闭集 9、且仅本盘实有的那几个）：点出与所问之事相关的助力或隐忧
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
- investigation_agenda：3–4 项即可；每项 label ≤20 字，锐而短，直指验证目标。

# 输出（严格 JSON，无围栏，内部推理用中文；此输出不直接给用户看）
{
  "relationship_conclusion": "...",
  "breakthrough_directions": [
    { "direction": "...", "structural_basis": "...", "timing": "...", "what_would_confirm": "..." }
  ],
  "investigation_agenda": [ … 见下方议程段 ]
}

# 任务（续）：反向拆解 → 定制议程（Agenda Engine）

基于你刚产出的 breakthrough_directions，执行【反向拆解法】：
要验证 / 证伪这几条破局方向，你必须从这个用户嘴里搞清楚哪几件事？

## 规则
- 严禁通用问卷。不要"做什么行业 / 试过什么 / 期望什么"这类放之四海皆准的字段——
  那是任何教练都会问的废话，正是要废除的"通用 7 问"。
- 每一项议程都必须从某条 breakthrough_direction 倒推出来，针对【这个命盘 + 这个问题】的致命痛点。
- 3–5 项（宁少而锐）。其中 ≥2 项 critical=true（不搞清就无法验证方向、无法下判断）。
- 每项 { id, label, critical, status:"unexplored", supports }；supports 必须写明它验证哪条 direction。
- label 是你内部的调查目标，措辞可锐利、直指要害；它是你的【私有调查计划】，不是逐字念给用户的问题。

## 锚定用户核心诉求（硬要求 · 议程必须扣题）
生成 investigation_agenda 时，每一项都必须是【为了破解用户这个具体问题（见输入「用户原始问题」的核心诉求）所必须搞清的信息】，
而不是对这个人做泛泛的性格/技能/兴趣画像。
- 先在心里锁定核心诉求（如"再婚"=如何走向一段新的亲密关系）；障碍（事业/钱/社交）只作背景，不作议程主题。
- 每一项议程，问自己："弄清这一项，是否直接帮助回答/破解他这个核心诉求？" 否则删掉重拟。
- 反例（婚姻问题却问这些=跑题）：工作核心技能、学习兴趣、自我充电习惯。
- 正例（婚姻问题应问这些）：过往亲密关系的模式与卡点、对伴侣的真实期待、迈出第一步的具体顾虑、能接触到人的现实场景。

## 自检（不通过就重写）
- 把每项盖住 supports 看：它像不像"通用问卷题"？像 → 删掉重写成命盘特异的。
- 这份议程换一个命盘还成立吗？成立 → 太通用，重写。

## 追加进上面的 JSON：
"investigation_agenda": [
  { "id":"...", "label":"...", "critical":true, "status":"unexplored", "supports":"验证 direction X" }
]`;

export type BreakthroughCoreLLMResponse = {
  relationship_conclusion: string;
  breakthrough_directions: Array<{
    direction: string;
    structural_basis: string;
    timing: string;
    what_would_confirm: string;
  }>;
  investigation_agenda: unknown;
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

  const user = `【locale】${locale}

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
输出上述 JSON（relationship_conclusion + breakthrough_directions + investigation_agenda）。仅 JSON，无 markdown 围栏。`;

  return { system, user, structured, auditRelations: auditAllowlist };
}

export function parseBreakthroughCoreResponseText(raw: string): unknown {
  return JSON.parse(extractJson(raw)) as unknown;
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

  const now = new Date().toISOString();
  return {
    breakthrough_core: {
      relationship_conclusion,
      breakthrough_directions,
      generated_at: now,
    },
    investigation_agenda,
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
  options?: { base_analysis?: unknown | null },
): Promise<{ session: POJUSessionState; tokens_used: number }> {
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
  const softTimeoutMs = 240_000;
  const timer = window.setTimeout(() => ac.abort(), softTimeoutMs);

  let res: Response;
  try {
    res = await fetch("/api/poju/breakthrough-core", {
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
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        locale.startsWith("zh")
          ? "深测算超时未完成，再发一句继续即可。"
          : "Deep analysis timed out — send another message to retry.",
      );
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }

  const payload = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    retryable?: boolean;
    reason?: string;
    breakthrough_core?: BreakthroughCore;
    investigation_agenda?: AgendaItem[];
    model?: string;
    tokens_used?: number;
    error?: string;
  };

  if (payload.ok === false && payload.retryable) {
    console.warn(
      "[breakthrough-core] soft failure (retryable):",
      payload.reason ?? "unknown",
      payload.error ?? "",
    );
    return { session, tokens_used: 0 };
  }

  if (!payload.ok || !payload.breakthrough_core || !payload.investigation_agenda) {
    throw new Error(payload.error || `Breakthrough core failed (${res.status})`);
  }

  const tokens_used = typeof payload.tokens_used === "number" ? payload.tokens_used : 0;
  const nextAgent: POJUAgentState = {
    ...agent,
    breakthrough_core: payload.breakthrough_core,
    investigation_agenda: payload.investigation_agenda,
    agenda_generated: true,
    has_situation_analysis: true,
  };

  console.info(
    "[breakthrough-core] persisted:",
    payload.breakthrough_core.relationship_conclusion.slice(0, 80),
    "agenda:",
    payload.investigation_agenda.map((a) => a.label),
  );

  return {
    session: {
      ...session,
      agent_v2: nextAgent,
      tokens_used: session.tokens_used + tokens_used,
    },
    tokens_used,
  };
}
