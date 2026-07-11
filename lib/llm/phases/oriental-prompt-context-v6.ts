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
  buildDirectedDynamicRelationInventoryBlock,
  computeDirectedDynamicRelations,
  computeRelationAuditAllowlist,
  getCurrentLiunian,
} from "@/lib/calculations/relation-engine";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { AgentPhase } from "@/lib/poju/agent-state";
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
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import {
  inferQuestionCategoryFromText,
  resolveAgendaRelationContext,
} from "@/lib/llm/prompts/relation-closed-set-context";
import { buildChatPhaseTermBindingBlock } from "@/lib/llm/prompts/term-closed-set-constraint";
import { countSubstantiveOpeningTurns } from "@/lib/poju/agent";
import {
  buildTurnContextSnapshot,
  shouldForceConverge,
} from "@/lib/poju/state-machine";
import {
  applyTurnContext,
  formatPhaseMessageHistory,
} from "@/lib/llm/phases/phase-transport";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";
import { buildAnchoredFactsExclusionBlock } from "@/lib/poju/anchored-fact-tracking";
import { buildUsedMetaphorsAvoidBlock } from "@/lib/poju/reply-metaphor-extract";
import { buildStaleAgendaCatchupBlock } from "@/lib/poju/investigation-agenda";
import { extractRelationFocusHintsFromText } from "@/lib/poju/relation-focus-hints";

/** 下游相位：question_category 已定，流年/定向关系进 user 侧（INV-1 · 不进 system）。 */
export const POJU_V6_DIRECTED_RELATION_PHASES: ReadonlySet<AgentPhase> = new Set([
  "opening",
  "collecting_context",
  "awaiting_confirmation",
  "delivered",
]);

export function shouldInjectDirectedRelationsV6(input: PhaseLLMInput): boolean {
  const phase = input.agent_state?.current_phase;
  return phase != null && POJU_V6_DIRECTED_RELATION_PHASES.has(phase);
}

export function buildDirectedRelationAuditAllowlistV6(
  structured: ProfileStructured,
  questionCategory: string | null | undefined,
) {
  return computeRelationAuditAllowlist(structured, getCurrentLiunian(), questionCategory);
}

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

  const injectDirected = Boolean(structured && shouldInjectDirectedRelationsV6(input));
  const liunian = injectDirected ? getCurrentLiunian() : null;
  const questionCategory =
    input.agent_state?.question_category ??
    inferQuestionCategoryFromText(
      input.agent_state?.original_question ??
        input.session.original_question ??
        input.user_message,
    );
  const focusHints = extractRelationFocusHintsFromText(input.user_message);
  const directedDynamicRelsFull =
    structured && liunian
      ? computeDirectedDynamicRelations(structured, liunian, questionCategory)
      : undefined;
  const directedInventoryBlock =
    structured && liunian
      ? buildDirectedDynamicRelationInventoryBlock(
          structured,
          liunian,
          questionCategory,
          focusHints,
        )
      : "";
  const anchoredFactsBlock = buildAnchoredFactsExclusionBlock(
    input.agent_state?.anchored_fact_ids,
    outLoc,
  );
  const usedMetaphorsBlock = buildUsedMetaphorsAvoidBlock(
    input.agent_state?.used_metaphors,
    outLoc,
  );

  const dataPlane = stitchPromptSections(
    buildNorthAmericaAdaptation(outLoc),
    buildProfileContextSection(input.profile, baseAnalysis, outLoc),
    structured
      ? buildChatFactGuardBlock(structured, {
          directedRelations: injectDirected ? directedDynamicRelsFull ?? [] : undefined,
        })
      : "",
    directedInventoryBlock,
    structured ? buildStructuredInstanceInventory(structured) : "",
    anchoredFactsBlock,
    usedMetaphorsBlock,
  );

  const termPlane = stitchPromptSections(
    buildTermMarkingPromptBlock(outLoc),
    buildChatPhaseTermBindingBlock(outLoc),
  );

  const substantiveOpeningTurns = countSubstantiveOpeningTurns(input.session.messages);
  const baseAnalysisReady = Boolean(
    baseAnalysis ?? input.session.has_profile ?? structured,
  );
  const forceConvergeBlock =
    input.agent_state?.current_phase === "opening" &&
    shouldForceConverge(substantiveOpeningTurns, baseAnalysisReady)
      ? `【控制面指令 · 本轮必须收敛】你已通过前几轮充分掌握了核心困境与期望方向。本轮必须填齐 core_dilemma + desired_direction 全部实质子字段（禁止"尚未明确"占位），只输出 response 追问或承接——议程由第2段独立生成。`
      : "";

  const agendaCatchupBlock =
    input.agent_state?.current_phase === "collecting_context"
      ? buildStaleAgendaCatchupBlock(input.agent_state, outLoc)
      : "";

  return stitchPromptSections(
    langDirective.directive.trim(),
    buildCurrentDateContext(new Date(), outLoc),
    injectionBlock,
    dataPlane,
    termPlane,
    buildPojuUserSideControlPlane(outLoc),
    snapshotBlock,
    forceConvergeBlock,
    agendaCatchupBlock,
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
