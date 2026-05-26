/**
 * Syncro — device capability detection (mobile / tablet / desktop).
 * @see docs/Syncro_TrueSolarTime_Final.md Step 1
 */

import { hasOrientationSensor as probeOrientationSensor } from "./device-check";

export interface DeviceCapability {
  type: "mobile" | "tablet" | "desktop";
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasOrientationSensor: boolean;
  hasCamera: boolean;
  hasGeolocation: boolean;
  os: "ios" | "android" | "windows" | "mac" | "linux" | "unknown";
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
};

export function detectOsFromUserAgent(ua: string): DeviceCapability["os"] {
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows/.test(ua)) return "windows";
  if (/Mac/.test(ua)) return "mac";
  if (/Linux/.test(ua)) return "linux";
  return "unknown";
}

export function buildDeviceCapability(input: {
  isTabletUA: boolean;
  isMobileUA: boolean;
  hasTouch: boolean;
  hasOrientationSensor: boolean;
  hasCamera: boolean;
  hasGeolocation: boolean;
  os: DeviceCapability["os"];
}): DeviceCapability {
  let type: DeviceCapability["type"];
  if (input.isTabletUA) {
    type = "tablet";
  } else if (input.isMobileUA && input.hasTouch) {
    type = "mobile";
  } else {
    type = "desktop";
  }

  return {
    type,
    isMobile: type === "mobile",
    isTablet: type === "tablet",
    isDesktop: type === "desktop",
    hasOrientationSensor: type !== "desktop" && input.hasOrientationSensor,
    hasCamera: input.hasCamera,
    hasGeolocation: input.hasGeolocation,
    os: input.os,
  };
}

export async function detectDeviceCapability(): Promise<DeviceCapability> {
  if (typeof window === "undefined") {
    return { ...DESKTOP_CAPABILITY };
  }

  const ua = navigator.userAgent;
  const os = detectOsFromUserAgent(ua);

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
  });
}

/**
 * Desktop cannot use Syncro features (compass / AR); marketing page only.
 */
export function canUseSyncro(capability: DeviceCapability): boolean {
  return !capability.isDesktop;
}
