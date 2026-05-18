/**
 * Session-scoped profile semantics (v4): never infer BaZi profile from legacy `userProfiles` alone.
 */

import { getUserProfile } from "@/lib/profile/active-profile";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

const STORED_PROFILE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Life domains: force birth form when profile missing (shared client + server policy). */
export const DEEP_LIFE_TOPIC_RE =
  /事业|职业|工作|职场|创业|财富|收入|金钱|投资|生意|感情|恋爱|婚姻|婚恋|夫妻|家庭|抚养|合伙|生存压力|经济压力|失业|转行/i;

export function isValidStoredProfileId(id: string | null | undefined): boolean {
  return typeof id === "string" && STORED_PROFILE_UUID_RE.test(id.trim());
}

/** True only when this session explicitly bound a stored profile or in-session birth submit. */
export function resolveSessionHasProfile(session: POJUSessionState): boolean {
  if (isValidStoredProfileId(session.selected_stored_profile_id)) return true;
  if (session.birth_submitted_in_session) return true;
  return false;
}

/** @deprecated UI uses `lastAssistantRequestsBirthForm` (model `action_requested`) only. */
export function shouldForceBirthForm(session: POJUSessionState, lastUserMessage: string): boolean {
  if (resolveSessionHasProfile(session) || session.profile_skipped) return false;
  return lastUserMessage.trim().length > 0 && DEEP_LIFE_TOPIC_RE.test(lastUserMessage);
}

/** True when the latest assistant turn asked the client to open the birth form. */
export function lastAssistantRequestsBirthForm(session: POJUSessionState): boolean {
  if (resolveSessionHasProfile(session) || session.profile_skipped) return false;
  const last = [...session.messages].reverse().find((m) => m.role === "assistant");
  return last?.meta?.action_requested === "show_birth_form";
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

/** Browser-only: load UserProfile for LLM / Step 7–9. */
/** Prevent birth-form UI from re-opening after profile is bound (stale assistant meta). */
export function clearBirthFormActionIfProfileBound(session: POJUSessionState): POJUSessionState {
  if (!resolveSessionHasProfile(session)) return session;
  const messages = session.messages.map((m, i) => {
    if (i !== session.messages.length - 1 || m.role !== "assistant") return m;
    if (m.meta?.action_requested !== "show_birth_form") return m;
    return {
      ...m,
      meta: { ...m.meta, action_requested: "continue_chat" as const },
    };
  });
  return { ...session, messages };
}

export async function loadSessionUserProfile(session: POJUSessionState): Promise<UserProfile | null> {
  if (!resolveSessionHasProfile(session)) return null;
  const sid = session.selected_stored_profile_id?.trim();
  if (isValidStoredProfileId(sid)) {
    const data = await getStoredProfile(sid!);
    return data?.user_profile ?? null;
  }
  if (session.birth_submitted_in_session) {
    return getUserProfile();
  }
  return null;
}
