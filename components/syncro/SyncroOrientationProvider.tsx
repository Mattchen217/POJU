"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useCompassPermission } from "@/lib/syncro/useCompassPermission";

export type OrientationContextValue = {
  compassDegree: number;
  deviceTiltBeta: number | null;
  hasPermission: boolean;
  /** True after at least one deviceorientation heading event. */
  receivingHeading: boolean;
  requestPermission: () => Promise<boolean>;
  requestPermissionFromUserGesture: () => Promise<boolean>;
  isSupported: boolean;
  needsUserGesture: boolean;
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
  const {
    granted,
    supported,
    alpha,
    beta,
    receivingHeading,
    requestPermission,
    requestPermissionFromUserGesture,
    needsUserGesture,
  } = useCompassPermission();

  const [compassDegree, setCompassDegree] = useState(0);
  const smoothedRef = useRef(0);
  const compassDegreeRef = useRef(0);

  useEffect(() => {
    if (!granted) return;
    smoothedRef.current = alpha;
  }, [alpha, granted]);

  useEffect(() => {
    if (!granted || !receivingHeading) return;

    const interval = window.setInterval(() => {
      const target = smoothedRef.current;
      const current = compassDegreeRef.current;

      let diff = target - current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      const smoothed = (current + diff * 0.15 + 360) % 360;
      compassDegreeRef.current = smoothed;
      setCompassDegree(smoothed);
    }, 16);

    return () => window.clearInterval(interval);
  }, [granted, receivingHeading]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !granted) return;
    const id = window.setInterval(() => {
      console.log("[Compass] compassDegree:", Math.round(compassDegreeRef.current), {
        receivingHeading,
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, [granted, receivingHeading]);

  return (
    <OrientationContext.Provider
      value={{
        compassDegree: granted && receivingHeading ? compassDegree : 0,
        deviceTiltBeta: granted && beta != null ? beta : null,
        hasPermission: granted,
        receivingHeading,
        requestPermission,
        requestPermissionFromUserGesture,
        isSupported: supported,
        needsUserGesture,
      }}
    >
      {children}
    </OrientationContext.Provider>
  );
}
