/**
 * M9-R1-FU1 — Redis Lua / shared-predicate integrity parity
 *
 *   pnpm test:m9-r1-fu1-redis-lua-integrity-parity
 *
 * Demonstrates the review gap: production CAS must fail closed when the stored
 * Record is structurally inconsistent (snapshot id, snapshot revision, hash)
 * or when the same-KV ledger probe cannot establish an authoritative state.
 *
 * Harness label (read this first):
 *   RedisEvalHarness is a contract harness only. It asserts that
 *   createKvSessionAuthorityStore() calls kv.eval with the exact production
 *   SESSION_AUTHORITY_CAS_LUA source, then executes the shared TypeScript
 *   predicate applySessionAuthorityCas(). It does NOT run a Lua VM and it
 *   does NOT execute SESSION_AUTHORITY_CAS_LUA on a Redis server.
 *
 *   Static assertions against the Lua source string are labeled as source
 *   contract checks, not as proof of Redis Lua execution.
 *
 *   This process does not start Redis, Docker, or Upstash. If no Redis/Lua
 *   runtime is already available, the tests report that Lua remains
 *   unexecuted in a real Redis server.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import type { POJULLMResponse } from "../lib/llm/poju-llm";
import type { POJUMessage, POJUSessionState } from "../lib/poju/types";
import { POST as postChat } from "../app/api/poju/chat/route";
import { MemoryKv, isRemoteKvConfigured } from "../lib/kv/memory-kv";
import { canonicalHash, normalizeJson } from "../lib/poju/decision-authority/hash";
import {
  dcLedgerEntryKey,
  dcLedgerHeadKey,
} from "../lib/poju/decision-authority/server/ledger-store";
import { DC_LEDGER_SCHEMA_VERSION } from "../lib/poju/decision-authority/types";
import {
  LEDGER_CAS_PROBE_LIMIT,
  SESSION_AUTHORITY_CAS_LUA,
  SessionRecordIntegrityError,
  applySessionAuthorityCas,
  createKvSessionAuthorityStore,
  createMemorySessionAuthorityStore,
  inspectStoredSessionRecord,
  luaCasCodeToResult,
  runWithSessionAuthorityStore,
  sessionCasResultToLuaCode,
  type SessionAuthorityStore,
  type SessionCasResult,
} from "../lib/poju/session-authority/store";
import {
  SessionAuthorityError,
  commitAuthoritativeSessionUpdate,
  hashSessionSnapshot,
  initializeAuthoritativeSession,
  requireAuthoritativeSession,
} from "../lib/poju/session-authority/lifecycle";
import { runWithAuthoritativeChatTestHooks, runWithTestChatModel } from "../lib/poju/session-authority/chat-hooks";
import { mergeAnswerInterpretationTestHooks } from "./fixtures/test-answer-interpretation-hook";
import type { ServerSessionRecord } from "../lib/poju/session-authority/types";
import { serverSessionKey } from "../lib/poju/session-authority/types";

installIntakeR6TestGlobals("dev_m9_r1_fu1_lua_integrity");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "m9-r1-fu1-session-authority-test-secret";
}

const asyncTest = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`PASS ${name}`);
};

function cannedLlm(text: string): POJULLMResponse {
  return {
    response: text,
    model: "m9-r1-fu1-test-model",
    tokens_used: 1,
    user_intent: "sharing_situation",
    current_state: "collecting_context",
    topic_drift_detected: false,
    context_updates: { note: text },
    contains_delivery: false,
  };
}

function userMessage(content: string, client_id: string, extras?: Partial<POJUMessage>): POJUMessage {
  return {
    role: "user",
    content,
    timestamp: "2026-11-18T08:00:00.000Z",
    client_id,
    ...extras,
  };
}

function clientSessionFrom(record: ServerSessionRecord, patch?: Partial<POJUSessionState>): POJUSessionState {
  return {
    ...record.session_snapshot,
    session_revision: record.revision,
    ...patch,
  };
}

function chatRequest(session: POJUSessionState, extra?: Record<string, unknown>): Request {
  return new Request("http://localhost/api/poju/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: "zh", session, ...extra }),
  });
}

async function postChatJson(
  session: POJUSessionState,
  extra?: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await postChat(chatRequest(session, extra));
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body };
}

async function withStore<T>(
  fn: (store: SessionAuthorityStore) => Promise<T>,
  store: SessionAuthorityStore = createMemorySessionAuthorityStore(),
): Promise<T> {
  return runWithSessionAuthorityStore(store, () =>
    runWithAuthoritativeChatTestHooks(mergeAnswerInterpretationTestHooks(), () => fn(store)),
  );
}

async function initRecord(tag: string): Promise<ServerSessionRecord> {
  return initializeAuthoritativeSession({
    original_question: `M9-R1-FU1 ${tag}`,
    device_id: "dev_m9_r1_fu1_lua_integrity",
  });
}

let modelCalls = 0;

async function withModel<T>(
  fn: () => Promise<T>,
  impl?: (session: POJUSessionState) => Promise<POJULLMResponse>,
): Promise<T> {
  return runWithTestChatModel(async ({ session, signal }) => {
    if (signal?.aborted) {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }
    modelCalls += 1;
    return impl ? impl(session) : cannedLlm(`M9-R1-FU1 reply #${modelCalls}`);
  }, fn);
}

function bumpSnapshot(record: ServerSessionRecord, patch: Partial<ServerSessionRecord> = {}): ServerSessionRecord {
  const revision = patch.revision ?? record.revision + 1;
  const session_snapshot = patch.session_snapshot ?? {
    ...record.session_snapshot,
    session_revision: revision,
  };
  session_snapshot.session_revision = revision;
  return {
    ...record,
    ...patch,
    revision,
    session_snapshot,
    snapshot_hash: hashSessionSnapshot(session_snapshot),
  };
}

type KvSurface = {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) => Promise<"OK" | null>;
  del?: (...keys: string[]) => Promise<number>;
  rawGet?: (key: string) => string | undefined;
  getRaw?: (key: string) => string | null;
};

/**
 * Contract harness for the production eval branch of createKvSessionAuthorityStore.
 *
 * NOT A REDIS SERVER. NOT A LUA VM.
 * It refuses compareAndSetExact / getSync so the adapter must call kv.eval with
 * SESSION_AUTHORITY_CAS_LUA. The harness asserts it received that production
 * Lua source, then executes the shared TypeScript CAS predicate. Results from
 * this harness prove adapter wiring and TypeScript/Memory-equivalent reasons;
 * they are not proof that Redis executed the Lua script.
 */
class RedisEvalHarness implements KvSurface {
  private readonly data = new Map<string, string>();
  lastEvalScript: string | null = null;
  lastEvalTtl: string | null = null;
  evalCalls = 0;

  rawGet(key: string): string | undefined {
    return this.data.get(key);
  }

  getRaw(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = this.data.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Return the raw string so inspectStoredSessionRecord can fail closed
      // as a malformed record instead of a parse exception becoming "unavailable".
      return raw as T;
    }
  }

  async set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<"OK" | null> {
    if (opts?.nx && this.data.has(key)) return null;
    this.data.set(key, typeof value === "string" ? value : JSON.stringify(value));
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const key of keys) {
      if (this.data.delete(key)) n += 1;
    }
    return n;
  }

  async eval(script: string, keys: string[], args: string[]): Promise<number> {
    this.evalCalls += 1;
    this.lastEvalScript = script;
    assert.equal(script, SESSION_AUTHORITY_CAS_LUA, "eval must receive the production Lua source");
    assert.equal(keys.length, 1);
    this.lastEvalTtl = args[2] ?? null;
    const expectedRevision = Number(args[0]);
    const next = JSON.parse(args[1] ?? "null") as unknown;
    const sessionId = args[3] ?? "";
    const nowIso = args[4] ?? new Date().toISOString();
    const intakeCommit = args[5] === "1";
    const result: SessionCasResult = applySessionAuthorityCas({
      sessionId,
      expectedRevision,
      next,
      read: (key) => {
        const raw = this.data.get(key);
        if (raw == null) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      },
      write: (key, value) => {
        this.data.set(key, JSON.stringify(value));
      },
      intakeCommit,
      nowIso,
      ttlSeconds: Number(args[2]),
    });
    return sessionCasResultToLuaCode(result);
  }
}

function detectRealRedis(): { available: boolean; detail: string } {
  if (isRemoteKvConfigured()) {
    return { available: true, detail: "UPSTASH/KV REST credentials are present in the environment" };
  }
  return {
    available: false,
    detail:
      "no redis-server, no REDIS_URL, Docker daemon not running, and no UPSTASH/KV credentials; Lua was not executed on a real Redis server",
  };
}

async function peek(kv: KvSurface, key: string): Promise<unknown> {
  if (typeof kv.rawGet === "function") {
    const raw = kv.rawGet(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return kv.get(key);
}

function sealTestLedgerEntry(body: Record<string, unknown>): Record<string, unknown> {
  const rest = normalizeJson(body) as Record<string, unknown>;
  delete rest.entry_hash;
  return { ...rest, entry_hash: canonicalHash(rest) };
}

function validTestLedgerEntry(
  sessionId: string,
  version: number,
  patch: Record<string, unknown> = {},
  previousHash: string | null = null,
): Record<string, unknown> {
  return sealTestLedgerEntry({
    schema_version: DC_LEDGER_SCHEMA_VERSION,
    session_id: sessionId,
    commit_version: version,
    previous_commit_version: version === 1 ? null : version - 1,
    previous_entry_hash: version === 1 ? null : previousHash,
    change_type: version === 1 ? "genesis" : "draft_update",
    dc_status: "draft",
    ...patch,
  });
}

async function writeLedgerEntry(
  kv: KvSurface,
  sessionId: string,
  version: number,
  entry: Record<string, unknown>,
): Promise<void> {
  await kv.set(dcLedgerEntryKey(sessionId, version), entry);
}

async function writeLedgerHint(kv: KvSurface, sessionId: string, version: number): Promise<void> {
  await kv.set(dcLedgerHeadKey(sessionId), { commit_version: version });
}

async function writeValidNonFreeze(kv: KvSurface, sessionId: string, version = 1): Promise<string> {
  const entry = validTestLedgerEntry(sessionId, version, {}, null);
  await writeLedgerEntry(kv, sessionId, version, entry);
  await writeLedgerHint(kv, sessionId, version);
  return String(entry.entry_hash);
}

async function writeValidFreeze(kv: KvSurface, sessionId: string): Promise<string> {
  const entry = validTestLedgerEntry(
    sessionId,
    1,
    { change_type: "freeze", dc_status: "final" },
    null,
  );
  await writeLedgerEntry(kv, sessionId, 1, entry);
  await writeLedgerHint(kv, sessionId, 1);
  return String(entry.entry_hash);
}

function reasonOf(result: SessionCasResult): string {
  return result.ok ? "accepted" : result.reason;
}

async function main() {
  const redis = detectRealRedis();
  console.log("M9-R1-FU1 Redis Lua integrity parity tests starting");
  console.log("HARNESS=RedisEvalHarness (TypeScript predicate; does not execute Lua)");
  console.log(`REAL_REDIS_LUA_EXECUTED=${redis.available ? "yes" : "no"}`);
  console.log(`REAL_REDIS_DETAIL=${redis.detail}`);
  if (!redis.available) {
    console.log("LIMITATION: SESSION_AUTHORITY_CAS_LUA remains unexecuted in a real Redis server.");
  }

  await asyncTest("Static Lua source contract (NOT execution proof): structural integrity and ledger fail-closed codes", async () => {
    const lua = SESSION_AUTHORITY_CAS_LUA;
    assert.match(lua, /local function inspect_record/);
    assert.match(lua, /snap\['session_id'\] ~= obj\['session_id'\]/);
    assert.match(lua, /snap\['session_revision'\] ~= obj\['revision'\]/);
    assert.match(lua, /obj\['v'\] ~= 1/);
    assert.match(lua, /if not raw then return 5 end/);
    assert.match(lua, /if not ok then return 6 end/);
    assert.match(lua, /tonumber\(obj\['revision'\]\) ~= expected/);
    assert.match(lua, /nextObj\['session_generation'\]/);
    assert.match(lua, /nextObj\['expires_at'\] > obj\['expires_at'\]/);
    assert.match(lua, /change_type'\] == 'freeze'/);
    assert.match(lua, /return 8/);
    assert.match(lua, /return 9/);
    assert.match(lua, /redis\.call\('SET', KEYS\[1\], ARGV\[2\], 'EX'/);
    assert.match(lua, /canonicalHash/);
    console.log("NOTE: the assertions above are static source checks, not Redis Lua execution.");
  });

  const backends: Array<{ name: string; create: () => { store: SessionAuthorityStore; kv: KvSurface; isHarness: boolean } }> = [
    {
      name: "MemoryKv production adapter",
      create: () => {
        const kv = new MemoryKv();
        return { store: createKvSessionAuthorityStore(kv), kv, isHarness: false };
      },
    },
    {
      name: "Redis eval contract harness (does NOT execute Lua)",
      create: () => {
        const kv = new RedisEvalHarness();
        return { store: createKvSessionAuthorityStore(kv), kv, isHarness: true };
      },
    },
  ];

  for (const backend of backends) {
    const label = backend.name;

    await asyncTest(`A. Stored snapshot ID mismatch during CAS [${label}]`, async () => {
      const { store, kv, isHarness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`a-snap-id:${label}`);
        const key = serverSessionKey(record.session_id);
        const damaged = {
          ...record,
          session_snapshot: { ...record.session_snapshot, session_id: "tampered-snapshot-id" },
        };
        await kv.set(key, damaged);
        const next = bumpSnapshot(record);
        const result = await store.compareAndSetDetailed(record.session_id, record.revision, next, {
          intakeCommit: true,
        });
        assert.equal(reasonOf(result), "malformed");
        const stored = await peek(kv, key);
        assert.ok(stored && typeof stored === "object");
        assert.equal((stored as ServerSessionRecord).session_snapshot.session_id, "tampered-snapshot-id");
        assert.equal((stored as ServerSessionRecord).revision, record.revision);
        if (isHarness) {
          assert.equal((kv as RedisEvalHarness).lastEvalScript, null);
        }
      }, store);
    });

    await asyncTest(`B. Stored snapshot revision mismatch during CAS [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`b-snap-rev:${label}`);
        const key = serverSessionKey(record.session_id);
        await kv.set(key, { ...record, revision: record.revision + 1 });
        const next = bumpSnapshot(record);
        const result = await store.compareAndSetDetailed(record.session_id, record.revision, next, {
          intakeCommit: true,
        });
        assert.equal(reasonOf(result), "malformed");
        const stored = (await peek(kv, key)) as ServerSessionRecord;
        assert.equal(stored.revision, record.revision + 1);
        assert.equal(stored.session_snapshot.session_revision, record.session_snapshot.session_revision);
        assert.notEqual(stored.snapshot_hash, next.snapshot_hash);
      }, store);
    });

    await asyncTest(`C. Stored snapshot hash mismatch during CAS [${label}]`, async () => {
      const { store, kv, isHarness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`c-hash:${label}`);
        const key = serverSessionKey(record.session_id);
        const badHash = "0".repeat(64);
        await kv.set(key, { ...record, snapshot_hash: badHash });
        const next = bumpSnapshot(record);
        const result = await store.compareAndSetDetailed(record.session_id, record.revision, next, {
          intakeCommit: true,
        });
        assert.equal(reasonOf(result), "malformed");
        const stored = (await peek(kv, key)) as ServerSessionRecord;
        assert.equal(stored.snapshot_hash, badHash);
        assert.equal(stored.revision, record.revision);
        if (isHarness) {
          // Production Redis adapter fail-closes in inspectStoredSessionRecord
          // (canonicalHash) before EVAL. Lua is not claimed to recompute the hash.
          assert.equal((kv as RedisEvalHarness).evalCalls, 0);
        }
      }, store);
    });

    await asyncTest(`D. Malformed current Record during CAS is not overwritten [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`d-malformed-current:${label}`);
        const key = serverSessionKey(record.session_id);
        await kv.set(key, "this-is-not-json");
        const next = bumpSnapshot(record);
        const result = await store.compareAndSetDetailed(record.session_id, record.revision, next, {
          intakeCommit: true,
        });
        assert.equal(reasonOf(result), "malformed");
        const stored = await peek(kv, key);
        assert.equal(stored, "this-is-not-json");
        await assert.rejects(
          () => store.get(record.session_id),
          (error: unknown) => error instanceof SessionRecordIntegrityError,
        );
      }, store);
    });

    await asyncTest(`E. Malformed proposed Record is rejected [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`e-malformed-next:${label}`);
        const key = serverSessionKey(record.session_id);
        const before = await peek(kv, key);
        const badNext = {
          ...bumpSnapshot(record),
          snapshot_hash: "f".repeat(64),
        } as ServerSessionRecord;
        const result = await store.compareAndSetDetailed(record.session_id, record.revision, badNext, {
          intakeCommit: true,
        });
        assert.equal(reasonOf(result), "identity");
        const stored = (await peek(kv, key)) as ServerSessionRecord;
        assert.equal(stored.revision, record.revision);
        assert.equal(stored.snapshot_hash, (before as ServerSessionRecord).snapshot_hash);
      }, store);
    });

    await asyncTest(`F. Same-key ledger malformed JSON: Intake fail-closed [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`f-ledger-json:${label}`);
        await kv.set(dcLedgerEntryKey(record.session_id, 1), "{not-json");
        await writeLedgerHint(kv, record.session_id, 1);
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "ledger_integrity");
        const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
        assert.equal(stored.revision, record.revision);
      }, store);
    });

    await asyncTest(`G. Ledger structurally invalid entry: Intake fail-closed [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`g-ledger-struct:${label}`);
        await writeLedgerEntry(kv, record.session_id, 1, {
          change_type: "freeze",
          dc_status: "final",
          commit_version: 99,
          session_id: record.session_id,
        });
        await writeLedgerHint(kv, record.session_id, 1);
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "ledger_integrity");
        const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
        assert.equal(stored.revision, record.revision);
      }, store);
    });

    await asyncTest(`H. Ledger scan limit exhausted: Intake fail-closed [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`h-ledger-limit:${label}`);
        // No hint: scan starts at 0. LIMIT+1 visible entries means the probe
        // cannot establish that it has reached the authoritative end.
        let previousHash: string | null = null;
        for (let n = 1; n <= LEDGER_CAS_PROBE_LIMIT + 1; n += 1) {
          const entry = validTestLedgerEntry(record.session_id, n, {}, previousHash);
          await writeLedgerEntry(kv, record.session_id, n, entry);
          previousHash = String(entry.entry_hash);
        }
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "ledger_probe_incomplete");
        const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
        assert.equal(stored.revision, record.revision);
      }, store);
    });

    await asyncTest(`I. Valid non-Freeze ledger remains eligible for Intake [${label}]`, async () => {
      const { store, kv, isHarness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`i-ledger-open:${label}`);
        await writeValidNonFreeze(kv, record.session_id);
        const next = bumpSnapshot(record);
        const result = await store.compareAndSetDetailed(record.session_id, record.revision, next, {
          intakeCommit: true,
        });
        assert.equal(result.ok, true);
        const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
        assert.equal(stored.revision, 1);
        assert.equal(stored.snapshot_hash, next.snapshot_hash);
        if (isHarness) {
          assert.equal((kv as RedisEvalHarness).lastEvalScript, SESSION_AUTHORITY_CAS_LUA);
        }
      }, store);
    });

    await asyncTest(`J. Valid Freeze ledger rejects Intake [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`j-ledger-freeze:${label}`);
        await writeValidFreeze(kv, record.session_id);
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "frozen");
        const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
        assert.equal(stored.revision, record.revision);
      }, store);
    });

    await asyncTest(`K. Missing Session Record is not recreated [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`k-missing:${label}`);
        const key = serverSessionKey(record.session_id);
        if (kv.del) await kv.del(key);
        else await Promise.resolve();
        const result = await store.compareAndSetDetailed(record.session_id, record.revision, bumpSnapshot(record), {
          intakeCommit: true,
        });
        assert.equal(reasonOf(result), "missing");
        assert.equal(await peek(kv, key), null);
        assert.equal(await store.get(record.session_id), null);
      }, store);
    });

    await asyncTest(`L. Revision CAS conflict cannot overwrite the winner [${label}]`, async () => {
      const { store, kv, isHarness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`l-cas-race:${label}`);
        const winner = bumpSnapshot(record, {
          session_snapshot: { ...record.session_snapshot, original_question: "winner-question", session_revision: 1 },
        });
        const loser = bumpSnapshot(record, {
          session_snapshot: { ...record.session_snapshot, original_question: "loser-question", session_revision: 1 },
        });
        const [a, b] = await Promise.all([
          store.compareAndSetDetailed(record.session_id, 0, winner),
          store.compareAndSetDetailed(record.session_id, 0, loser),
        ]);
        assert.equal([a, b].filter((r) => r.ok).length, 1);
        const lost = a.ok ? b : a;
        assert.equal(reasonOf(lost), "cas_conflict");
        const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
        assert.equal(stored.revision, 1);
        assert.equal(stored.session_snapshot.original_question, a.ok ? "winner-question" : "loser-question");
        if (isHarness) {
          assert.equal((kv as RedisEvalHarness).lastEvalScript, SESSION_AUTHORITY_CAS_LUA);
        }
      }, store);
    });

    await asyncTest(`M. Terminal lifecycle still rejects commit [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        for (const [tag, patch, expected] of [
          ["expired", { expires_at: "2001-01-01T00:00:00.000Z", lifecycle_status: "expired" as const }, "expired"],
          ["frozen", { lifecycle_status: "frozen" as const }, "frozen"],
          ["terminated", { lifecycle_status: "terminated" as const }, "terminated"],
        ] as const) {
          const record = await initRecord(`m-${tag}:${label}`);
          const current = await store.get(record.session_id);
          assert.ok(current);
          const terminal: ServerSessionRecord = { ...current!, ...patch };
          assert.equal(await store.compareAndSet(record.session_id, current!.revision, terminal), true);
          const result = await store.compareAndSetDetailed(
            record.session_id,
            terminal.revision,
            bumpSnapshot(terminal),
            { intakeCommit: true },
          );
          assert.equal(reasonOf(result), expected);
          const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
          assert.equal(stored.revision, terminal.revision);
          assert.equal(stored.lifecycle_status, patch.lifecycle_status);
        }
      }, store);
    });
  }

  await asyncTest("N. Same-content idempotency remains successful without rerunning the model", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("n-idempotent-same");
        const before = modelCalls;
        const session = clientSessionFrom(record, {
          messages: [userMessage("same content", "turn_n1", { meta: { note: "first" } })],
        });
        const first = await postChatJson(session);
        const replay = await postChatJson({
          ...session,
          session_revision: 0,
          messages: [
            userMessage("same content", "turn_n1", {
              meta: { note: "edited-meta" },
              timestamp: "2099-01-01T00:00:00.000Z",
            }),
          ],
        });
        assert.equal(first.status, 200);
        assert.equal(replay.status, 200);
        assert.equal(replay.body.turn_idempotent, true);
        assert.equal(replay.body.session_revision, 1);
        const current = await requireAuthoritativeSession(record.session_id);
        assert.equal(current.revision, 1);
        assert.equal(current.session_snapshot.messages.filter((m) => m.role === "user").length, 1);
        assert.equal(modelCalls - before, 1);
      });
    });
  });

  await asyncTest("O. Different-content idempotency still returns session_turn_conflict", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("o-idempotent-conflict");
        const before = modelCalls;
        const first = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("original content", "turn_o1")] }),
        );
        assert.equal(first.status, 200);
        const conflict = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("tampered content", "turn_o1")] }),
        );
        assert.equal(conflict.status, 409);
        assert.equal(conflict.body.code, "session_turn_conflict");
        const current = await requireAuthoritativeSession(record.session_id);
        assert.equal(current.revision, 1);
        const users = current.session_snapshot.messages.filter((m) => m.role === "user");
        assert.equal(users.length, 1);
        assert.equal(users[0]?.content, "original content");
        assert.equal(modelCalls - before, 1);
      });
    });
  });

  await asyncTest("Reason contract maps Lua codes without collapsing integrity into cas_conflict", async () => {
    assert.deepEqual(luaCasCodeToResult(1), { ok: true });
    assert.deepEqual(luaCasCodeToResult(0), { ok: false, reason: "cas_conflict" });
    assert.deepEqual(luaCasCodeToResult(6), { ok: false, reason: "malformed" });
    assert.deepEqual(luaCasCodeToResult(7), { ok: false, reason: "identity" });
    assert.deepEqual(luaCasCodeToResult(8), { ok: false, reason: "ledger_integrity" });
    assert.deepEqual(luaCasCodeToResult(9), { ok: false, reason: "ledger_probe_incomplete" });
    assert.equal(sessionCasResultToLuaCode({ ok: false, reason: "ledger_integrity" }), 8);
    assert.equal(sessionCasResultToLuaCode({ ok: false, reason: "ledger_probe_incomplete" }), 9);
    assert.equal(sessionCasResultToLuaCode({ ok: false, reason: "malformed" }), 6);
    assert.notEqual(sessionCasResultToLuaCode({ ok: false, reason: "ledger_integrity" }), 0);
    assert.notEqual(sessionCasResultToLuaCode({ ok: false, reason: "malformed" }), 0);
  });

  await asyncTest("commitAuthoritativeSessionUpdate maps ledger integrity without a generic CAS conflict", async () => {
    const kv = new MemoryKv();
    const store = createKvSessionAuthorityStore(kv);
    await withStore(async () => {
      const record = await initRecord("commit-ledger-integrity");
      await kv.set(dcLedgerEntryKey(record.session_id, 1), "{not-json");
      await writeLedgerHint(kv, record.session_id, 1);
      await assert.rejects(
        () =>
          commitAuthoritativeSessionUpdate({
            sessionId: record.session_id,
            expectedRevision: record.revision,
            expectedGeneration: record.session_generation,
            snapshot: {
              ...record.session_snapshot,
              messages: [userMessage("should not commit", "turn_commit_ledger")],
            },
            last_committed_turn_id: "turn_commit_ledger",
          }),
        (error: unknown) =>
          error instanceof SessionAuthorityError && error.code === "ledger_integrity_failure" && error.recoverable === false,
      );
      const still = await requireAuthoritativeSession(record.session_id);
      assert.equal(still.revision, 0);
    }, store);
  });

  // Keep inspect helpers referenced so typings stay tight in this script.
  assert.equal(inspectStoredSessionRecord("absent", null), null);

  console.log("M9-R1-FU1 Redis Lua integrity parity checks complete");
  console.log(`REAL_REDIS_LUA_EXECUTED=${redis.available ? "yes" : "no"}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});