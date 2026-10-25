import { parseAppLocale } from "@/lib/prompts/language-directive";
import type { UserProfile } from "@/lib/profile/types";

export type SyncroComputeRequestBody = {
  profile_id?: string;
  task_description?: string;
  user_location?: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  locale?: unknown;
  user_profile?: UserProfile | null;
  base_analysis?: unknown | null;
};

export type ParsedSyncroComputeRequest = {
  profile_id: string;
  task_description: string;
  user_location: { latitude: number; longitude: number; timezone: string };
  locale: string;
  user_profile: UserProfile | null;
  base_analysis: unknown | null;
};

export function parseSyncroComputeRequest(
  body: SyncroComputeRequestBody,
): { ok: true; data: ParsedSyncroComputeRequest } | { ok: false; status: number; error: string; message?: string } {
  const locale = parseAppLocale(body.locale);

  if (!body.profile_id?.trim() || !body.task_description?.trim() || !body.user_location) {
    return { ok: false, status: 400, error: "invalid_request" };
  }

  const { latitude, longitude, timezone } = body.user_location;
  if (
    latitude == null ||
    longitude == null ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !timezone?.trim()
  ) {
    return {
      ok: false,
      status: 400,
      error: "invalid_location",
      message: "Latitude, longitude, and timezone are required.",
    };
  }

  return {
    ok: true,
    data: {
      profile_id: body.profile_id.trim(),
      task_description: body.task_description.trim(),
      user_location: { latitude, longitude, timezone: timezone.trim() },
      locale,
      user_profile: body.user_profile ?? null,
      base_analysis: body.base_analysis ?? null,
    },
  };
}
