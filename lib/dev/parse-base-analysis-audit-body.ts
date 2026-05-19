import type { UserProfile } from "@/lib/profile/types";
import { parseUserProfileForApi } from "@/lib/profile/user-profile-api";

export type BaseAnalysisAuditBodyMeta = {
  user_profile: UserProfile;
  stored_profile_id: string | null;
  display_name: string | null;
};

export function parseBaseAnalysisAuditBody(raw: unknown): BaseAnalysisAuditBodyMeta | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const profile = parseUserProfileForApi(body.user_profile);
  if (!profile) return null;

  const stored_profile_id =
    typeof body.stored_profile_id === "string" && body.stored_profile_id.trim()
      ? body.stored_profile_id.trim()
      : null;
  const display_name =
    typeof body.display_name === "string" && body.display_name.trim() ? body.display_name.trim() : null;

  return { user_profile: profile, stored_profile_id, display_name };
}
