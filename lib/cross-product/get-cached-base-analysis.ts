import {
  hasBaseAnalysisPayload,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
import { getStoredProfile, storedLayer1Present } from "@/lib/profile/stored-profiles-service";

export type CachedBaseAnalysis = {
  baseAnalysis: unknown;
  /** Legacy narrative; empty when the user-facing report is not stored. */
  reportText: string;
};

/** Client-side cache probe — Layer-1 structured is enough (narrative report not required). */
export async function getCachedBaseAnalysis(profileId: string): Promise<CachedBaseAnalysis | null> {
  const stored = await getStoredProfile(profileId);
  if (!stored?.user_profile) return null;

  const bundle = normalizeBaseAnalysisInput(stored.base_analysis);
  if (!storedLayer1Present(stored.base_analysis) && !hasBaseAnalysisPayload(bundle)) return null;

  return {
    baseAnalysis: stored.base_analysis,
    reportText: markedTextFromStoredBaseAnalysis(stored.base_analysis) ?? "",
  };
}
