/** Strip `bazi.` prefix for use with next-intl `useTranslations("bazi")`. */
export function baziI18nSubKey(fullKey: string): string {
  return fullKey.startsWith("bazi.") ? fullKey.slice(5) : fullKey;
}

/** Resolve a bazi i18n key; falls back to Han label when key missing. */
export function resolveBaziLabel(
  fullKey: string | undefined | null,
  t: (key: string) => string,
  fallback?: string,
): string {
  if (!fullKey) return fallback ?? "";
  try {
    const sub = baziI18nSubKey(fullKey);
    const translated = t(sub);
    if (translated && translated !== sub) return translated;
  } catch {
    /* key not in catalog */
  }
  return fallback ?? fullKey;
}

/** Map 神煞 Han name to i18n sub-key under bazi.shensha.* */
export function shenshaHanToSubKey(han: string): string {
  const map: Record<string, string> = {
    天乙贵人: "shensha.tian_yi_gui_ren",
    禄神: "shensha.lu_shen",
    飞刃: "shensha.fei_ren",
    文昌: "shensha.wen_chang",
    桃花: "shensha.tao_hua",
    驿马: "shensha.yi_ma",
    华盖: "shensha.hua_gai",
    孤辰: "shensha.gu_chen",
    寡宿: "shensha.gua_su",
  };
  return map[han] ?? han;
}
