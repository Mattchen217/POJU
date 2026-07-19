"use client";

import { useEffect } from "react";

import {
  cacheUserLocation,
  loadCachedUserLocation,
  type UserLocation,
} from "@/lib/location/user-location-cache";

export type { UserLocation } from "@/lib/location/user-location-cache";

/**
 * Invisible bootstrap: IP city cache for birth-form placeholders only.
 * Precise GPS is Syncro-only (mobile `/syncro/location`) — never prompt on first site open.
 */
export function FirstTimeLocation() {
  useEffect(() => {
    void detectAndCacheLocation();
  }, []);

  return null;
}

export function getCurrentLocation(): UserLocation | null {
  return loadCachedUserLocation();
}

async function detectAndCacheLocation(): Promise<void> {
  const cached = loadCachedUserLocation();
  if (cached) return;

  // IP-only everywhere (browser + PWA). Avoids the system location sheet on homepage /
  // POJU / Match / Glyph. Syncro requests GPS itself when the user reaches location step.
  const runIp = async () => {
    try {
      const loc = await ipLocate();
      if (!loc) return; // located:false → 手动选择，不 toast
      cacheUserLocation({ ...loc, source: "ip", cached_at: Date.now() });
    } catch {
      // BirthLocationField falls back to timezone city
    }
  };
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => void runIp(), { timeout: 8000 });
  } else {
    window.setTimeout(() => void runIp(), 2500);
  }
}

async function ipLocate(): Promise<Omit<UserLocation, "source" | "cached_at"> | null> {
  const res = await fetch("/api/location/ip-locate");
  if (!res.ok) return null;
  const data = (await res.json()) as {
    located?: boolean;
    city?: string;
    region?: string;
    country_name?: string;
    latitude?: number;
    longitude?: number;
  };
  // 查不到 → 静默回退手动选择，不当错误 toast。
  if (
    data.located === false ||
    !data.city ||
    !data.country_name ||
    typeof data.latitude !== "number" ||
    typeof data.longitude !== "number"
  ) {
    return null;
  }
  return {
    city: data.city,
    state: data.region,
    country: data.country_name,
    latitude: data.latitude,
    longitude: data.longitude,
  };
}
