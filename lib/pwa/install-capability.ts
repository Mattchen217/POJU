export type InstallCapability =
  | "ios_safari"
  | "ios_other_browser"
  | "android_chrome"
  | "android_other_browser"
  | "desktop"
  | "pwa_installed"
  | "unknown";

export interface CapabilityResult {
  capability: InstallCapability;
  browser_name: string;
  os: string;
  can_real_install: boolean;
  recommend_redirect: boolean;
}

export const POJULIFE_SITE_URL = "https://easternos.com";

function detectStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectInstallCapabilityFromUA(
  userAgent: string,
  isStandalone = false,
): CapabilityResult {
  const ua = userAgent.toLowerCase();

  let os = "unknown";
  if (/iphone|ipad|ipod/.test(ua)) os = "ios";
  else if (/android/.test(ua)) os = "android";
  else if (/windows|mac|linux/.test(ua)) os = "desktop";

  if (isStandalone) {
    return {
      capability: "pwa_installed",
      browser_name: "pwa",
      os,
      can_real_install: true,
      recommend_redirect: false,
    };
  }

  if (os === "desktop") {
    return {
      capability: "desktop",
      browser_name: "desktop",
      os,
      can_real_install: false,
      recommend_redirect: false,
    };
  }

  if (os === "ios") {
    const isSafari =
      /safari/.test(ua) && !/crios|fxios|edgios|opios|firefox|chrome/.test(ua);

    if (isSafari) {
      return {
        capability: "ios_safari",
        browser_name: "safari",
        os,
        can_real_install: true,
        recommend_redirect: false,
      };
    }

    let browser_name = "ios_other";
    if (/crios/.test(ua)) browser_name = "chrome_ios";
    else if (/fxios/.test(ua)) browser_name = "firefox_ios";
    else if (/edgios/.test(ua)) browser_name = "edge_ios";

    return {
      capability: "ios_other_browser",
      browser_name,
      os,
      can_real_install: false,
      recommend_redirect: true,
    };
  }

  if (os === "android") {
    const isChrome =
      /chrome/.test(ua) &&
      !/huawei|hbpc|hwebpro|ucbrowser|qqbrowser|miuibrowser|samsungbrowser|edg/.test(ua);

    if (isChrome) {
      return {
        capability: "android_chrome",
        browser_name: "chrome",
        os,
        can_real_install: true,
        recommend_redirect: false,
      };
    }

    let browser_name = "android_other";
    if (/huawei|hbpc|hwebpro/.test(ua)) browser_name = "huawei";
    else if (/ucbrowser/.test(ua)) browser_name = "uc";
    else if (/qqbrowser/.test(ua)) browser_name = "qq";
    else if (/miuibrowser/.test(ua)) browser_name = "miui";
    else if (/samsungbrowser/.test(ua)) browser_name = "samsung";
    else if (/edg/.test(ua)) browser_name = "edge";

    return {
      capability: "android_other_browser",
      browser_name,
      os,
      can_real_install: false,
      recommend_redirect: true,
    };
  }

  return {
    capability: "unknown",
    browser_name: "unknown",
    os,
    can_real_install: false,
    recommend_redirect: false,
  };
}

export function detectInstallCapability(): CapabilityResult {
  if (typeof navigator === "undefined") {
    return detectInstallCapabilityFromUA("", false);
  }
  return detectInstallCapabilityFromUA(navigator.userAgent, detectStandaloneMode());
}

declare global {
  interface Window {
    _deferredInstallPrompt?: Event;
  }
}

/** Whether a one-tap install prompt was captured via `beforeinstallprompt`. */
export function canPromptInstall(): boolean {
  return typeof window !== "undefined" && window._deferredInstallPrompt !== undefined;
}

const ANDROID_BROWSER_DISPLAY: Record<string, string> = {
  huawei: "Huawei Browser",
  uc: "UC Browser",
  qq: "QQ Browser",
  miui: "Mi Browser",
  samsung: "Samsung Internet",
  edge: "Edge",
  android_other: "this browser",
};

const IOS_BROWSER_DISPLAY: Record<string, string> = {
  chrome_ios: "Chrome",
  firefox_ios: "Firefox",
  edge_ios: "Edge",
  ios_other: "this browser",
};

export function getBrowserDisplayName(name: string): string {
  return ANDROID_BROWSER_DISPLAY[name] ?? IOS_BROWSER_DISPLAY[name] ?? "this browser";
}
