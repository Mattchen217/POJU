"use client";

import type { ReactNode } from "react";

/**
 * PWAInstallGate — now a pass-through.
 *
 * Previously this component blocked every mobile / tablet visitor with a
 * disclaimer screen followed by a forced "install the PWA" wall, so the actual
 * product never rendered in a normal mobile browser. That added an extra step
 * and was the wrong call: a mobile browser visitor should get the exact same
 * experience as the installed PWA.
 *
 * The feature-first "app mode" UI (bottom nav, Begin buttons, hidden marketing
 * intro) is now driven by `isAppMode()` (mobile/tablet OR installed PWA) via
 * PwaModeBootstrap / PwaAppShell / PWAConditional. Installing the PWA is an
 * optional prompt (HeroInstallCta, the bottom-nav install chip), never a gate.
 *
 * The one-time legal disclaimer still lives in the global <DisclaimerModal>
 * (app/providers.tsx), independent of this component.
 */
export function PWAInstallGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
