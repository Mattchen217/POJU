import { isLikelyPwaContext } from "@/lib/client/pwa-standalone";

const LEGACY_RESET_KEY = "pojulife_sw_legacy_reset_v3";

/**
 * One-time cleanup for browser-tab users stuck on a pre-Serwist service worker.
 * Must NOT run in installed PWA: unregistering Serwist on every load causes iOS crash/reload loops.
 */
export async function runLegacyServiceWorkerResetOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (isLikelyPwaContext()) return;

  try {
    if (localStorage.getItem(LEGACY_RESET_KEY) === "1") return;
    localStorage.setItem(LEGACY_RESET_KEY, "1");
  } catch {
    return;
  }

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  } catch {
    // ignore
  }

  try {
    if (!("caches" in window)) return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // ignore
  }
}
