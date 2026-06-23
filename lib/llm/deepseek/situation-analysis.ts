/**
 * @deprecated Block 2 — 困境分析已迁移至 `breakthrough-core.ts`。
 * 本模块保留薄壳，供遗留引用与 dev 工具；主路径使用 breakthrough-core。
 */

export {
  resolveBaseAnalysisForBreakthrough as resolveBaseAnalysisForSession,
} from "@/lib/llm/deepseek/breakthrough-core";

import type { POJUSessionState, SituationAnalysisCacheEntry } from "@/lib/poju/types";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";

/** @deprecated Use agent_v2.breakthrough_core instead. */
export function getCachedSituationAnalysis(
  session: POJUSessionState,
  fingerprint: string,
): SituationAnalysisCacheEntry | undefined {
  return session.situation_analysis_by_fingerprint?.[fingerprint];
}

/** @deprecated Use requestBreakthroughCore instead. */
export async function requestSituationAnalysis(
  session: POJUSessionState,
  locale: string,
  options?: { force?: boolean; base_analysis?: unknown | null },
): Promise<{ session: POJUSessionState; cache_hit: boolean; fingerprint: string }> {
  const { requestBreakthroughCore } = await import("@/lib/llm/deepseek/breakthrough-core");
  const fingerprint = await computeSituationContextFingerprint({
    session_id: session.session_id,
    original_question: session.original_question,
    agent_v2: session.agent_v2,
    context_collected: session.context_collected,
  });
  if (session.agent_v2?.breakthrough_core && !options?.force) {
    return { session, cache_hit: true, fingerprint };
  }
  const out = await requestBreakthroughCore(session, locale, {
    base_analysis: options?.base_analysis,
  });
  return { session: out.session, cache_hit: false, fingerprint };
}

/** @deprecated */
export function buildSituationAnalysisPrompt(): never {
  throw new Error("buildSituationAnalysisPrompt is deprecated; use breakthrough-core");
}

/** @deprecated */
export function parseSituationAnalysisResponseText(): never {
  throw new Error("parseSituationAnalysisResponseText is deprecated; use breakthrough-core");
}
