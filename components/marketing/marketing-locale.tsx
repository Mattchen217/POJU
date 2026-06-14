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

export type MarketingLocale = "en" | "es" | "de" | "fr" | "zh";

const STORAGE_KEY = "poju-marketing-locale";

export const MARKETING_LOCALES: { code: MarketingLocale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "zh", label: "中文" },
];

function isMarketingLocale(v: string | null): v is MarketingLocale {
  return v === "en" || v === "es" || v === "de" || v === "fr" || v === "zh";
}

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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (isMarketingLocale(raw)) setLocaleState(raw);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setLocale = useCallback((next: MarketingLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
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
