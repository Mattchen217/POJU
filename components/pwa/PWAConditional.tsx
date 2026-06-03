"use client";

import { useEffect, useState, type ReactNode } from "react";

import { detectDeviceCapability } from "@/lib/syncro/device-capability";

export function useIsPwaMode(): boolean | null {
  const [isPWA, setIsPWA] = useState<boolean | null>(null);

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

  return isPWA;
}

export function PWAOnly({ children }: { children: ReactNode }) {
  const isPWA = useIsPwaMode();
  if (isPWA === null) return null;
  return isPWA ? <>{children}</> : null;
}

export function NotPWA({ children }: { children: ReactNode }) {
  const isPWA = useIsPwaMode();
  if (isPWA === null) return null;
  return !isPWA ? <>{children}</> : null;
}
