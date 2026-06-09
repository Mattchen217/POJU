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
  /** Bump cache namespace when precache contents change (e.g. poju-chat.css 960px). */
  cacheId: "pojulife-chat960-v1",
});
