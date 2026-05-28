/** True when running as an installed PWA (home-screen / standalone display mode). */
export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

/** Installed PWA or launched from manifest `start_url` (?source=pwa). */
export function isLikelyPwaContext(): boolean {
  if (typeof window === "undefined") return false;
  if (isPwaStandalone()) return true;
  try {
    if (new URLSearchParams(window.location.search).get("source") === "pwa") return true;
  } catch {
    // ignore
  }
  return false;
}
