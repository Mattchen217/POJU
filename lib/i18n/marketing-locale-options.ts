import { routing } from "@/i18n/routing";

export type MarketingLocaleCode = (typeof routing.locales)[number];

/** 营销顶栏 / 移动抽屉用语言列表（顺序与各页面一致） */
export const MARKETING_LOCALE_OPTIONS: { code: MarketingLocaleCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "zh", label: "中文" },
];

export const MARKETING_LOCALE_COMPACT_LABEL: Record<MarketingLocaleCode, string> = {
  en: "EN",
  es: "ES",
  de: "DE",
  fr: "FR",
  zh: "ZH",
};
