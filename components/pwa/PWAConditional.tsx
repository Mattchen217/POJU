"use client";

import { useEffect, useState, type ReactNode } from "react";

import { detectDeviceCapability, isAppMode } from "@/lib/syncro/device-capability";

/**
 * `useIsPwaMode` reports “app mode” (installed PWA OR mobile/tablet browser),
 * matching the `pwa-mode` class on <html>. PWAOnly / NotPWA therefore treat a
 * mobile browser exactly like the installed PWA — e.g. the product Begin button
 * (PWAOnly) shows and the long marketing intro (NotPWA) hides on both.
 */
export function useIsPwaMode(): boolean | null {
  const [isPWA, setIsPWA] = useState<boolean | null>(null);

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

  return isPWA;
}

export function PWAOnly({ children }: { children: ReactNode }) {
  const isPWA = useIsPwaMode();
  if (isPWA !== true) return null;
  return <>{children}</>;
}

export function NotPWA({ children }: { children: ReactNode }) {
  const isPWA = useIsPwaMode();
  if (isPWA === true) return null;
  return <>{children}</>;
}
