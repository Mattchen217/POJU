"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useState } from "react";

import { Suspense } from "react";

import { NotPWA } from "@/components/pwa/PWAConditional";
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

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    window.scrollTo(0, 0);
  }, [ready]);

  useEffect(() => {
    void detectDeviceCapability().then((cap) => {
      if (cap.isDesktop) setMode("desktop");
      else if (cap.isMobile && !cap.hasOrientationSensor) setMode("no_compass");
      else setMode("mobile");
      setReady(true);
    });
  }, []);

  if (ready && mode === "no_compass") return <SyncroIncompatible />;

  return (
    <main className="text-text-body">
      {marketing}
      {ready ? (
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
      ) : null}
    </main>
  );
}
