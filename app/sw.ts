/* eslint-disable no-restricted-globals */
import { installSerwist } from "serwist/legacy";

declare const self: typeof globalThis & {
  __SW_MANIFEST: Array<{
    url: string;
    revision: string | null;
  }>;
};

installSerwist({
  precacheEntries: self.__SW_MANIFEST,
  /** Take over immediately on deploy so stale CSS/JS chunks are not served. */
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  /** Bump when precache URLs change (legacy /v2/emailicon 404s). */
  cacheId: "pojulife-chat-layout-v5",
});
