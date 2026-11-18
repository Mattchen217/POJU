/**
 * M9 ? persistence adapter for the server-authoritative Session record.
 * Production uses durableKv() (Upstash Redis when configured, MemoryKv otherwise).
 * Tests inject the same contract, including a MemoryKv-backed adapter with atomic CAS.
 *
 * M9-R1: reads fail closed on identity, hash, version, or revision corruption and
 * never treat a damaged record as missing. CAS is atomic (in-process sync section
 * or Redis Lua), will not create a record when the key is missing or malformed,
 * and the intake-commit path probes Decision Authority ledger keys in the same KV
 * when they are present. Two independent KV operations are not treated as atomic.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { durableKv, KV_TTL } from "@/lib/kv/client";
import { MemoryKv } from "@/lib/kv/memory-kv";
import { canonicalHash } from "@/lib/poju/decision-authority/hash";
import {
  dcLedgerEntryKey,
  dcLedgerHeadKey,
} from "@/lib/poju/decision-authority/server/ledger-store";
import {
  SERVER_SESSION_RECORD_VERSION,
  serverSessionKey,
  type ServerSessionRecord,
  type SessionLifecycleStatus,
} from "@/lib/poju/session-authority/types";

export const SERVER_SESSION_TTL_SECONDS = KV_TTL.DECISION_AUTHORITY_RETENTION;

export const LEDGER_CAS_PROBE_LIMIT = 512;

export class SessionPersistenceUnavailableError extends Error {
  readonly code = "server_persistence_unavailable" as const;
  constructor(message = "Server session persistence is unavailable") {
    super(message);
    this.name = "SessionPersistenceUnavailableError";
  }
}

export class SessionRecordIntegrityError extends Error {
  readonly code = "invalid_session_record" as const;
  constructor(message = "Server session record failed integrity checks") {
    super(message);
    this.name = "SessionRecordIntegrityError";
  }
}

export type SessionCasReason =
  | "missing"
  | "malformed"
  | "cas_conflict"
  | "identity"
  | "expired"
  | "frozen"
  | "terminated";

export type SessionCasResult = { ok: true } | { ok: false; reason: SessionCasReason };

export type SessionCasOptions = {
  /** When true, also reject current terminal lifecycle and a frozen ledger head. */
  intakeCommit?: boolean;
  nowIso?: string;
};

export type SessionAuthorityStore = {
  get(sessionId: string): Promise<ServerSessionRecord | null>;
  /** Create only when the key is absent. Returns false if the key already exists. */
  createNx(record: ServerSessionRecord): Promise<boolean>;
  /**
   * Atomic replace when the stored revision equals `expectedRevision`.
   * Must not overwrite a newer revision, and must not create a missing/malformed record.
   */
  compareAndSet(
    sessionId: string,
    expectedRevision: number,
    next: ServerSessionRecord,
    opts?: SessionCasOptions,
  ): Promise<boolean>;
  compareAndSetDetailed(
    sessionId: string,
    expectedRevision: number,
    next: ServerSessionRecord,
    opts?: SessionCasOptions,
  ): Promise<SessionCasResult>;
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
  getSync?: (key: string) => unknown | null;
  setSync?: (
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ) => "OK" | null;
};

function decodeJsonValue(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new SessionRecordIntegrityError("session record JSON is malformed");
    }
  }
  return raw;
}

function hasRecordShape(value: unknown): value is ServerSessionRecord {
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

/**
 * Inspect a stored document for the requested session key.
 * Returns null only when the key is genuinely absent.
 * Damaged, unsupported, or identity-inconsistent documents throw.
 */
export function inspectStoredSessionRecord(
  sessionId: string,
  raw: unknown,
): ServerSessionRecord | null {
  if (raw == null) return null;
  const value = decodeJsonValue(raw);
  if (!value || typeof value !== "object") {
    throw new SessionRecordIntegrityError("session record is not an object");
  }
  const partial = value as Partial<ServerSessionRecord>;
  if (partial.v !== SERVER_SESSION_RECORD_VERSION) {
    throw new SessionRecordIntegrityError(
      partial.v == null
        ? "session record version is missing"
        : `unsupported session record version: ${String(partial.v)}`,
    );
  }
  if (!hasRecordShape(value)) {
    throw new SessionRecordIntegrityError("session record is missing required fields");
  }
  if (value.session_id !== sessionId) {
    throw new SessionRecordIntegrityError("session record id does not match the storage key");
  }
  const snapshot = value.session_snapshot;
  if (!snapshot || typeof snapshot !== "object") {
    throw new SessionRecordIntegrityError("session snapshot is damaged");
  }
  if (typeof snapshot.session_id !== "string" || snapshot.session_id !== value.session_id) {
    throw new SessionRecordIntegrityError("session snapshot id does not match the record id");
  }
  if (snapshot.session_revision !== value.revision) {
    throw new SessionRecordIntegrityError("session revision does not match the snapshot revision");
  }
  const actualHash = canonicalHash(snapshot);
  if (actualHash !== value.snapshot_hash) {
    throw new SessionRecordIntegrityError("session snapshot hash does not match the stored hash");
  }
  return value;
}

function isLedgerFrozenValue(raw: unknown): boolean {
  if (raw == null) return false;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return false;
    }
  }
  if (!value || typeof value !== "object") return false;
  const entry = value as { change_type?: unknown; dc_status?: unknown };
  return entry.change_type === "freeze" || entry.dc_status === "final";
}

function readHintVersion(raw: unknown): number {
  if (raw == null) return 0;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return 0;
    }
  }
  if (!value || typeof value !== "object") return 0;
  const n = (value as { commit_version?: unknown }).commit_version;
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/**
 * Probe the Decision Authority ledger in the same KV as the Session record.
 * This is the same forward-scan used by readLedgerHead, kept synchronous so it
 * can run inside MemoryKv's atomic section or the matching Redis Lua script.
 */
export function probeSameKvLedgerFrozen(
  read: (key: string) => unknown | null,
  sessionId: string,
): boolean {
  const headKey = dcLedgerHeadKey(sessionId);
  let n = readHintVersion(read(headKey));
  let head = n > 0 ? read(dcLedgerEntryKey(sessionId, n)) : null;
  if (n > 0 && head == null) n = 0;
  for (let i = 0; i < LEDGER_CAS_PROBE_LIMIT; i += 1) {
    const next = read(dcLedgerEntryKey(sessionId, n + 1));
    if (next == null) break;
    head = next;
    n += 1;
  }
  return isLedgerFrozenValue(head);
}

function assertNextIntegrity(sessionId: string, next: ServerSessionRecord): void {
  inspectStoredSessionRecord(sessionId, next);
}

/**
 * Shared CAS predicate used by the in-process atomic path and by the Redis eval
 * contract harness. Redis production uses the Lua translation of this predicate.
 */
export function evaluateSessionAuthorityCas(input: {
  sessionId: string;
  expectedRevision: number;
  next: unknown;
  read: (key: string) => unknown | null;
  intakeCommit: boolean;
  nowIso: string;
}): SessionCasResult {
  const key = serverSessionKey(input.sessionId);
  let current: ServerSessionRecord | null;
  try {
    current = inspectStoredSessionRecord(input.sessionId, input.read(key));
  } catch (error) {
    if (error instanceof SessionRecordIntegrityError) {
      return { ok: false, reason: "malformed" };
    }
    throw error;
  }
  if (!current) return { ok: false, reason: "missing" };

  let nextRecord: ServerSessionRecord;
  try {
    if (!hasRecordShape(input.next)) {
      return { ok: false, reason: "identity" };
    }
    assertNextIntegrity(input.sessionId, input.next);
    nextRecord = input.next;
  } catch {
    return { ok: false, reason: "identity" };
  }

  if (current.revision !== input.expectedRevision) {
    return { ok: false, reason: "cas_conflict" };
  }
  if (
    nextRecord.session_id !== input.sessionId ||
    nextRecord.session_id !== current.session_id ||
    nextRecord.session_generation !== current.session_generation ||
    nextRecord.expires_at > current.expires_at ||
    (nextRecord.revision !== current.revision && nextRecord.revision !== current.revision + 1)
  ) {
    return { ok: false, reason: "identity" };
  }

  if (input.intakeCommit) {
    if (current.lifecycle_status === "expired" || current.expires_at <= input.nowIso) {
      return { ok: false, reason: "expired" };
    }
    if (current.lifecycle_status === "terminated") {
      return { ok: false, reason: "terminated" };
    }
    if (current.lifecycle_status === "frozen") {
      return { ok: false, reason: "frozen" };
    }
    if (probeSameKvLedgerFrozen(input.read, input.sessionId)) {
      return { ok: false, reason: "frozen" };
    }
  }

  return { ok: true };
}

export function applySessionAuthorityCas(input: {
  sessionId: string;
  expectedRevision: number;
  next: unknown;
  read: (key: string) => unknown | null;
  write: (key: string, value: ServerSessionRecord, ttlSeconds: number) => void;
  intakeCommit: boolean;
  nowIso: string;
  ttlSeconds: number;
}): SessionCasResult {
  const decision = evaluateSessionAuthorityCas(input);
  if (!decision.ok) return decision;
  input.write(serverSessionKey(input.sessionId), input.next as ServerSessionRecord, input.ttlSeconds);
  return decision;
}

/**
 * Lua: atomic Session CAS. Returns:
 *   1  accepted
 *   0  revision conflict
 *   2  intake commit rejected because the session is expired
 *   3  intake commit rejected because the session is frozen (record or ledger)
 *   4  intake commit rejected because the session is terminated
 *   5  record missing (must not create)
 *   6  record malformed (must not create)
 *   7  identity / generation / expires_at / revision-increment violation
 *
 * KEYS[1] = session record key
 * ARGV: expectedRevision, nextJson, ttlSeconds, sessionId, nowIso, intakeCommit (0/1),
 *       ledgerHeadKey, ledgerEntryPrefix, probeLimit
 */
export const SESSION_AUTHORITY_CAS_LUA = `
local function decode(raw)
  if not raw then return nil, false end
  if type(raw) ~= 'string' then raw = tostring(raw) end
  local ok, obj = pcall(cjson.decode, raw)
  if not ok or type(obj) ~= 'table' then return nil, false end
  return obj, true
end

local raw = redis.call('GET', KEYS[1])
if not raw then return 5 end
local obj, ok = decode(raw)
if not ok then return 6 end

local expected = tonumber(ARGV[1])
local nextObj, nextOk = decode(ARGV[2])
if not nextOk then return 7 end

local sessionId = ARGV[4]
if type(obj['session_id']) ~= 'string' or obj['session_id'] ~= sessionId then return 6 end
if tonumber(obj['revision']) ~= expected then return 0 end
if type(nextObj['session_id']) ~= 'string' or nextObj['session_id'] ~= sessionId then return 7 end
if tonumber(nextObj['session_generation']) ~= tonumber(obj['session_generation']) then return 7 end
local nextRev = tonumber(nextObj['revision'])
if nextRev ~= expected and nextRev ~= expected + 1 then return 7 end
if type(nextObj['expires_at']) ~= 'string' or type(obj['expires_at']) ~= 'string' or nextObj['expires_at'] > obj['expires_at'] then return 7 end

local intake = tonumber(ARGV[6]) == 1
if intake then
  local status = obj['lifecycle_status']
  local nowIso = ARGV[5]
  if status == 'expired' or (type(obj['expires_at']) == 'string' and obj['expires_at'] <= nowIso) then
    return 2
  end
  if status == 'terminated' then return 4 end
  if status == 'frozen' then return 3 end

  local headKey = ARGV[7]
  local prefix = ARGV[8]
  local limit = tonumber(ARGV[9]) or 512
  local hintRaw = redis.call('GET', headKey)
  local n = 0
  local hint, hintOk = decode(hintRaw)
  if hintOk and tonumber(hint['commit_version']) and tonumber(hint['commit_version']) > 0 then
    n = tonumber(hint['commit_version'])
  end
  local function load_entry(idx)
    if idx < 1 then return nil end
    local eraw = redis.call('GET', prefix .. tostring(idx))
    local e, eok = decode(eraw)
    if not eok then return nil end
    return e
  end
  local head = load_entry(n)
  if n > 0 and not head then n = 0 end
  for i = 1, limit do
    local nxt = load_entry(n + 1)
    if not nxt then break end
    head = nxt
    n = n + 1
  end
  if head and (head['change_type'] == 'freeze' or head['dc_status'] == 'final') then
    return 3
  end
end

redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

function casCodeToResult(code: unknown): SessionCasResult {
  if (code === 1 || code === true) return { ok: true };
  if (code === 2) return { ok: false, reason: "expired" };
  if (code === 3) return { ok: false, reason: "frozen" };
  if (code === 4) return { ok: false, reason: "terminated" };
  if (code === 5) return { ok: false, reason: "missing" };
  if (code === 6) return { ok: false, reason: "malformed" };
  if (code === 7) return { ok: false, reason: "identity" };
  return { ok: false, reason: "cas_conflict" };
}

export function sessionCasResultToLuaCode(result: SessionCasResult): number {
  if (result.ok) return 1;
  switch (result.reason) {
    case "expired":
      return 2;
    case "frozen":
      return 3;
    case "terminated":
      return 4;
    case "missing":
      return 5;
    case "malformed":
      return 6;
    case "identity":
      return 7;
    default:
      return 0;
  }
}

function ledgerEntryPrefix(sessionId: string): string {
  const sample = dcLedgerEntryKey(sessionId, 0);
  return sample.replace(/0$/, "");
}

function runAtomicSessionCas(
  kv: KvLike,
  sessionId: string,
  expectedRevision: number,
  next: ServerSessionRecord,
  opts?: SessionCasOptions,
): SessionCasResult {
  if (typeof kv.getSync !== "function" || typeof kv.setSync !== "function") {
    throw new SessionPersistenceUnavailableError("atomic session CAS requires synchronous KV primitives");
  }
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const intakeCommit = Boolean(opts?.intakeCommit);
  return applySessionAuthorityCas({
    sessionId,
    expectedRevision,
    next,
    read: (key) => kv.getSync!(key),
    write: (key, value, ttlSeconds) => {
      kv.setSync!(key, value, { ex: ttlSeconds });
    },
    intakeCommit,
    nowIso,
    ttlSeconds: SERVER_SESSION_TTL_SECONDS,
  });
}

async function runLuaSessionCas(
  kv: KvLike,
  sessionId: string,
  expectedRevision: number,
  next: ServerSessionRecord,
  opts?: SessionCasOptions,
): Promise<SessionCasResult> {
  if (typeof kv.eval !== "function") {
    throw new SessionPersistenceUnavailableError("session CAS Lua eval is unavailable");
  }
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const result = await kv.eval(
    SESSION_AUTHORITY_CAS_LUA,
    [serverSessionKey(sessionId)],
    [
      String(expectedRevision),
      JSON.stringify(next),
      String(SERVER_SESSION_TTL_SECONDS),
      sessionId,
      nowIso,
      opts?.intakeCommit ? "1" : "0",
      dcLedgerHeadKey(sessionId),
      ledgerEntryPrefix(sessionId),
      String(LEDGER_CAS_PROBE_LIMIT),
    ],
  );
  return casCodeToResult(result);
}

export function createKvSessionAuthorityStore(kv: KvLike): SessionAuthorityStore {
  const compareAndSetDetailed = async (
    sessionId: string,
    expectedRevision: number,
    next: ServerSessionRecord,
    opts?: SessionCasOptions,
  ): Promise<SessionCasResult> => {
    try {
      if (typeof kv.getSync === "function" && typeof kv.setSync === "function") {
        return runAtomicSessionCas(kv, sessionId, expectedRevision, next, opts);
      }
      if (typeof kv.eval === "function") {
        return runLuaSessionCas(kv, sessionId, expectedRevision, next, opts);
      }
      if (typeof kv.compareAndSetExact === "function") {
        // Last-resort exact-JSON CAS. Ledger/terminal checks still run through
        // evaluateSessionAuthorityCas, but this path yields between get and set.
        const key = serverSessionKey(sessionId);
        const current = await kv.get<unknown>(key);
        const decision = evaluateSessionAuthorityCas({
          sessionId,
          expectedRevision,
          next,
          read: (readKey) => {
            if (readKey === key) return current;
            return null;
          },
          intakeCommit: Boolean(opts?.intakeCommit),
          nowIso: opts?.nowIso ?? new Date().toISOString(),
        });
        if (!decision.ok) return decision;
        const ok = await kv.compareAndSetExact(key, current == null ? null : JSON.stringify(current), next, {
          ex: SERVER_SESSION_TTL_SECONDS,
        });
        return ok ? { ok: true } : { ok: false, reason: "cas_conflict" };
      }
      throw new SessionPersistenceUnavailableError(`session CAS unavailable for ${serverSessionKey(sessionId)}`);
    } catch (error) {
      if (error instanceof SessionPersistenceUnavailableError) throw error;
      throw new SessionPersistenceUnavailableError(
        error instanceof Error ? error.message : "session record CAS failed",
      );
    }
  };

  return {
    async get(sessionId: string): Promise<ServerSessionRecord | null> {
      try {
        const raw = await kv.get<unknown>(serverSessionKey(sessionId));
        return inspectStoredSessionRecord(sessionId, raw);
      } catch (error) {
        if (error instanceof SessionRecordIntegrityError) throw error;
        throw new SessionPersistenceUnavailableError(
          error instanceof Error ? error.message : "session record read failed",
        );
      }
    },

    async createNx(record: ServerSessionRecord): Promise<boolean> {
      try {
        inspectStoredSessionRecord(record.session_id, record);
        const result = await kv.set(serverSessionKey(record.session_id), record, {
          ex: SERVER_SESSION_TTL_SECONDS,
          nx: true,
        });
        return result === "OK";
      } catch (error) {
        if (error instanceof SessionRecordIntegrityError) throw error;
        throw new SessionPersistenceUnavailableError(
          error instanceof Error ? error.message : "session record create failed",
        );
      }
    },

    async compareAndSet(
      sessionId: string,
      expectedRevision: number,
      next: ServerSessionRecord,
      opts?: SessionCasOptions,
    ): Promise<boolean> {
      const result = await compareAndSetDetailed(sessionId, expectedRevision, next, opts);
      return result.ok;
    },

    compareAndSetDetailed,
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
    compareAndSetDetailed: fail,
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
