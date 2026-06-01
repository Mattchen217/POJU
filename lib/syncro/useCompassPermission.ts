"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadSyncroPermission, saveSyncroPermission } from "@/lib/syncro/permissions";

/** iOS Safari + legacy cache key (Strict Fix v2 Part 1). */
export const PJ_COMPASS_GRANTED_KEY = "pj_compass_granted";

export type CompassPermissionState = {
  granted: boolean;
  supported: boolean;
  alpha: number;
  beta: number;
  gamma: number;
  needsUserGesture: boolean;
};

type DeviceOrientationEventWithIOS = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

function readCompassAlpha(e: DeviceOrientationEvent): number | null {
  const ios = (e as DeviceOrientationEventWithIOS).webkitCompassHeading;
  if (typeof ios === "number" && !Number.isNaN(ios)) {
    return ios;
  }
  if (e.alpha != null && !Number.isNaN(e.alpha)) {
    return (360 - e.alpha) % 360;
  }
  return null;
}

function iosRequestPermissionAvailable(): boolean {
  return (
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
      .requestPermission === "function"
  );
}

/**
 * Compass permission + live heading (P0 Part 1).
 * `requestPermission` MUST be invoked from a user click handler on iOS 13+.
 */
export function useCompassPermission() {
  const [state, setState] = useState<CompassPermissionState>({
    granted: false,
    supported: false,
    alpha: 0,
    beta: 0,
    gamma: 0,
    needsUserGesture: false,
  });

  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const attachedRef = useRef(false);

  const attachListener = useCallback(() => {
    if (typeof window === "undefined" || attachedRef.current) return;

    const handler = (e: DeviceOrientationEvent) => {
      const alpha = readCompassAlpha(e);
      setState((s) => ({
        ...s,
        ...(alpha !== null ? { alpha } : {}),
        beta: e.beta ?? s.beta,
        gamma: e.gamma ?? s.gamma,
      }));
    };

    handlerRef.current = handler;
    window.addEventListener("deviceorientationabsolute", handler);
    window.addEventListener("deviceorientation", handler);
    attachedRef.current = true;
    console.log("[Compass] deviceorientation listener attached");
  }, []);

  const detachListener = useCallback(() => {
    const handler = handlerRef.current;
    if (!handler || !attachedRef.current) return;
    window.removeEventListener("deviceorientationabsolute", handler);
    window.removeEventListener("deviceorientation", handler);
    handlerRef.current = null;
    attachedRef.current = false;
    console.log("[Compass] deviceorientation listener detached");
  }, []);

  useEffect(() => {
    const supported = typeof DeviceOrientationEvent !== "undefined";
    const needsUserGesture = iosRequestPermissionAvailable();

    setState((s) => ({ ...s, supported, needsUserGesture }));

    if (!supported) return;

    void (async () => {
      const perms = await loadSyncroPermission();
      const cached =
        (typeof localStorage !== "undefined" && localStorage.getItem(PJ_COMPASS_GRANTED_KEY) === "1") ||
        perms.orientation;

      if (needsUserGesture) {
        if (cached) {
          console.log("[Compass] restored granted from cache");
          setState((s) => ({ ...s, granted: true }));
          attachListener();
        }
        return;
      }

      console.log("[Compass] non-iOS: auto-grant orientation");
      setState((s) => ({ ...s, granted: true }));
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PJ_COMPASS_GRANTED_KEY, "1");
      }
      await saveSyncroPermission("orientation", true);
      attachListener();
    })();

    return () => detachListener();
  }, [attachListener, detachListener]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log("[Compass] requestPermission called");

    if (!state.supported) {
      console.warn("[Compass] requestPermission: not supported");
      return false;
    }

    if (iosRequestPermissionAvailable()) {
      try {
        const result = await (
          DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        console.log("[Compass] iOS permission result:", result);

        if (result === "granted") {
          setState((s) => ({ ...s, granted: true }));
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(PJ_COMPASS_GRANTED_KEY, "1");
          }
          await saveSyncroPermission("orientation", true);
          attachListener();
          return true;
        }
        return false;
      } catch (e) {
        console.error("[Compass] iOS permission error:", e);
        return false;
      }
    }

    setState((s) => ({ ...s, granted: true }));
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PJ_COMPASS_GRANTED_KEY, "1");
    }
    await saveSyncroPermission("orientation", true);
    attachListener();
    return true;
  }, [attachListener, state.supported]);

  return { ...state, requestPermission };
}
