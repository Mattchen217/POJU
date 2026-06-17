import {
  hasBaseAnalysisPayload,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";
import { formatBaseAnalysisForDisplay } from "@/lib/profile/format-base-analysis-zh";
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

  const reportText = formatBaseAnalysisForDisplay({
    content: bundle.content,
    display_text: bundle.display_text,
  });
  if (!reportText.trim()) return null;

  return {
    baseAnalysis: stored.base_analysis,
    reportText: reportText.trim(),
  };
}
