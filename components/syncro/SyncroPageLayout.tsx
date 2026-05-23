"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { SyncroDesktopBanner } from "@/components/syncro/syncro-desktop-banner";
import { SyncroDesktopOnlyView } from "@/components/syncro/SyncroDesktopOnlyView";
import { SyncroIncompatible } from "@/components/syncro/syncro-incompatible";
import { SyncroMobileStartSection } from "@/components/syncro/SyncroMobileStartSection";
import { detectDevice } from "@/lib/device-detection";

/**
 * Wraps Syncro marketing content with device-specific footer:
 * desktop → compact “open on phone” notice; mobile → v5 start CTA.
 */
export function SyncroPageLayout({ marketing }: { marketing: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"desktop" | "no_compass" | "mobile">("mobile");

  useEffect(() => {
    const d = detectDevice();
    if (d.type === "desktop") setMode("desktop");
    else if (!d.hasCompass) setMode("no_compass");
    else setMode("mobile");
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-bg-deep" aria-hidden />;
  }

  if (mode === "no_compass") return <SyncroIncompatible />;

  return (
    <main className="bg-bg-deep text-text-body">
      {mode === "desktop" ? <SyncroDesktopBanner /> : null}
      {marketing}
      {mode === "desktop" ? <SyncroDesktopOnlyView embedded /> : <SyncroMobileStartSection />}
    </main>
  );
}
