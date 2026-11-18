/**
 * M9-R1-FU1-FU2 ? Ledger integrity atomic binding
 *
 *   pnpm test:m9-r1-fu1-fu2-ledger-integrity-atomic-binding
 *
 * Production Redis Lua must not accept a Ledger Entry solely because
 * session_id and commit_version match. TypeScript validates entry_hash with
 * the existing canonicalHash implementation and binds the exact raw values
 * into EVAL. Lua compares live Redis GET bytes against that snapshot.
 *
 * Harness labels (read this first):
 *   MemoryKv: in-process atomic TypeScript path (getSync/setSync). Ledger
 *   hash and chain checks run inside the same synchronous CAS section.
 *
 *   RedisEvalHarness is a contract harness only. It asserts that
 *   createKvSessionAuthorityStore() calls kv.eval with the exact production
 *   SESSION_AUTHORITY_CAS_LUA source and that intake ARGV contains the exact
 *   validated ledger raw values. It then applies the shared TypeScript
 *   raw-binding predicate evaluateLedgerRawBinding() plus Session CAS. It
 *   does NOT run a Lua VM and it does NOT execute SESSION_AUTHORITY_CAS_LUA
 *   on a Redis server.
 *
 *   Static assertions against the Lua source string are labeled as source
 *   contract checks, not as proof of Redis Lua execution.
 *
 *   This process does not start Redis, Docker, or Upstash, and does not add
 *   credentials or infrastructure.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  SESSION_AUTHORITY_RAW_MGET_LUA,
  applySessionAuthorityCas,
  collectLedgerBindingSnapshot,
  createKvSessionAuthorityStore,
  decodeLedgerBindingArgs,
  encodeLedgerBindingArgs,
  evaluateLedgerRawBinding,
  inspectLedgerEntryValue,
  luaCasCodeToResult,
  runWithSessionAuthorityStore,
  sessionCasResultToLuaCode,
  type LedgerBindingSnapshot,
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

installIntakeR6TestGlobals("dev_m9_r1_fu1_fu2_ledger_binding");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "m9-r1-fu1-fu2-ledger-binding-test-secret";
}

const asyncTest = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`PASS ${name}`);
};

function cannedLlm(text: string): POJULLMResponse {
  return {
    response: text,
    model: "m9-r1-fu1-fu2-test-model",
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
  store: SessionAuthorityStore,
): Promise<T> {
  return runWithSessionAuthorityStore(store, () =>
    runWithAuthoritativeChatTestHooks(mergeAnswerInterpretationTestHooks(), () => fn(store)),
  );
}

async function initRecord(tag: string): Promise<ServerSessionRecord> {
  return initializeAuthoritativeSession({
    original_question: `M9-R1-FU1-FU2 ${tag}`,
    device_id: "dev_m9_r1_fu1_fu2_ledger_binding",
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
    return impl ? impl(session) : cannedLlm(`M9-R1-FU1-FU2 reply #${modelCalls}`);
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

function reasonOf(result: SessionCasResult): string {
  return result.ok ? "accepted" : result.reason;
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

type KvSurface = {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) => Promise<"OK" | null>;
  del?: (...keys: string[]) => Promise<number>;
  rawGet?: (key: string) => string | undefined;
  getRaw?: (key: string) => string | null;
};

async function writeLedgerEntry(
  kv: KvSurface,
  sessionId: string,
  version: number,
  entry: Record<string, unknown> | string,
): Promise<void> {
  await kv.set(dcLedgerEntryKey(sessionId, version), entry);
}

async function writeLedgerHint(kv: KvSurface, sessionId: string, version: number): Promise<void> {
  await kv.set(dcLedgerHeadKey(sessionId), { commit_version: version });
}

async function writeValidNonFreeze(kv: KvSurface, sessionId: string): Promise<Record<string, unknown>> {
  const entry = validTestLedgerEntry(sessionId, 1, {}, null);
  await writeLedgerEntry(kv, sessionId, 1, entry);
  await writeLedgerHint(kv, sessionId, 1);
  return entry;
}

async function writeValidFreeze(kv: KvSurface, sessionId: string): Promise<Record<string, unknown>> {
  const entry = validTestLedgerEntry(sessionId, 1, { change_type: "freeze", dc_status: "final" }, null);
  await writeLedgerEntry(kv, sessionId, 1, entry);
  await writeLedgerHint(kv, sessionId, 1);
  return entry;
}

async function peek(kv: KvSurface, key: string): Promise<unknown> {
  if (typeof kv.rawGet === "function" || typeof kv.getRaw === "function") {
    const raw = kv.getRaw?.(key) ?? kv.rawGet?.(key);
    if (raw == null) return null;
    try {
      return JSON.parse(String(raw));
    } catch {
      return raw;
    }
  }
  return kv.get(key);
}

/**
 * Contract harness for the production eval branch of createKvSessionAuthorityStore.
 *
 * NOT A REDIS SERVER. NOT A LUA VM.
 * Intake CAS uses getRaw so TypeScript can validate canonical hashes, then eval
 * receives the production Lua source plus the exact raw ledger snapshot. The
 * harness applies evaluateLedgerRawBinding() against live bytes after an
 * optional onBeforeEval mutation. Results prove adapter wiring and the shared
 * raw-binding contract; they are not proof that Redis executed the Lua script.
 */
class RedisEvalHarness implements KvSurface {
  private readonly data = new Map<string, string>();
  lastEvalScript: string | null = null;
  lastEvalArgs: string[] | null = null;
  lastEvalTtl: string | null = null;
  evalCalls = 0;
  onBeforeEval: (() => void) | null = null;

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
    this.lastEvalArgs = args;
    assert.equal(script, SESSION_AUTHORITY_CAS_LUA, "eval must receive the production Lua source");
    assert.equal(keys.length, 1);
    this.lastEvalTtl = args[2] ?? null;
    if (this.onBeforeEval) this.onBeforeEval();

    const expectedRevision = Number(args[0]);
    const next = JSON.parse(args[1] ?? "null") as unknown;
    const sessionId = args[3] ?? "";
    const nowIso = args[4] ?? new Date().toISOString();
    const intakeCommit = args[5] === "1";
    const binding = intakeCommit ? decodeLedgerBindingArgs(args) : null;
    if (intakeCommit) {
      assert.ok(binding, "intake EVAL must receive the validated ledger raw snapshot");
    }

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
      ledgerBinding:
        intakeCommit && binding
          ? {
              hintRaw: binding.hintRaw,
              startVersion: binding.startVersion,
              endVersion: binding.endVersion,
              entryRaws: binding.entryRaws,
              liveHintRaw: this.data.get(args[6] ?? "") ?? null,
              liveEntryRaw: (version) => this.data.get(`${args[7] ?? ""}${version}`) ?? null,
            }
          : undefined,
    });
    return sessionCasResultToLuaCode(result);
  }
}

function commandExists(command: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(probe, [command], { encoding: "utf8" });
  return result.status === 0;
}

function detectRealRedis(): { available: boolean; detail: string } {
  const hasCli = commandExists("redis-cli");
  const hasServer = commandExists("redis-server");
  const redisUrl = process.env.REDIS_URL?.trim() ?? "";
  const docker = spawnSync("docker", ["info"], { encoding: "utf8" });
  const dockerUp = docker.status === 0;
  if (hasCli) {
    const ping = spawnSync("redis-cli", ["ping"], { encoding: "utf8" });
    if (ping.status === 0 && (ping.stdout || "").trim() === "PONG") {
      return { available: true, detail: "redis-cli ping returned PONG" };
    }
  }
  return {
    available: false,
    detail:
      `redis-cli=${hasCli ? "yes" : "no"}; redis-server=${hasServer ? "yes" : "no"}; ` +
      `REDIS_URL=${redisUrl ? "set" : "unset"}; docker_daemon=${dockerUp ? "up" : "down"}; ` +
      `upstash_configured=${isRemoteKvConfigured() ? "yes(not used; no test writes to remote KV)" : "no"}`,
  };
}

type Backend = {
  name: string;
  label: "MemoryKv" | "RedisEvalHarness";
  isHarness: boolean;
  create: () => { store: SessionAuthorityStore; kv: KvSurface; harness: RedisEvalHarness | null };
};

const backends: Backend[] = [
  {
    name: "MemoryKv production adapter (TypeScript/MemoryKv atomic path)",
    label: "MemoryKv",
    isHarness: false,
    create: () => {
      const kv = new MemoryKv();
      return { store: createKvSessionAuthorityStore(kv), kv, harness: null };
    },
  },
  {
    name: "Redis eval contract harness (does NOT execute Lua)",
    label: "RedisEvalHarness",
    isHarness: true,
    create: () => {
      const harness = new RedisEvalHarness();
      return { store: createKvSessionAuthorityStore(harness), kv: harness, harness };
    },
  },
];

async function main() {
  const redis = detectRealRedis();
  console.log("M9-R1-FU1-FU2 ledger integrity atomic binding tests starting");
  console.log("HARNESS=MemoryKv + RedisEvalHarness (TypeScript raw-binding predicate; does not execute Lua)");
  console.log(`REAL_REDIS_LUA_EXECUTED=${redis.available ? "yes" : "no"}`);
  console.log(`REAL_REDIS_DETAIL=${redis.detail}`);
  if (!redis.available) {
    console.log("LIMITATION: SESSION_AUTHORITY_CAS_LUA remains unexecuted in a real Redis server.");
  }

  await asyncTest("Static Lua source contract (NOT execution proof): raw ledger binding and new result code", async () => {
    const lua = SESSION_AUTHORITY_CAS_LUA;
    assert.match(lua, /canonicalHash/);
    assert.match(lua, /liveHint ~= validatedHintRaw/);
    assert.match(lua, /live ~= expectedRaw/);
    assert.match(lua, /return 10/);
    assert.match(lua, /change_type'\] == 'freeze'/);
    assert.match(lua, /return 8/);
    assert.match(lua, /return 9/);
    assert.match(lua, /does not recompute canonicalHash/);
    assert.match(SESSION_AUTHORITY_RAW_MGET_LUA, /redis\.call\('GET', KEYS\[i\]\)/);
    assert.deepEqual(luaCasCodeToResult(10), { ok: false, reason: "ledger_snapshot_changed" });
    assert.equal(sessionCasResultToLuaCode({ ok: false, reason: "ledger_snapshot_changed" }), 10);
    assert.notEqual(sessionCasResultToLuaCode({ ok: false, reason: "ledger_snapshot_changed" }), 0);
    assert.notEqual(sessionCasResultToLuaCode({ ok: false, reason: "ledger_snapshot_changed" }), 8);
    console.log("NOTE: the assertions above are static source checks, not Redis Lua execution.");
  });

  for (const backend of backends) {
    const label = `${backend.label}`;

    await asyncTest(`A. Valid Freeze entry: Intake rejected [${label}]`, async () => {
      const { store, kv, harness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`a-freeze:${label}`);
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
        if (harness) assert.equal(harness.lastEvalScript, SESSION_AUTHORITY_CAS_LUA);
      }, store);
    });

    await asyncTest(`B. Valid non-Freeze entry: Intake eligible [${label}]`, async () => {
      const { store, kv, harness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`b-open:${label}`);
        const entry = await writeValidNonFreeze(kv, record.session_id);
        const next = bumpSnapshot(record);
        const result = await store.compareAndSetDetailed(record.session_id, record.revision, next, {
          intakeCommit: true,
        });
        assert.equal(result.ok, true);
        const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
        assert.equal(stored.revision, 1);
        if (harness) {
          assert.equal(harness.lastEvalScript, SESSION_AUTHORITY_CAS_LUA);
          const binding = decodeLedgerBindingArgs(harness.lastEvalArgs ?? []);
          assert.ok(binding);
          assert.equal(binding.endVersion, 1);
          assert.equal(binding.entryRaws[0], JSON.stringify(entry));
        }
      }, store);
    });

    await asyncTest(`C. Freeze entry with corrupted change_type but original entry_hash: integrity [${label}]`, async () => {
      const { store, kv, harness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`c-type:${label}`);
        const entry = await writeValidFreeze(kv, record.session_id);
        await writeLedgerEntry(kv, record.session_id, 1, { ...entry, change_type: "draft_update" });
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "ledger_integrity");
        const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
        assert.equal(stored.revision, record.revision);
        if (harness) assert.equal(harness.evalCalls, 0);
      }, store);
    });

    await asyncTest(`D. Freeze entry with corrupted dc_status but original entry_hash: integrity [${label}]`, async () => {
      const { store, kv, harness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`d-status:${label}`);
        const entry = await writeValidFreeze(kv, record.session_id);
        await writeLedgerEntry(kv, record.session_id, 1, { ...entry, dc_status: "draft" });
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "ledger_integrity");
        if (harness) assert.equal(harness.evalCalls, 0);
      }, store);
    });

    await asyncTest(`E. Corrupted entry_hash: rejected [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`e-hash:${label}`);
        const entry = await writeValidFreeze(kv, record.session_id);
        await writeLedgerEntry(kv, record.session_id, 1, { ...entry, entry_hash: "0".repeat(64) });
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "ledger_integrity");
      }, store);
    });

    await asyncTest(`F. Incorrect previous_entry_hash: rejected [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`f-prev:${label}`);
        const first = validTestLedgerEntry(record.session_id, 1);
        const second = validTestLedgerEntry(
          record.session_id,
          2,
          { change_type: "draft_update", dc_status: "draft" },
          "f".repeat(64),
        );
        await writeLedgerEntry(kv, record.session_id, 1, first);
        await writeLedgerEntry(kv, record.session_id, 2, second);
        await writeLedgerHint(kv, record.session_id, 2);
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "ledger_integrity");
        const inspectSecond = inspectLedgerEntryValue(second, record.session_id, 2);
        assert.equal(inspectSecond.kind, "ok");
      }, store);
    });

    await asyncTest(`G. Missing intermediate Ledger entry: fail closed [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`g-gap:${label}`);
        const first = validTestLedgerEntry(record.session_id, 1);
        const third = validTestLedgerEntry(record.session_id, 3, {}, String(first.entry_hash));
        await writeLedgerEntry(kv, record.session_id, 1, first);
        await writeLedgerEntry(kv, record.session_id, 3, third);
        await writeLedgerHint(kv, record.session_id, 3);
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

    await asyncTest(`H. Invalid commit_version sequence: fail closed [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`h-seq:${label}`);
        const first = validTestLedgerEntry(record.session_id, 1);
        const second = sealTestLedgerEntry({
          schema_version: DC_LEDGER_SCHEMA_VERSION,
          session_id: record.session_id,
          commit_version: 2,
          previous_commit_version: 0,
          previous_entry_hash: first.entry_hash,
          change_type: "draft_update",
          dc_status: "draft",
        });
        await writeLedgerEntry(kv, record.session_id, 1, first);
        await writeLedgerEntry(kv, record.session_id, 2, second);
        await writeLedgerHint(kv, record.session_id, 2);
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "ledger_integrity");
      }, store);
    });

    await asyncTest(`I. Invalid head hint that conceals an entry: fail closed [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`i-hint:${label}`);
        await writeValidFreeze(kv, record.session_id);
        await writeLedgerHint(kv, record.session_id, 9);
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "ledger_integrity");
        const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
        assert.equal(stored.revision, record.revision);
        assert.notEqual(reasonOf(result), "accepted");
        assert.notEqual(reasonOf(result), "frozen");
      }, store);
    });

    if (backend.isHarness) {
      await asyncTest(`J. Validated raw entry changes between pre-validation and EVAL: CAS rejects [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord("j-raw-changed");
          const entry = await writeValidNonFreeze(kv, record.session_id);
          harness!.onBeforeEval = () => {
            void kv.set(dcLedgerEntryKey(record.session_id, 1), { ...entry, change_type: "blueprint_update" });
          };
          const result = await store.compareAndSetDetailed(
            record.session_id,
            record.revision,
            bumpSnapshot(record),
            { intakeCommit: true },
          );
          assert.equal(reasonOf(result), "ledger_snapshot_changed");
          const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
          assert.equal(stored.revision, record.revision);
          assert.equal(harness!.lastEvalScript, SESSION_AUTHORITY_CAS_LUA);
        }, store);
      });

      await asyncTest(`K. New entry appears between pre-validation and EVAL: CAS rejects [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord("k-new-entry");
          const first = await writeValidNonFreeze(kv, record.session_id);
          const second = validTestLedgerEntry(record.session_id, 2, {}, String(first.entry_hash));
          harness!.onBeforeEval = () => {
            void kv.set(dcLedgerEntryKey(record.session_id, 2), second);
            void kv.set(dcLedgerHeadKey(record.session_id), { commit_version: 2 });
          };
          const result = await store.compareAndSetDetailed(
            record.session_id,
            record.revision,
            bumpSnapshot(record),
            { intakeCommit: true },
          );
          assert.equal(reasonOf(result), "ledger_snapshot_changed");
          const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
          assert.equal(stored.revision, record.revision);
        }, store);
      });

      await asyncTest(`L. New Freeze entry races Intake commit: Freeze is not silently missed [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord("l-race-freeze");
          const first = await writeValidNonFreeze(kv, record.session_id);
          const freeze = validTestLedgerEntry(
            record.session_id,
            2,
            { change_type: "freeze", dc_status: "final" },
            String(first.entry_hash),
          );
          harness!.onBeforeEval = () => {
            void kv.set(dcLedgerEntryKey(record.session_id, 2), freeze);
            void kv.set(dcLedgerHeadKey(record.session_id), { commit_version: 2 });
          };
          const result = await store.compareAndSetDetailed(
            record.session_id,
            record.revision,
            bumpSnapshot(record),
            { intakeCommit: true },
          );
          assert.ok(reasonOf(result) === "ledger_snapshot_changed" || reasonOf(result) === "frozen");
          assert.notEqual(reasonOf(result), "accepted");
          const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
          assert.equal(stored.revision, record.revision);
        }, store);
      });
    } else {
      await asyncTest("J/K/L. MemoryKv has no pre-validation-to-commit window; races are harness/Redis-path cases", async () => {
        assert.equal(backend.label, "MemoryKv");
      });
    }

    await asyncTest(`M. Probe limit exhaustion: fail closed [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`m-limit:${label}`);
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

    await asyncTest(`N. No Ledger genuinely exists: Intake remains eligible [${label}]`, async () => {
      const { store, kv, harness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`n-no-ledger:${label}`);
        const next = bumpSnapshot(record);
        const result = await store.compareAndSetDetailed(record.session_id, record.revision, next, {
          intakeCommit: true,
        });
        assert.equal(result.ok, true);
        const stored = (await peek(kv, serverSessionKey(record.session_id))) as ServerSessionRecord;
        assert.equal(stored.revision, 1);
        if (harness) {
          const binding = decodeLedgerBindingArgs(harness.lastEvalArgs ?? []);
          assert.ok(binding);
          assert.equal(binding.endVersion, 0);
          assert.equal(binding.entryRaws.length, 0);
        }
      }, store);
    });

    await asyncTest(`O. Existing Session integrity failures remain rejected [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`o-session:${label}`);
        const key = serverSessionKey(record.session_id);
        await kv.set(key, "this-is-not-json");
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "malformed");
        const stored = await peek(kv, key);
        assert.equal(stored, "this-is-not-json");
      }, store);
    });

    await asyncTest(`P. Existing Session lifecycle and revision conflicts remain correct [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`p-life:${label}`);
        const loser = bumpSnapshot(record);
        const winner = bumpSnapshot(record, {
          session_snapshot: { ...record.session_snapshot, original_question: "winner", session_revision: 1 },
        });
        assert.equal((await store.compareAndSetDetailed(record.session_id, 0, winner)).ok, true);
        const conflict = await store.compareAndSetDetailed(record.session_id, 0, loser);
        assert.equal(reasonOf(conflict), "cas_conflict");
        const current = await store.get(record.session_id);
        assert.ok(current);
        for (const [tag, patch, expected] of [
          ["expired", { expires_at: "2001-01-01T00:00:00.000Z", lifecycle_status: "expired" as const }, "expired"],
          ["frozen", { lifecycle_status: "frozen" as const }, "frozen"],
          ["terminated", { lifecycle_status: "terminated" as const }, "terminated"],
        ] as const) {
          const rec = await initRecord(`p-${tag}:${label}`);
          const live = await store.get(rec.session_id);
          assert.ok(live);
          const terminal: ServerSessionRecord = { ...live!, ...patch };
          assert.equal(await store.compareAndSet(rec.session_id, live!.revision, terminal), true);
          const result = await store.compareAndSetDetailed(rec.session_id, terminal.revision, bumpSnapshot(terminal), {
            intakeCommit: true,
          });
          assert.equal(reasonOf(result), expected);
        }
        void kv;
      }, store);
    });
  }

  await asyncTest("Q. Same-content idempotency remains successful without rerunning the model [MemoryKv]", async () => {
    const store = createKvSessionAuthorityStore(new MemoryKv());
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("q-idempotent-same");
        const before = modelCalls;
        const session = clientSessionFrom(record, {
          messages: [userMessage("same content", "turn_q1", { meta: { note: "first" } })],
        });
        const first = await postChatJson(session);
        const replay = await postChatJson({
          ...session,
          session_revision: 0,
          messages: [
            userMessage("same content", "turn_q1", {
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
        assert.equal(modelCalls - before, 1);
      });
    }, store);
  });

  await asyncTest("R. Different-content idempotency still returns session_turn_conflict [MemoryKv]", async () => {
    const store = createKvSessionAuthorityStore(new MemoryKv());
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("r-idempotent-conflict");
        const before = modelCalls;
        const first = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("original content", "turn_r1")] }),
        );
        assert.equal(first.status, 200);
        const conflict = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("tampered content", "turn_r1")] }),
        );
        assert.equal(conflict.status, 409);
        assert.equal(conflict.body.code, "session_turn_conflict");
        const current = await requireAuthoritativeSession(record.session_id);
        assert.equal(current.revision, 1);
        assert.equal(modelCalls - before, 1);
      });
    }, store);
  });

  await asyncTest("commitAuthoritativeSessionUpdate maps ledger_snapshot_changed without a generic CAS conflict", async () => {
    const harness = new RedisEvalHarness();
    const store = createKvSessionAuthorityStore(harness);
    await withStore(async () => {
      const record = await initRecord("commit-snapshot-changed");
      const entry = await writeValidNonFreeze(harness, record.session_id);
      harness.onBeforeEval = () => {
        void harness.set(dcLedgerEntryKey(record.session_id, 1), { ...entry, change_type: "user_confirm" });
      };
      await assert.rejects(
        () =>
          commitAuthoritativeSessionUpdate({
            sessionId: record.session_id,
            expectedRevision: record.revision,
            expectedGeneration: record.session_generation,
            snapshot: {
              ...record.session_snapshot,
              messages: [userMessage("should not commit", "turn_commit_changed")],
            },
            last_committed_turn_id: "turn_commit_changed",
          }),
        (error: unknown) =>
          error instanceof SessionAuthorityError &&
          error.code === "ledger_snapshot_changed" &&
          error.recoverable === true,
      );
      const still = await requireAuthoritativeSession(record.session_id);
      assert.equal(still.revision, 0);
    }, store);
  });

  await asyncTest("collectLedgerBindingSnapshot covers the chain, not only the head hint", async () => {
    const first = validTestLedgerEntry("sid-bind", 1);
    const second = validTestLedgerEntry("sid-bind", 2, { change_type: "freeze", dc_status: "final" }, String(first.entry_hash));
    const data = new Map<string, string>([
      [dcLedgerHeadKey("sid-bind"), JSON.stringify({ commit_version: 1 })],
      [dcLedgerEntryKey("sid-bind", 1), JSON.stringify(first)],
      [dcLedgerEntryKey("sid-bind", 2), JSON.stringify(second)],
    ]);
    const collected = await collectLedgerBindingSnapshot(async (keys) => keys.map((key) => data.get(key) ?? null), "sid-bind");
    assert.equal(collected.ok, true);
    if (collected.ok) {
      assert.equal(collected.snapshot.endVersion, 2);
      assert.equal(collected.snapshot.entryRaws.length, 2);
      assert.equal(collected.snapshot.frozen, true);
      const bind = evaluateLedgerRawBinding({
        ...collected.snapshot,
        liveHintRaw: data.get(dcLedgerHeadKey("sid-bind")) ?? null,
        liveEntryRaw: (version) => data.get(dcLedgerEntryKey("sid-bind", version)) ?? null,
      });
      assert.equal(bind.ok, true);
      if (bind.ok) assert.equal(bind.frozen, true);
      const encoded = encodeLedgerBindingArgs(collected.snapshot as LedgerBindingSnapshot);
      assert.equal(encoded[3], "2");
    }
  });

  console.log("S. Existing M9, M9-R1, and FU1 regressions are executed by the required command suite, not this file.");
  console.log("M9-R1-FU1-FU2 ledger integrity atomic binding checks complete");
  console.log(`REAL_REDIS_LUA_EXECUTED=${redis.available ? "yes" : "no"}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
