"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readStoredUiLocale,
  writeStoredUiLocale,
  type UiLocaleCode,
} from "@/lib/i18n/ui-locale-preference";

export type MarketingLocale = UiLocaleCode;

export const MARKETING_LOCALES: { code: MarketingLocale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "zh", label: "中文" },
];

function htmlLangFor(locale: MarketingLocale): string {
  if (locale === "zh") return "zh-Hans";
  return locale;
}

type MarketingLocaleContextValue = {
  locale: MarketingLocale;
  setLocale: (next: MarketingLocale) => void;
};

const MarketingLocaleContext = createContext<MarketingLocaleContextValue | null>(null);

export function MarketingLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<MarketingLocale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredUiLocale();
    if (stored) setLocaleState(stored);
    setReady(true);
  }, []);

  const setLocale = useCallback((next: MarketingLocale) => {
    setLocaleState(next);
    writeStoredUiLocale(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = htmlLangFor(next);
    }
  }, []);

  useEffect(() => {
    if (!ready || typeof document === "undefined") return;
    document.documentElement.lang = htmlLangFor(locale);
  }, [locale, ready]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <MarketingLocaleContext.Provider value={value}>{children}</MarketingLocaleContext.Provider>;
}

export function useMarketingLocale(): MarketingLocaleContextValue {
  const v = useContext(MarketingLocaleContext);
  if (!v) throw new Error("useMarketingLocale must be used within MarketingLocaleProvider");
  return v;
}
