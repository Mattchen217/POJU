/**
 * Mid-chat website-language switch (output ≡ site locale).
 * Shared by POJUChatUI (write) and WorkspaceShell (hydrate resume).
 */

import { routing } from "@/i18n/routing";
import { getPathnameWithoutLocale } from "@/lib/i18n/pathname-without-locale";
import type { AppLocale } from "@/lib/prompts/language-directive";

export const PIVOT_PENDING_LANG_SWITCH_KEY = "pivot-pending-lang-switch";

export type PendingLangSwitch = {
  sessionId: string;
  message: string;
  targetLocale: AppLocale;
  /** Serialized composer attachment if any (data_url may be large). */
  attachment: {
    name: string;
    kind: string;
    mime: string;
    data_url?: string;
  } | null;
};

export function readPendingLangSwitch(): PendingLangSwitch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PIVOT_PENDING_LANG_SWITCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingLangSwitch;
    if (!parsed?.sessionId || !parsed?.message || !parsed?.targetLocale) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingLangSwitch(pending: PendingLangSwitch): void {
  try {
    sessionStorage.setItem(PIVOT_PENDING_LANG_SWITCH_KEY, JSON.stringify(pending));
  } catch {
    /* quota */
  }
}

export function clearPendingLangSwitch(): void {
  try {
    sessionStorage.removeItem(PIVOT_PENDING_LANG_SWITCH_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * `/app?tab=poju&session=` (workspace) or `/poju/session/:id` (classic).
 * Always includes session when known — hydrate depends on it.
 */
export function buildChatLocaleSwitchHref(
  targetLocale: AppLocale,
  sessionId: string,
): string {
  const livePath =
    typeof window !== "undefined"
      ? getPathnameWithoutLocale(window.location.pathname)
      : "/app";
  const path = livePath || "/app";
  const sid = sessionId.trim();

  let hrefPath = "/app";
  let qs = "";

  if (path.startsWith("/poju/session/")) {
    hrefPath = path;
  } else {
    hrefPath = "/app";
    const q = new URLSearchParams();
    q.set("tab", "poju");
    if (sid) q.set("session", sid);
    qs = `?${q.toString()}`;
  }

  const localized =
    targetLocale === routing.defaultLocale
      ? hrefPath
      : `/${targetLocale}${hrefPath === "/" ? "" : hrefPath}`;
  return `${localized}${qs}`;
}

/** Path+query for next-intl router.replace (locale passed separately). */
export function buildChatLocaleSwitchAppHref(sessionId: string): string {
  const sid = sessionId.trim();
  const q = new URLSearchParams();
  q.set("tab", "poju");
  if (sid) q.set("session", sid);
  return `/app?${q.toString()}`;
}
