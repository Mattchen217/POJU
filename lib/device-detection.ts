/**
 * v4.0 Syncro 设备检测（见 POJU_v4.0_Batch2_Patch.md §5.8）
 */
export type DeviceOs = "ios" | "android" | "windows" | "mac" | "linux" | "unknown";

export type DetectedDevice = {
  type: "mobile" | "tablet" | "desktop";
  hasCompass: boolean;
  hasCamera: boolean;
  hasTouch: boolean;
  os: DeviceOs;
};

export function detectDevice(): DetectedDevice {
  if (typeof window === "undefined") {
    return {
      type: "desktop",
      hasCompass: false,
      hasCamera: false,
      hasTouch: false,
      os: "unknown",
    };
  }

  const ua = navigator.userAgent.toLowerCase();

  let os: DeviceOs = "unknown";
  if (/iphone|ipad|ipod/.test(ua)) os = "ios";
  else if (/android/.test(ua)) os = "android";
  else if (/win/.test(ua)) os = "windows";
  else if (/mac/.test(ua)) os = "mac";
  else if (/linux/.test(ua)) os = "linux";

  const screenWidth = window.innerWidth;
  const hasTouch = "ontouchstart" in window;
  const isMobileUA = /iphone|android.*mobile|webos|blackberry|opera mini|iemobile/.test(ua);
  const isTabletUA = /ipad|tablet|playbook|silk/.test(ua) || (ua.includes("android") && !ua.includes("mobile"));

  let type: DetectedDevice["type"];
  if (isTabletUA || (screenWidth >= 768 && screenWidth < 1024 && hasTouch)) {
    type = "tablet";
  } else if (isMobileUA || (screenWidth < 768 && hasTouch)) {
    type = "mobile";
  } else {
    type = "desktop";
  }

  const hasCompass = typeof DeviceOrientationEvent !== "undefined";
  const hasCamera = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  return { type, hasCompass, hasCamera, hasTouch, os };
}
