/**
 * Syncro — device capability detection (mobile / tablet / desktop + PWA).
 * @see docs/Syncro_TrueSolarTime_Final.md Step 1
 * @see pojulife PWA UI refactor Step 2
 */

import { hasOrientationSensor as probeOrientationSensor } from "./device-check";

export type BrowserName = "safari" | "chrome" | "firefox" | "edge" | "other";

export interface DeviceCapability {
  type: "mobile" | "tablet" | "desktop";
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasOrientationSensor: boolean;
  hasCamera: boolean;
  hasGeolocation: boolean;
  os: "ios" | "android" | "windows" | "mac" | "linux" | "unknown";
  isPWA: boolean;
  isStandalone: boolean;
  canInstallPWA: boolean;
  browserName: BrowserName;
}

const DESKTOP_CAPABILITY: DeviceCapability = {
  type: "desktop",
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  hasOrientationSensor: false,
  hasCamera: false,
  hasGeolocation: false,
  os: "unknown",
  isPWA: false,
  isStandalone: false,
  canInstallPWA: false,
  browserName: "other",
};

export function detectOsFromUserAgent(ua: string): DeviceCapability["os"] {
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows/.test(ua)) return "windows";
  if (/Mac/.test(ua)) return "mac";
  if (/Linux/.test(ua)) return "linux";
  return "unknown";
}

/** Detect browser from UA (client hints not required for Step 2). */
export function detectBrowserName(ua: string): BrowserName {
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox/i.test(ua)) return "firefox";
  if (/CriOS|Chrome|Chromium/i.test(ua)) return "chrome";
  if (/Safari/i.test(ua)) return "safari";
  return "other";
}

export function detectStandaloneMode(): { isStandalone: boolean; isPWA: boolean } {
  if (typeof window === "undefined") {
    return { isStandalone: false, isPWA: false };
  }

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://");

  return { isStandalone, isPWA: isStandalone };
}

export function computeCanInstallPWA(
  os: DeviceCapability["os"],
  browserName: BrowserName,
  isPWA: boolean,
): boolean {
  if (isPWA) return false;
  if (os === "ios" && browserName === "safari") return true;
  if (os === "android" && browserName === "chrome") return true;
  return false;
}

export function buildDeviceCapability(input: {
  isTabletUA: boolean;
  isMobileUA: boolean;
  hasTouch: boolean;
  hasOrientationSensor: boolean;
  hasCamera: boolean;
  hasGeolocation: boolean;
  os: DeviceCapability["os"];
  isPWA?: boolean;
  isStandalone?: boolean;
  canInstallPWA?: boolean;
  browserName?: BrowserName;
}): DeviceCapability {
  let type: DeviceCapability["type"];
  if (input.isTabletUA) {
    type = "tablet";
  } else if (input.isMobileUA && input.hasTouch) {
    type = "mobile";
  } else {
    type = "desktop";
  }

  const browserName = input.browserName ?? "other";
  const isStandalone = input.isStandalone ?? false;
  const isPWA = input.isPWA ?? isStandalone;
  const canInstallPWA =
    input.canInstallPWA ?? computeCanInstallPWA(input.os, browserName, isPWA);

  return {
    type,
    isMobile: type === "mobile",
    isTablet: type === "tablet",
    isDesktop: type === "desktop",
    hasOrientationSensor: type !== "desktop" && input.hasOrientationSensor,
    hasCamera: input.hasCamera,
    hasGeolocation: input.hasGeolocation,
    os: input.os,
    isPWA,
    isStandalone,
    canInstallPWA,
    browserName,
  };
}

export async function detectDeviceCapability(): Promise<DeviceCapability> {
  if (typeof window === "undefined") {
    return { ...DESKTOP_CAPABILITY };
  }

  const ua = navigator.userAgent;
  const os = detectOsFromUserAgent(ua);
  const browserName = detectBrowserName(ua);
  const { isStandalone, isPWA } = detectStandaloneMode();

  const isMobileUA =
    /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA =
    /iPad|Tablet|PlayBook/i.test(ua) ||
    (/Android/.test(ua) && !/Mobile/.test(ua));

  const hasTouch =
    "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;

  const hasCamera = Boolean(navigator.mediaDevices?.getUserMedia);
  const hasGeolocation = "geolocation" in navigator;

  const orientation =
    isTabletUA || (isMobileUA && hasTouch)
      ? await probeOrientationSensor()
      : false;

  return buildDeviceCapability({
    isTabletUA,
    isMobileUA,
    hasTouch,
    hasOrientationSensor: orientation,
    hasCamera,
    hasGeolocation,
    os,
    isPWA,
    isStandalone,
    browserName,
    canInstallPWA: computeCanInstallPWA(os, browserName, isPWA),
  });
}

/**
 * “App mode” = the feature-first, chromeless experience (bottom nav, Begin
 * buttons, marketing intro hidden). True for the installed PWA AND for any
 * mobile / tablet visitor in a normal browser tab. The ONLY runtime difference
 * between an installed PWA and a mobile browser is the home-screen icon
 * (`isPWA` / standalone) — not the UI. Desktop browsers stay on the full
 * marketing site.
 */
export function isAppMode(capability: DeviceCapability): boolean {
  return capability.isPWA || capability.isMobile || capability.isTablet;
}

/**
 * Deprecated: we no longer force a PWA install before letting people use the
 * product. Mobile browsers get the same experience as the PWA (see isAppMode).
 * Kept as a no-op so any remaining callers compile; install is now an optional
 * prompt, never a gate.
 */
export function shouldForcePWAInstall(_capability: DeviceCapability): boolean {
  return false;
}

/**
 * Desktop cannot use Syncro features (compass / AR); marketing page only.
 */
export function canUseSyncro(capability: DeviceCapability): boolean {
  return !capability.isDesktop;
}
