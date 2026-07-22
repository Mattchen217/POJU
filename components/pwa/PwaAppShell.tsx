"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { PWABottomNav } from "@/components/pwa/PWABottomNav";
import { isWorkspaceAppRoute } from "@/lib/i18n/pathname-without-locale";
import { detectDeviceCapability, isAppMode } from "@/lib/syncro/device-capability";

export function PwaAppShell({ children }: { children: ReactNode }) {
  const [isPWA, setIsPWA] = useState(false);
  const pathname = usePathname();
  const hideBottomNav = isWorkspaceAppRoute(pathname);

  useEffect(() => {
    function syncFromDom() {
      setIsPWA(document.documentElement.classList.contains("pwa-mode"));
    }

    void detectDeviceCapability().then((cap) => {
      setIsPWA(isAppMode(cap));
    });

    syncFromDom();
    const observer = new MutationObserver(syncFromDom);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className={isPWA ? "pwa-page" : undefined}>{children}</div>
      {isPWA && !hideBottomNav ? <PWABottomNav /> : null}
    </>
  );
}
