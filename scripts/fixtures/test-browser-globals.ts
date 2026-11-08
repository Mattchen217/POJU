/**
 * Browser-global shims for IndexedDB-backed Intake R6 tests — scripts/** only.
 * Must never be imported from lib/ or app/ production modules.
 *
 * Installs window / dispatchEvent / localStorage / crypto on globalThis and
 * seeds the device + owner-key markers session-manager reads. Pair with
 * `import "fake-indexeddb/auto"` as the test file's first import.
 */

import { webcrypto } from "node:crypto";

function defineGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

/** Returns the backing store of the localStorage shim. */
export function installIntakeR6TestGlobals(deviceId: string): Map<string, string> {
  const memoryStore = new Map<string, string>();
  const localStorageShim: Storage = {
    getItem(key: string): string | null {
      return memoryStore.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      memoryStore.set(key, String(value));
    },
    removeItem(key: string): void {
      memoryStore.delete(key);
    },
    clear(): void {
      memoryStore.clear();
    },
    key(i: number): string | null {
      return [...memoryStore.keys()][i] ?? null;
    },
    get length() {
      return memoryStore.size;
    },
  };

  defineGlobal("window", globalThis);
  if (typeof globalThis.dispatchEvent !== "function") {
    defineGlobal("dispatchEvent", () => true);
  }
  defineGlobal("localStorage", localStorageShim);
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== "function") {
    defineGlobal("crypto", webcrypto);
  }
  memoryStore.set("pojulife_device_id_v4", deviceId);
  memoryStore.set("pojulife_owner_key_migrated_v1", "1");
  return memoryStore;
}
