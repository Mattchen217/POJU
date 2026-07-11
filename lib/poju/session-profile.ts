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

/** True when this session explicitly bound a stored profile or in-session birth submit. */
export function resolveSessionHasProfile(session: POJUSessionState): boolean {
  const sid = session.selected_stored_profile_id?.trim();
  if (sid && sid.length > 0) return true;
  if (session.birth_submitted_in_session) return true;
  const agentSid = session.agent_v2?.selected_profile_id?.trim();
  if (agentSid && agentSid.length > 0) return true;
  if (session.agent_v2?.has_base_analysis === true) return true;
  return false;
}

/** Backfill standard session field when profile id only lives on agent_v2 (legacy rows). */
export function backfillSessionProfileBinding(session: POJUSessionState): POJUSessionState {
  const stored = session.selected_stored_profile_id?.trim();
  if (stored) return session;
  const agentSid = session.agent_v2?.selected_profile_id?.trim();
  if (agentSid) {
    return { ...session, selected_stored_profile_id: agentSid };
  }
  return session;
}

/** Sync legacy `has_profile` flag with resolver (call after profile bind). */
export function withSessionProfileFlags(
  session: POJUSessionState,
  patch?: Partial<Pick<POJUSessionState, "selected_stored_profile_id" | "birth_submitted_in_session" | "profile_skipped">>,
): POJUSessionState {
  const merged = backfillSessionProfileBinding({ ...session, ...patch });
  return {
    ...merged,
    has_profile: resolveSessionHasProfile(merged),
  };
}

export async function loadSessionUserProfile(session: POJUSessionState): Promise<UserProfile | null> {
  const bundle = await loadSessionProfileBundle(session);
  return bundle.profile;
}

function collectSessionProfileCandidateIds(session: POJUSessionState): string[] {
  const raw = [
    session.selected_stored_profile_id,
    session.agent_v2?.selected_profile_id,
    session.matrix_payload?.profile_id,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    const trimmed = id?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function resolveStoredProfileIdForSession(session: POJUSessionState): string | null {
  const candidates = collectSessionProfileCandidateIds(session);
  return candidates[0] ?? null;
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
  resolved_profile_id: string | null;
}> {
  for (const id of collectSessionProfileCandidateIds(session)) {
    const data = await getStoredProfile(id);
    if (data?.base_analysis != null) {
      return {
        profile: data.user_profile ?? null,
        base_analysis: data.base_analysis,
        resolved_profile_id: id,
      };
    }
  }

  if (session.birth_submitted_in_session) {
    const base_analysis = await loadStoredBaseAnalysis(session);
    if (base_analysis != null) {
      return {
        profile: await getUserProfile(),
        base_analysis,
        resolved_profile_id: resolveStoredProfileIdForSession(session),
      };
    }
  }

  return { profile: null, base_analysis: null, resolved_profile_id: null };
}
