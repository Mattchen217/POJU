"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { usePwaInstall } from "@/components/pwa/pwa-install-context";
import { isMacOS } from "@/lib/pwa/detect";

function normalizeLocale(raw: string): "en" | "es" | "de" | "fr" | "zh" {
  if (raw === "es" || raw === "de" || raw === "fr" || raw === "zh") return raw;
  return "en";
}

export function HeroInstallCta() {
  const locale = normalizeLocale(useLocale());
  const { clientReady, standalone, persona, requestInstall, androidApkUrl } = usePwaInstall();

  const copy = useMemo(() => {
    if (persona === "ios_safari" || persona === "ios_other") return "添加到桌面可以带来更好的体验";
    if (isMacOS()) return "添加到桌面可以带来更好的体验";
    if (
      persona === "android" ||
      persona === "win_chromium" ||
      persona === "linux_chromium" ||
      persona === "desktop_chromium" ||
      persona === "desktop_other"
    ) {
      return "安装桌面应用可以带来更好的体验";
    }
    return "安装应用可以带来更好的体验";
  }, [persona]);

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

    if (persona === "ios_safari" || persona === "ios_other") {
      window.location.assign(`/${locale}/modal-pwa-install?next=%2F`);
      return;
    }

    void requestInstall();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mt-6 inline-flex items-center justify-center rounded-full border border-white/35 bg-white/12 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/18"
    >
      {copy}
    </button>
  );
}
