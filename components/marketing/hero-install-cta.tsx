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
      className="mt-6 inline-flex items-center justify-center rounded-full border border-[#7c3aed]/60 bg-black px-6 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,0.35)] transition hover:border-[#a855f7] hover:bg-[#7c3aed] hover:shadow-[0_0_30px_rgba(168,85,247,0.55)]"
    >
      {copy}
    </button>
  );
}
