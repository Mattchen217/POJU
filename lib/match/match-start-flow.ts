import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

export type MatchPrepareRedirect = {
  profile_id: string;
  partner_id: string;
};

export type MatchStartCheckResult =
  | { status: "ready" }
  | { status: "needs_prepare"; redirect: MatchPrepareRedirect };

function hasBaseAnalysis(
  profile: Awaited<ReturnType<typeof getStoredProfile>>,
): boolean {
  return profile?.base_analysis?.content != null && profile.base_analysis.content !== "";
}

/**
 * Ensure both Match profiles have completed base analysis before computing.
 * Returns a prepare redirect for the first profile that is missing analysis (A before B).
 */
export async function checkMatchProfilesReady(
  aProfileId: string,
  bProfileId: string,
): Promise<MatchStartCheckResult> {
  const [profileA, profileB] = await Promise.all([
    getStoredProfile(aProfileId),
    getStoredProfile(bProfileId),
  ]);

  if (!hasBaseAnalysis(profileA)) {
    return {
      status: "needs_prepare",
      redirect: { profile_id: aProfileId, partner_id: bProfileId },
    };
  }

  if (!hasBaseAnalysis(profileB)) {
    return {
      status: "needs_prepare",
      redirect: { profile_id: bProfileId, partner_id: aProfileId },
    };
  }

  return { status: "ready" };
}

export function matchPreparePath(redirect: MatchPrepareRedirect): string {
  const params = new URLSearchParams({
    next: "match",
    partner: redirect.partner_id,
  });
  return `/match/prepare/${redirect.profile_id}?${params.toString()}`;
}
