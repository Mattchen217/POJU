"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Suspense } from "react";

import { NotPWA } from "@/components/pwa/PWAConditional";
import { SyncroDesktopBanner } from "@/components/syncro/syncro-desktop-banner";
import { SyncroIncompatible } from "@/components/syncro/syncro-incompatible";
import { SyncroMobileStartSection } from "@/components/syncro/SyncroMobileStartSection";
import { SyncroRecentSessionsList } from "@/components/syncro/SyncroRecentSessionsList";
import { detectDeviceCapability } from "@/lib/syncro/device-capability";

/**
 * Wraps Syncro marketing content with device-specific footer:
 * desktop → compact “open on phone” notice; mobile → v5 start CTA.
 */
export function SyncroPageLayout({ marketing }: { marketing: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"desktop" | "no_compass" | "mobile">("mobile");

  useEffect(() => {
    void detectDeviceCapability().then((cap) => {
      if (cap.isDesktop) setMode("desktop");
      else if (cap.isMobile && !cap.hasOrientationSensor) setMode("no_compass");
      else setMode("mobile");
      setReady(true);
    });
  }, []);

  if (!ready) {
    return <div className="min-h-screen" aria-hidden />;
  }

  if (mode === "no_compass") return <SyncroIncompatible />;

  return (
    <main className="text-text-body">
      {mode === "desktop" ? <SyncroDesktopBanner /> : null}
      {marketing}
      <NotPWA>
        <Suspense
          fallback={
            <section id="syncro-start" className="mx-auto w-full max-w-lg px-4 pb-16 pt-4 text-center text-text-secondary">
              …
            </section>
          }
        >
          <SyncroMobileStartSection />
        </Suspense>
        <section className="mx-auto w-full max-w-lg px-4 pb-16">
          <SyncroRecentSessionsList />
        </section>
      </NotPWA>
    </main>
  );
}
