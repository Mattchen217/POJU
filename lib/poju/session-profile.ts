/**
 * Session-scoped profile semantics (v4): never infer BaZi profile from legacy `userProfiles` alone.
 */

import { getUserProfile } from "@/lib/profile/active-profile";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

const STORED_PROFILE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidStoredProfileId(id: string | null | undefined): boolean {
  return typeof id === "string" && STORED_PROFILE_UUID_RE.test(id.trim());
}

/** True only when this session explicitly bound a stored profile or in-session birth submit. */
export function resolveSessionHasProfile(session: POJUSessionState): boolean {
  if (isValidStoredProfileId(session.selected_stored_profile_id)) return true;
  if (session.birth_submitted_in_session) return true;
  return false;
}

/** Sync legacy `has_profile` flag with resolver (call after profile bind). */
export function withSessionProfileFlags(
  session: POJUSessionState,
  patch?: Partial<Pick<POJUSessionState, "selected_stored_profile_id" | "birth_submitted_in_session" | "profile_skipped">>,
): POJUSessionState {
  const merged = { ...session, ...patch };
  return {
    ...merged,
    has_profile: resolveSessionHasProfile(merged),
  };
}

export async function loadSessionUserProfile(session: POJUSessionState): Promise<UserProfile | null> {
  const bundle = await loadSessionProfileBundle(session);
  return bundle.profile;
}

function resolveStoredProfileIdForSession(session: POJUSessionState): string | null {
  const sid = session.selected_stored_profile_id?.trim();
  if (isValidStoredProfileId(sid)) return sid!;
  const agentSid = session.agent_v2?.selected_profile_id?.trim();
  if (isValidStoredProfileId(agentSid)) return agentSid!;
  return null;
}

async function loadStoredBaseAnalysis(session: POJUSessionState): Promise<unknown | null> {
  const profileId = resolveStoredProfileIdForSession(session);
  if (!profileId) return null;
  const data = await getStoredProfile(profileId);
  return data?.base_analysis ?? null;
}

/** Browser-only: profile + Step 7 base analysis for `/api/poju/chat`. */
export async function loadSessionProfileBundle(session: POJUSessionState): Promise<{
  profile: UserProfile | null;
  base_analysis: unknown | null;
}> {
  if (!resolveSessionHasProfile(session)) return { profile: null, base_analysis: null };
  const sid = session.selected_stored_profile_id?.trim();
  if (isValidStoredProfileId(sid)) {
    const data = await getStoredProfile(sid!);
    return {
      profile: data?.user_profile ?? null,
      base_analysis: data?.base_analysis ?? null,
    };
  }
  if (session.birth_submitted_in_session) {
    const base_analysis = await loadStoredBaseAnalysis(session);
    return { profile: await getUserProfile(), base_analysis };
  }
  return { profile: null, base_analysis: null };
}
