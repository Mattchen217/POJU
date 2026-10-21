"use client";

import { useEffect, useRef } from "react";
import { usePwaInstall } from "@/components/pwa/pwa-install-context";

/** Same-origin iframe → parent install bridge (BIP lives on the top document). */
export const V2_LANDING_PWA_INSTALL_MSG = "eastern-os-v2-landing:pwa-install" as const;

/**
 * V2 workspace landing — loads the Stitch HTML via /v2-landing iframe.
 * A same-looking shell paints in the *parent* document first so Lighthouse/FCP
 * is not stuck on an empty main frame (iframe pixels often do not count as FCP).
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
    <>
      {/* Parent-frame paint: black + brand (covered by iframe once it loads). */}
      <div
        className="fixed inset-0 z-0 flex flex-col items-center justify-center bg-black"
        aria-hidden
      >
        <img
          src="/v2/EASTERN-OS-LOGO2.webp"
          alt=""
          width={160}
          height={32}
          decoding="async"
          fetchPriority="high"
          className="h-8 w-auto opacity-90"
        />
      </div>
      <iframe
        src="/v2-landing"
        title="Eastern OS — Cognitive Velocity"
        className="fixed inset-0 z-[1] h-[100dvh] w-screen border-0 bg-transparent"
        loading="eager"
        referrerPolicy="same-origin"
      />
    </>
  );
}
