import { z } from "zod";

/** Locales used on easternos.com (next-intl). Stored on user_metadata as `lang`. */
export const AUTH_LOCALES = ["en", "zh", "es", "fr"] as const;
export type AuthLocale = (typeof AUTH_LOCALES)[number];

export const AuthLocaleSchema = z.enum(AUTH_LOCALES);

export function normalizeAuthLocale(raw: unknown): AuthLocale {
  const parsed = AuthLocaleSchema.safeParse(
    typeof raw === "string" ? raw.trim().toLowerCase() : raw,
  );
  return parsed.success ? parsed.data : "en";
}

function cookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

/**
 * Resolve UI locale for auth emails: body → cookies → Referer path → en.
 * Landing also writes `NEXT_LOCALE` + `poju-marketing-locale` cookies on language change.
 */
export function resolveAuthLocale(req: Request, bodyLocale?: unknown): AuthLocale {
  if (bodyLocale != null && bodyLocale !== "") {
    const parsed = AuthLocaleSchema.safeParse(
      typeof bodyLocale === "string" ? bodyLocale.trim().toLowerCase() : bodyLocale,
    );
    if (parsed.success) return parsed.data;
  }

  const cookie = req.headers.get("cookie") ?? "";
  for (const name of ["NEXT_LOCALE", "poju-marketing-locale"]) {
    const raw = cookieValue(cookie, name);
    if (!raw) continue;
    const parsed = AuthLocaleSchema.safeParse(raw.trim().toLowerCase());
    if (parsed.success) return parsed.data;
  }

  const referer = req.headers.get("referer") ?? "";
  try {
    const path = new URL(referer).pathname;
    const m = path.match(/^\/(zh|es|fr)(\/|$)/);
    if (m) return m[1] as AuthLocale;
  } catch {
    /* ignore */
  }

  return "en";
}
