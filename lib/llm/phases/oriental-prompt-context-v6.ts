/**
 * POJU v6 Shadow — 动静分离拼装器。
 *
 * System：仅 poju-base-v6 人设 + 红线（字节恒定）
 * User turn prepend：语言/日期 → 命盘数据 → 术语规则 → 控制面 → 快照 → taskBlock
 *
 * ⚠️ 影子实现，不替换 oriental-prompt-context.ts。
 */

import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import {
  buildPojuSystemPromptV6,
  buildPojuUserSideControlPlane,
} from "@/lib/llm/prompts/poju-base-v6";
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
import { buildChatShenShaGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import { buildChatPhaseTermBindingBlock } from "@/lib/llm/prompts/term-closed-set-constraint";
import { buildTurnContextSnapshot } from "@/lib/poju/state-machine";
import {
  applyTurnContext,
  formatPhaseMessageHistory,
} from "@/lib/llm/phases/phase-transport";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";

export async function loadBaseAnalysisForSessionV6(input: PhaseLLMInput): Promise<unknown> {
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
 * v6 System — 零参数、字节恒定。
 * 不注入 profile / locale / phase / 命盘 —— 全部留给 user turn context。
 */
export function buildPojuSystemPromptV6Sync(): string {
  return buildPojuSystemPromptV6();
}

/**
 * v6 动态 turn context — prepend 到最新 user 消息前。
 *
 * 顺序（动静分离拓扑）：
 * 1. 语言与日期
 * 2. 命盘数据面（profile + base_analysis + 神煞守卫 + 实例清单）
 * 3. 术语标记规则
 * 4. 控制面契约（知识边界 / JSON 契约 / 会话准则 / 状态机通用协议）
 * 5. 状态机快照 JSON
 * 6. 当前 phase 专属 taskBlock
 */
export async function buildPhaseTurnContextV6(
  input: PhaseLLMInput,
  taskBlock: string,
): Promise<string> {
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

  const baseAnalysis = await loadBaseAnalysisForSessionV6(input);
  const structured =
    normalizeBaseAnalysisInput(baseAnalysis ?? null).structured ?? null;
  const injectionBlock = input.tool_injection_context?.trim() ?? "";
  const snapshotBlock = buildTurnContextSnapshot(input.agent_state);

  const dataPlane = stitchPromptSections(
    buildNorthAmericaAdaptation(outLoc),
    buildProfileContextSection(input.profile, baseAnalysis, outLoc),
    structured ? buildChatShenShaGuardBlock(structured) : "",
    structured ? buildStructuredInstanceInventory(structured) : "",
  );

  const termPlane = stitchPromptSections(
    buildTermMarkingPromptBlock(outLoc),
    buildChatPhaseTermBindingBlock(outLoc),
  );

  return stitchPromptSections(
    langDirective.directive.trim(),
    buildCurrentDateContext(new Date(), outLoc),
    injectionBlock,
    dataPlane,
    termPlane,
    buildPojuUserSideControlPlane(outLoc),
    snapshotBlock,
    taskBlock,
  );
}

/** v6 完整 transport：恒定 system + 动态 user prepend */
export async function buildPhaseTransportInputV6(
  input: PhaseLLMInput,
  taskBlock: string,
  messageHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}> {
  const system = buildPojuSystemPromptV6Sync();
  const turnContext = await buildPhaseTurnContextV6(input, taskBlock);
  const base = messageHistory ?? formatPhaseMessageHistory(input.session.messages);

  const baseAnalysis = await loadBaseAnalysisForSessionV6(input);
  logBaseAnalysisPayload("buildPhaseTransportInputV6", baseAnalysis, {
    session_id: input.session.session_id,
    system_chars: system.length,
    system_est_tokens: estimatePromptTokens(system.length),
    turn_context_chars: turnContext.length,
    turn_context_est_tokens: estimatePromptTokens(turnContext.length),
  });

  return {
    system,
    messages: applyTurnContext(base, turnContext),
  };
}
