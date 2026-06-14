"use client";

import { useTranslations } from "next-intl";

import { PWAOnly } from "@/components/pwa/PWAConditional";

import "@/styles/app-mode-product.css";

/** Brief note below product heroes in app mode — full legal/marketing lives on desktop. */
export function AppModeDesktopHint() {
  const t = useTranslations("pwa.app_mode");

  return (
    <PWAOnly>
      <p className="app-mode-desktop-hint">{t("desktop_hint")}</p>
    </PWAOnly>
  );
}
