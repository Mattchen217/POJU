import type { PwaInstallPersona } from "./types";

export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isChromiumFamilyUa(ua: string): boolean {
  return /Chrome|Chromium|Edg|OPR|Brave/i.test(ua);
}

/** User-Agent Client Hints（部分 Chromium 浏览器） */
function platformHint(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform;
}

export function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Mac OS X/i.test(ua) || navigator.platform?.includes?.("Mac") === true) return true;
  const p = platformHint();
  if (p === "macOS") return true;
  return false;
}

export function isWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/Win/i.test(navigator.userAgent)) return true;
  const p = platformHint();
  return p === "Windows";
}

/**
 * iPadOS 13+ “Request Desktop Website” spoofs Macintosh + touch.
 * Real Macs must NOT match — Safari on Mac often exposes touch APIs / maxTouchPoints,
 * which previously routed Mac users to the iPhone “Share at bottom” install guide.
 */
function isIosLikeDevice(ua: string): boolean {
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  if (navigator.platform !== "MacIntel" || navigator.maxTouchPoints <= 1) return false;
  // iPad has coarse pointer / no hover; Mac trackpads report fine pointer + hover.
  try {
    return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches;
  } catch {
    return false;
  }
}

export function getPwaInstallPersona(): PwaInstallPersona {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;

  if (isIosLikeDevice(ua)) {
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Brave/i.test(ua);
    return isSafari ? "ios_safari" : "ios_other";
  }

  if (/Android/i.test(ua)) return "android";

  if (isMacOS()) {
    const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Brave/i.test(ua);
    if (isSafari) return "mac_safari";
    if (isChromiumFamilyUa(ua)) return "mac_chromium";
    return "mac_other";
  }

  if (isWindows()) {
    if (isChromiumFamilyUa(ua)) return "win_chromium";
    return "desktop_other";
  }

  if (/Linux/i.test(ua)) {
    if (isChromiumFamilyUa(ua)) return "linux_chromium";
    return "desktop_other";
  }

  if (/Chrome|Chromium|Edg|OPR|Brave/i.test(ua)) return "desktop_chromium";

  return "unknown";
}

export function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || isIosLikeDevice(ua);
}
