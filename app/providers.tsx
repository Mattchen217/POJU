"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { DisclaimerModal } from "@/components/disclaimer/disclaimer-modal";
import { ForceHomeScreenGate } from "@/components/marketing/force-home-screen-gate";
import { siteConfig } from "@/lib/config/site";

/** Client-only tab bar — avoids SSR edge cases alongside webpack path normalization */
const PwaTabbar = dynamic(
  () => import("@/components/layout/pwa-tabbar").then((m) => ({ default: m.PwaTabbar })),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState<boolean | null>(null);

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
    <>
      {children}
      <ScrollToTopButton />
      <PwaTabbar />
      {accepted === false ? <DisclaimerModal onAccepted={() => setAccepted(true)} /> : null}
      <ForceHomeScreenGate />
    </>
  );
}
