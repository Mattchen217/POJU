import {
  hasBaseAnalysisPayload,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

export type CachedBaseAnalysis = {
  baseAnalysis: unknown;
  reportText: string;
};

/** Client-side cache probe — stored profile base_analysis only (KV jobs resume via stream API). */
export async function getCachedBaseAnalysis(profileId: string): Promise<CachedBaseAnalysis | null> {
  const stored = await getStoredProfile(profileId);
  if (!stored?.user_profile) return null;

  const bundle = normalizeBaseAnalysisInput(stored.base_analysis);
  if (!hasBaseAnalysisPayload(bundle)) return null;

  const reportText = markedTextFromStoredBaseAnalysis(stored.base_analysis);
  if (!reportText) return null;

  return {
    baseAnalysis: stored.base_analysis,
    reportText,
  };
}
