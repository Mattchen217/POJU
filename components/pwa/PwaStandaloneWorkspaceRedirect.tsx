"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { isPwaStandalone } from "@/lib/pwa/detect";
import { getPathnameWithoutLocale } from "@/lib/i18n/pathname-without-locale";
import {
  getWorkspaceHref,
  type WorkspaceTab,
} from "@/lib/ui-shell/resolve-ui-shell";

/** Classic marketing product roots → workspace (installed PWA only). Home `/` stays on V2 landing. */
const CLASSIC_PRODUCT_ROOT_TO_TAB: Record<string, WorkspaceTab> = {
  "/poju": "poju",
  "/glyph": "glyph",
  "/oracle": "glyph",
  "/syncro": "syncro",
  "/match": "match",
};

/**
 * Keep the V2 landing as PWA home. Only bounce legacy product marketing URLs
 * into the workspace shell so bottom-nav / old bookmarks do not show V1 pages.
 */
export function PwaStandaloneWorkspaceRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isPwaStandalone()) return;

    const path = getPathnameWithoutLocale(pathname);
    const tab = CLASSIC_PRODUCT_ROOT_TO_TAB[path];
    if (tab) {
      router.replace(`${getWorkspaceHref(tab)}&source=pwa`);
    }
  }, [pathname, router]);

  return null;
}
