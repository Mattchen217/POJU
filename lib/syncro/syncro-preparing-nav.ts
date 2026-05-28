import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** iOS PWA sometimes drops client-side `router.replace`; hard-navigate if still on preparing. */
export function replaceSyncroPreparingWithLocation(router: Pick<AppRouterInstance, "replace">): void {
  const targetPath = "/syncro/location";
  router.replace(targetPath);

  window.setTimeout(() => {
    if (!/\/syncro\/preparing/.test(window.location.pathname)) return;
    const localePrefix = window.location.pathname.match(/^(\/[^/]+)\/syncro\/preparing/)?.[1] ?? "";
    window.location.replace(`${localePrefix}${targetPath}`);
  }, 2000);
}
