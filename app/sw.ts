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
  skipWaiting: true,
  clientsClaim: true,
});
