/**
 * Client-side profile upgrade: recalculate chart with birth location + optional base_analysis regen.
 */
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import {
  getStoredProfile,
  upgradeStoredProfileLocation,
} from "@/lib/profile/stored-profiles-service";
import type { BirthLocation } from "@/lib/profile/types";

export type ProfileUpgradeResult = {
  hourChanged: boolean;
  oldHourPillar: string;
  newHourPillar: string;
  diffMinutes: number;
  baseAnalysisRegenerated: boolean;
};

export async function upgradeProfileWithLocation(
  profileId: string,
  location: BirthLocation,
): Promise<ProfileUpgradeResult> {
  const before = await getStoredProfile(profileId);
  if (!before) throw new Error("Profile not found");

  const oldHour = before.user_profile.bazi.hourPillar;
  const hadBaseAnalysis = Boolean(before.base_analysis?.content);

  const userProfile = await upgradeStoredProfileLocation(profileId, {
    ...location,
    use_defaults: false,
  });

  let baseAnalysisRegenerated = false;
  if (hadBaseAnalysis) {
    await generateBaseAnalysis(profileId);
    baseAnalysisRegenerated = true;
  }

  return {
    hourChanged: oldHour !== userProfile.bazi.hourPillar,
    oldHourPillar: oldHour,
    newHourPillar: userProfile.bazi.hourPillar,
    diffMinutes: userProfile.tst_meta?.diff_minutes ?? 0,
    baseAnalysisRegenerated,
  };
}

/** True when profile may benefit from birth-location upgrade. */
export function profileNeedsLocationUpgrade(usedTrueSolarTime?: boolean): boolean {
  return usedTrueSolarTime !== true;
}
