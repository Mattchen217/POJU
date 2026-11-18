/**
 * Server-only in-memory Session CAS for authoritative chat.
 * Kept off the client graph so session-mutation.ts can stay in the browser bundle.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { POJUSessionState } from "@/lib/poju/types";
import { bindMemorySessionPersistRuntime } from "@/lib/poju/session-mutation";

type MemorySessionPersistFrame = {
  sessions: Map<string, POJUSessionState>;
};

const memorySessionPersistAls = new AsyncLocalStorage<MemorySessionPersistFrame>();

bindMemorySessionPersistRuntime({
  getStore: () => memorySessionPersistAls.getStore(),
});

/** Server-authoritative chat: apply Session CAS in memory; the server record is the persist. */
export function runWithMemorySessionPersist<T>(
  seed: POJUSessionState | POJUSessionState[],
  fn: () => T | Promise<T>,
): Promise<T> {
  const sessions = new Map<string, POJUSessionState>();
  for (const state of Array.isArray(seed) ? seed : [seed]) {
    sessions.set(state.session_id, JSON.parse(JSON.stringify(state)) as POJUSessionState);
  }
  return Promise.resolve(memorySessionPersistAls.run({ sessions }, fn));
}
