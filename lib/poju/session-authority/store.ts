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
 *
 * M9-R1-FU1-FU2: TypeScript validates ledger entry_hash with canonicalHash and
 * binds the exact raw entries into Redis Lua CAS. Lua compares live GET bytes
 * against that snapshot and fail-closes on a changed or newly visible entry.
 * Lua still does not recompute JavaScript canonicalHash.
 *
 * M9-R1-FU1-FU2-FU3: TypeScript validates the current Session Record with
 * inspectStoredSessionRecord (canonicalHash) and binds the exact original
 * raw Redis value into Redis Lua CAS. Lua compares live GET bytes against
 * that exact raw string immediately after reading KEYS[1] and fail-closes
 * on a changed, deleted, or newly created record. Lua still does not
 * recompute JavaScript canonicalHash.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { durableKv, KV_TTL } from "@/lib/kv/client";
import { MemoryKv } from "@/lib/kv/memory-kv";
import { canonicalHash, normalizeJson } from "@/lib/poju/decision-authority/hash";
import {
  dcLedgerEntryKey,
  dcLedgerHeadKey,
} from "@/lib/poju/decision-authority/server/ledger-store";
import { DC_LEDGER_SCHEMA_VERSION } from "@/lib/poju/decision-authority/types";
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
  | "ledger_probe_incomplete"
  | "ledger_snapshot_changed"
  | "session_snapshot_changed";

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
  getRaw?: (key: string) => Promise<string | null> | string | null;
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

const LEDGER_CHANGE_TYPES = new Set([
  "genesis",
  "draft_update",
  "user_confirm",
  "version_open",
  "blueprint_update",
  "freeze",
]);

const LEDGER_DC_STATUSES = new Set(["draft", "final", "superseded"]);

/**
 * Inspect one ledger slot. A missing key is not an integrity failure.
 * Hash, identity, schema, and previous-pointer shape failures are integrity.
 * canonicalHash is the only hash used; this does not invent another algorithm.
 */
export function inspectLedgerEntryValue(
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
  if (entry.schema_version !== DC_LEDGER_SCHEMA_VERSION) return { kind: "integrity" };
  if (typeof entry.session_id !== "string" || entry.session_id !== sessionId) {
    return { kind: "integrity" };
  }
  if (!Number.isSafeInteger(entry.commit_version) || entry.commit_version !== expectedVersion) {
    return { kind: "integrity" };
  }
  if (typeof entry.change_type !== "string" || !LEDGER_CHANGE_TYPES.has(entry.change_type)) {
    return { kind: "integrity" };
  }
  if (typeof entry.dc_status !== "string" || !LEDGER_DC_STATUSES.has(entry.dc_status)) {
    return { kind: "integrity" };
  }
  if (expectedVersion === 1) {
    if (entry.previous_commit_version !== null || entry.previous_entry_hash !== null) {
      return { kind: "integrity" };
    }
  } else {
    if (entry.previous_commit_version !== expectedVersion - 1) return { kind: "integrity" };
    if (typeof entry.previous_entry_hash !== "string" || entry.previous_entry_hash.length === 0) {
      return { kind: "integrity" };
    }
  }
  if (typeof entry.entry_hash !== "string" || entry.entry_hash.length === 0) {
    return { kind: "integrity" };
  }
  try {
    const copy = normalizeJson(entry) as Record<string, unknown>;
    const { entry_hash, ...rest } = copy;
    if (canonicalHash(rest) !== entry_hash) return { kind: "integrity" };
  } catch {
    return { kind: "integrity" };
  }
  return { kind: "ok", entry };
}

function isFrozenLedgerHead(entry: Record<string, unknown>): boolean {
  return entry.change_type === "freeze" || entry.dc_status === "final";
}

function validateLoadedLedgerChain(
  loaded: Map<number, Record<string, unknown>>,
  headVersion: number,
  read: (key: string) => unknown | null,
  sessionId: string,
  probeLimit: number,
): LedgerProbeResult {
  let backwardReads = 0;
  const loadVersion = (
    version: number,
  ): { kind: "ok"; entry: Record<string, unknown> } | { kind: "integrity" } | { kind: "incomplete" } => {
    const cached = loaded.get(version);
    if (cached) return { kind: "ok", entry: cached };
    if (backwardReads >= probeLimit) return { kind: "incomplete" };
    backwardReads += 1;
    const got = inspectLedgerEntryValue(read(dcLedgerEntryKey(sessionId, version)), sessionId, version);
    if (got.kind !== "ok") return { kind: "integrity" };
    loaded.set(version, got.entry);
    return { kind: "ok", entry: got.entry };
  };

  for (let version = headVersion; version >= 1; version -= 1) {
    const current = loadVersion(version);
    if (current.kind === "incomplete") return { ok: false, reason: "ledger_probe_incomplete" };
    if (current.kind !== "ok") return { ok: false, reason: "ledger_integrity" };
    if (version === 1) break;
    const previous = loadVersion(version - 1);
    if (previous.kind === "incomplete") return { ok: false, reason: "ledger_probe_incomplete" };
    if (previous.kind !== "ok") return { ok: false, reason: "ledger_integrity" };
    if (current.entry.previous_commit_version !== version - 1) {
      return { ok: false, reason: "ledger_integrity" };
    }
    if (current.entry.previous_entry_hash !== previous.entry.entry_hash) {
      return { ok: false, reason: "ledger_integrity" };
    }
  }
  return { ok: true, frozen: false };
}

/**
 * Probe the Decision Authority ledger in the same KV as the Session record.
 * This is the same forward-scan used by readLedgerHead, kept synchronous so it
 * can run inside MemoryKv's atomic section or a TypeScript contract harness.
 *
 * Every consumed entry is hash-checked with canonicalHash. The chain from
 * genesis (commit 1) through the effective head is validated: previous
 * commit_version, previous_entry_hash, session identity, and monotonic slots.
 * The head hint is only a hint. A missing entry, invalid hash, invalid chain,
 * unusable hint, or probe-limit exhaustion fails closed. A genuinely missing
 * ledger (no hint and no entry 1) is not frozen. Freeze becomes effective
 * only after the NX-written ledger entry itself is visible.
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

  const loaded = new Map<number, Record<string, unknown>>();
  let head: Record<string, unknown> | null = null;
  if (n > 0) {
    const got = inspectLedgerEntryValue(read(dcLedgerEntryKey(sessionId, n)), sessionId, n);
    if (got.kind !== "ok") return { ok: false, reason: "ledger_integrity" };
    loaded.set(n, got.entry);
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
    loaded.set(n + 1, got.entry);
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

  const chain = validateLoadedLedgerChain(loaded, n, read, sessionId, probeLimit);
  if (!chain.ok) return chain;
  return { ok: true, frozen: isFrozenLedgerHead(head) };
}

export type LedgerBindingSnapshot = {
  hintRaw: string | null;
  startVersion: number;
  endVersion: number;
  entryRaws: string[];
  frozen: boolean;
};

export type LedgerRawBindingLive = {
  hintRaw: string | null;
  startVersion: number;
  endVersion: number;
  entryRaws: string[];
  liveHintRaw: string | null;
  liveEntryRaw: (version: number) => string | null;
};

/**
 * Lua-equivalent raw binding check. Live Redis GET bytes must equal the exact
 * TypeScript-validated raw strings. A changed or newly visible value is
 * ledger_snapshot_changed, never a valid non-Freeze head.
 */
export function evaluateLedgerRawBinding(
  input: LedgerRawBindingLive,
): { ok: true; frozen: boolean } | { ok: false; reason: "ledger_snapshot_changed" | "ledger_integrity" } {
  const { startVersion, endVersion, entryRaws } = input;
  if (endVersion === 0) {
    if (startVersion !== 0 || entryRaws.length !== 0) return { ok: false, reason: "ledger_integrity" };
  } else if (startVersion !== 1 || entryRaws.length !== endVersion || endVersion < 1) {
    return { ok: false, reason: "ledger_integrity" };
  }

  if (input.hintRaw == null) {
    if (input.liveHintRaw != null) return { ok: false, reason: "ledger_snapshot_changed" };
  } else if (input.liveHintRaw !== input.hintRaw) {
    return { ok: false, reason: "ledger_snapshot_changed" };
  }

  for (let i = 0; i < entryRaws.length; i += 1) {
    const expected = entryRaws[i];
    if (typeof expected !== "string" || expected.length === 0) {
      return { ok: false, reason: "ledger_integrity" };
    }
    const live = input.liveEntryRaw(startVersion + i);
    if (live !== expected) return { ok: false, reason: "ledger_snapshot_changed" };
  }

  if (input.liveEntryRaw(endVersion + 1) != null) {
    return { ok: false, reason: "ledger_snapshot_changed" };
  }

  if (endVersion === 0) return { ok: true, frozen: false };
  const parsed = asJsonObject(entryRaws[entryRaws.length - 1]);
  if (!parsed.ok) return { ok: false, reason: "ledger_integrity" };
  return { ok: true, frozen: isFrozenLedgerHead(parsed.value) };
}

export function encodeLedgerBindingArgs(snapshot: LedgerBindingSnapshot): string[] {
  return [
    snapshot.hintRaw ?? "",
    String(snapshot.startVersion),
    String(snapshot.endVersion),
    String(snapshot.entryRaws.length),
    ...snapshot.entryRaws,
  ];
}

/**
 * 0-based eval args index of the exact TypeScript-validated Session Record
 * raw string (Lua ARGV[10]). An empty string means the record was absent
 * during validation. Ledger binding args, when present, start immediately
 * after this slot (Lua ARGV[11], 0-based index 10).
 */
export const VALIDATED_SESSION_RAW_ARGV_INDEX = 9;
export const LEDGER_BINDING_ARGV_OFFSET = 10;

/**
 * Compare the exact TypeScript-validated Session Record raw value with the
 * live Redis GET bytes. An empty validatedRaw means the record was absent.
 * A mismatch, appearance, or disappearance is session_snapshot_changed.
 * Absent-and-still-absent is missing and must not create a record.
 */
export function evaluateSessionRecordRawBinding(input: {
  validatedRaw: string;
  liveRaw: string | null;
}): { ok: true } | { ok: false; reason: "session_snapshot_changed" | "missing" } {
  if (input.validatedRaw === "") {
    if (input.liveRaw != null) return { ok: false, reason: "session_snapshot_changed" };
    return { ok: false, reason: "missing" };
  }
  if (input.liveRaw == null || input.liveRaw !== input.validatedRaw) {
    return { ok: false, reason: "session_snapshot_changed" };
  }
  return { ok: true };
}

export function decodeValidatedSessionRawArg(args: string[]): string | undefined {
  if (args.length <= VALIDATED_SESSION_RAW_ARGV_INDEX) return undefined;
  return args[VALIDATED_SESSION_RAW_ARGV_INDEX] ?? "";
}

export function decodeLedgerBindingArgs(args: string[]): LedgerBindingSnapshot | null {
  const offset = LEDGER_BINDING_ARGV_OFFSET;
  if (args.length < offset + 4) return null;
  const hintRaw = args[offset] ?? "";
  const startVersion = Number(args[offset + 1]);
  const endVersion = Number(args[offset + 2]);
  const count = Number(args[offset + 3]);
  if (!Number.isSafeInteger(startVersion) || !Number.isSafeInteger(endVersion) || !Number.isSafeInteger(count) || count < 0) {
    return null;
  }
  if (args.length < offset + 4 + count) return null;
  return {
    hintRaw: hintRaw.length === 0 ? null : hintRaw,
    startVersion,
    endVersion,
    entryRaws: args.slice(offset + 4, offset + 4 + count),
    frozen: false,
  };
}

function hexToRaw(value: unknown): string | null {
  if (value === false || value == null) return null;
  if (typeof value !== "string" || value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
    throw new SessionRecordIntegrityError("ledger raw snapshot encoding is invalid");
  }
  return Buffer.from(value, "hex").toString("utf8");
}

export const SESSION_AUTHORITY_RAW_MGET_LUA = `
local function tohex(s)
  return (string.gsub(s, '.', function(c)
    return string.format('%02x', string.byte(c))
  end))
end
local out = {}
for i = 1, #KEYS do
  local raw = redis.call('GET', KEYS[i])
  if raw then
    out[i] = tohex(raw)
  else
    out[i] = false
  end
end
return out
`;

async function readRawKvValues(kv: KvLike, keys: string[]): Promise<(string | null)[]> {
  if (keys.length === 0) return [];
  if (typeof kv.getRaw === "function") {
    const values = await Promise.all(keys.map((key) => Promise.resolve(kv.getRaw!(key))));
    return values.map((value) => (value == null ? null : String(value)));
  }
  if (typeof kv.eval !== "function") {
    throw new SessionPersistenceUnavailableError("raw ledger reads require Redis eval or getRaw");
  }
  const result = await kv.eval(SESSION_AUTHORITY_RAW_MGET_LUA, keys, []);
  const rows = Array.isArray(result) ? result : [result];
  return keys.map((_, index) => hexToRaw(rows[index] ?? null));
}

export async function collectLedgerBindingSnapshot(
  readRaw: (keys: string[]) => Promise<(string | null)[]>,
  sessionId: string,
  probeLimit = LEDGER_CAS_PROBE_LIMIT,
): Promise<{ ok: true; snapshot: LedgerBindingSnapshot } | { ok: false; reason: LedgerProbeFailure }> {
  const cache = new Map<string, string | null>();
  const fill = async (keys: string[]): Promise<(string | null)[]> => {
    const missing = keys.filter((key) => !cache.has(key));
    if (missing.length > 0) {
      const values = await readRaw(missing);
      missing.forEach((key, index) => cache.set(key, values[index] ?? null));
    }
    return keys.map((key) => cache.get(key) ?? null);
  };
  const rawOf = (key: string): string | null => cache.get(key) ?? null;
  const readOne = (key: string): unknown | null => {
    const raw = rawOf(key);
    if (raw == null) return null;
    const parsed = asJsonObject(raw);
    if (!parsed.ok) return raw;
    return parsed.value;
  };

  const hintKey = dcLedgerHeadKey(sessionId);
  await fill([hintKey]);
  const hintRaw = rawOf(hintKey);
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

  const loaded = new Map<number, Record<string, unknown>>();
  let head: Record<string, unknown> | null = null;
  if (n > 0) {
    const key = dcLedgerEntryKey(sessionId, n);
    await fill([key]);
    const got = inspectLedgerEntryValue(readOne(key), sessionId, n);
    if (got.kind !== "ok") return { ok: false, reason: "ledger_integrity" };
    loaded.set(n, got.entry);
    head = got.entry;
  }

  for (let i = 0; i < probeLimit; i += 1) {
    const key = dcLedgerEntryKey(sessionId, n + 1);
    await fill([key]);
    const got = inspectLedgerEntryValue(readOne(key), sessionId, n + 1);
    if (got.kind === "integrity") return { ok: false, reason: "ledger_integrity" };
    if (got.kind === "missing") break;
    loaded.set(n + 1, got.entry);
    head = got.entry;
    n += 1;
    if (i === probeLimit - 1) {
      const moreKey = dcLedgerEntryKey(sessionId, n + 1);
      await fill([moreKey]);
      const more = inspectLedgerEntryValue(readOne(moreKey), sessionId, n + 1);
      if (more.kind === "integrity") return { ok: false, reason: "ledger_integrity" };
      if (more.kind === "ok") return { ok: false, reason: "ledger_probe_incomplete" };
    }
  }

  if (!head) {
    return {
      ok: true,
      snapshot: { hintRaw, startVersion: 0, endVersion: 0, entryRaws: [], frozen: false },
    };
  }

  const missingVersions: number[] = [];
  for (let version = 1; version <= n; version += 1) {
    if (!loaded.has(version)) missingVersions.push(version);
  }
  if (missingVersions.length > 0) {
    await fill(missingVersions.map((version) => dcLedgerEntryKey(sessionId, version)));
  }

  const chain = validateLoadedLedgerChain(
    loaded,
    n,
    (key) => readOne(key),
    sessionId,
    probeLimit,
  );
  if (!chain.ok) return chain;

  const entryRaws: string[] = [];
  for (let version = 1; version <= n; version += 1) {
    const raw = rawOf(dcLedgerEntryKey(sessionId, version));
    if (raw == null) return { ok: false, reason: "ledger_integrity" };
    entryRaws.push(raw);
  }
  return {
    ok: true,
    snapshot: {
      hintRaw,
      startVersion: 1,
      endVersion: n,
      entryRaws,
      frozen: isFrozenLedgerHead(head),
    },
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
  ledgerBinding?: LedgerRawBindingLive;
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
    if (input.ledgerBinding) {
      const bind = evaluateLedgerRawBinding(input.ledgerBinding);
      if (!bind.ok) return { ok: false, reason: bind.reason };
      if (bind.frozen) return { ok: false, reason: "frozen" };
    } else {
      const probe = probeSameKvLedger(input.read, input.sessionId);
      if (!probe.ok) return { ok: false, reason: probe.reason };
      if (probe.frozen) return { ok: false, reason: "frozen" };
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
  ledgerBinding?: LedgerRawBindingLive;
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
 *   10 ledger snapshot changed (retryable binding mismatch or new entry)
 *   11 session snapshot changed (retryable raw Session Record binding mismatch)
 *
 * KEYS[1] = session record key
 * ARGV: expectedRevision, nextJson, ttlSeconds, sessionId, nowIso, intakeCommit (0/1),
 *       ledgerHeadKey, ledgerEntryPrefix, probeLimit,
 *       validatedSessionRaw (exact TypeScript-validated raw, or empty if absent),
 *       [intake] hintRaw, startVersion, endVersion, entryCount, entryRaw...
 *
 * Hash policy: this script does not recompute canonicalHash / SHA-256 of
 * session_snapshot or ledger entry_hash. Exact JS JSON.stringify + SHA-256
 * parity cannot be implemented safely in Redis Lua. The production Redis
 * adapter runs inspectStoredSessionRecord (canonicalHash) on the current
 * and proposed records before EVAL, and validates ledger entry hashes with
 * the same canonicalHash implementation. The exact validated Session Record
 * raw value and ledger raw values are passed into this script; Lua compares
 * live GET bytes against those values and rejects the commit if they changed,
 * disappeared, appeared, or a new ledger entry appeared. Lua still
 * fail-closes on version, required fields, identity, snapshot.session_id,
 * and snapshot revision mismatches, and never treats a corrupted Record as
 * missing.
 */
export const SESSION_AUTHORITY_CAS_LUA = `
-- Hash policy: this script does not recompute canonicalHash / SHA-256 of
-- session_snapshot or ledger entry_hash. The production adapter validates
-- those hashes with canonicalHash and binds the exact raw Session Record
-- and ledger values. Lua compares live GET bytes against those exact
-- validated raw values and fail-closes on a change, deletion, appearance,
-- or newly visible ledger entry. Lua still fail-closes on structural
-- Record integrity and never treats a corrupted Record as missing.
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
local validatedSessionRaw = ARGV[10]
if type(validatedSessionRaw) ~= 'string' then return 6 end
-- Bind the exact TypeScript-validated raw Session Record. Lua does not
-- recompute canonicalHash. A byte-level mismatch, deletion, or appearance
-- is session_snapshot_changed (11), never success, cas_conflict, malformed,
-- or a successful create.
if validatedSessionRaw == '' then
  if raw then return 11 end
  if not raw then return 5 end
end
if (not raw) or raw ~= validatedSessionRaw then return 11 end

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

  -- Ledger binding: TypeScript validated canonical entry hashes and passed
  -- the exact raw values. Lua compares live Redis GET bytes against those
  -- raw values and never interprets an unbound or changed entry as a valid
  -- non-Freeze head. Lua does not recompute canonicalHash / entry_hash.
  local validatedHintRaw = ARGV[11]
  local startVersion = tonumber(ARGV[12]) or 0
  local endVersion = tonumber(ARGV[13]) or 0
  local entryCount = tonumber(ARGV[14]) or 0
  if type(validatedHintRaw) ~= 'string' then return 8 end
  if entryCount ~= math.floor(entryCount) or entryCount < 0 then return 8 end
  if endVersion > limit then return 9 end
  if endVersion == 0 then
    if startVersion ~= 0 or entryCount ~= 0 then return 8 end
  else
    if startVersion ~= 1 or entryCount ~= endVersion or endVersion < 1 then return 8 end
  end

  local liveHint = redis.call('GET', headKey)
  if validatedHintRaw == '' then
    if liveHint then return 10 end
  else
    if (not liveHint) or liveHint ~= validatedHintRaw then return 10 end
  end

  for i = 1, entryCount do
    local expectedRaw = ARGV[14 + i]
    if type(expectedRaw) ~= 'string' or string.len(expectedRaw) == 0 then return 8 end
    local live = redis.call('GET', prefix .. tostring(startVersion + i - 1))
    if (not live) or live ~= expectedRaw then return 10 end
  end

  local nextLive = redis.call('GET', prefix .. tostring(endVersion + 1))
  if nextLive then return 10 end

  if endVersion > 0 then
    local headRaw = ARGV[14 + entryCount]
    local head, headOk = decode(headRaw)
    if not headOk then return 8 end
    if head['change_type'] == 'freeze' or head['dc_status'] == 'final' then
      return 3
    end
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
  if (code === 10) return { ok: false, reason: "ledger_snapshot_changed" };
  if (code === 11) return { ok: false, reason: "session_snapshot_changed" };
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
    case "ledger_snapshot_changed":
      return 10;
    case "session_snapshot_changed":
      return 11;
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
  // Authoritative canonicalHash of the live record, bound by the exact raw
  // Redis bytes. Redis Lua does not recompute this hash; a corrupted current
  // record must fail closed here and never be overwritten. The exact original
  // raw string (not a JSON.stringify reconstruction) is passed to Lua, which
  // compares live GET bytes against it atomically. A genuinely absent record
  // still falls through to EVAL so the Lua path cannot recreate a missing key.
  let validatedSessionRaw = "";
  try {
    const [currentRaw] = await readRawKvValues(kv, [serverSessionKey(sessionId)]);
    inspectStoredSessionRecord(sessionId, currentRaw);
    // Preserve the exact original raw string. Empty means validated-absent.
    validatedSessionRaw = currentRaw ?? "";
  } catch (error) {
    if (error instanceof SessionRecordIntegrityError) {
      return { ok: false, reason: "malformed" };
    }
    throw error;
  }

  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const intakeCommit = Boolean(opts?.intakeCommit);
  const evalArgs: string[] = [
    String(expectedRevision),
    JSON.stringify(next),
    String(SERVER_SESSION_TTL_SECONDS),
    sessionId,
    nowIso,
    intakeCommit ? "1" : "0",
    dcLedgerHeadKey(sessionId),
    ledgerEntryPrefix(sessionId),
    String(LEDGER_CAS_PROBE_LIMIT),
    validatedSessionRaw,
  ];

  if (intakeCommit) {
    // TypeScript validates canonical ledger hashes, then binds the exact raw
    // values into EVAL. This is not a GET-hash-EVAL window: Lua compares the
    // live Redis bytes against those exact validated raw values and rejects
    // the commit if anything changed or a new entry appeared.
    const snapshot = await collectLedgerBindingSnapshot(
      (keys) => readRawKvValues(kv, keys),
      sessionId,
    );
    if (!snapshot.ok) return { ok: false, reason: snapshot.reason };
    evalArgs.push(...encodeLedgerBindingArgs(snapshot.snapshot));
  }

  // Upstash/Redis may time out on large session_snapshot JSON + ledger bind.
  // One quiet retry absorbs transient SCRIPT timeouts without failing the turn.
  const evalOnce = () =>
    kv.eval!(SESSION_AUTHORITY_CAS_LUA, [serverSessionKey(sessionId)], evalArgs);
  try {
    const result = await evalOnce();
    return luaCasCodeToResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/timed out|BUSY|SCRIPT/i.test(message)) throw error;
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    const result = await evalOnce();
    return luaCasCodeToResult(result);
  }
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
