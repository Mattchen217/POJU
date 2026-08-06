/**
 * Step 9 — 最终交付（DeepSeek V4 Pro / OpenRouter：整合 base + situation，按用户语言输出长文 + 行动卡）
 * 与 Step 7/8 同栈：`POST /api/poju/final-delivery` → `callLLM`。
 */

import { safeRandomUUID } from "@/lib/client/safe-crypto";
import type { POJUAgentState, BreakthroughCore } from "@/lib/poju/agent-state";
import { findMissingFields } from "@/lib/poju/agent-state";
import type { DeliveryMode } from "@/lib/poju/collection-progress";
import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import type { POJUAction, POJUDelivery, POJUSessionState, POJUMessage } from "@/lib/poju/types";
import { markCycleDelivered } from "@/lib/poju/cycle-manager";
import { buildCoveredAgendaEvidence } from "@/lib/poju/investigation-agenda";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import {
  buildDirectedDynamicRelationInventoryBlock,
  computeDirectedDynamicRelations,
  getCurrentLiunian,
} from "@/lib/calculations/relation-engine";
import { resolveBaseAnalysisForBreakthrough } from "@/lib/llm/deepseek/breakthrough-core";
import {
  POJU_DELIVERY_COMPLIANCE_LINE,
  buildPojuConclusionOriginalQuestionBlock,
} from "@/lib/llm/compliance/output-policy";
import { buildPojuSystemPromptV6Sync } from "@/lib/llm/phases/oriental-prompt-context-v6";
import {
  POJU_ACTION_DESIGN_PRINCIPLES,
  POJU_BAZI_DEEP_METHOD,
  POJU_OUTPUT_DATA_DISCIPLINE,
} from "@/lib/llm/prompts/poju-base";
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { buildChatPhaseTermBindingBlock } from "@/lib/llm/prompts/term-closed-set-constraint";
import {
  buildCurrentDateContext,
  buildNorthAmericaAdaptation,
  stitchPromptSections,
} from "@/lib/llm/prompts/oriental-counselor-base";
import { POJU_DELIVERY_STRUCTURE_MANDATE, READING_LAYOUT_CONTRACT } from "@/lib/llm/prompts/reading-layout";
import { buildDualLayerDeliveryPromptBlock } from "@/lib/llm/prompts/dual-layer-delivery";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
import {
  detectLanguage as detectAppLocale,
  getPojuChatLanguageDirective,
  parseAppLocale,
  resolvePojuSessionOutputLocale,
  type AppLocale,
} from "@/lib/prompts/language-directive";

export interface FinalDeliveryResult {
  full_text: string;
  actions: POJUAction[];
  model: string;
  tokens_used: number;
  latency_ms: number;
  cost_usd: number;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
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

/** Infer delivery language: session lock first, then samples, then UI locale. */
export function resolveDeliveryLanguage(input: {
  original_question: string;
  locale: string;
  recent_user_messages?: string[];
  locked_output_locale?: string | null;
}): { code: DeliveryLanguageCode; instruction: string } {
  const uiLocale = parseAppLocale(input.locale);
  let code: DeliveryLanguageCode = uiLocale;

  if (input.locked_output_locale) {
    code = parseAppLocale(input.locked_output_locale);
  } else {
    const samples = [
      input.original_question,
      ...(input.recent_user_messages ?? []).slice(-8),
    ]
      .join("\n")
      .trim();

    if (samples.length >= 2) {
      // Same conservative detector as chat — do not treat fiancé/résumé/café as Spanish/French.
      code = detectAppLocale(samples) as AppLocale;
    }
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
   - ${POJU_DELIVERY_COMPLIANCE_LINE}
   - 用户可见须 **⟦t:id|<该情景软译词>|<这句话里对他这件事的白话解释>⟧ 三段位硬要求**；第三段须针对当前处境/本句，不是术语通用定义；禁裸合婚排盘术语`;
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

# 交付结构（解析依赖 — 四段大标记必须独立成行 · 见 POJU_DELIVERY_STRUCTURE_MANDATE）

严格使用 POJU_OUTPUT_BRANDING 中的分段标记。**缺 ═══ 分隔 = 交付失败。**

═══ ANALYSIS ═══
（**3–4 个 ### 子标题**；每子标题 2–3 短段 + ≥1 金句框；**每个子标题至少一处锚定本盘真实结构**——day_master/strength/yong_shen/十神/本命关系实例，**⟦t:id|情景软译|对他这件事的白话⟧ 三段位**，禁裸术语；若本盘有定向动态关系，织入 1–2 条解释「为什么会卡」）

═══ CONCLUSION ═══
（**直答 original_question** + **1–2 句展开** + **金句框收束**——禁止一句话收场；依据 = 选定破局方向 × 本盘结构）

${buildPojuConclusionOriginalQuestionBlock()}

═══ WHAT TO DO ═══
给 3 条行动，每条用 "### Action N: " 开头 + **自拟标题**（贴合该用户具体处境，不用 Environmental Alignment 等固定名）。

【选取规则】
- 从 POJU_ACTION_DESIGN_PRINCIPLES 中的行动维度菜单，按本次对话挑 3 个**不同**维度
- 三条必须覆盖不同维度：不得三条都是内省，也不得三条都是发消息
- 每条从用户**亲口说过的具体细节**生长 — 人、项目、恐惧、资源、数字、时间点；禁万能模板
- 每条 80–120 字/词，末尾独立一行 \`Profile basis: …\`

【硬约束（不变）】
- 若选到「环境与空间」：须三步洗白（spatial harmony + 具体动作 + 环境心理学）；禁招财/催运/Amulet/lucky direction
- ${POJU_DELIVERY_COMPLIANCE_LINE}

═══ COMING BACK ═══
（60–100 字/词；模糊回访；Session 30 天有效；禁止复诊/三个月后再来）

# 关键规则

1. 全文使用用户语言。
2. 关键术语 **⟦t:<id>|<该情景下的软译词>|<这句话里对他这件事的白话解释>⟧ 三段位硬要求**（可见软译**禁括号干支**）。第三段必须是【针对他当前处境/这句话】的具体解释，不是术语的通用定义；UI 仅在缺第三段时才回退词表。另：禁裸合婚排盘术语 + 禁超自然承诺；五行/I Ching 可保留。
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

${buildPojuConclusionOriginalQuestionBlock()}

═══ WHAT TO DO ═══
3 条**低-risk**行动：观察/小步试探/厘清/记录/低承诺探索；禁辞职/搬家/大额决策类；格式同 full（### Action N + Profile basis）

═══ COMING BACK ═══
（含诚实声明变体 + 若愿意补充 ${missingHint} 可更贴合；Session 30 天有效）

# 关键规则

1. 全文使用用户语言。
2. 合规与 full 相同：${POJU_DELIVERY_COMPLIANCE_LINE}。
3. 不暴露 Glyph / Syncro / Match 等产品名。
4. 总长约 700–1200 词/字。`;
}

function formatBreakthroughCoreForDelivery(core: BreakthroughCore | null): string {
  if (!core) return "(none — degraded mode: rely on chart + collected context only.)";
  const xc = core.key_crossroads;
  const er = core.energy_retune_frame;
  const rf = core.rhythm_frame;
  const frames = core.modern_action_frames
    .map(
      (d) =>
        `- ${d.direction} [status: ${d.status ?? "hypothesis"}]\n  适配：${d.why_fits}\n  锚：${d.structural_basis}\n  待验证：${d.needs_validation}`,
    )
    .join("\n");
  return `处境洞察（结构性原因）：\n${core.situation_conclusion}

关键抉择骨架：
- 真正分岔：${xc.real_fork}
- 路径代价：${xc.path_costs}
- 决策特质：${xc.decision_traits}
- 锚：${xc.structural_basis}
- 待验证：${xc.needs_validation}

现代行动骨架（经收集验证后的最终判断）：
${frames}

能量调频骨架：
- 使力方向：${er.direction_fit}
- 成熟条件：${er.timing_ripeness}
- 日常调频：${er.daily_retune}
- 互补/避开：${er.complementary}
- 锚：${er.structural_basis}
- 待验证：${er.needs_validation}
- status: ${er.status ?? "hypothesis"}

30天节奏骨架：观察=${rf.phase1_observe} · 调整=${rf.phase2_adjust} · 巩固=${rf.phase3_consolidate}

自检信号：${core.self_check_signals.map((s) => `- ${s}`).join("\n")}`;
}

function formatCoveredAgendaForDelivery(
  items: Array<{ label: string; answer?: string }>,
): string {
  if (items.length === 0) return "(尚无 covered 议程项 — 结合 collected context 作答，勿编造。)";
  return items.map((a, i) => `${i + 1}. ${a.label}${a.answer ? `\n   用户确认：${a.answer}` : ""}`).join("\n");
}

/** Same closed-set binding as chat phases; delivery output is plain text, not JSON `response`. */
function buildDeliveryTermBindingBlock(locale: string): string {
  return buildChatPhaseTermBindingBlock(locale).replace(/`response`/g, "交付全文（四段 + 行动）");
}

function buildDeliveryDynamicTaskTail(input: {
  modeTask: string;
  expertMaterials: string;
}): string {
  return stitchPromptSections(
    POJU_DELIVERY_STRUCTURE_MANDATE,
    READING_LAYOUT_CONTRACT,
    POJU_BAZI_DEEP_METHOD,
    POJU_ACTION_DESIGN_PRINCIPLES,
    input.modeTask,
    input.expertMaterials,
  );
}

export function buildFinalDeliveryPrompt(input: {
  base_analysis: unknown | null;
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  agent_v2: POJUAgentState;
  locale: string;
  recent_user_messages?: string[];
  delivery_mode?: DeliveryMode | null;
}): { system: string; user: string; delivery_mode: DeliveryMode } {
  const { base_analysis, breakthrough_core, covered_agenda, agent_v2, locale, recent_user_messages } = input;
  const delivery_mode = resolveDeliveryMode({ delivery_mode: input.delivery_mode, agent_v2 });
  const baseStr = safeJsonSlice(base_analysis, 3000);
  const spineStr = formatBreakthroughCoreForDelivery(breakthrough_core);
  const agendaStr = formatCoveredAgendaForDelivery(covered_agenda);
  const { code: deliveryLang, instruction: langInstruction } = resolveDeliveryLanguage({
    original_question: agent_v2.original_question,
    locale,
    recent_user_messages,
    locked_output_locale: locale,
  });
  const regionalGuidance = buildRegionalPlatformGuidance(deliveryLang);

  const modeTask =
    delivery_mode === "degraded"
      ? buildDegradedDeliveryTask(regionalGuidance, langInstruction, deliveryLang, locale, agent_v2)
      : buildFullDeliveryTask(regionalGuidance, langInstruction, deliveryLang, locale);

  const expertMaterials = stitchPromptSections(
    `# 专家分析素材（脊柱 · 已贯穿全程，禁从头重算）

## 推理脊柱（本次破局的骨架 —— ANALYSIS / CONCLUSION 必须长在它上面）
${spineStr}

## 议程证据（用户亲口确认、用于落地行动的事实）
${agendaStr}

## 命局基础（structured —— 事实源，节选）
${baseStr}`,
    `# 整合要求（闭环 · 反断点）
- ANALYSIS：直接展开 situation_conclusion；**每个 ### 子标题**正文零标记；段末加 \`**依据与推理:**\`（≤2 句 / ≤3 金字 \`⟦t:slug|贴题白话⟧\`）；3–4 个子标题，短段+金句框，禁字墙。
- CONCLUSION：落回 original_question **完整直答**（金句框 + 1–2 句展开）；**正面接住他问的问题本身**；含时间诉求时显式用条件成熟 + 可促成行动回应；依据块写「选定行动骨架 × 本盘锚点」。
${buildPojuConclusionOriginalQuestionBlock()}
- WHAT TO DO：3 条从「选定 modern_action_frames × 用户亲口议程证据」生长，禁万能模板；
  每条末尾 \`Profile basis:\`（= 依据与推理）写「这条为什么对你成立」——可打标，正文行动句零标记。
- 软译词不用写（系统从术语表填入）；贴题白话须情景化。
- ${POJU_DELIVERY_COMPLIANCE_LINE}；不暴露 Glyph/Syncro/Match。
- 须按 POJU 八字深度解读法则展开 ANALYSIS；按行动设计原则填写 WHAT TO DO 三条。`,
    POJU_OUTPUT_DATA_DISCIPLINE,
  );

  const deliveryTaskTail = buildDeliveryDynamicTaskTail({ modeTask, expertMaterials });
  const structured = normalizeBaseAnalysisInput(base_analysis).structured ?? null;
  const uiLocale = parseAppLocale(locale);
  const outLoc = resolvePojuSessionOutputLocale({
    uiLocale,
    userInput: agent_v2.original_question,
    conversationHistory: (recent_user_messages ?? []).map((content) => ({ role: "user" as const, content })),
  });
  const langDirective = getPojuChatLanguageDirective({
    locale: uiLocale,
    userInput: agent_v2.original_question,
    conversationHistory: (recent_user_messages ?? []).map((content) => ({ role: "user" as const, content })),
    forcedOutputLocale: deliveryLang,
  });

  const liunian = structured ? getCurrentLiunian() : null;
  const directedRelations =
    structured && liunian
      ? computeDirectedDynamicRelations(structured, liunian, agent_v2.question_category)
      : undefined;

  const system = stitchPromptSections(
    buildPojuSystemPromptV6Sync(),
    structured
      ? buildChatFactGuardBlock(structured, { directedRelations: directedRelations ?? [] })
      : "",
    buildNorthAmericaAdaptation(deliveryLang),
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
      : `Delivery mode: **full** — spine-fed delivery from breakthrough_core + covered agenda evidence; highly specific actions from user-stated details.`;

  const directedRelationBlock =
    structured && liunian
      ? buildDirectedDynamicRelationInventoryBlock(structured, liunian, agent_v2.question_category)
      : "";

  const user = stitchPromptSections(
    langDirective.directive.trim(),
    buildCurrentDateContext(new Date(), outLoc),
    buildDualLayerDeliveryPromptBlock(outLoc),
    buildTermMarkingPromptBlock(outLoc),
    structured ? buildStructuredInstanceInventory(structured) : "",
    directedRelationBlock,
    buildDeliveryTermBindingBlock(outLoc),
    deliveryTaskTail,
    `User's original question: "${agent_v2.original_question}"

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
    }`,
  );

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

export function buildPojuDeliveryFromFinalText(
  fullText: string,
  _actions: POJUAction[],
  locale: string,
): POJUDelivery {
  return {
    delivered_at: new Date().toISOString(),
    language: locale,
    full_text: fullText.trim(),
  };
}

/** @deprecated Prefer parseDeliveryContent from parse-delivery — kept for scripts. */
export { parseDeliverySections } from "@/lib/poju/parse-delivery";


/** Persisted before the create HTTP round-trip so leave-and-return can still `resume_latest`. */
export const FINAL_DELIVERY_JOB_AWAITING = "__awaiting__";

/** Soft pause after segment transport retries — UI keeps streamed markdown + Continue. */
export class FinalDeliveryInterruptedError extends Error {
  readonly job_id: string;
  readonly streamed_markdown: string;

  constructor(job_id: string, message: string, streamed_markdown = "") {
    super(message);
    this.name = "FinalDeliveryInterruptedError";
    this.job_id = job_id;
    this.streamed_markdown = streamed_markdown;
  }
}

export function isFinalDeliveryInterruptedError(e: unknown): e is FinalDeliveryInterruptedError {
  return (
    e instanceof FinalDeliveryInterruptedError ||
    (Boolean(e) &&
      typeof e === "object" &&
      (e as { name?: string }).name === "FinalDeliveryInterruptedError" &&
      typeof (e as { job_id?: unknown }).job_id === "string")
  );
}

function isUsableFinalDeliveryJobId(id: string | null | undefined): boolean {
  const t = id?.trim() ?? "";
  return Boolean(t) && t !== FINAL_DELIVERY_JOB_AWAITING;
}

/** Create (or resume) a final-delivery xhigh job — returns job_id immediately. */
export async function createFinalDeliveryJobFromApi(input: {
  session_id?: string;
  base_analysis: unknown | null;
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  agent_v2: POJUAgentState;
  locale: string;
  recent_user_messages?: string[];
  delivery_mode?: DeliveryMode | null;
  regenerate?: boolean;
}): Promise<{ job_id: string; already_complete: boolean; result?: FinalDeliveryResult }> {
  if (typeof window === "undefined") throw new Error("createFinalDeliveryJobFromApi is browser-only");

  const res = await fetch("/api/poju/final-delivery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<FinalDeliveryResult> & {
    ok?: boolean;
    job_id?: string;
    status?: string;
    error?: string;
    reason?: string;
  };
  if (!res.ok) {
    if (res.status === 402 || data.error === "pass_required") {
      throw new Error("PASS_REQUIRED");
    }
    if (res.status === 401 || data.error === "pass_login_required") {
      throw new Error("PASS_LOGIN_REQUIRED");
    }
    throw new Error(typeof data.error === "string" ? data.error : `final-delivery HTTP ${res.status}`);
  }
  if (!data.job_id) {
    throw new Error(data.error || "final-delivery missing job_id");
  }
  if (typeof data.full_text === "string" && data.full_text.trim()) {
    return {
      job_id: data.job_id,
      already_complete: true,
      result: {
        full_text: data.full_text.trim(),
        actions: Array.isArray(data.actions) ? (data.actions as POJUAction[]) : [],
        model: String(data.model ?? ""),
        tokens_used: typeof data.tokens_used === "number" ? data.tokens_used : 0,
        latency_ms: 0,
        cost_usd: 0,
        llm_debug:
          data.llm_debug && typeof data.llm_debug === "object" && !Array.isArray(data.llm_debug)
            ? data.llm_debug
            : undefined,
      },
    };
  }
  return { job_id: data.job_id, already_complete: false };
}

/** @deprecated Prefer create + poll — kept for callers that expect a single round-trip helper. */
export async function requestFinalDeliveryFromApi(input: {
  session_id?: string;
  base_analysis: unknown | null;
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  agent_v2: POJUAgentState;
  locale: string;
  recent_user_messages?: string[];
  delivery_mode?: DeliveryMode | null;
  regenerate?: boolean;
}): Promise<FinalDeliveryResult> {
  const created = await createFinalDeliveryJobFromApi(input);
  if (created.already_complete && created.result) return created.result;

  const { pollFinalDeliveryJobUntilDone } = await import("@/lib/poju/poll-final-delivery-job");
  const polled = await pollFinalDeliveryJobUntilDone({ job_id: created.job_id });
  if (!polled.ok) {
    throw new Error(polled.error || "final-delivery poll failed");
  }
  return {
    full_text: polled.full_text,
    actions: Array.isArray(polled.actions) ? (polled.actions as POJUAction[]) : [],
    model: polled.model,
    tokens_used: polled.tokens_used,
    latency_ms: 0,
    cost_usd: 0,
    llm_debug: polled.llm_debug,
  };
}

/** Apply a completed delivery result onto the session (idempotent if same text already present). */
export function applyFinalDeliveryResultToSession(
  session: POJUSessionState,
  result: FinalDeliveryResult,
  locale: string,
): POJUSessionState {
  if (!session.agent_v2) throw new Error("agent_v2 required");

  const recent_user_messages = session.messages
    .filter((m) => m.role === "user" && !m.is_rejected)
    .map((m) => m.content)
    .slice(-8);

  const deliveryLang = resolveDeliveryLanguage({
    original_question: session.agent_v2.original_question,
    locale,
    recent_user_messages,
    locked_output_locale: session.locked_output_locale ?? locale,
  }).code;

  const existingDelivery = session.messages.find(
    (m) => m.meta?.contains_delivery && m.content.trim() === result.full_text.trim(),
  );
  if (existingDelivery && session.main_delivery_done) {
    return { ...session, pending_delivery_job_id: null };
  }

  // Drop prior delivery bubbles when hydrating a new book (regenerate / resume).
  const messagesWithoutDelivery = session.messages.filter((m) => !m.meta?.contains_delivery);

  const delivery = buildPojuDeliveryFromFinalText(result.full_text, result.actions, deliveryLang);
  const mergedActions = [...session.actions, ...result.actions];

  const assistantMessage: POJUMessage = {
    role: "assistant",
    content: result.full_text,
    timestamp: new Date().toISOString(),
    meta: {
      llm_model: result.model,
      tokens_used: result.tokens_used,
      contains_delivery: true,
      current_state: "delivered",
      llm_debug: result.llm_debug,
    },
  };

  let next: POJUSessionState = {
    ...session,
    messages: [...messagesWithoutDelivery, assistantMessage],
    actions: mergedActions,
    main_delivery_done: true,
    main_delivery: delivery,
    pending_delivery_job_id: null,
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

/**
 * Create delivery job → persist pending_delivery_job_id → poll → apply.
 * Job result lives in KV so a closed tab can resume on reopen.
 */
export async function runFinalDeliveryForSession(
  session: POJUSessionState,
  locale: string,
  opts?: {
    delivery_mode?: DeliveryMode | null;
    regenerate?: boolean;
    onStreamProgress?: (
      hint: string,
      streamedMarkdown: string,
      meta?: { waiting_next: boolean; preface_ready: boolean },
    ) => void;
    onNetworkIssue?: (offline: boolean) => void;
  },
): Promise<POJUSessionState> {
  if (!session.agent_v2) throw new Error("agent_v2 required");
  const delivery_mode = resolveDeliveryMode({
    delivery_mode: opts?.delivery_mode,
    agent_v2: session.agent_v2,
  });

  if (delivery_mode === "full" && !session.agent_v2.breakthrough_core) {
    throw new Error("No breakthrough_core persisted; run deep reckoning pass first.");
  }

  const { savePOJUSession } = await import("@/lib/poju/session-manager");
  const { resolvePivotSessionLang } = await import("@/lib/poju/session-lang");
  const sessionLang = resolvePivotSessionLang(session, locale);

  // Mark awaiting BEFORE create HTTP — if the tab closes mid-request, reopen can still resume_latest.
  const awaitingSession: POJUSessionState = {
    ...session,
    locked_output_locale: session.locked_output_locale ?? sessionLang,
    pending_delivery_job_id: isUsableFinalDeliveryJobId(session.pending_delivery_job_id)
      ? session.pending_delivery_job_id
      : FINAL_DELIVERY_JOB_AWAITING,
  };
  await savePOJUSession(awaitingSession);

  const base_analysis = await resolveBaseAnalysisForBreakthrough(awaitingSession);
  const covered_agenda = buildCoveredAgendaEvidence(awaitingSession.agent_v2!);

  const recent_user_messages = awaitingSession.messages
    .filter((m) => m.role === "user" && !m.is_rejected)
    .map((m) => m.content)
    .slice(-8);

  let created: Awaited<ReturnType<typeof createFinalDeliveryJobFromApi>>;
  try {
    created = await createFinalDeliveryJobFromApi({
      session_id: awaitingSession.session_id,
      base_analysis,
      breakthrough_core: awaitingSession.agent_v2!.breakthrough_core,
      covered_agenda,
      agent_v2: awaitingSession.agent_v2!,
      locale: sessionLang,
      recent_user_messages,
      delivery_mode,
      regenerate: opts?.regenerate === true,
    });
  } catch (e) {
    const cleared: POJUSessionState = { ...awaitingSession, pending_delivery_job_id: null };
    await savePOJUSession(cleared).catch(() => undefined);
    throw e;
  }

  // Persist real job id BEFORE poll — critical for leave-and-return.
  const pendingSession: POJUSessionState = {
    ...awaitingSession,
    pending_delivery_job_id: created.job_id,
  };
  await savePOJUSession(pendingSession);

  if (created.already_complete && created.result) {
    return applyFinalDeliveryResultToSession(pendingSession, created.result, sessionLang);
  }

  const { pollFinalDeliveryJobUntilDone } = await import("@/lib/poju/poll-final-delivery-job");
  const original_question =
    pendingSession.agent_v2?.original_question?.trim() ||
    pendingSession.original_question?.trim() ||
    "";
  const polled = await pollFinalDeliveryJobUntilDone({
    job_id: created.job_id,
    locale: sessionLang,
    original_question,
    onProgress: (_status, hint, streamed) => {
      opts?.onStreamProgress?.(hint, streamed?.markdown ?? "", {
        waiting_next: streamed?.waiting_next ?? true,
        preface_ready: streamed?.preface_ready ?? false,
      });
    },
    onNetworkIssue: opts?.onNetworkIssue,
  });
  if (!polled.ok) {
    if (polled.interrupted) {
      // Keep pending_delivery_job_id so Continue can resume the same job.
      throw new FinalDeliveryInterruptedError(
        polled.job_id,
        polled.error || "final-delivery interrupted",
        polled.streamed_markdown ?? "",
      );
    }
    // Partial book already streamed — never blank the UI; surface Continue path.
    if (polled.streamed_markdown?.trim()) {
      throw new FinalDeliveryInterruptedError(
        polled.job_id,
        polled.error || "final-delivery interrupted",
        polled.streamed_markdown,
      );
    }
    const cleared: POJUSessionState = { ...pendingSession, pending_delivery_job_id: null };
    await savePOJUSession(cleared).catch(() => undefined);
    throw new Error(polled.error || "final-delivery poll failed");
  }

  return applyFinalDeliveryResultToSession(
    pendingSession,
    {
      full_text: polled.full_text,
      actions: Array.isArray(polled.actions) ? (polled.actions as POJUAction[]) : [],
      model: polled.model,
      tokens_used: polled.tokens_used,
      latency_ms: 0,
      cost_usd: 0,
      llm_debug: polled.llm_debug,
    },
    sessionLang,
  );
}

/**
 * Resume an in-flight / completed delivery job into the session (page reopen).
 * Also reconciles when local still shows an older book but KV has a newer completed job.
 */
export async function resumeFinalDeliveryJobForSession(
  session: POJUSessionState,
  locale: string,
  job_id?: string | null,
): Promise<POJUSessionState | null> {
  if (typeof window === "undefined") return null;

  const {
    fetchLatestFinalDeliveryJob,
    pollFinalDeliveryJobUntilDone,
  } = await import("@/lib/poju/poll-final-delivery-job");
  const { savePOJUSession } = await import("@/lib/poju/session-manager");
  const { resolvePivotSessionLang } = await import("@/lib/poju/session-lang");
  const sessionLang = resolvePivotSessionLang(session, locale);

  const requested = job_id?.trim() || session.pending_delivery_job_id?.trim() || "";
  let id = isUsableFinalDeliveryJobId(requested) ? requested.trim() : "";

  if (!id) {
    const latest = await fetchLatestFinalDeliveryJob(session.session_id);
    if (!latest?.job_id) {
      if (requested === FINAL_DELIVERY_JOB_AWAITING) {
        return { ...session, pending_delivery_job_id: null };
      }
      return null;
    }
    id = latest.job_id;
    if (latest.status === "completed" && typeof latest.full_text === "string" && latest.full_text.trim()) {
      return applyFinalDeliveryResultToSession(
        { ...session, pending_delivery_job_id: id },
        {
          full_text: latest.full_text.trim(),
          actions: Array.isArray(latest.actions) ? (latest.actions as POJUAction[]) : [],
          model: String(latest.model ?? ""),
          tokens_used: typeof latest.tokens_used === "number" ? latest.tokens_used : 0,
          latency_ms: 0,
          cost_usd: 0,
          llm_debug: latest.llm_debug,
        },
        sessionLang,
      );
    }
    if (latest.status === "failed") {
      const interrupted =
        latest.interrupted === true ||
        latest.reason === "interrupted" ||
        latest.retryable === true;
      if (interrupted) {
        const segs = Array.isArray(latest.streamed_segments) ? latest.streamed_segments : [];
        const { buildStreamedDeliveryMarkdown } = await import(
          "@/lib/poju/poll-final-delivery-job"
        );
        const streamedMd = buildStreamedDeliveryMarkdown(segs, sessionLang, {
          original_question:
            session.agent_v2?.original_question?.trim() ||
            session.original_question?.trim() ||
            "",
          require_preface: true,
        });
        throw new FinalDeliveryInterruptedError(
          id,
          latest.error || "final-delivery interrupted",
          streamedMd,
        );
      }
      return { ...session, pending_delivery_job_id: null };
    }
    // still running — fall through to poll
  }

  const pendingSession: POJUSessionState = {
    ...session,
    pending_delivery_job_id: id,
  };
  await savePOJUSession(pendingSession);

  const polled = await pollFinalDeliveryJobUntilDone({ job_id: id, locale: sessionLang });
  if (!polled.ok) {
    console.warn("[final-delivery] resume poll failed", polled);
    if (polled.interrupted || polled.streamed_markdown?.trim()) {
      throw new FinalDeliveryInterruptedError(
        polled.job_id,
        polled.error || "final-delivery interrupted",
        polled.streamed_markdown ?? "",
      );
    }
    // Keep awaiting if job still may exist under latest; clear only on hard failure.
    if (polled.reason === "poll_timeout") {
      return pendingSession;
    }
    return { ...pendingSession, pending_delivery_job_id: null };
  }

  return applyFinalDeliveryResultToSession(
    pendingSession,
    {
      full_text: polled.full_text,
      actions: Array.isArray(polled.actions) ? (polled.actions as POJUAction[]) : [],
      model: polled.model,
      tokens_used: polled.tokens_used,
      latency_ms: 0,
      cost_usd: 0,
      llm_debug: polled.llm_debug,
    },
    sessionLang,
  );
}

/**
 * User Continue after interrupted delivery — same job_id, reset segment transport
 * counters, re-arm stage runner from incomplete segments.
 */
export async function continueInterruptedFinalDeliveryForSession(
  session: POJUSessionState,
  locale: string,
  opts?: {
    job_id?: string | null;
    onStreamProgress?: (
      hint: string,
      streamedMarkdown: string,
      meta?: { waiting_next: boolean; preface_ready: boolean },
    ) => void;
    onNetworkIssue?: (offline: boolean) => void;
  },
): Promise<POJUSessionState> {
  if (typeof window === "undefined") {
    throw new Error("continueInterruptedFinalDeliveryForSession is browser-only");
  }
  const { savePOJUSession } = await import("@/lib/poju/session-manager");
  const { pollFinalDeliveryJobUntilDone } = await import("@/lib/poju/poll-final-delivery-job");
  const { resolvePivotSessionLang } = await import("@/lib/poju/session-lang");
  const sessionLang = resolvePivotSessionLang(session, locale);

  const jobId =
    (opts?.job_id?.trim() || session.pending_delivery_job_id?.trim() || "").trim();
  if (!isUsableFinalDeliveryJobId(jobId)) {
    throw new Error("No interrupted delivery job to continue");
  }

  const res = await fetch("/api/poju/final-delivery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      session_id: session.session_id,
      continue_interrupted: true,
      job_id: jobId,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    job_id?: string;
    error?: string;
  };
  if (!res.ok || !data.job_id) {
    throw new Error(
      typeof data.error === "string" ? data.error : `continue_interrupted HTTP ${res.status}`,
    );
  }

  const pendingSession: POJUSessionState = {
    ...session,
    pending_delivery_job_id: data.job_id,
  };
  await savePOJUSession(pendingSession);

  const original_question =
    pendingSession.agent_v2?.original_question?.trim() ||
    pendingSession.original_question?.trim() ||
    "";
  const polled = await pollFinalDeliveryJobUntilDone({
    job_id: data.job_id,
    locale: sessionLang,
    original_question,
    onProgress: (_status, hint, streamed) => {
      opts?.onStreamProgress?.(hint, streamed?.markdown ?? "", {
        waiting_next: streamed?.waiting_next ?? true,
        preface_ready: streamed?.preface_ready ?? false,
      });
    },
    onNetworkIssue: opts?.onNetworkIssue,
  });

  if (!polled.ok) {
    if (polled.interrupted || polled.streamed_markdown?.trim()) {
      throw new FinalDeliveryInterruptedError(
        polled.job_id,
        polled.error || "final-delivery interrupted",
        polled.streamed_markdown,
      );
    }
    throw new Error(polled.error || "final-delivery continue poll failed");
  }

  return applyFinalDeliveryResultToSession(
    pendingSession,
    {
      full_text: polled.full_text,
      actions: Array.isArray(polled.actions) ? (polled.actions as POJUAction[]) : [],
      model: polled.model,
      tokens_used: polled.tokens_used,
      latency_ms: 0,
      cost_usd: 0,
      llm_debug: polled.llm_debug,
    },
    sessionLang,
  );
}
