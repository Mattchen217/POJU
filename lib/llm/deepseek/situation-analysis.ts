/**
 * Step 8 — 困境分析（DeepSeek / OpenRouter，按 session + 语境指纹可多次调用）
 * LLM 仅走 `POST /api/poju/situation-analysis`；缓存写入 `POJUSessionState.situation_analysis_by_fingerprint`。
 */

import type { POJUAgentState } from "@/lib/poju/agent-state";
import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import type { POJUSessionState, SituationAnalysisCacheEntry } from "@/lib/poju/types";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

const SITUATION_SYSTEM = `# 角色

你是中国传统命理学、风水与易经方向的资深顾问。
你已阅读【命主基础分析】（可能为节选或为空）。请针对【用户当下具体困境】给出深度、可执行的回应。

# 任务

结合基础分析（如有）+ 用户原始问题 + 已收集语境，输出【针对此次困境的深度分析】，供后续对话与交付参考。

# 输出格式（严格 JSON，不要 markdown 围栏）

{
  "困境本质": {
    "用户描述的问题": "",
    "命理视角的本质": "200-400 字",
    "为什么会发生": "200-400 字"
  },
  "用户处境深度解读": {
    "命局如何映射处境": "300-500 字",
    "命主优势在此事中": ["3-5 条"],
    "命主挑战在此事中": ["3-5 条"],
    "用户没意识到的动力": ["3-5 条"]
  },
  "破局之路": {
    "核心破局方向": "300-500 字",
    "时机判断": {
      "当前时机": "",
      "未来 3 个月": "",
      "未来 1 年": "",
      "关键转折时间点": [""]
    },
    "需要的内在转变": "300-500 字",
    "需要的外在调整": "200-400 字"
  },
  "传统行动建议": {
    "调候建议": [
      { "类别": "方位|颜色|物件|居所|名字", "具体建议": "", "命理依据": "", "实施难度": "easy|medium|hard" }
    ],
    "日常风水细节": ["5-8 条"],
    "搬迁/装修方向": "",
    "改名建议": ""
  },
  "现代实操建议": {
    "决策性行动": [
      { "行动": "", "具体内容": "", "时机": "immediate|this_week|this_month|ongoing", "依据": "" }
    ],
    "反思性行动": [{ "行动": "", "时长": "", "频率": "", "依据": "" }]
  },
  "关键警示": ["3-5 条"],
  "_meta": { "version": "v1.0", "question_category": "" }
}

# 写作要求

- 全部中文；具体可执行；行动含时间/内容/依据。
- 若缺少基础分析 JSON，禁止编造与用户未提供四柱相矛盾的个人定数；可写通用命理框架 + 语境推演并标明不确定性。
- 总字数建议 4000-8000（写在 JSON 字符串内）；合法 JSON。`;

export function buildSituationAnalysisPrompt(input: {
  base_analysis: unknown | null;
  agent_v2: POJUAgentState | null | undefined;
  original_question: string;
  locale: string;
}): { system: string; user: string } {
  const { base_analysis, agent_v2, original_question, locale } = input;
  const contextText = (() => {
    if (!agent_v2) return "（尚无结构化 agent_v2 语境，仅依赖扁平 context 与问题。）";
    try {
      return formatContextForPrompt(agent_v2);
    } catch {
      return "（语境结构不完整，已省略格式化块。）";
    }
  })();

  const baseStr =
    base_analysis === null || base_analysis === undefined
      ? "（未提供命主基础分析缓存；请主要依据下列语境与问题作答。）"
      : JSON.stringify(base_analysis, null, 2).slice(0, 12000);

  const user = `【locale】${locale}

【命主基础分析（节选/全文）】
${baseStr}

【用户原始问题】
"${original_question}"

【问题类别】
${agent_v2?.question_category ?? "other"}

【收集到的具体上下文】
${contextText}

【任务】
输出上述 JSON 结构的困境深度分析（仅 JSON，中文）。
_meta.question_category 填实际类别字符串。`;

  return { system: SITUATION_SYSTEM, user };
}

export function parseSituationAnalysisResponseText(raw: string): unknown {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as unknown;
}

export function getCachedSituationAnalysis(
  session: POJUSessionState,
  fingerprint: string,
): SituationAnalysisCacheEntry | undefined {
  return session.situation_analysis_by_fingerprint?.[fingerprint];
}

/**
 * 解析 `base_analysis`：优先 `selected_stored_profile_id`，否则 `agent_v2.selected_profile_id`（UUID 形态）。
 */
export async function resolveBaseAnalysisForSession(session: POJUSessionState): Promise<unknown | null> {
  const id = session.selected_stored_profile_id ?? uuidLike(session.agent_v2?.selected_profile_id);
  if (!id) return null;
  const stored = await getStoredProfile(id);
  return stored?.base_analysis?.content ?? null;
}

function uuidLike(s: string | null | undefined): string | null {
  if (!s || s === "active_user_profile") return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return s;
  return null;
}

export async function requestSituationAnalysis(
  session: POJUSessionState,
  locale: string,
  options?: { force?: boolean; base_analysis?: unknown | null },
): Promise<{ session: POJUSessionState; cache_hit: boolean; fingerprint: string }> {
  if (typeof window === "undefined") {
    throw new Error("requestSituationAnalysis is browser-only");
  }

  const fingerprint = await computeSituationContextFingerprint({
    session_id: session.session_id,
    original_question: session.original_question,
    agent_v2: session.agent_v2,
    context_collected: session.context_collected,
  });

  const existing = getCachedSituationAnalysis(session, fingerprint);
  if (existing && !options?.force) {
    return { session, cache_hit: true, fingerprint };
  }

  let base_analysis = options?.base_analysis;
  if (base_analysis === undefined) {
    base_analysis = await resolveBaseAnalysisForSession(session);
  }

  const res = await fetch("/api/poju/situation-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: session.session_id,
      original_question: session.original_question,
      agent_v2: session.agent_v2 ?? null,
      context_collected: session.context_collected,
      base_analysis,
      locale,
      context_fingerprint: fingerprint,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    analysis?: unknown;
    model?: string;
    tokens_used?: number;
    fingerprint?: string;
    error?: string;
  };

  if (!res.ok || !payload.ok || payload.analysis === undefined) {
    throw new Error(payload.error || `Situation analysis failed (${res.status})`);
  }

  const fp = typeof payload.fingerprint === "string" ? payload.fingerprint : fingerprint;
  const entry: SituationAnalysisCacheEntry = {
    context_fingerprint: fp,
    generated_at: new Date().toISOString(),
    model: typeof payload.model === "string" ? payload.model : "unknown",
    tokens_used: typeof payload.tokens_used === "number" ? payload.tokens_used : 0,
    content: payload.analysis,
  };

  const prevMap = session.situation_analysis_by_fingerprint ?? {};
  const nextSession: POJUSessionState = {
    ...session,
    tokens_used: session.tokens_used + entry.tokens_used,
    situation_analysis_by_fingerprint: { ...prevMap, [fp]: entry },
  };

  return { session: nextSession, cache_hit: false, fingerprint: fp };
}
