"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { requestOrientationPermission } from "@/lib/syncro/device-check";

export type OrientationContextValue = {
  compassDegree: number;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  isSupported: boolean;
};

const OrientationContext = createContext<OrientationContextValue | null>(null);

export function useOrientation(): OrientationContextValue {
  const ctx = useContext(OrientationContext);
  if (!ctx) {
    throw new Error("useOrientation must be used within SyncroOrientationProvider");
  }
  return ctx;
}

export function SyncroOrientationProvider({ children }: { children: ReactNode }) {
  const [compassDegree, setCompassDegree] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const smoothedRef = useRef(0);
  const rawValueRef = useRef(0);

  useEffect(() => {
    setIsSupported(typeof DeviceOrientationEvent !== "undefined");

    if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission !== "function") {
      setHasPermission(true);
    }
  }, []);

  useEffect(() => {
    if (!hasPermission) return;

    function handler(e: DeviceOrientationEvent) {
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;

      if (typeof ios === "number") {
        rawValueRef.current = ios;
      } else if (e.alpha !== null && e.alpha !== undefined) {
        rawValueRef.current = (360 - e.alpha) % 360;
      }
    }

    window.addEventListener("deviceorientationabsolute", handler);
    window.addEventListener("deviceorientation", handler);

    const interval = window.setInterval(() => {
      const target = rawValueRef.current;
      const current = smoothedRef.current;

      let diff = target - current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      const smoothed = (current + diff * 0.15 + 360) % 360;
      smoothedRef.current = smoothed;
      setCompassDegree(smoothed);
    }, 16);

    return () => {
      window.removeEventListener("deviceorientationabsolute", handler);
      window.removeEventListener("deviceorientation", handler);
      window.clearInterval(interval);
    };
  }, [hasPermission]);

  async function requestPermission() {
    const granted = await requestOrientationPermission();
    setHasPermission(granted);
    return granted;
  }

  return (
    <OrientationContext.Provider
      value={{
        compassDegree,
        hasPermission,
        requestPermission,
        isSupported,
      }}
    >
      {children}
    </OrientationContext.Provider>
  );
}
