"use client";

import { useMemo } from "react";
import { usePwaInstall } from "@/components/pwa/pwa-install-context";
import { isMacOS } from "@/lib/pwa/detect";

export function HeroInstallCta() {
  const { clientReady, standalone, persona, requestInstall, androidApkUrl } = usePwaInstall();

  const copy = useMemo(() => {
    if (persona === "ios_safari" || persona === "ios_other") {
      return "Add to desktop for a better experience";
    }
    if (isMacOS()) return "Add to desktop for a better experience";
    if (
      persona === "android" ||
      persona === "win_chromium" ||
      persona === "linux_chromium" ||
      persona === "desktop_chromium" ||
      persona === "desktop_other"
    ) {
      return "Install desktop app for a better experience";
    }
    return "Install app for a better experience";
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

    void requestInstall();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="pj-btn pj-btn-primary mt-6 px-8 py-3 text-sm font-semibold"
    >
      {copy}
    </button>
  );
}
