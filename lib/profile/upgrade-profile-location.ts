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

  const userProfile = await upgradeStoredProfileLocation(profileId, {
    ...location,
    use_defaults: false,
  });

  await generateBaseAnalysis(profileId, undefined, undefined, { force: true });

  return {
    hourChanged: oldHour !== userProfile.bazi.hourPillar,
    oldHourPillar: oldHour,
    newHourPillar: userProfile.bazi.hourPillar,
    diffMinutes: userProfile.tst_meta?.diff_minutes ?? 0,
    baseAnalysisRegenerated: true,
  };
}

/** True when profile may benefit from birth-location upgrade. */
export function profileNeedsLocationUpgrade(usedTrueSolarTime?: boolean): boolean {
  return usedTrueSolarTime !== true;
}
