"use client";

import { useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { getActiveNavFromPathname } from "@/lib/i18n/pathname-without-locale";
import {
  MARKETING_LOCALE_COMPACT_LABEL,
  MARKETING_LOCALE_OPTIONS,
} from "@/lib/i18n/marketing-locale-options";
import { routing } from "@/i18n/routing";

import "@/styles/pwa-nav.css";

const PRODUCTS = [
  { id: "poju" as const, name: "POJU", path: "/poju" },
  { id: "glyph" as const, name: "Glyph", path: "/glyph" },
  { id: "syncro" as const, name: "Syncro", path: "/syncro" },
  { id: "match" as const, name: "Match", path: "/match" },
];

const LOCALES = MARKETING_LOCALE_OPTIONS.map(({ code, label }) => ({
  code,
  label: MARKETING_LOCALE_COMPACT_LABEL[code],
  name: label,
}));

export function PWABottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [langOpen, setLangOpen] = useState(false);

  const activeProduct = getActiveNavFromPathname(pathname);
  const currentLocaleLabel = LOCALES.find((l) => l.code === locale)?.label ?? "EN";

  function navigateTo(productPath: string) {
    router.push(productPath);
  }

  function handleLanguageSelect(newLocale: string) {
    setLangOpen(false);
    if (!routing.locales.includes(newLocale as (typeof routing.locales)[number])) return;
    router.replace(pathname, { locale: newLocale });
  }

  function goToArchive() {
    router.push("/archive");
  }

  return (
    <>
      <nav className="pwa-bottom-nav" aria-label="Product navigation">
        <button
          type="button"
          className="nav-aux"
          onClick={() => setLangOpen(true)}
          aria-label="Language"
        >
          {currentLocaleLabel}
        </button>

        <div className="nav-products">
          {PRODUCTS.map((product) => (
            <button
              key={product.id}
              type="button"
              className={`nav-product ${activeProduct === product.id ? "active" : ""}`}
              onClick={() => navigateTo(product.path)}
            >
              {product.name}
            </button>
          ))}
        </div>

        <button type="button" className="nav-aux" onClick={goToArchive} aria-label="Archive">
          A
        </button>
      </nav>

      {langOpen ? (
        <LanguageModal
          currentLocale={locale}
          onSelect={handleLanguageSelect}
          onClose={() => setLangOpen(false)}
        />
      ) : null}
    </>
  );
}

function LanguageModal({
  currentLocale,
  onSelect,
  onClose,
}: {
  currentLocale: string;
  onSelect: (locale: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("pwa.nav");

  return (
    <div className="lang-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="lang-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-lang-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lang-modal-header">
          <span id="pwa-lang-modal-title" className="lang-modal-title">
            {t("language")}
          </span>
          <button type="button" className="lang-modal-close" onClick={onClose} aria-label={t("close")}>
            <IconX aria-hidden size={18} stroke={1.75} />
          </button>
        </div>

        <div className="lang-options">
          {LOCALES.map((loc) => (
            <button
              key={loc.code}
              type="button"
              className={`lang-option ${currentLocale === loc.code ? "active" : ""}`}
              onClick={() => onSelect(loc.code)}
            >
              <span className="lang-code">{loc.label}</span>
              <span className="lang-name">{loc.name}</span>
              {currentLocale === loc.code ? (
                <IconCheck aria-hidden size={18} stroke={1.75} className="lang-option-check" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
