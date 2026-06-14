"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { PWAOnly } from "@/components/pwa/PWAConditional";

import "@/styles/app-mode-product.css";

/** Sticky logo + language switcher on product marketing landings (app mode only). */
export function AppModeProductTopBar() {
  const t = useTranslations("common");

  return (
    <PWAOnly>
      <header className="app-mode-product-topbar" aria-label={t("brand")}>
        <Link href="/" className="app-mode-product-topbar__logo" prefetch={false}>
          <BrandLockup label={t("brandWordmark")} size="subpage" />
        </Link>
        <MarketingLanguageSwitcher compact />
      </header>
    </PWAOnly>
  );
}
