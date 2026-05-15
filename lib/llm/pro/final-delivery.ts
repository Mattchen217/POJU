/**
 * Step 9 — 最终交付（DeepSeek V4 Pro / OpenRouter：整合 base + situation，按用户语言输出长文 + 行动卡）
 * 与 Step 7/8 同栈：`POST /api/poju/final-delivery` → `callLLM`。
 */

import type { POJUAgentState } from "@/lib/poju/agent-state";
import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import type { POJUAction, POJUDelivery, POJUSessionState, POJUMessage } from "@/lib/poju/types";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";
import { getCachedSituationAnalysis, resolveBaseAnalysisForSession } from "@/lib/llm/deepseek/situation-analysis";

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

  const system = `# YOU ARE POJU (Final Delivery Mode)

This is the most important moment. The user paid for this analysis.
After many rounds of conversation, they have confirmed their situation summary.
Now you deliver the complete analysis + actionable recommendations.

# YOU HAVE TWO EXPERT ANALYSES (source material — may be in Chinese)

The excerpts below are **reference only**. Your delivery must NOT copy their language if the user speaks another language.

## 1. Base Analysis (astrological foundation — excerpt)
${baseStr}

## 2. Situation Analysis (specific to their current question — excerpt)
${sitStr}

# YOUR JOB

INTEGRATE + TRANSLATE (when needed) these into a complete, structured delivery.

You are NOT inventing new metaphysical claims beyond what the analyses already imply.
You ARE organizing, translating cultural context into the user's language, and making actions concrete and doable.

# 🌐 OUTPUT LANGUAGE (MANDATORY — HIGHEST PRIORITY)

${langInstruction}

Detected target language code: **${deliveryLang}**
Session locale hint: ${locale}

Rules:
- The opening, ANALYSIS, CONCLUSION, WHAT TO DO (all 3 actions), and COMING BACK must ALL be in the same target language.
- Never deliver the full package in Chinese just because the expert analyses are in Chinese.
- Never default to English if the user wrote in Spanish, French, German, etc.
- Section markers (═══ ANALYSIS ═══ etc.) stay exactly as shown below; body text follows the target language.
- Action headings may stay in English ("### Action 1: ...") OR be localized — but action **content** must be in the target language.

# OUTPUT STRUCTURE (required markers for parsing)

Use these exact section markers on their own lines:

═══ ANALYSIS ═══

═══ CONCLUSION ═══

═══ WHAT TO DO ═══

Inside WHAT TO DO, include exactly three subsections in this order:

### Action 1: Traditional Fengshui Remedy
(80–120 words, concrete objects / directions / rooms)

### Action 2: Modern Decisive Action
(80–120 words: time + channel + exact words + what to notice)

### Action 3: Modern Reflective Practice
(80–120 words: duration + prompt + when + where)

Then:

═══ COMING BACK ═══

# CRITICAL RULES

1. **Language**: entire prose in the user's language (see above).
2. Avoid unexplained jargon: do not say Bazi/八字/五行/用神/大运 as technical labels; use plain-life language in the target language.
3. Actions must be specific (time + content + observable outcome).
4. No fortune-telling certainties; use conditional, grounded language.
5. Total length about 1000–1500 words unless inputs are very thin.`;

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
      action_id: crypto.randomUUID(),
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
