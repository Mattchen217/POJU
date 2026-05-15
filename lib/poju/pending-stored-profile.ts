/** SessionStorage key: optional `stored_profiles` row to attach to the next created POJU session (Step 7 → Step 8). */
export const POJU_PENDING_STORED_PROFILE_KEY = "poju_pending_stored_profile_id";

export function readPendingStoredProfileId(): string | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(POJU_PENDING_STORED_PROFILE_KEY)?.trim();
  return v || null;
}

export function clearPendingStoredProfileId(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(POJU_PENDING_STORED_PROFILE_KEY);
}

/** @deprecated Prefer read + clear on success to avoid losing the id if session creation fails. */
export function consumePendingStoredProfileId(): string | null {
  const v = readPendingStoredProfileId();
  if (v) sessionStorage.removeItem(POJU_PENDING_STORED_PROFILE_KEY);
  return v;
}
