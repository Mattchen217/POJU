/**
 * M9 — persistence adapter for the server-authoritative Session record.
 * Production uses durableKv() (Upstash Redis when configured, MemoryKv otherwise).
 * Tests inject the same contract, including a MemoryKv-backed adapter with atomic CAS.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { durableKv, KV_TTL } from "@/lib/kv/client";
import { MemoryKv } from "@/lib/kv/memory-kv";
import {
  SERVER_SESSION_RECORD_VERSION,
  serverSessionKey,
  type ServerSessionRecord,
  type SessionLifecycleStatus,
} from "@/lib/poju/session-authority/types";

export const SERVER_SESSION_TTL_SECONDS = KV_TTL.DECISION_AUTHORITY_RETENTION;

export class SessionPersistenceUnavailableError extends Error {
  readonly code = "server_persistence_unavailable" as const;
  constructor(message = "Server session persistence is unavailable") {
    super(message);
    this.name = "SessionPersistenceUnavailableError";
  }
}

export type SessionAuthorityStore = {
  get(sessionId: string): Promise<ServerSessionRecord | null>;
  /** Create only when the key is absent. Returns false if the key already exists. */
  createNx(record: ServerSessionRecord): Promise<boolean>;
  /**
   * Atomic replace when the stored revision equals `expectedRevision`.
   * Must not overwrite a newer revision.
   */
  compareAndSet(
    sessionId: string,
    expectedRevision: number,
    next: ServerSessionRecord,
  ): Promise<boolean>;
};

type KvLike = {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ) => Promise<"OK" | null | unknown>;
  compareAndSetExact?: (
    key: string,
    expectedJson: string | null,
    next: unknown,
    opts?: { ex?: number },
  ) => Promise<boolean>;
  eval?: (script: string, keys: string[], args: string[]) => Promise<unknown>;
};

/**
 * Lua: SET only when the live record's revision equals ARGV[1].
 * ARGV[2] is the next JSON document, ARGV[3] is TTL seconds.
 */
const CAS_REVISION_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if type(raw) ~= 'string' then raw = tostring(raw) end
local ok, obj = pcall(cjson.decode, raw)
if not ok or type(obj) ~= 'table' then return 0 end
if tonumber(obj['revision']) ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

function isRecord(value: unknown): value is ServerSessionRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<ServerSessionRecord>;
  return (
    r.v === SERVER_SESSION_RECORD_VERSION &&
    typeof r.session_id === "string" &&
    r.session_id.trim().length > 0 &&
    typeof r.session_generation === "number" &&
    Number.isFinite(r.session_generation) &&
    typeof r.revision === "number" &&
    Number.isFinite(r.revision) &&
    r.revision >= 0 &&
    typeof r.created_at === "string" &&
    typeof r.updated_at === "string" &&
    typeof r.expires_at === "string" &&
    (r.lifecycle_status === "active" ||
      r.lifecycle_status === "expired" ||
      r.lifecycle_status === "frozen" ||
      r.lifecycle_status === "terminated") &&
    typeof r.snapshot_hash === "string" &&
    r.session_snapshot != null &&
    typeof r.session_snapshot === "object"
  );
}

function parseRecord(raw: unknown): ServerSessionRecord | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return parseRecord(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  return isRecord(raw) ? raw : null;
}

export function createKvSessionAuthorityStore(kv: KvLike): SessionAuthorityStore {
  return {
    async get(sessionId: string): Promise<ServerSessionRecord | null> {
      try {
        const raw = await kv.get<unknown>(serverSessionKey(sessionId));
        return parseRecord(raw);
      } catch (error) {
        throw new SessionPersistenceUnavailableError(
          error instanceof Error ? error.message : "session record read failed",
        );
      }
    },

    async createNx(record: ServerSessionRecord): Promise<boolean> {
      try {
        const result = await kv.set(serverSessionKey(record.session_id), record, {
          ex: SERVER_SESSION_TTL_SECONDS,
          nx: true,
        });
        return result === "OK";
      } catch (error) {
        throw new SessionPersistenceUnavailableError(
          error instanceof Error ? error.message : "session record create failed",
        );
      }
    },

    async compareAndSet(
      sessionId: string,
      expectedRevision: number,
      next: ServerSessionRecord,
    ): Promise<boolean> {
      const key = serverSessionKey(sessionId);
      try {
        if (typeof kv.compareAndSetExact === "function") {
          const current = await kv.get<unknown>(key);
          const record = parseRecord(current);
          if (!record || record.revision !== expectedRevision) return false;
          return kv.compareAndSetExact(key, JSON.stringify(current), next, {
            ex: SERVER_SESSION_TTL_SECONDS,
          });
        }
        if (typeof kv.eval === "function") {
          const result = await kv.eval(
            CAS_REVISION_LUA,
            [key],
            [String(expectedRevision), JSON.stringify(next), String(SERVER_SESSION_TTL_SECONDS)],
          );
          return result === 1 || result === true;
        }
        throw new SessionPersistenceUnavailableError(
          `session CAS unavailable for ${key}`,
        );
      } catch (error) {
        if (error instanceof SessionPersistenceUnavailableError) throw error;
        throw new SessionPersistenceUnavailableError(
          error instanceof Error ? error.message : "session record CAS failed",
        );
      }
    },
  };
}

/** In-memory adapter with the same atomic CAS / revision contract as production. */
export function createMemorySessionAuthorityStore(): SessionAuthorityStore {
  return createKvSessionAuthorityStore(new MemoryKv());
}

export function createUnavailableSessionAuthorityStore(): SessionAuthorityStore {
  const fail = async (): Promise<never> => {
    throw new SessionPersistenceUnavailableError("injected session store outage");
  };
  return {
    get: fail,
    createNx: fail,
    compareAndSet: fail,
  };
}

const storeAls = new AsyncLocalStorage<SessionAuthorityStore>();

let defaultStore: SessionAuthorityStore | null = null;

function productionStore(): SessionAuthorityStore {
  if (!defaultStore) {
    defaultStore = createKvSessionAuthorityStore(durableKv() as unknown as KvLike);
  }
  return defaultStore;
}

export function getSessionAuthorityStore(): SessionAuthorityStore {
  return storeAls.getStore() ?? productionStore();
}

export function runWithSessionAuthorityStore<T>(
  store: SessionAuthorityStore,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(storeAls.run(store, fn));
}

export function isTerminalLifecycle(status: SessionLifecycleStatus): boolean {
  return status === "expired" || status === "frozen" || status === "terminated";
}