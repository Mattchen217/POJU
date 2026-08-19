/**
 * Persist Layer-1 natal facts (structured + core_judgments + metaphysics_pack)
 * without generating the user-facing energy-analysis report.
 */
import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import { resolveClientLocale } from "@/lib/base-analysis/resolve-client-locale";
import {
  getStoredProfile,
  saveCoreJudgmentsForProfile,
  storedLayer1Present,
} from "@/lib/profile/stored-profiles-service";

export async function ensureLayer1ForProfile(
  profileId: string,
  locale?: string,
  options?: { force?: boolean },
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("ensureLayer1ForProfile is browser-only");
  }

  const data = await getStoredProfile(profileId);
  if (!data?.user_profile) throw new Error("Profile not found");

  if (!options?.force && storedLayer1Present(data.base_analysis)) {
    return;
  }

  const outputLocale = locale ?? resolveClientLocale();
  const local = buildStreamLocalDataFromProfile(data.user_profile);
  await saveCoreJudgmentsForProfile({
    profile_id: profileId,
    structured: local.structured,
    locale: outputLocale,
  });

  const { clearPendingBaseAnalysisProfile } = await import("@/lib/profile/pending-base-analysis");
  clearPendingBaseAnalysisProfile();
}
