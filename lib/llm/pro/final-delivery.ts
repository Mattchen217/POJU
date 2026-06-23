/**
 * Step 9 — 最终交付（DeepSeek V4 Pro / OpenRouter：整合 base + situation，按用户语言输出长文 + 行动卡）
 * 与 Step 7/8 同栈：`POST /api/poju/final-delivery` → `callLLM`。
 */

import { safeRandomUUID } from "@/lib/client/safe-crypto";
import type { POJUAgentState } from "@/lib/poju/agent-state";
import { findMissingFields } from "@/lib/poju/agent-state";
import type { DeliveryMode } from "@/lib/poju/collection-progress";
import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import type { POJUAction, POJUDelivery, POJUSessionState, POJUMessage } from "@/lib/poju/types";
import { markCycleDelivered } from "@/lib/poju/cycle-manager";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";
import { getCachedSituationAnalysis, resolveBaseAnalysisForSession } from "@/lib/llm/deepseek/situation-analysis";
import { buildPojuDeliveryCoreSections } from "@/lib/llm/prompts/poju-base";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
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
  return `# Regional platforms (when an action involves outreach or channels)

- Assume the user is in North America / global English context unless they stated otherwise.
- Prefer: LinkedIn, Reddit, industry Discords/Slack, email outreach, local meetups, Upwork/Fiverr if relevant.
- Do NOT recommend 知乎, 微博, 豆瓣, 脉脉, 小红书, or other China-only platforms unless the user explicitly operates in China.`;
}

export function resolveDeliveryMode(input: {
  delivery_mode?: DeliveryMode | null;
  agent_v2: POJUAgentState;
}): DeliveryMode {
  if (input.delivery_mode === "degraded" || input.delivery_mode === "full") {
    return input.delivery_mode;
  }
  if (input.agent_v2.delivery_mode === "degraded") {
    return "degraded";
  }
  return "full";
}

function formatFieldKey(key: string): string {
  return key.replace(/_/g, " ");
}

function topMissingLabels(agent: POJUAgentState, limit = 2): string[] {
  const missing = findMissingFields(agent);
  return [...missing.general, ...missing.category_specific].slice(0, limit).map(formatFieldKey);
}

function buildDegradedDeliveryRules(agent: POJUAgentState): string {
  const missingHint =
    topMissingLabels(agent).join("、") || "更多具体处境细节";

  return `# 降级交付模式（delivery_mode = degraded · 信息不足）

本次为**降级交付**：收集阶段信息不足或用户选择「先给方向」。仍须输出完整四段结构，但重心与 full 模式不同。

## 降级规则（mandatory）

1. **四段结构不变**：═══ ANALYSIS ═══ / ═══ CONCLUSION ═══ / ═══ WHAT TO DO ═══ / ═══ COMING BACK ═══ 必须齐全。

2. **重命盘、轻具体处境**：
   - ANALYSIS 主要依据 Base Analysis（命盘是真实计算出的内容），从格局、用神、大运、五行结构展开
   - 少依赖、少编造具体对话细节（用户分享得少）；可泛化引用 original_question 与已收集的少量事实，不得虚构人名/项目/数字

3. **诚实声明**（放在开篇 1-2 句或 COMING BACK 段）：
   - 中文示例："这是基于你愿意分享的部分 + 你的命盘给出的方向。如果之后你愿意多聊 ${missingHint}，我能给得更贴合。"
   - 英文示例："This direction draws on what you shared plus your chart. If you later want to talk through ${missingHint}, I can tailor this much more closely."

4. **WHAT TO DO — 偏低风险、通用、自我探索类**：
   - 信息不足时**禁止**高风险具体行动：辞职、搬家、大额投资、立刻分手、重大合同签字等
   - **优先**安全行动：先观察/小步试探/厘清某个问题/记录与复盘/低承诺的信息收集/与信任的人做一次短对话
   - 仍用 \`### Action N: 自拟标题\` 格式，3 条不同维度，每条末尾 \`Profile basis:\` 须来自命盘真实依据

5. **合规不变**：
   - 重命盘 ≠ 编造：只用 Base Analysis 中真实算出的内容
   - 仍禁预测具体未来事件、禁吉凶断语、禁招财/催运/Amulet/lucky direction
   - 用户可见须用术语表 soft 词 + ⟦t:id|…⟧ 标记；禁裸合婚排盘术语`;
}

function buildFullDeliveryTask(
  regionalGuidance: string,
  langInstruction: string,
  deliveryLang: DeliveryLanguageCode,
  locale: string,
): string {
  return `# 当前任务：主交付（Final Delivery · full 模式）

这是用户付费后的**最重要时刻**。用户已确认情境汇总，现在输出完整破局交付。

# 🌐 输出语言（最高优先级）

${langInstruction}

目标语言代码: **${deliveryLang}**
Session locale: ${locale}

${regionalGuidance ? `${regionalGuidance}\n\n` : ""}规则:
- 开篇、═══ ANALYSIS ═══、═══ CONCLUSION ═══、═══ WHAT TO DO ═══（含 3 条行动）、═══ COMING BACK ═══ **全文**使用目标语言
- 专家分析是中文也不要默认整篇中文（除非用户语言是中文）
- **分段标记行**（═══ ANALYSIS ═══ 等）必须原样保留；标记内正文用目标语言
- Action 子标题可保留英文 "### Action 1: ..." 或本地化，但行动**内容**必须用目标语言

# 交付结构（解析依赖 — 四段大标记必须独立成行）

严格使用 POJU_OUTPUT_BRANDING 中的分段标记。

═══ ANALYSIS ═══
（展开：⟦t:day_master|…⟧ / ⟦t:decade|…⟧ / ⟦t:yong_shen|…⟧ / 困境根源 / 破局方向 — 见 POJU_BAZI_DEEP_METHOD；**小标题+2–3句短段+金句框**，见 READING_LAYOUT；禁裸 chart/Day Master/合婚术语）

═══ CONCLUSION ═══
（收束：对用户问题的直接判断 + 1–2 句核心建议 — **直答句用金句框** \`> **…:** …\`）

═══ WHAT TO DO ═══
给 3 条行动，每条用 "### Action N: " 开头 + **自拟标题**（贴合该用户具体处境，不用 Environmental Alignment 等固定名）。

【选取规则】
- 从 POJU_ACTION_DESIGN_PRINCIPLES 中的行动维度菜单，按本次对话挑 3 个**不同**维度
- 三条必须覆盖不同维度：不得三条都是内省，也不得三条都是发消息
- 每条从用户**亲口说过的具体细节**生长 — 人、项目、恐惧、资源、数字、时间点；禁万能模板
- 每条 80–120 字/词，末尾独立一行 \`Profile basis: …\`

【硬约束（不变）】
- 若选到「环境与空间」：须三步洗白（spatial harmony + 具体动作 + 环境心理学）；禁招财/催运/Amulet/lucky direction
- 不预测具体未来事件、不下吉凶断语

═══ COMING BACK ═══
（60–100 字/词；模糊回访；Session 30 天有效；禁止复诊/三个月后再来）

# 关键规则

1. 全文使用用户语言。
2. 用户可见须 **⟦t:id|软译词 (干支)⟧ 标记** + 禁裸合婚排盘术语 + 禁超自然承诺；五行/I Ching 可保留。
3. WHAT TO DO 三条须极其具体（时间+地点+人+话+可观察结果）。
4. 不下命运定论；不用中医话术（方子/诊脉/复诊）。
5. 不暴露 Glyph / Syncro / Match 等产品名。
6. 总长约 1000–1500 词/字，素材极薄时可略短。`;
}

function buildDegradedDeliveryTask(
  regionalGuidance: string,
  langInstruction: string,
  deliveryLang: DeliveryLanguageCode,
  locale: string,
  agent: POJUAgentState,
): string {
  const missingHint = topMissingLabels(agent).join("、") || "更多细节";
  return `# 当前任务：主交付（Final Delivery · degraded 模式）

用户选择或系统判定：信息不足，输出**降级方向性交付**（非 full 完整破局）。

${buildDegradedDeliveryRules(agent)}

# 🌐 输出语言（最高优先级）

${langInstruction}

目标语言代码: **${deliveryLang}**
Session locale: ${locale}

${regionalGuidance ? `${regionalGuidance}\n\n` : ""}规则:
- 四段标记行必须原样保留；标记内正文用目标语言
- Action 子标题 \`### Action N: …\`，内容用目标语言

# 交付结构（四段大标记必须独立成行）

═══ ANALYSIS ═══
（以 Base Analysis 命盘结构为主轴展开；困境与方向可结合 original_question；轻量引用已收集事实，不编造细节）

═══ CONCLUSION ═══
（方向性判断 + 核心提醒：这是基于有限信息 + 命盘的方向，非最终定论）

═══ WHAT TO DO ═══
3 条**低-risk**行动：观察/小步试探/厘清/记录/低承诺探索；禁辞职/搬家/大额决策类；格式同 full（### Action N + Profile basis）

═══ COMING BACK ═══
（含诚实声明变体 + 若愿意补充 ${missingHint} 可更贴合；Session 30 天有效）

# 关键规则

1. 全文使用用户语言。
2. 合规与 full 相同：禁预测具体未来、禁吉凶断语、禁招财/催运/lucky direction、禁合婚排盘术语。
3. 不暴露 Glyph / Syncro / Match 等产品名。
4. 总长约 700–1200 词/字。`;
}

export function buildFinalDeliveryPrompt(input: {
  base_analysis: unknown | null;
  situation_analysis: unknown | null;
  agent_v2: POJUAgentState;
  locale: string;
  recent_user_messages?: string[];
  delivery_mode?: DeliveryMode | null;
}): { system: string; user: string; delivery_mode: DeliveryMode } {
  const { base_analysis, situation_analysis, agent_v2, locale, recent_user_messages } = input;
  const delivery_mode = resolveDeliveryMode({ delivery_mode: input.delivery_mode, agent_v2 });
  const baseStr = safeJsonSlice(base_analysis, 3000);
  const sitStr =
    situation_analysis != null
      ? safeJsonSlice(situation_analysis, 3000)
      : "(none — degraded mode: rely primarily on Base Analysis chart content; do not invent situation details.)";
  const { code: deliveryLang, instruction: langInstruction } = resolveDeliveryLanguage({
    original_question: agent_v2.original_question,
    locale,
    recent_user_messages,
  });
  const regionalGuidance = buildRegionalPlatformGuidance(deliveryLang);

  const modeTask =
    delivery_mode === "degraded"
      ? buildDegradedDeliveryTask(regionalGuidance, langInstruction, deliveryLang, locale, agent_v2)
      : buildFullDeliveryTask(regionalGuidance, langInstruction, deliveryLang, locale);

  const expertMaterials = `# 专家分析素材（可能为中文 — 仅作依据，勿照抄语言）

## 1. Base Analysis（命局基础 — 节选）
${baseStr}

## 2. Situation Analysis（所问之事 — 节选）
${sitStr}

# 整合要求

将可用分析 **整合 + 必要时翻译** 为结构化长文交付。
不得超出分析已暗示的范畴编造玄学结论。
须按 POJU 八字深度解读法则展开 ANALYSIS；按行动设计原则填写 WHAT TO DO 三条。`;

  const finalDeliveryTask = `${modeTask}\n\n${expertMaterials}`;

  const system = stitchPromptSections(
    ...buildPojuDeliveryCoreSections(deliveryLang),
    buildTermMarkingPromptBlock(locale),
    finalDeliveryTask,
  );

  const contextText = formatContextForPrompt(agent_v2);
  const summaryStr = agent_v2.current_summary ? safeJsonSlice(agent_v2.current_summary, 4000) : "(No formal current_summary object — rely on context below.)";
  const recentBlock =
    recent_user_messages && recent_user_messages.length > 0
      ? recent_user_messages.map((m, i) => `${i + 1}. ${m.slice(0, 500)}`).join("\n")
      : "(no recent user messages provided)";

  const modeHint =
    delivery_mode === "degraded"
      ? `Delivery mode: **degraded** — chart-forward, low-risk actions, honest limitation statement required.`
      : `Delivery mode: **full** — integrate situation + chart; highly specific actions from user-stated details.`;

  const user = `User's original question: "${agent_v2.original_question}"

${modeHint}

Recent user messages (for language + tone):
${recentBlock}

User's confirmed situation summary (structured, may be empty):
${summaryStr}

User's collected context (structured):
${contextText}

Required delivery language: ${DELIVERY_LANGUAGE_NAMES[deliveryLang]} (${deliveryLang})

Generate the complete delivery now. Use the markers exactly as specified. All body text in ${DELIVERY_LANGUAGE_NAMES[deliveryLang]}.

WHAT TO DO: exactly 3 actions as \`### Action 1:\` / \`### Action 2:\` / \`### Action 3:\` with custom titles and distinct dimension types from the menu.${
    delivery_mode === "degraded"
      ? " Degraded mode: low-risk / observational / small-step actions only — no quit/move/major financial commitments."
      : " If you include spatial/environment actions, use the 3-step whitewash — no wealth/luck/amulet promises."
  }`;

  return { system, user, delivery_mode };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

/** Map extracted action content to card chrome category (color), not fixed Action 1/2/3 slots. */
function inferActionCategory(title: string, body: string, idx: number): POJUAction["category"] {
  const blob = `${title}\n${body}`.toLowerCase();
  const spatial =
    /environment|spatial|空间|环境|绿植|placement|room|desk|物件|harmony|biophilic|feng|layout|方位/i;
  const reflective =
    /reflect|journal|写|反思|内观|meditat|复盘|书写|恢复|休整|recovery|rest|journaling|内省/i;
  const decisive =
    /decide|对话|email|call|reach|commit|会议|发|谈|止损|边界|实验|里程碑|outreach|linkedin|conversation|deadline/i;

  if (spatial.test(blob)) return "traditional";
  if (reflective.test(blob) && !decisive.test(blob)) return "modern_reflective";
  if (decisive.test(blob)) return "modern_decisive";

  if (idx === 0) return "traditional";
  if (idx === 1) return "modern_decisive";
  return "modern_reflective";
}

function splitActionBodyAndBasis(block: string): { text: string; rationale: string } {
  const m = block.match(/\n(?:Profile basis|profile basis|Profile 依据|五行依据)\s*[:：]\s*([\s\S]+)$/i);
  if (m && typeof m.index === "number") {
    return {
      text: block.slice(0, m.index).trim(),
      rationale: String(m[1] ?? "").trim(),
    };
  }
  return { text: block.trim(), rationale: "" };
}

export function extractActionsFromDelivery(fullText: string, situationAnalysis: unknown): POJUAction[] {
  const sa = isRecord(situationAnalysis) ? situationAnalysis : null;
  const trad = sa && isRecord(sa["传统行动建议"]) ? (sa["传统行动建议"] as Record<string, unknown>) : null;
  const modern = sa && isRecord(sa["现代实操建议"]) ? (sa["现代实操建议"] as Record<string, unknown>) : null;
  const tiao = trad && Array.isArray(trad["调候建议"]) ? (trad["调候建议"] as Record<string, unknown>[]) : [];
  const decisive = modern && Array.isArray(modern["决策性行动"]) ? (modern["决策性行动"] as Record<string, unknown>[]) : [];
  const reflective = modern && Array.isArray(modern["反思性行动"]) ? (modern["反思性行动"] as Record<string, unknown>[]) : [];

  const actions: POJUAction[] = [];
  const actionMatches = [
    ...fullText.matchAll(
      /###\s*Action\s*(\d+)\s*:\s*([^\n]*)\r?\n([\s\S]*?)(?=###\s*Action\s*\d+\s*:|═══|$)/gi,
    ),
  ];

  let idx = 0;
  const now = new Date().toISOString();
  for (const match of actionMatches) {
    const customTitle = String(match[2] ?? "").trim();
    const rawBlock = String(match[3] ?? "").trim();
    if (!rawBlock) continue;

    const { text, rationale: basisFromBlock } = splitActionBodyAndBasis(rawBlock);
    if (!text) continue;

    const cat = inferActionCategory(customTitle, text, idx);
    let rationale = basisFromBlock;
    if (!rationale) {
      if (cat === "traditional" && tiao[0] && isRecord(tiao[0])) {
        rationale = String(tiao[0]["命理依据"] ?? "");
      } else if (cat === "modern_decisive" && decisive[0] && isRecord(decisive[0])) {
        rationale = String(decisive[0]["依据"] ?? "");
      } else if (cat === "modern_reflective" && reflective[0] && isRecord(reflective[0])) {
        rationale = String(reflective[0]["依据"] ?? "");
      }
    }

    actions.push({
      action_id: safeRandomUUID(),
      given_at: now,
      title: customTitle || undefined,
      text: text.slice(0, 4000),
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
  session_id?: string;
  base_analysis: unknown | null;
  situation_analysis: unknown | null;
  agent_v2: POJUAgentState;
  locale: string;
  recent_user_messages?: string[];
  delivery_mode?: DeliveryMode | null;
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
export async function runFinalDeliveryForSession(
  session: POJUSessionState,
  locale: string,
  opts?: { delivery_mode?: DeliveryMode | null },
): Promise<POJUSessionState> {
  if (!session.agent_v2) throw new Error("agent_v2 required");
  const delivery_mode = resolveDeliveryMode({
    delivery_mode: opts?.delivery_mode,
    agent_v2: session.agent_v2,
  });

  const fp = await computeSituationContextFingerprint({
    session_id: session.session_id,
    original_question: session.original_question,
    agent_v2: session.agent_v2,
    context_collected: session.context_collected,
  });
  const sit = getCachedSituationAnalysis(session, fp);
  if (delivery_mode === "full" && !sit?.content) {
    throw new Error("No cached situation analysis for this context; run Step 8 first.");
  }

  const base_analysis = await resolveBaseAnalysisForSession(session);

  const recent_user_messages = session.messages
    .filter((m) => m.role === "user" && !m.is_rejected)
    .map((m) => m.content)
    .slice(-8);

  const result = await requestFinalDeliveryFromApi({
    session_id: session.session_id,
    base_analysis,
    situation_analysis: sit?.content ?? null,
    agent_v2: session.agent_v2,
    locale,
    recent_user_messages,
    delivery_mode,
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

  let next: POJUSessionState = {
    ...session,
    messages: [...session.messages, assistantMessage],
    actions: mergedActions,
    main_delivery_done: true,
    main_delivery: delivery,
    tokens_used: session.tokens_used + result.tokens_used,
  };

  const cycleId = next.active_cycle_id;
  if (cycleId) {
    next = markCycleDelivered(
      next,
      cycleId,
      mergedActions.map((a) => ({
        action_id: a.action_id,
        category: a.category,
        text: a.text,
        status: a.status,
        timing: a.timing,
      })),
    );
  }

  return next;
}
