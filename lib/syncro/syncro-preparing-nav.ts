import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

const PREPARING_PATH_RE = /\/syncro\/preparing(?:\/|$|\?)/;

export function isOnSyncroPreparingRoute(): boolean {
  if (typeof window === "undefined") return false;
  return PREPARING_PATH_RE.test(window.location.pathname);
}

/** Locale-aware `/syncro/location` for `window.location` fallback. */
export function resolveSyncroLocationHref(): string {
  if (typeof window === "undefined") return "/syncro/location";
  const localePrefix = window.location.pathname.match(/^(\/[^/]+)\/syncro\//)?.[1] ?? "";
  return `${localePrefix}/syncro/location`;
}

function hardNavigateToSyncroLocation(): void {
  const href = resolveSyncroLocationHref();
  const url = href.startsWith("http") ? href : `${window.location.origin}${href}`;
  window.location.replace(url);
}

/**
 * iOS PWA often drops a single `router.replace`. Retry hard navigation while still on preparing.
 */
export function replaceSyncroPreparingWithLocation(router: Pick<AppRouterInstance, "replace">): void {
  if (typeof window === "undefined") {
    router.replace("/syncro/location");
    return;
  }

  router.replace("/syncro/location");

  const retryMs = [350, 900, 1800, 3500, 6000];
  for (const ms of retryMs) {
    window.setTimeout(() => {
      if (isOnSyncroPreparingRoute()) {
        hardNavigateToSyncroLocation();
      }
    }, ms);
  }
}
