"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { usePwaInstall } from "@/components/pwa/pwa-install-context";
import { isMacOS } from "@/lib/pwa/detect";

export function HeroInstallCta() {
  const t = useTranslations("home.hero");
  const { clientReady, standalone, persona, requestInstall, androidApkUrl } = usePwaInstall();

  const copy = useMemo(() => {
    if (persona === "ios_safari" || persona === "ios_other") {
      return t("ctaAddDesktop");
    }
    if (isMacOS()) return t("ctaAddDesktop");
    if (
      persona === "android" ||
      persona === "win_chromium" ||
      persona === "linux_chromium" ||
      persona === "desktop_chromium" ||
      persona === "desktop_other"
    ) {
      return t("ctaInstall");
    }
    return t("ctaInstallApp");
  }, [persona, t]);

  if (!clientReady || standalone) return null;

  const handleClick = () => {
    if (persona === "android") {
      if (androidApkUrl) {
        window.location.assign(androidApkUrl);
        return;
      }
      void requestInstall();
      return;
    }

    void requestInstall();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="ds-home-hero__cta pj-btn pj-btn-primary mt-6 px-8 py-3 text-sm font-semibold"
    >
      {copy}
    </button>
  );
}
