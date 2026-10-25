"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  deviceOrientationRequiresPermissionPrompt,
  isIosDevice,
  markCompassGrantedInStorage,
  PJ_COMPASS_GRANTED_KEY,
  requestDeviceOrientationPermission,
} from "@/lib/syncro/compass-permission-ios";
import { loadSyncroPermission } from "@/lib/syncro/permissions";

export { PJ_COMPASS_GRANTED_KEY };

export type CompassPermissionState = {
  granted: boolean;
  supported: boolean;
  receivingHeading: boolean;
  alpha: number;
  beta: number;
  gamma: number;
  needsUserGesture: boolean;
};

type DeviceOrientationEventWithIOS = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

function smoothAlpha(prev: number, current: number): number {
  let diff = current - prev;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (prev + diff * 0.7 + 360) % 360;
}

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

/**
 * Compass permission + live heading (P0 Part 1).
 * iOS: motion/orientation dialog via `DeviceOrientationEvent.requestPermission()` in a tap handler.
 */
export function useCompassPermission() {
  const [state, setState] = useState<CompassPermissionState>({
    granted: false,
    supported: false,
    receivingHeading: false,
    alpha: 0,
    beta: 0,
    gamma: 0,
    needsUserGesture: false,
  });

  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const attachedRef = useRef(false);
  const receivedHeadingRef = useRef(false);
  const lastUpdateRef = useRef(0);
  const alphaRef = useRef(0);

  const attachListener = useCallback(() => {
    if (typeof window === "undefined" || attachedRef.current) return;

    receivedHeadingRef.current = false;
    lastUpdateRef.current = 0;

    const handler = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < 100) return;
      lastUpdateRef.current = now;

      const rawAlpha = readCompassAlpha(e);
      if (rawAlpha !== null) {
        receivedHeadingRef.current = true;
        alphaRef.current = smoothAlpha(alphaRef.current, rawAlpha);
        setState((s) => ({
          ...s,
          receivingHeading: true,
          alpha: alphaRef.current,
        }));
      }
      setState((s) => ({
        ...s,
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
    receivedHeadingRef.current = false;
    console.log("[Compass] deviceorientation listener detached");
  }, []);

  const applyGranted = useCallback(async () => {
    setState((s) => ({ ...s, granted: true }));
    await markCompassGrantedInStorage();
    attachListener();
  }, [attachListener]);

  useEffect(() => {
    const supported = typeof DeviceOrientationEvent !== "undefined";
    const needsUserGesture = deviceOrientationRequiresPermissionPrompt();

    setState((s) => ({ ...s, supported, needsUserGesture }));

    if (!supported) return;

    void (async () => {
      console.log("[Compass] auto-enable: attach listener");
      attachListener();
      setState((s) => ({ ...s, granted: true }));

      if (!needsUserGesture && !isIosDevice()) {
        await markCompassGrantedInStorage();
        return;
      }

      const perms = await loadSyncroPermission();
      const cached =
        (typeof localStorage !== "undefined" && localStorage.getItem(PJ_COMPASS_GRANTED_KEY) === "1") ||
        perms.orientation;

      if (cached) {
        await markCompassGrantedInStorage();
      } else if (needsUserGesture || isIosDevice()) {
        console.log("[Compass] iOS — will request motion permission on first interaction");
      }
    })();

    return () => detachListener();
  }, [attachListener, detachListener]);

  const requestPermissionFromUserGesture = useCallback((): Promise<boolean> => {
    console.log("[Compass] auto request motion/orientation permission");

    const permPromise = requestDeviceOrientationPermission();

    return permPromise.then(async (status) => {
      if (status === "denied" || status === "unsupported") {
        return false;
      }
      await applyGranted();
      return true;
    });
  }, [applyGranted]);

  const requestPermission = requestPermissionFromUserGesture;

  return {
    ...state,
    requestPermission,
    requestPermissionFromUserGesture,
    applyGranted,
  };
}
