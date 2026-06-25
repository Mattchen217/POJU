import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { buildPojuChatCoreSections } from "@/lib/llm/prompts/poju-base";
import {
  getPojuChatLanguageDirective,
  parseAppLocale,
  resolvePojuSessionOutputLocale,
} from "@/lib/prompts/language-directive";
import {
  estimatePromptTokens,
  logBaseAnalysisPayload,
} from "@/lib/poju/base-analysis-diagnostics";
import {
  buildCurrentDateContext,
  buildNorthAmericaAdaptation,
  buildProfileContextSection,
  stitchPromptSections,
} from "@/lib/llm/prompts/oriental-counselor-base";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { buildChatPhaseTermBindingBlock } from "@/lib/llm/prompts/term-closed-set-constraint";
import {
  applyTurnContext,
  formatPhaseMessageHistory,
} from "@/lib/llm/phases/phase-transport";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";

/** Byte-stable output red lines — cached in system prompt (INV-1). */
export function buildOutputRedLinesBlock(): string {
  return `【输出红线·任何阶段绝不跨越】
1) 不预测具体未来事件/日期/数额；遇"什么时候/能不能/多久"重构为"能量是否就绪/什么在驱动/卡在哪"。
2) 不算命、不下吉凶命定。 3) 不占卜。 4) 不恐吓收割。 5) 不做保证。
6) 合婚/合盘归 Match：POJU 只谈单人"该不该/准备好没"，不堆合婚术语。
—— 在此之上，五行/阴阳/十神/神煞/《易经》作为能量与性格语言【尽情展示】，是灵魂不是违规。`;
}

export async function loadBaseAnalysisForSession(input: PhaseLLMInput): Promise<unknown> {
  if (input.base_analysis !== undefined && input.base_analysis !== null) {
    return input.base_analysis;
  }
  if (typeof window === "undefined") return null;
  if (input.profile && input.session.selected_stored_profile_id) {
    const row = await getStoredProfile(input.session.selected_stored_profile_id);
    return row?.base_analysis ?? null;
  }
  const id = input.session.selected_stored_profile_id?.trim();
  if (!id) return null;
  const row = await getStoredProfile(id);
  return row?.base_analysis ?? null;
}

/**
 * Byte-stable system prompt for prefix cache: core + locale adaptation + profile/base_analysis only.
 * Dynamic per-turn content belongs in {@link buildPhaseTurnContext} + {@link applyTurnContext}.
 */
export async function buildPojuSystemPrompt(input: PhaseLLMInput): Promise<string> {
  const baseAnalysis = await loadBaseAnalysisForSession(input);
  const outLoc = resolvePojuSessionOutputLocale({
    locked: input.session.locked_output_locale,
    uiLocale: parseAppLocale(input.locale),
    userInput: input.user_message,
    conversationHistory: input.session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });
  const system = stitchPromptSections(
    ...buildPojuChatCoreSections(outLoc),
    buildOutputRedLinesBlock(),
    buildNorthAmericaAdaptation(outLoc),
    buildProfileContextSection(input.profile, baseAnalysis, outLoc),
  );
  logBaseAnalysisPayload("buildPojuSystemPrompt", baseAnalysis, {
    session_id: input.session.session_id,
    system_chars: system.length,
    system_est_tokens: estimatePromptTokens(system.length),
  });
  return system;
}

/** Per-turn dynamic context — prepended to the latest user message (not in system). */
export function buildPhaseTurnContext(input: PhaseLLMInput, taskBlock: string): string {
  const uiLocale = parseAppLocale(input.locale);
  const outLoc = resolvePojuSessionOutputLocale({
    locked: input.session.locked_output_locale,
    uiLocale,
    userInput: input.user_message,
    conversationHistory: input.session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });
  const langDirective = getPojuChatLanguageDirective({
    locale: uiLocale,
    userInput: input.user_message,
    conversationHistory: input.session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    forcedOutputLocale: outLoc,
  });
  const structured =
    normalizeBaseAnalysisInput(input.base_analysis ?? null).structured ?? null;
  const injectionBlock = input.tool_injection_context?.trim() ?? "";

  return stitchPromptSections(
    langDirective.directive.trim(),
    buildCurrentDateContext(new Date(), outLoc),
    injectionBlock,
    buildTermMarkingPromptBlock(outLoc),
    structured ? buildStructuredInstanceInventory(structured) : "",
    buildChatPhaseTermBindingBlock(outLoc),
    taskBlock,
  );
}

/** Stable system + turn-context messages for phase LLM calls. */
export async function buildPhaseTransportInput(
  input: PhaseLLMInput,
  taskBlock: string,
  messageHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}> {
  const system = await buildPojuSystemPrompt(input);
  const turnContext = buildPhaseTurnContext(input, taskBlock);
  const base = messageHistory ?? formatPhaseMessageHistory(input.session.messages);
  return {
    system,
    messages: applyTurnContext(base, turnContext),
  };
}

/** @deprecated 使用 buildPojuSystemPrompt；保留别名避免大范围重命名 */
export const buildOrientalSystemPrompt = buildPojuSystemPrompt;
