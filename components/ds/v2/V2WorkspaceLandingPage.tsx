"use client";

import { useEffect, useRef } from "react";
import { usePwaInstall } from "@/components/pwa/pwa-install-context";

/** Same-origin iframe → parent install bridge (BIP lives on the top document). */
export const V2_LANDING_PWA_INSTALL_MSG = "eastern-os-v2-landing:pwa-install" as const;

/**
 * V2 workspace landing — loads the Stitch HTML verbatim via /v2-landing.
 * Edit public/v2-landing.html for landing content.
 */
export function V2WorkspaceLandingPage() {
  const { requestInstall } = usePwaInstall();
  const requestInstallRef = useRef(requestInstall);
  requestInstallRef.current = requestInstall;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type !== V2_LANDING_PWA_INSTALL_MSG) return;
      void requestInstallRef.current();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      src="/v2-landing"
      title="Eastern OS — Cognitive Velocity"
      className="fixed inset-0 z-[1] h-[100dvh] w-screen border-0 bg-[#05070a]"
    />
  );
}
