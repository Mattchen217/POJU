/**
 * Step 9 — 最终交付（DeepSeek V4 Pro / OpenRouter：整合 base + situation，按用户语言输出长文 + 行动卡）
 * 与 Step 7/8 同栈：`POST /api/poju/final-delivery` → `callLLM`。
 */

import { safeRandomUUID } from "@/lib/client/safe-crypto";
import type { POJUAgentState } from "@/lib/poju/agent-state";
import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import type { POJUAction, POJUDelivery, POJUSessionState, POJUMessage } from "@/lib/poju/types";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";
import { getCachedSituationAnalysis, resolveBaseAnalysisForSession } from "@/lib/llm/deepseek/situation-analysis";
import { buildPojuCorePromptSections } from "@/lib/llm/prompts/poju-base";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";

export interface FinalDeliveryResult {
  full_text: string;
  actions: POJUAction[];
  model: string;
  tokens_used: number;
  latency_ms: number;
  cost_usd: number;
}

function safeJsonSlice(value: unknown, max: number): string {
  if (value === undefined || value === null) return "(none)";
  try {
    return JSON.stringify(value, null, 2).slice(0, max);
  } catch {
    return String(value).slice(0, max);
  }
}

export type DeliveryLanguageCode = "zh" | "en" | "es" | "fr" | "de";

const DELIVERY_LANGUAGE_NAMES: Record<DeliveryLanguageCode, string> = {
  zh: "Chinese (简体中文)",
  en: "English",
  es: "Spanish (Español)",
  fr: "French (Français)",
  de: "German (Deutsch)",
};

/** Infer output language from question, chat turns, and locale — never default to Chinese only. */
export function resolveDeliveryLanguage(input: {
  original_question: string;
  locale: string;
  recent_user_messages?: string[];
}): { code: DeliveryLanguageCode; instruction: string } {
  const samples = [
    input.original_question,
    ...(input.recent_user_messages ?? []).slice(-8),
  ]
    .join("\n")
    .trim();

  const localeBase = (input.locale.split("-")[0] || "en").toLowerCase();
  let code: DeliveryLanguageCode = "en";

  if (/[\u4e00-\u9fa5]/.test(samples)) {
    code = "zh";
  } else if (/[áéíóúñ¿¡]/i.test(samples)) {
    code = "es";
  } else if (/[àâäéèêëîïôöùûüÿç]/i.test(samples)) {
    code = "fr";
  } else if (/[äöüß]/i.test(samples)) {
    code = "de";
  } else if (localeBase === "zh" || localeBase === "es" || localeBase === "fr" || localeBase === "de") {
    code = localeBase as DeliveryLanguageCode;
  }

  const name = DELIVERY_LANGUAGE_NAMES[code];
  const instruction = `Write the ENTIRE delivery (every section, every action, every sentence) in ${name}. Do NOT output Chinese unless the user's language is Chinese. Do NOT output English unless the user's language is English. If the user mixed languages, use the language they used most in their question and recent messages.`;

  return { code, instruction };
}

/** Non-Chinese deliveries: Action 2 must use platforms the user can use locally (Step K / issue 12). */
export function buildRegionalPlatformGuidance(code: DeliveryLanguageCode): string {
  if (code === "zh") return "";
  return `# Regional platforms (Action 2 — Modern Decisive Action)

- Assume the user is in North America / global English context unless they stated otherwise.
- Prefer: LinkedIn, Reddit, industry Discords/Slack, email outreach, local meetups, Upwork/Fiverr if relevant.
- Do NOT recommend 知乎, 微博, 豆瓣, 脉脉, 小红书, or other China-only platforms unless the user explicitly operates in China.`;
}

export function buildFinalDeliveryPrompt(input: {
  base_analysis: unknown | null;
  situation_analysis: unknown | null;
  agent_v2: POJUAgentState;
  locale: string;
  recent_user_messages?: string[];
}): { system: string; user: string } {
  const { base_analysis, situation_analysis, agent_v2, locale, recent_user_messages } = input;
  const baseStr = safeJsonSlice(base_analysis, 3000);
  const sitStr = safeJsonSlice(situation_analysis, 3000);
  const { code: deliveryLang, instruction: langInstruction } = resolveDeliveryLanguage({
    original_question: agent_v2.original_question,
    locale,
    recent_user_messages,
  });
  const regionalGuidance = buildRegionalPlatformGuidance(deliveryLang);

  const finalDeliveryTask = `# 当前任务：主交付（Final Delivery）

这是用户付费后的**最重要时刻**。用户已确认情境汇总，现在输出完整破局交付。

# 专家分析素材（可能为中文 — 仅作依据，勿照抄语言）

## 1. Base Analysis（命局基础 — 节选）
${baseStr}

## 2. Situation Analysis（所问之事 — 节选）
${sitStr}

# 你的任务

将两份分析 **整合 + 必要时翻译** 为结构化长文交付。
不得超出分析已暗示的范畴编造玄学结论。
须按 POJU 八字深度解读法则展开 ANALYSIS；按行动设计原则填写 WHAT TO DO 三条。

# 🌐 输出语言（最高优先级）

${langInstruction}

目标语言代码: **${deliveryLang}**
Session locale: ${locale}

${regionalGuidance ? `${regionalGuidance}\n\n` : ""}规则:
- 开篇、═══ ANALYSIS ═══、═══ CONCLUSION ═══、═══ WHAT TO DO ═══（含 3 条行动）、═══ COMING BACK ═══ **全文**使用目标语言
- 专家分析是中文也不要默认整篇中文（除非用户语言是中文）
- **分段标记行**（═══ ANALYSIS ═══ 等）必须原样保留；标记内正文用目标语言
- Action 子标题可保留英文 "### Action 1: ..." 或本地化，但行动**内容**必须用目标语言

# 交付结构（解析依赖 — 标记必须独立成行）

严格使用 POJU_OUTPUT_BRANDING 中的分段标记与三条 Action 顺序。

═══ ANALYSIS ═══
（展开：命主 / 大运 / 用神 / 困境根源 / 破局方向 — 见 POJU_BAZI_DEEP_METHOD）

═══ CONCLUSION ═══
（收束：对用户问题的直接判断 + 1–2 句核心建议）

═══ WHAT TO DO ═══
### Action 1: Traditional Fengshui Remedy
### Action 2: Modern Decisive Action
### Action 3: Modern Reflective Practice
（每类 80–120 字/词，含命理依据）

═══ COMING BACK ═══
（60–100 字/词；模糊回访；Session 30 天有效；禁止复诊/三个月后再来）

# 关键规则

1. 全文使用用户语言。
2. 命理术语可用，但须白话解释；避免只扔术语标签。
3. WHAT TO DO 三步须极其具体（时间+地点+人+话+可观察结果）。
4. 不下命运定论；不用中医话术（方子/诊脉/复诊）。
5. 不暴露 Glyph / Syncro / Match 等产品名。
6. 总长约 1000–1500 词/字，素材极薄时可略短。`;

  const system = stitchPromptSections(...buildPojuCorePromptSections(), finalDeliveryTask);

  const contextText = formatContextForPrompt(agent_v2);
  const summaryStr = agent_v2.current_summary ? safeJsonSlice(agent_v2.current_summary, 4000) : "(No formal current_summary object — rely on context below.)";
  const recentBlock =
    recent_user_messages && recent_user_messages.length > 0
      ? recent_user_messages.map((m, i) => `${i + 1}. ${m.slice(0, 500)}`).join("\n")
      : "(no recent user messages provided)";

  const user = `User's original question: "${agent_v2.original_question}"

Recent user messages (for language + tone):
${recentBlock}

User's confirmed situation summary (structured, may be empty):
${summaryStr}

User's collected context (structured):
${contextText}

Required delivery language: ${DELIVERY_LANGUAGE_NAMES[deliveryLang]} (${deliveryLang})

Generate the complete delivery now. Use the markers exactly as specified. All body text in ${DELIVERY_LANGUAGE_NAMES[deliveryLang]}.`;

  return { system, user };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

/** Map Step 9 extracted categories to POJU v4 action card categories. */
function mapCategory(idx: number): POJUAction["category"] {
  if (idx === 0) return "traditional";
  if (idx === 1) return "modern_decisive";
  return "modern_reflective";
}

export function extractActionsFromDelivery(fullText: string, situationAnalysis: unknown): POJUAction[] {
  const sa = isRecord(situationAnalysis) ? situationAnalysis : null;
  const trad = sa && isRecord(sa["传统行动建议"]) ? (sa["传统行动建议"] as Record<string, unknown>) : null;
  const modern = sa && isRecord(sa["现代实操建议"]) ? (sa["现代实操建议"] as Record<string, unknown>) : null;
  const tiao = trad && Array.isArray(trad["调候建议"]) ? (trad["调候建议"] as Record<string, unknown>[]) : [];
  const decisive = modern && Array.isArray(modern["决策性行动"]) ? (modern["决策性行动"] as Record<string, unknown>[]) : [];
  const reflective = modern && Array.isArray(modern["反思性行动"]) ? (modern["反思性行动"] as Record<string, unknown>[]) : [];

  const actions: POJUAction[] = [];
  const actionMatches = [...fullText.matchAll(/###\s*Action\s*\d+[^\n]*\r?\n([\s\S]*?)(?=###\s*Action|═══|$)/gi)];

  let idx = 0;
  const now = new Date().toISOString();
  for (const match of actionMatches) {
    const block = String(match[0] ?? "").replace(/^###\s*Action\s*\d+[^\n]*\n?/i, "").trim();
    if (!block) continue;

    let rationale = "";
    const cat = mapCategory(idx);
    if (cat === "traditional" && tiao[0] && isRecord(tiao[0])) {
      rationale = String(tiao[0]["命理依据"] ?? "");
    } else if (cat === "modern_decisive" && decisive[0] && isRecord(decisive[0])) {
      rationale = String(decisive[0]["依据"] ?? "");
    } else if (cat === "modern_reflective" && reflective[0] && isRecord(reflective[0])) {
      rationale = String(reflective[0]["依据"] ?? "");
    }

    actions.push({
      action_id: safeRandomUUID(),
      given_at: now,
      text: block.slice(0, 4000),
      category: cat,
      timing: "this_week",
      rationale,
      status: "pending",
    });
    idx += 1;
    if (actions.length >= 3) break;
  }

  return actions;
}

/** Split model output by ═══ markers (ANALYSIS / CONCLUSION / WHAT TO DO / COMING BACK). */
export function parseDeliverySections(fullText: string): {
  opening: string;
  analysis: string;
  conclusion: string;
  whatToDo: string;
  comingBack: string;
} {
  const t = fullText.trim();
  const mA = t.split(/═══\s*ANALYSIS\s*═══/i);
  const opening = (mA[0] ?? "").trim();
  let rest = (mA[1] ?? "").trim();

  const mC = rest.split(/═══\s*CONCLUSION\s*═══/i);
  const analysis = (mC[0] ?? "").trim();
  rest = (mC[1] ?? "").trim();

  const mW = rest.split(/═══\s*WHAT\s+TO\s+DO\s*═══|═══\s*WHAT\s+YOU\s+CAN\s+DO\s*═══/i);
  const conclusion = (mW[0] ?? "").trim();
  rest = (mW[1] ?? "").trim();

  const mB = rest.split(/═══\s*COMING\s+BACK\s*═══/i);
  const whatToDo = (mB[0] ?? "").trim();
  const comingBack = (mB[1] ?? "").trim();

  return {
    opening: opening || t.slice(0, 400),
    analysis,
    conclusion,
    whatToDo,
    comingBack,
  };
}

export function buildPojuDeliveryFromFinalText(
  fullText: string,
  actions: POJUAction[],
  locale: string,
): POJUDelivery {
  const sec = parseDeliverySections(fullText);
  const now = new Date().toISOString();
  return {
    delivered_at: now,
    language: locale,
    analysis: {
      user_situation_summary: [sec.opening, sec.analysis].filter(Boolean).join("\n\n").slice(0, 8000),
      pattern_insight: sec.analysis.slice(0, 4000) || sec.opening.slice(0, 2000),
      current_phase_insight: "",
      hidden_dynamics: [],
    },
    conclusion: {
      core_message: sec.conclusion.slice(0, 4000) || sec.opening.slice(0, 1500),
      perspective_shift: sec.conclusion ? sec.conclusion.slice(0, 1500) : "",
    },
    actions: actions.length > 0 ? actions : [],
    invitation: sec.comingBack.slice(0, 4000) || sec.whatToDo.slice(0, 1500),
  };
}

export async function requestFinalDeliveryFromApi(input: {
  base_analysis: unknown | null;
  situation_analysis: unknown | null;
  agent_v2: POJUAgentState;
  locale: string;
  recent_user_messages?: string[];
}): Promise<FinalDeliveryResult> {
  if (typeof window === "undefined") throw new Error("requestFinalDeliveryFromApi is browser-only");

  const res = await fetch("/api/poju/final-delivery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<FinalDeliveryResult> & { error?: string };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `final-delivery HTTP ${res.status}`);
  }
  if (typeof data.full_text !== "string" || !data.full_text.trim()) {
    throw new Error(data.error || "final-delivery returned empty body");
  }
  return {
    full_text: data.full_text.trim(),
    actions: Array.isArray(data.actions) ? (data.actions as POJUAction[]) : [],
    model: String(data.model ?? ""),
    tokens_used: typeof data.tokens_used === "number" ? data.tokens_used : 0,
    latency_ms: typeof data.latency_ms === "number" ? data.latency_ms : 0,
    cost_usd: typeof data.cost_usd === "number" ? data.cost_usd : 0,
  };
}

/**
 * 需要：当前语境指纹下已有 Step 8 缓存；`agent_v2` 存在。
 * 将最终交付写入 `main_delivery`、合并 `actions`、追加一条 assistant（含 meta.contains_delivery）。
 */
export async function runFinalDeliveryForSession(session: POJUSessionState, locale: string): Promise<POJUSessionState> {
  if (!session.agent_v2) throw new Error("agent_v2 required");
  const fp = await computeSituationContextFingerprint({
    session_id: session.session_id,
    original_question: session.original_question,
    agent_v2: session.agent_v2,
    context_collected: session.context_collected,
  });
  const sit = getCachedSituationAnalysis(session, fp);
  if (!sit?.content) {
    throw new Error("No cached situation analysis for this context; run Step 8 first.");
  }

  const base_analysis = await resolveBaseAnalysisForSession(session);

  const recent_user_messages = session.messages
    .filter((m) => m.role === "user" && !m.is_rejected)
    .map((m) => m.content)
    .slice(-8);

  const result = await requestFinalDeliveryFromApi({
    base_analysis,
    situation_analysis: sit.content,
    agent_v2: session.agent_v2,
    locale,
    recent_user_messages,
  });

  const deliveryLang = resolveDeliveryLanguage({
    original_question: session.agent_v2.original_question,
    locale,
    recent_user_messages,
  }).code;

  const delivery = buildPojuDeliveryFromFinalText(result.full_text, result.actions, deliveryLang);
  const mergedActions = [...session.actions, ...delivery.actions];

  const assistantMessage: POJUMessage = {
    role: "assistant",
    content: result.full_text,
    timestamp: new Date().toISOString(),
    meta: {
      llm_model: result.model,
      tokens_used: result.tokens_used,
      contains_delivery: true,
      current_state: "delivered",
    },
  };

  return {
    ...session,
    messages: [...session.messages, assistantMessage],
    actions: mergedActions,
    main_delivery_done: true,
    main_delivery: delivery,
    tokens_used: session.tokens_used + result.tokens_used,
  };
}
