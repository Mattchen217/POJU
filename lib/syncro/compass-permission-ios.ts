import { saveSyncroPermission } from "@/lib/syncro/permissions";

export const PJ_COMPASS_GRANTED_KEY = "pj_compass_granted";

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** iOS 13+ Safari / PWA — motion & orientation (罗盘), NOT geolocation. */
export function deviceOrientationRequiresPermissionPrompt(): boolean {
  if (typeof DeviceOrientationEvent === "undefined") return false;
  return (
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
      .requestPermission === "function"
  );
}

/**
 * Must be invoked synchronously from a click/tap handler on iOS.
 * Do not await geolocation or setState before calling this.
 */
export function requestDeviceOrientationPermission(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof DeviceOrientationEvent === "undefined") {
    console.warn("[Compass] DeviceOrientationEvent missing");
    return Promise.resolve("unsupported");
  }

  const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
    .requestPermission;

  if (typeof req !== "function") {
    console.log("[Compass] no requestPermission API — treating as granted (Android/desktop)");
    return Promise.resolve("granted");
  }

  console.log("[Compass] invoking DeviceOrientationEvent.requestPermission() …");
  return req()
    .then((status) => {
      console.log("[Compass] motion/orientation permission:", status);
      return status === "granted" ? "granted" : "denied";
    })
    .catch((e) => {
      console.error("[Compass] requestPermission error:", e);
      return "denied";
    });
}

export async function markCompassGrantedInStorage(): Promise<void> {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(PJ_COMPASS_GRANTED_KEY, "1");
  }
  await saveSyncroPermission("orientation", true);
}

export async function clearCompassPermissionCache(): Promise<void> {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(PJ_COMPASS_GRANTED_KEY);
  }
  await saveSyncroPermission("orientation", false);
}
