"use client";

import { useEffect } from "react";

import { isPwaStandalone } from "@/lib/client/pwa-standalone";
import {
  cacheUserLocation,
  loadCachedUserLocation,
  type UserLocation,
} from "@/lib/location/user-location-cache";

export type { UserLocation } from "@/lib/location/user-location-cache";

/** Invisible bootstrap: cache GPS or IP city once per session (24h TTL). */
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

  const standalone = isPwaStandalone();

  // Installed PWA: IP-only on launch — auto GPS prompts correlate with iOS WKWebView crash loops
  // when combined with Serwist; user can still pick a city manually in birth forms.
  if (standalone) {
    const runIp = async () => {
      try {
        const loc = await ipLocate();
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
    return;
  }

  if (typeof navigator !== "undefined" && "geolocation" in navigator) {
    try {
      const pos = await getGeolocation();
      const loc = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      cacheUserLocation({ ...loc, source: "gps", cached_at: Date.now() });
      return;
    } catch {
      // GPS denied or timed out — try IP
    }
  }

  try {
    const loc = await ipLocate();
    cacheUserLocation({ ...loc, source: "ip", cached_at: Date.now() });
  } catch {
    // Both failed — BirthLocationField will use timezone fallback
  }
}

function getGeolocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 3_600_000,
    });
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<Omit<UserLocation, "source" | "cached_at">> {
  const res = await fetch(
    `/api/location/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
  );
  if (!res.ok) {
    throw new Error(`reverse_geocode_${res.status}`);
  }
  const data = (await res.json()) as {
    city?: string;
    state?: string;
    country?: string;
  };
  if (!data.city || !data.country) {
    throw new Error("reverse_geocode_incomplete");
  }
  return {
    city: data.city,
    state: data.state,
    country: data.country,
    longitude: lng,
    latitude: lat,
  };
}

async function ipLocate(): Promise<Omit<UserLocation, "source" | "cached_at">> {
  const res = await fetch("/api/location/ip-locate");
  if (!res.ok) {
    throw new Error(`ip_locate_${res.status}`);
  }
  const data = (await res.json()) as {
    city?: string;
    region?: string;
    country_name?: string;
    latitude?: number;
    longitude?: number;
  };
  if (
    !data.city ||
    !data.country_name ||
    typeof data.latitude !== "number" ||
    typeof data.longitude !== "number"
  ) {
    throw new Error("ip_locate_incomplete");
  }
  return {
    city: data.city,
    state: data.region,
    country: data.country_name,
    latitude: data.latitude,
    longitude: data.longitude,
  };
}
