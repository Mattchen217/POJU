import type { User } from "@supabase/supabase-js";

/** True when the session user must complete email before using protected app routes. */
export function userNeedsEmail(user: User | null | undefined): boolean {
  if (!user) return false;
  return !Boolean(user.email?.trim());
}

export function loginProviders(user: User | null | undefined): string[] {
  if (!user) return [];
  const fromIdentities = (user.identities ?? [])
    .map((i) => i.provider)
    .filter((p): p is string => Boolean(p));
  if (fromIdentities.length > 0) {
    return Array.from(new Set(fromIdentities));
  }
  const meta = user.app_metadata?.providers;
  if (Array.isArray(meta)) {
    return meta.filter((p): p is string => typeof p === "string");
  }
  const single = user.app_metadata?.provider;
  return typeof single === "string" ? [single] : [];
}

export function hasPasswordIdentity(user: User | null | undefined): boolean {
  return loginProviders(user).includes("email");
}
