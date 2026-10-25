/**
 * Syncro v5 — mobile + orientation capability checks.
 * @see docs/Syncro_v5.0_Refactor.md Step 5
 */

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  return isMobileUA && hasTouch;
}

export async function hasOrientationSensor(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (typeof DeviceOrientationEvent === "undefined") return false;

  if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === "function") {
    return true;
  }

  return new Promise((resolve) => {
    let hasData = false;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.alpha !== undefined) {
        hasData = true;
      }
    };

    window.addEventListener("deviceorientation", handler);

    window.setTimeout(() => {
      window.removeEventListener("deviceorientation", handler);
      resolve(hasData);
    }, 500);
  });
}

export async function requestOrientationPermission(): Promise<boolean> {
  const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
  if (typeof req === "function") {
    try {
      const result = await req();
      return result === "granted";
    } catch {
      return false;
    }
  }
  return true;
}
