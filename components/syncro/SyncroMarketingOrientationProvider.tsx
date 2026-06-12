"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  OrientationContext,
  type OrientationContextValue,
} from "@/components/syncro/SyncroOrientationProvider";
import type { SyncroUiMode } from "@/lib/syncro/syncro-view-helpers";

/** Slow compass rotation for marketing preview — no device sensors. */
export function SyncroMarketingOrientationProvider({
  children,
  uiMode = "compass",
}: {
  children: ReactNode;
  uiMode?: SyncroUiMode;
}) {
  const [compassDegree, setCompassDegree] = useState(48);
  const degreeRef = useRef(48);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const next = (48 + ((now - start) / 1000) * 5) % 360;
      degreeRef.current = next;
      setCompassDegree(next);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const deviceTiltBeta = uiMode === "ar" ? 82 : 18;

  const value: OrientationContextValue = {
    compassDegree,
    deviceTiltBeta,
    hasPermission: true,
    receivingHeading: false,
    requestPermission: async () => true,
    requestPermissionFromUserGesture: async () => true,
    isSupported: true,
    needsUserGesture: false,
  };

  return <OrientationContext.Provider value={value}>{children}</OrientationContext.Provider>;
}
