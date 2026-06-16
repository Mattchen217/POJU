/** Strip `bazi.` prefix for use with next-intl `useTranslations("bazi")`. */
export function baziI18nSubKey(fullKey: string): string {
  return fullKey.startsWith("bazi.") ? fullKey.slice(5) : fullKey;
}

function isMissingBaziTranslation(translated: string, sub: string, fullKey: string): boolean {
  if (!translated) return true;
  if (translated === sub || translated === fullKey) return true;
  if (translated.startsWith("bazi.")) return true;
  if (translated.includes("shensha.unmapped_")) return true;
  return false;
}

/** Resolve a bazi i18n key; falls back to Han label when key missing. */
export function resolveBaziLabel(
  fullKey: string | undefined | null,
  t: (key: string) => string,
  fallback?: string,
): string {
  if (!fullKey) return fallback ?? "";
  const sub = baziI18nSubKey(fullKey);
  try {
    const translated = t(sub);
    if (!isMissingBaziTranslation(translated, sub, fullKey)) return translated;
  } catch {
    /* key not in catalog */
  }
  return fallback ?? fullKey.replace(/^bazi\./, "");
}

export { shenshaHanToSubKey } from "@/lib/poju/shensha-i18n-map";
