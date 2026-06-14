"use client";

import { IconDownload } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { usePwaInstall } from "@/components/pwa/pwa-install-context";
import { isMacOS } from "@/lib/pwa/detect";

import "@/styles/app-mode-product.css";

/** Optional “add to home screen” prompt — mobile browser only (hidden when standalone). */
export function AddToHomeCta() {
  const t = useTranslations("pwa.app_mode");
  const { clientReady, standalone, persona, requestInstall, androidApkUrl } = usePwaInstall();

  if (!clientReady || standalone) return null;

  const handleClick = () => {
    if (persona === "android" && androidApkUrl) {
      window.location.assign(androidApkUrl);
      return;
    }
    void requestInstall();
  };

  const title =
    persona === "ios_safari" || persona === "ios_other" || isMacOS()
      ? t("add_to_home_title_ios")
      : t("add_to_home_title");

  return (
    <button type="button" className="app-mode-add-home" onClick={handleClick}>
      <span className="app-mode-add-home__row">
        <IconDownload size={16} stroke={1.75} aria-hidden className="app-mode-add-home__icon" />
        <span className="app-mode-add-home__title">{title}</span>
      </span>
      <span className="app-mode-add-home__desc">{t("add_to_home_desc")}</span>
    </button>
  );
}
