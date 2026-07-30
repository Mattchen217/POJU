"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { isPwaStandalone } from "@/lib/pwa/detect";
import { getPathnameWithoutLocale } from "@/lib/i18n/pathname-without-locale";
import { detectDeviceCapability } from "@/lib/syncro/device-capability";
import {
  getWorkspaceHref,
  type WorkspaceTab,
} from "@/lib/ui-shell/resolve-ui-shell";

/** Classic marketing product roots → workspace (mobile/tablet installed PWA only). */
const CLASSIC_PRODUCT_ROOT_TO_TAB: Record<string, WorkspaceTab> = {
  "/poju": "poju",
  "/glyph": "glyph",
  "/oracle": "glyph",
  "/syncro": "syncro",
  "/match": "match",
};

/**
 * Keep the V2 landing as PWA home on mobile. Bounce legacy product marketing
 * URLs into the workspace shell. Desktop PWA mirrors the normal website — no redirect.
 */
export function PwaStandaloneWorkspaceRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isPwaStandalone()) return;

    let cancelled = false;
    void detectDeviceCapability().then((cap) => {
      if (cancelled || cap.isDesktop) return;
      const path = getPathnameWithoutLocale(pathname);
      const tab = CLASSIC_PRODUCT_ROOT_TO_TAB[path];
      if (tab) {
        router.replace(`${getWorkspaceHref(tab)}&source=pwa`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
