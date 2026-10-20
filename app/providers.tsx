"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { OAuthCodeCatcher } from "@/components/auth/OAuthCodeCatcher";
import { PwaInstallProvider } from "@/components/pwa/pwa-install-context";
import { siteConfig } from "@/lib/config/site";
import { isHomeRoute } from "@/lib/i18n/pathname-without-locale";
import { initApp } from "@/lib/init";
import { runLegacyServiceWorkerResetOnce } from "@/lib/pwa/legacy-sw-reset";

/** Client-only chrome — keep out of the landing critical path */
const PwaTabbar = dynamic(
  () => import("@/components/layout/pwa-tabbar").then((m) => ({ default: m.PwaTabbar })),
  { ssr: false },
);
const ScrollToTopButton = dynamic(
  () =>
    import("@/components/scroll-to-top-button").then((m) => ({
      default: m.ScrollToTopButton,
    })),
  { ssr: false },
);
const DisclaimerModal = dynamic(
  () =>
    import("@/components/disclaimer/disclaimer-modal").then((m) => ({
      default: m.DisclaimerModal,
    })),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const onHome = isHomeRoute(pathname);
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    void initApp();
  }, []);

  useEffect(() => {
    void runLegacyServiceWorkerResetOnce();
  }, []);

  useEffect(() => {
    try {
      const key = `easternos_disclaimer_${siteConfig.disclaimerVersion}`;
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
      {/* Home is an iframe landing — skip chrome that steals main-thread time */}
      {onHome ? null : <ScrollToTopButton />}
      {onHome ? null : <PwaTabbar />}
      {onHome || accepted !== false ? null : (
        <DisclaimerModal onAccepted={() => setAccepted(true)} />
      )}
    </PwaInstallProvider>
  );
}
