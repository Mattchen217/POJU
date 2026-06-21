/**
 * POJU phase prompts — prefix-cache layout.
 *
 * **Static system prompt** (byte-stable across turns/phases in one session):
 * `buildPojuCorePromptSections()` + `buildNorthAmericaAdaptation` + profile/base_analysis block.
 *
 * **Dynamic turn context** (user message side): current date, language directive, tool injection, phase task block.
 *
 * DeepSeek/OpenRouter prefix cache has a **minute-level TTL** — long gaps between turns may miss cache; that is expected.
 * This layout maximizes the cacheable prefix size; it cannot eliminate TTL expiry.
 */

import { buildPojuChatResponseRules } from "@/lib/llm/prompts/poju-chat-output";
import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { buildPojuCorePromptSections } from "@/lib/llm/prompts/poju-base";
import {
  formatBaseAnalysisForPrompt,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";
import { getPojuChatLanguageDirective, parseAppLocale } from "@/lib/prompts/language-directive";
import {
  buildCurrentDateContext,
  buildNorthAmericaAdaptation,
  buildProfileContextSection,
  stitchPromptSections,
} from "@/lib/llm/prompts/oriental-counselor-base";
import {
  applyTurnContext,
  formatPhaseMessageHistory,
} from "@/lib/llm/phases/phase-transport";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";

type StaticPromptCacheEntry = {
  system: string;
  baseKey: string;
  locale: string;
  profileId: string;
};

/** In-process cache: one static system string per session while base_analysis/profile unchanged. */
const staticSystemPromptBySession = new Map<string, StaticPromptCacheEntry>();

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

/** Stable serialization key for base_analysis snapshot (avoid re-format drift). */
export function baseAnalysisStableKey(baseAnalysis: unknown): string {
  const bundle = normalizeBaseAnalysisInput(baseAnalysis);
  if (bundle.structured) {
    return JSON.stringify(bundle.structured);
  }
  const display = bundle.display_text?.trim() ?? "";
  const content =
    typeof bundle.content === "string" ? bundle.content.trim() : JSON.stringify(bundle.content ?? null);
  return JSON.stringify({ display, content });
}

/** Format base_analysis once per session snapshot — same bytes on every turn. */
export function formatBaseAnalysisSnapshot(baseAnalysis: unknown, locale: string): string {
  return formatBaseAnalysisForPrompt(baseAnalysis, locale);
}

/** Cross-turn constant system prompt (prefix-cache target). */
export async function buildPojuStaticSystemPrompt(input: PhaseLLMInput): Promise<string> {
  const sessionId = pojuCacheSessionId(input.session.session_id);
  const baseAnalysis = await loadBaseAnalysisForSession(input);
  const baseKey = baseAnalysisStableKey(baseAnalysis);
  const profileId = input.session.selected_stored_profile_id?.trim() ?? input.profile?.id ?? "";
  const locale = input.locale;

  const cached = staticSystemPromptBySession.get(sessionId);
  if (
    cached &&
    cached.baseKey === baseKey &&
    cached.locale === locale &&
    cached.profileId === profileId
  ) {
    return cached.system;
  }

  const system = stitchPromptSections(
    ...buildPojuCorePromptSections(),
    buildNorthAmericaAdaptation(locale),
    buildProfileContextSection(input.profile, baseAnalysis, locale),
  );

  staticSystemPromptBySession.set(sessionId, { system, baseKey, locale, profileId });
  return system;
}

/** Per-turn dynamic context — appended to the latest user message (not system). */
export function buildPojuDynamicTurnContext(input: PhaseLLMInput, taskBlock: string): string {
  const langDirective = getPojuChatLanguageDirective({
    locale: parseAppLocale(input.locale),
    userInput: input.user_message,
    conversationHistory: input.session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  return stitchPromptSections(
    buildCurrentDateContext(new Date(), input.locale),
    langDirective.directive,
    input.tool_injection_context?.trim() ?? "",
    buildPojuChatResponseRules(input.locale),
    taskBlock,
  );
}

/** System + messages ready for `callPhaseJsonTransport`. */
export async function preparePojuPhaseLLMCall(
  input: PhaseLLMInput,
  taskBlock: string,
): Promise<{ system: string; messages: Array<{ role: "user" | "assistant"; content: string }> }> {
  const system = await buildPojuStaticSystemPrompt(input);
  const turnContext = buildPojuDynamicTurnContext(input, taskBlock);
  const messages = applyTurnContext(formatPhaseMessageHistory(input.session.messages), turnContext);
  return { system, messages };
}

/** Test helper — clear cached static system for a session. */
export function clearPojuStaticSystemPromptCache(sessionId?: string): void {
  if (sessionId) staticSystemPromptBySession.delete(sessionId.trim());
  else staticSystemPromptBySession.clear();
}

/**
 * @deprecated Use `preparePojuPhaseLLMCall` or `buildPojuStaticSystemPrompt` + `buildPojuDynamicTurnContext`.
 * Kept for legacy callers/tests — concatenates static + dynamic (hurts prefix cache).
 */
export async function buildPojuSystemPrompt(input: PhaseLLMInput, taskBlock: string): Promise<string> {
  const [system, turnContext] = await Promise.all([
    buildPojuStaticSystemPrompt(input),
    Promise.resolve(buildPojuDynamicTurnContext(input, taskBlock)),
  ]);
  return stitchPromptSections(system, turnContext);
}

/** @deprecated Use `preparePojuPhaseLLMCall` */
export const buildOrientalSystemPrompt = buildPojuSystemPrompt;
