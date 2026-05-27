"use client";

import { useEffect, useState, type ReactNode } from "react";

import { PWABottomNav } from "@/components/pwa/PWABottomNav";
import { detectDeviceCapability } from "@/lib/syncro/device-capability";

export function PwaAppShell({ children }: { children: ReactNode }) {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    function syncFromDom() {
      setIsPWA(document.documentElement.classList.contains("pwa-mode"));
    }

    void detectDeviceCapability().then((cap) => {
      setIsPWA(cap.isPWA);
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
      {isPWA ? <PWABottomNav /> : null}
    </>
  );
}
