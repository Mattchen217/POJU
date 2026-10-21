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
