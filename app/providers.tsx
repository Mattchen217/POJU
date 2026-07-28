"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { DisclaimerModal } from "@/components/disclaimer/disclaimer-modal";
import { OAuthCodeCatcher } from "@/components/auth/OAuthCodeCatcher";
import { PwaInstallProvider } from "@/components/pwa/pwa-install-context";
import { siteConfig } from "@/lib/config/site";
import { initApp } from "@/lib/init";
import { runLegacyServiceWorkerResetOnce } from "@/lib/pwa/legacy-sw-reset";

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
    void runLegacyServiceWorkerResetOnce();
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
      <OAuthCodeCatcher />
      {children}
      <ScrollToTopButton />
      <PwaTabbar />
      {accepted === false ? <DisclaimerModal onAccepted={() => setAccepted(true)} /> : null}
    </PwaInstallProvider>
  );
}
