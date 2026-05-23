import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { buildPojuCorePromptSections } from "@/lib/llm/prompts/poju-base";
import {
  buildCurrentDateContext,
  buildLanguageGuidance,
  buildNorthAmericaAdaptation,
  buildProfileContextSection,
  stitchPromptSections,
} from "@/lib/llm/prompts/oriental-counselor-base";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";

export async function loadBaseAnalysisForSession(input: PhaseLLMInput): Promise<unknown> {
  if (input.base_analysis !== undefined && input.base_analysis !== null) {
    return input.base_analysis;
  }
  if (typeof window === "undefined") return null;
  if (input.profile && input.session.selected_stored_profile_id) {
    const row = await getStoredProfile(input.session.selected_stored_profile_id);
    return row?.base_analysis?.content ?? null;
  }
  const id = input.session.selected_stored_profile_id?.trim();
  if (!id) return null;
  const row = await getStoredProfile(id);
  return row?.base_analysis?.content ?? null;
}

/** POJU phase system prompt：poju-base 模块 + 日期/语言/命盘 + 阶段任务块 */
export async function buildPojuSystemPrompt(input: PhaseLLMInput, taskBlock: string): Promise<string> {
  const baseAnalysis = await loadBaseAnalysisForSession(input);
  return stitchPromptSections(
    ...buildPojuCorePromptSections(),
    buildCurrentDateContext(new Date(), input.locale),
    buildLanguageGuidance(input.locale, input.user_message),
    buildNorthAmericaAdaptation(input.locale),
    buildProfileContextSection(input.profile, baseAnalysis),
    taskBlock,
  );
}

/** @deprecated 使用 buildPojuSystemPrompt；保留别名避免大范围重命名 */
export const buildOrientalSystemPrompt = buildPojuSystemPrompt;
