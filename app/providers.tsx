"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { DisclaimerModal } from "@/components/disclaimer/disclaimer-modal";
import { PwaInstallProvider } from "@/components/pwa/pwa-install-context";
import { siteConfig } from "@/lib/config/site";
import { initApp } from "@/lib/init";

/** Client-only tab bar — avoids SSR edge cases alongside webpack path normalization */
const PwaTabbar = dynamic(
  () => import("@/components/layout/pwa-tabbar").then((m) => ({ default: m.PwaTabbar })),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    void initApp();
  }, []);

  useEffect(() => {
    // Temporary hard reset for mobile stale bundles:
    // unregister old PWA service workers and clear runtime caches.
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      } catch {
        // ignore
      }
      try {
        if (!("caches" in window)) return;
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const key = `pojulife_disclaimer_${siteConfig.disclaimerVersion}`;
      const value = localStorage.getItem(key);
      setAccepted(value === "accepted");
    } catch {
      setAccepted(false);
    }
  }, []);

  return (
    <PwaInstallProvider>
      {children}
      <ScrollToTopButton />
      <PwaTabbar />
      {accepted === false ? <DisclaimerModal onAccepted={() => setAccepted(true)} /> : null}
    </PwaInstallProvider>
  );
}
