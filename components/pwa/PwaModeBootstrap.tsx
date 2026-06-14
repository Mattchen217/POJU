"use client";

import { useEffect } from "react";

import { detectDeviceCapability, isAppMode } from "@/lib/syncro/device-capability";

/**
 * Injects `pwa-mode` on `<html>` and `data-os` / `data-browser` for global CSS (Step 2).
 *
 * `pwa-mode` is the “app mode” flag: it is on for the installed PWA AND for any
 * mobile / tablet browser, so both get the identical chromeless, feature-first
 * UI. `data-display-mode` still reflects the *real* standalone vs browser state
 * (so install affordances can show only in a browser).
 */
export function PwaModeBootstrap() {
  useEffect(() => {
    function apply(cap: Awaited<ReturnType<typeof detectDeviceCapability>>) {
      const root = document.documentElement;
      root.classList.toggle("pwa-mode", isAppMode(cap));
      root.dataset.os = cap.os;
      root.dataset.browser = cap.browserName;
      root.dataset.displayMode = cap.isPWA ? "standalone" : "browser";
    }

    void detectDeviceCapability().then(apply);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = () => {
      void detectDeviceCapability().then(apply);
    };
    mq.addEventListener("change", onDisplayModeChange);
    return () => mq.removeEventListener("change", onDisplayModeChange);
  }, []);

  return null;
}
