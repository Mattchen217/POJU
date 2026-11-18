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
 *
 * M9-R1-FU1: Redis Lua CAS now fail-closes on the same structural Record
 * integrity contract as inspectStoredSessionRecord (version, required fields,
 * identity, snapshot id, snapshot revision). Ledger probes fail closed on
 * malformed or structurally invalid data and on probe-limit exhaustion.
 * Lua does not recompute canonicalHash; the production Redis adapter runs
 * inspectStoredSessionRecord before EVAL. Reason codes distinguish ledger
 * integrity and incomplete probes from ordinary CAS conflicts.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { durableKv, KV_TTL } from "@/lib/kv/client";
import { MemoryKv } from "@/lib/kv/memory-kv";
import { canonicalHash, normalizeJson } from "@/lib/poju/decision-authority/hash";
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
  | "terminated"
  | "ledger_integrity"
  | "ledger_probe_incomplete";

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

function isJsonParseError(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  if (error instanceof SessionRecordIntegrityError) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /unexpected token|unterminated string|json/i.test(message);
}

async function readKvValue(kv: KvLike, key: string): Promise<unknown> {
  try {
    return await kv.get(key);
  } catch (error) {
    if (error instanceof SessionRecordIntegrityError) throw error;
    if (isJsonParseError(error)) {
      throw new SessionRecordIntegrityError("session record JSON is malformed");
    }
    throw error;
  }
}

export type LedgerProbeFailure = "ledger_integrity" | "ledger_probe_incomplete";

export type LedgerProbeResult =
  | { ok: true; frozen: boolean }
  | { ok: false; reason: LedgerProbeFailure };

function asJsonObject(
  raw: unknown,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; missing: true }
  | { ok: false; integrity: true } {
  if (raw == null) return { ok: false, missing: true };
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return { ok: false, integrity: true };
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, integrity: true };
  }
  return { ok: true, value: value as Record<string, unknown> };
}

function inspectLedgerEntryValue(
  raw: unknown,
  sessionId: string,
  expectedVersion: number,
): { kind: "missing" } | { kind: "ok"; entry: Record<string, unknown> } | { kind: "integrity" } {
  if (raw == null) return { kind: "missing" };
  const parsed = asJsonObject(raw);
  if (!parsed.ok) {
    return "missing" in parsed && parsed.missing ? { kind: "missing" } : { kind: "integrity" };
  }
  const entry = parsed.value;
  if (typeof entry.session_id !== "string" || entry.session_id !== sessionId) {
    return { kind: "integrity" };
  }
  if (entry.commit_version !== expectedVersion) {
    return { kind: "integrity" };
  }
  if (typeof entry.entry_hash === "string" && entry.entry_hash.length > 0) {
    try {
      const copy = normalizeJson(entry);
      const { entry_hash, ...rest } = copy;
      if (canonicalHash(rest) !== entry_hash) return { kind: "integrity" };
    } catch {
      return { kind: "integrity" };
    }
  }
  return { kind: "ok", entry };
}

/**
 * Probe the Decision Authority ledger in the same KV as the Session record.
 * This is the same forward-scan used by readLedgerHead, kept synchronous so it
 * can run inside MemoryKv's atomic section or the matching Redis Lua script.
 *
 * Fail closed on malformed JSON, structurally invalid entries, an unusable
 * head hint, or probe-limit exhaustion. A genuinely missing ledger (no hint
 * and no entry 1) is not frozen. Freeze becomes effective only after the
 * NX-written ledger entry itself is visible; a head hint that has not been
 * written yet is still discovered by the forward scan.
 */
export function probeSameKvLedger(
  read: (key: string) => unknown | null,
  sessionId: string,
  probeLimit = LEDGER_CAS_PROBE_LIMIT,
): LedgerProbeResult {
  const hintRaw = read(dcLedgerHeadKey(sessionId));
  let n = 0;
  if (hintRaw != null) {
    const hint = asJsonObject(hintRaw);
    if (!hint.ok) return { ok: false, reason: "ledger_integrity" };
    const version = hint.value.commit_version;
    if (typeof version !== "number" || !Number.isSafeInteger(version) || version <= 0) {
      return { ok: false, reason: "ledger_integrity" };
    }
    n = version;
  }

  let head: Record<string, unknown> | null = null;
  if (n > 0) {
    const got = inspectLedgerEntryValue(read(dcLedgerEntryKey(sessionId, n)), sessionId, n);
    if (got.kind !== "ok") return { ok: false, reason: "ledger_integrity" };
    head = got.entry;
  }

  for (let i = 0; i < probeLimit; i += 1) {
    const got = inspectLedgerEntryValue(
      read(dcLedgerEntryKey(sessionId, n + 1)),
      sessionId,
      n + 1,
    );
    if (got.kind === "integrity") return { ok: false, reason: "ledger_integrity" };
    if (got.kind === "missing") break;
    head = got.entry;
    n += 1;
    if (i === probeLimit - 1) {
      const more = inspectLedgerEntryValue(
        read(dcLedgerEntryKey(sessionId, n + 1)),
        sessionId,
        n + 1,
      );
      if (more.kind === "integrity") return { ok: false, reason: "ledger_integrity" };
      if (more.kind === "ok") return { ok: false, reason: "ledger_probe_incomplete" };
    }
  }

  if (!head) return { ok: true, frozen: false };
  return {
    ok: true,
    frozen: head.change_type === "freeze" || head.dc_status === "final",
  };
}

function assertNextIntegrity(sessionId: string, next: ServerSessionRecord): void {
  inspectStoredSessionRecord(sessionId, next);
}

/**
 * Shared CAS predicate used by the in-process atomic path and by any Redis eval
 * contract harness that deliberately executes TypeScript instead of Lua.
 * Production Redis uses SESSION_AUTHORITY_CAS_LUA, which must return the same
 * explicit reason codes. Lua does not recompute canonicalHash; the production
 * Redis adapter runs inspectStoredSessionRecord (authoritative hash) before
 * EVAL, and Lua still fail-closes on structural integrity failures.
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
    const probe = probeSameKvLedger(input.read, input.sessionId);
    if (!probe.ok) return { ok: false, reason: probe.reason };
    if (probe.frozen) return { ok: false, reason: "frozen" };
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
 * Lua: atomic Session CAS. Returns one explicit result contract, shared with
 * TypeScript evaluateSessionAuthorityCas():
 *   1  accepted
 *   0  revision conflict
 *   2  expired
 *   3  frozen (record lifecycle or valid Freeze/final ledger head)
 *   4  terminated
 *   5  record missing (must not create)
 *   6  malformed / integrity-failed current Record
 *   7  invalid identity / contract on the proposed Record
 *   8  ledger integrity failure
 *   9  ledger probe incomplete
 *
 * KEYS[1] = session record key
 * ARGV: expectedRevision, nextJson, ttlSeconds, sessionId, nowIso, intakeCommit (0/1),
 *       ledgerHeadKey, ledgerEntryPrefix, probeLimit
 *
 * Hash policy: this script does not recompute canonicalHash / SHA-256 of
 * session_snapshot. Exact JS JSON.stringify + SHA-256 parity cannot be
 * implemented safely in Redis Lua (cjson cannot faithfully distinguish []
 * from {}, and number/unicode encoding may diverge). The production Redis
 * adapter runs inspectStoredSessionRecord (canonicalHash) on the current
 * and proposed records before EVAL. Lua still fail-closes on version,
 * required fields, identity, snapshot.session_id, and snapshot revision
 * mismatches, and never treats a corrupted Record as missing.
 */
export const SESSION_AUTHORITY_CAS_LUA = `
-- Hash policy: this script does not recompute canonicalHash / SHA-256 of
-- session_snapshot. Exact JS JSON.stringify + SHA-256 parity cannot be
-- implemented safely in Redis Lua (cjson cannot faithfully distinguish []
-- from {}, and number/unicode encoding may diverge). The production Redis
-- adapter runs inspectStoredSessionRecord (canonicalHash) before EVAL.
-- Lua still fail-closes on structural Record integrity and ledger probe
-- failures and never treats a corrupted Record as missing.
local function decode(raw)
  if not raw then return nil, false end
  if type(raw) ~= 'string' then raw = tostring(raw) end
  local ok, obj = pcall(cjson.decode, raw)
  if not ok or type(obj) ~= 'table' then return nil, false end
  return obj, true
end

local function is_number(v)
  return type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge
end

local function is_nonempty_string(v)
  return type(v) == 'string' and string.len(v) > 0
end

local function lifecycle_ok(v)
  return v == 'active' or v == 'expired' or v == 'frozen' or v == 'terminated'
end

local function inspect_record(obj, sessionId, fail_code)
  if type(obj) ~= 'table' then return false, fail_code end
  if obj['v'] ~= 1 then return false, fail_code end
  if not is_nonempty_string(obj['session_id']) then return false, fail_code end
  if obj['session_id'] ~= sessionId then return false, fail_code end
  if not is_number(obj['session_generation']) then return false, fail_code end
  if not is_number(obj['revision']) or obj['revision'] < 0 then return false, fail_code end
  if type(obj['created_at']) ~= 'string' then return false, fail_code end
  if type(obj['updated_at']) ~= 'string' then return false, fail_code end
  if type(obj['expires_at']) ~= 'string' then return false, fail_code end
  if not lifecycle_ok(obj['lifecycle_status']) then return false, fail_code end
  if type(obj['snapshot_hash']) ~= 'string' or string.len(obj['snapshot_hash']) == 0 then return false, fail_code end
  local snap = obj['session_snapshot']
  if type(snap) ~= 'table' then return false, fail_code end
  if type(snap['session_id']) ~= 'string' or snap['session_id'] ~= obj['session_id'] then return false, fail_code end
  if not is_number(snap['session_revision']) or snap['session_revision'] ~= obj['revision'] then return false, fail_code end
  return true, nil
end

local raw = redis.call('GET', KEYS[1])
if not raw then return 5 end
local obj, ok = decode(raw)
if not ok then return 6 end

local sessionId = ARGV[4]
local current_ok, current_fail = inspect_record(obj, sessionId, 6)
if not current_ok then return current_fail end

local expected = tonumber(ARGV[1])
local nextObj, nextOk = decode(ARGV[2])
if not nextOk then return 7 end
local next_ok, next_fail = inspect_record(nextObj, sessionId, 7)
if not next_ok then return next_fail end

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
  if hintRaw then
    local hint, hintOk = decode(hintRaw)
    if not hintOk then return 8 end
    local cv = hint['commit_version']
    if type(cv) ~= 'number' or cv ~= math.floor(cv) or cv <= 0 then return 8 end
    n = cv
  end

  local function load_entry(idx)
    if idx < 1 then return nil, 'missing' end
    local eraw = redis.call('GET', prefix .. tostring(idx))
    if not eraw then return nil, 'missing' end
    local e, eok = decode(eraw)
    if not eok then return nil, 'integrity' end
    if type(e['session_id']) ~= 'string' or e['session_id'] ~= sessionId then return nil, 'integrity' end
    if type(e['commit_version']) ~= 'number' or e['commit_version'] ~= idx then return nil, 'integrity' end
    return e, 'ok'
  end

  local head = nil
  if n > 0 then
    local e, st = load_entry(n)
    if st ~= 'ok' then return 8 end
    head = e
  end
  for i = 1, limit do
    local nxt, st = load_entry(n + 1)
    if st == 'integrity' then return 8 end
    if st == 'missing' then break end
    head = nxt
    n = n + 1
    if i == limit then
      local more, mst = load_entry(n + 1)
      if mst == 'integrity' then return 8 end
      if mst == 'ok' then return 9 end
    end
  end
  if head and (head['change_type'] == 'freeze' or head['dc_status'] == 'final') then
    return 3
  end
end

redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

export function luaCasCodeToResult(code: unknown): SessionCasResult {
  if (code === 1 || code === true) return { ok: true };
  if (code === 2) return { ok: false, reason: "expired" };
  if (code === 3) return { ok: false, reason: "frozen" };
  if (code === 4) return { ok: false, reason: "terminated" };
  if (code === 5) return { ok: false, reason: "missing" };
  if (code === 6) return { ok: false, reason: "malformed" };
  if (code === 7) return { ok: false, reason: "identity" };
  if (code === 8) return { ok: false, reason: "ledger_integrity" };
  if (code === 9) return { ok: false, reason: "ledger_probe_incomplete" };
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
    case "ledger_integrity":
      return 8;
    case "ledger_probe_incomplete":
      return 9;
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
  // Authoritative hash + record integrity for the proposed next record.
  try {
    inspectStoredSessionRecord(sessionId, next);
  } catch {
    return { ok: false, reason: "identity" };
  }
  // Authoritative canonicalHash of the live record. Redis Lua does not recompute
  // this hash; a corrupted current record must fail closed here and never be
  // overwritten. Lua still enforces structural integrity atomically.
  try {
    const currentRaw = await readKvValue(kv, serverSessionKey(sessionId));
    const current = inspectStoredSessionRecord(sessionId, currentRaw);
    if (!current) {
      // Fall through to EVAL so the Lua path cannot recreate a missing key.
    }
  } catch (error) {
    if (error instanceof SessionRecordIntegrityError) {
      return { ok: false, reason: "malformed" };
    }
    throw error;
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
  return luaCasCodeToResult(result);
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
        const raw = await readKvValue(kv, serverSessionKey(sessionId));
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
