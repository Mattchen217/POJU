"use client";

import { usePathname } from "next/navigation";

import {
  isAuthRoute,
  isChatRoute,
  isHomeRoute,
  isWorkspaceAppRoute,
} from "@/lib/i18n/pathname-without-locale";

/**
 * Root-layout starfield (CSS only). Unmount on workspace / chat / V2 home —
 * those surfaces have their own background, and this node otherwise lives forever.
 */
export function SiteStarryBackground() {
  const pathname = usePathname() ?? "/";
  if (
    isWorkspaceAppRoute(pathname) ||
    isChatRoute(pathname) ||
    isAuthRoute(pathname) ||
    isHomeRoute(pathname)
  ) {
    return null;
  }
  return <div className="site-starry-bg" aria-hidden />;
}
