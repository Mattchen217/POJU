/**
 * Profiles created for base_analysis are "pending" until LLM succeeds.
 * Incomplete pending profiles are removed on failure and hidden from session lists.
 */
const PENDING_PROFILE_KEY = "pojulife_pending_base_analysis_profile_id";

export function markPendingBaseAnalysisProfile(profileId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_PROFILE_KEY, profileId);
}

export function clearPendingBaseAnalysisProfile(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_PROFILE_KEY);
}

export function getPendingBaseAnalysisProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PENDING_PROFILE_KEY)?.trim() || null;
}
