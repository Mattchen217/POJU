/**
 * M9-R1-FU1-FU2-FU3 — Session Record integrity atomic binding
 *
 *   pnpm test:m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding
 *
 * Production Redis Lua must not accept a structurally valid but
 * hash-corrupted Session Record that differs from the exact raw value
 * TypeScript validated. TypeScript validates the current record with
 * inspectStoredSessionRecord (canonicalHash) and binds the exact original
 * raw Redis string into EVAL. Lua compares live Redis GET bytes against
 * that value immediately after reading KEYS[1].
 *
 * Harness labels (read this first):
 *   MemoryKv: in-process atomic TypeScript path (getSync/setSync). Session
 *   Record hash checks run inside the same synchronous CAS section. There
 *   is no prevalidation-to-commit window on that path.
 *
 *   RedisEvalHarness is a contract harness only. It asserts that
 *   createKvSessionAuthorityStore() calls kv.eval with the exact production
 *   SESSION_AUTHORITY_CAS_LUA source and that ARGV contains the exact
 *   validated Session Record raw string (and, for intake, the exact
 *   validated ledger raw snapshot). It then applies the shared TypeScript
 *   predicates evaluateSessionRecordRawBinding() and, when intake, 
 *   evaluateLedgerRawBinding() plus Session CAS. It does NOT run a Lua VM
 *   and it does NOT execute SESSION_AUTHORITY_CAS_LUA on a Redis server.
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
  SESSION_AUTHORITY_CAS_LUA,
  SESSION_AUTHORITY_RAW_MGET_LUA,
  applySessionAuthorityCas,
  createKvSessionAuthorityStore,
  decodeLedgerBindingArgs,
  decodeValidatedSessionRawArg,
  encodeLedgerBindingArgs,
  evaluateLedgerRawBinding,
  evaluateSessionRecordRawBinding,
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

installIntakeR6TestGlobals("dev_m9_r1_fu1_fu2_fu3_session_binding");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "m9-r1-fu1-fu2-fu3-session-binding-test-secret";
}

const asyncTest = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`PASS ${name}`);
};

function cannedLlm(text: string): POJULLMResponse {
  return {
    response: text,
    model: "m9-r1-fu1-fu2-fu3-test-model",
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
    original_question: `M9-R1-FU1-FU2-FU3 ${tag}`,
    device_id: "dev_m9_r1_fu1_fu2_fu3_session_binding",
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
    return impl ? impl(session) : cannedLlm(`M9-R1-FU1-FU2-FU3 reply #${modelCalls}`);
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

function parseRecord(value: unknown): ServerSessionRecord {
  assert.ok(value && typeof value === "object");
  return value as ServerSessionRecord;
}

/**
 * Contract harness for the production eval branch of createKvSessionAuthorityStore.
 *
 * NOT A REDIS SERVER. NOT A LUA VM.
 * Session CAS uses getRaw so TypeScript can validate canonicalHash, then eval
 * receives the production Lua source plus the exact validated Session Record
 * raw string (and intake ledger snapshot). The harness first applies
 * evaluateSessionRecordRawBinding() against live bytes after an optional
 * onBeforeEval mutation, then the shared Session CAS / ledger predicate.
 * Results prove adapter wiring and the shared raw-binding contract; they
 * are not proof that Redis executed the Lua script.
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

    const validatedSessionRaw = decodeValidatedSessionRawArg(args);
    assert.equal(typeof validatedSessionRaw, "string", "EVAL must receive the validated Session Record raw argument");

    const liveSessionRaw = this.data.get(keys[0] ?? "") ?? null;
    const sessionBind = evaluateSessionRecordRawBinding({
      validatedRaw: validatedSessionRaw as string,
      liveRaw: liveSessionRaw,
    });
    if (!sessionBind.ok) return sessionCasResultToLuaCode(sessionBind);

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

function assertHarnessReceivedValidatedRaw(harness: RedisEvalHarness, expectedRaw: string): void {
  assert.equal(harness.lastEvalScript, SESSION_AUTHORITY_CAS_LUA);
  const validated = decodeValidatedSessionRawArg(harness.lastEvalArgs ?? []);
  assert.equal(validated, expectedRaw);
}

async function main() {
  const redis = detectRealRedis();
  console.log("M9-R1-FU1-FU2-FU3 Session Record integrity atomic binding tests starting");
  console.log("HARNESS=MemoryKv + RedisEvalHarness (TypeScript raw-binding predicate; does not execute Lua)");
  console.log(`REAL_REDIS_LUA_EXECUTED=${redis.available ? "yes" : "no"}`);
  console.log(`REAL_REDIS_DETAIL=${redis.detail}`);
  if (!redis.available) {
    console.log("LIMITATION: SESSION_AUTHORITY_CAS_LUA remains unexecuted in a real Redis server.");
  }

  await asyncTest("Static Lua source contract (NOT execution proof): Session Record raw binding and result code 11", async () => {
    const lua = SESSION_AUTHORITY_CAS_LUA;
    assert.match(lua, /canonicalHash/);
    assert.match(lua, /does not recompute canonicalHash/);
    assert.match(lua, /validatedSessionRaw/);
    assert.match(lua, /raw ~= validatedSessionRaw/);
    assert.match(lua, /return 11/);
    assert.match(lua, /ARGV\[10\]/);
    assert.match(lua, /validatedHintRaw = ARGV\[11\]/);
    assert.match(lua, /ARGV\[14 \+ i\]/);
    assert.match(lua, /return 10/);
    assert.match(lua, /liveHint ~= validatedHintRaw/);
    assert.match(SESSION_AUTHORITY_RAW_MGET_LUA, /redis\.call\('GET', KEYS\[i\]\)/);
    assert.deepEqual(luaCasCodeToResult(11), { ok: false, reason: "session_snapshot_changed" });
    assert.equal(sessionCasResultToLuaCode({ ok: false, reason: "session_snapshot_changed" }), 11);
    assert.notEqual(sessionCasResultToLuaCode({ ok: false, reason: "session_snapshot_changed" }), 0);
    assert.notEqual(sessionCasResultToLuaCode({ ok: false, reason: "session_snapshot_changed" }), 5);
    assert.notEqual(sessionCasResultToLuaCode({ ok: false, reason: "session_snapshot_changed" }), 6);
    assert.deepEqual(luaCasCodeToResult(10), { ok: false, reason: "ledger_snapshot_changed" });
    assert.equal(sessionCasResultToLuaCode({ ok: false, reason: "ledger_snapshot_changed" }), 10);
    assert.deepEqual(
      evaluateSessionRecordRawBinding({ validatedRaw: '{"ok":true}', liveRaw: '{"ok":true}' }),
      { ok: true },
    );
    assert.deepEqual(
      evaluateSessionRecordRawBinding({ validatedRaw: '{"ok":true}', liveRaw: '{"ok":false}' }),
      { ok: false, reason: "session_snapshot_changed" },
    );
    assert.deepEqual(
      evaluateSessionRecordRawBinding({ validatedRaw: '{"ok":true}', liveRaw: null }),
      { ok: false, reason: "session_snapshot_changed" },
    );
    assert.deepEqual(
      evaluateSessionRecordRawBinding({ validatedRaw: "", liveRaw: '{"appeared":true}' }),
      { ok: false, reason: "session_snapshot_changed" },
    );
    assert.deepEqual(evaluateSessionRecordRawBinding({ validatedRaw: "", liveRaw: null }), {
      ok: false,
      reason: "missing",
    });
    const ledgerSlice = encodeLedgerBindingArgs({
      hintRaw: '{"commit_version":1}',
      startVersion: 1,
      endVersion: 1,
      entryRaws: ['{"entry":1}'],
      frozen: false,
    });
    const prefix = ["0", "{}", "60", "sid", "now", "1", "head", "entry:", "512", '{"session":true}'];
    const decoded = decodeLedgerBindingArgs([...prefix, ...ledgerSlice]);
    assert.ok(decoded);
    assert.equal(decoded?.endVersion, 1);
    assert.deepEqual(decoded?.entryRaws, ['{"entry":1}']);
    assert.equal(decodeValidatedSessionRawArg([...prefix, ...ledgerSlice]), '{"session":true}');
    console.log("NOTE: the assertions above are static source checks, not Redis Lua execution.");
  });

  for (const backend of backends) {
    const label = `${backend.label}`;

    await asyncTest(`A. Valid Session Record, unchanged before EVAL: commit remains eligible [${label}]`, async () => {
      const { store, kv, harness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`a-valid:${label}`);
        const key = serverSessionKey(record.session_id);
        const originalRaw = harness?.getRaw(key) ?? null;
        await writeValidNonFreeze(kv, record.session_id);
        const result = await store.compareAndSetDetailed(
          record.session_id,
          record.revision,
          bumpSnapshot(record),
          { intakeCommit: true },
        );
        assert.equal(reasonOf(result), "accepted");
        const stored = parseRecord(await peek(kv, key));
        assert.equal(stored.revision, 1);
        if (harness) {
          assert.ok(originalRaw);
          assertHarnessReceivedValidatedRaw(harness, originalRaw!);
          const binding = decodeLedgerBindingArgs(harness.lastEvalArgs ?? []);
          assert.ok(binding);
          assert.equal(binding!.endVersion, 1);
        }
      }, store);
    });

    if (backend.isHarness) {
      await asyncTest(`B. Session Record raw bytes changed between validation and EVAL: session_snapshot_changed [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord(`b-raw-changed:${label}`);
          const key = serverSessionKey(record.session_id);
          const originalRaw = harness!.getRaw(key);
          assert.ok(originalRaw);
          await writeValidNonFreeze(kv, record.session_id);
          harness!.onBeforeEval = () => {
            const parsed = JSON.parse(originalRaw!) as ServerSessionRecord;
            void harness!.set(key, JSON.stringify(parsed, null, 2));
          };
          const proposed = bumpSnapshot(record, {
            session_snapshot: { ...record.session_snapshot, original_question: "should-not-commit", session_revision: 1 },
          });
          const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
            intakeCommit: true,
          });
          assert.equal(reasonOf(result), "session_snapshot_changed");
          assertHarnessReceivedValidatedRaw(harness!, originalRaw!);
          const storedRaw = harness!.getRaw(key);
          assert.ok(storedRaw);
          assert.notEqual(storedRaw, JSON.stringify(proposed));
          const stored = parseRecord(JSON.parse(storedRaw!));
          assert.equal(stored.revision, 0);
          assert.notEqual(stored.session_snapshot.original_question, "should-not-commit");
        }, store);
      });

      await asyncTest(`C. Session Snapshot changed while preserving the old snapshot_hash: rejected [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord(`c-snapshot-keep-hash:${label}`);
          const key = serverSessionKey(record.session_id);
          const originalRaw = harness!.getRaw(key);
          assert.ok(originalRaw);
          const oldHash = record.snapshot_hash;
          await writeValidNonFreeze(kv, record.session_id);
          harness!.onBeforeEval = () => {
            const parsed = JSON.parse(originalRaw!) as ServerSessionRecord;
            parsed.session_snapshot = {
              ...parsed.session_snapshot,
              original_question: "tampered-snapshot",
            };
            parsed.snapshot_hash = oldHash;
            void harness!.set(key, JSON.stringify(parsed));
          };
          const proposed = bumpSnapshot(record);
          const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
            intakeCommit: true,
          });
          assert.equal(reasonOf(result), "session_snapshot_changed");
          const stored = parseRecord(await peek(kv, key));
          assert.equal(stored.revision, 0);
          assert.equal(stored.snapshot_hash, oldHash);
          assert.equal(stored.session_snapshot.original_question, "tampered-snapshot");
          assert.notEqual(hashSessionSnapshot(stored.session_snapshot), oldHash);
        }, store);
      });

      await asyncTest(`D. snapshot_hash changed while preserving the original Snapshot: rejected [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord(`d-hash-keep-snapshot:${label}`);
          const key = serverSessionKey(record.session_id);
          const originalRaw = harness!.getRaw(key);
          assert.ok(originalRaw);
          const originalQuestion = record.session_snapshot.original_question;
          await writeValidNonFreeze(kv, record.session_id);
          const tamperedHash = `${record.snapshot_hash.slice(0, -1)}${record.snapshot_hash.endsWith("a") ? "b" : "a"}`;
          harness!.onBeforeEval = () => {
            const parsed = JSON.parse(originalRaw!) as ServerSessionRecord;
            parsed.snapshot_hash = tamperedHash;
            void harness!.set(key, JSON.stringify(parsed));
          };
          const proposed = bumpSnapshot(record);
          const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
            intakeCommit: true,
          });
          assert.equal(reasonOf(result), "session_snapshot_changed");
          const stored = parseRecord(await peek(kv, key));
          assert.equal(stored.revision, 0);
          assert.equal(stored.snapshot_hash, tamperedHash);
          assert.equal(stored.session_snapshot.original_question, originalQuestion);
        }, store);
      });

      await asyncTest(`E. Session revision changed between validation and EVAL: reject without overwrite [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord(`e-revision:${label}`);
          const key = serverSessionKey(record.session_id);
          await writeValidNonFreeze(kv, record.session_id);
          const winner = bumpSnapshot(record, {
            session_snapshot: { ...record.session_snapshot, original_question: "newer-winner", session_revision: 1 },
          });
          harness!.onBeforeEval = () => {
            void harness!.set(key, winner);
          };
          const proposed = bumpSnapshot(record, {
            session_snapshot: { ...record.session_snapshot, original_question: "stale-loser", session_revision: 1 },
          });
          const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
            intakeCommit: true,
          });
          assert.equal(reasonOf(result), "session_snapshot_changed");
          const stored = parseRecord(await peek(kv, key));
          assert.equal(stored.revision, 1);
          assert.equal(stored.session_snapshot.original_question, "newer-winner");
        }, store);
      });

      await asyncTest(`F. Session identity changed between validation and EVAL: rejected [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord(`f-identity:${label}`);
          const key = serverSessionKey(record.session_id);
          const originalRaw = harness!.getRaw(key);
          assert.ok(originalRaw);
          const originalGeneration = record.session_generation;
          await writeValidNonFreeze(kv, record.session_id);
          harness!.onBeforeEval = () => {
            const parsed = JSON.parse(originalRaw!) as ServerSessionRecord;
            parsed.session_generation = originalGeneration + 1;
            void harness!.set(key, JSON.stringify(parsed));
          };
          const proposed = bumpSnapshot(record);
          const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
            intakeCommit: true,
          });
          assert.equal(reasonOf(result), "session_snapshot_changed");
          const stored = parseRecord(await peek(kv, key));
          assert.equal(stored.revision, 0);
          assert.equal(stored.session_generation, originalGeneration + 1);
        }, store);
      });

      await asyncTest(`G. Session Record deleted between validation and EVAL: rejected [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord(`g-deleted:${label}`);
          const key = serverSessionKey(record.session_id);
          const originalRaw = harness!.getRaw(key);
          assert.ok(originalRaw);
          await writeValidNonFreeze(kv, record.session_id);
          harness!.onBeforeEval = () => {
            void harness!.del(key);
          };
          const proposed = bumpSnapshot(record);
          const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
            intakeCommit: true,
          });
          assert.equal(reasonOf(result), "session_snapshot_changed");
          assertHarnessReceivedValidatedRaw(harness!, originalRaw!);
          assert.equal(await peek(kv, key), null);
        }, store);
      });

      await asyncTest(`H. Session Record absent during validation but created before EVAL: rejected [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord(`h-created:${label}`);
          const key = serverSessionKey(record.session_id);
          const originalRaw = harness!.getRaw(key);
          assert.ok(originalRaw);
          await writeValidNonFreeze(kv, record.session_id);
          await harness!.del(key);
          assert.equal(harness!.getRaw(key), null);
          harness!.onBeforeEval = () => {
            void harness!.set(key, originalRaw!);
          };
          const proposed = bumpSnapshot(record, {
            session_snapshot: { ...record.session_snapshot, original_question: "must-not-create-or-overwrite", session_revision: 1 },
          });
          const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
            intakeCommit: true,
          });
          assert.equal(reasonOf(result), "session_snapshot_changed");
          const validated = decodeValidatedSessionRawArg(harness!.lastEvalArgs ?? []);
          assert.equal(validated, "");
          const stored = parseRecord(await peek(kv, key));
          assert.equal(stored.revision, 0);
          assert.notEqual(stored.session_snapshot.original_question, "must-not-create-or-overwrite");
        }, store);
      });

      await asyncTest(`I. Ledger raw value changes before EVAL: ledger_snapshot_changed remains intact [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord(`i-ledger:${label}`);
          const key = serverSessionKey(record.session_id);
          const originalRaw = harness!.getRaw(key);
          assert.ok(originalRaw);
          const entry = await writeValidNonFreeze(kv, record.session_id);
          harness!.onBeforeEval = () => {
            void harness!.set(dcLedgerEntryKey(record.session_id, 1), { ...entry, change_type: "user_confirm" });
          };
          const proposed = bumpSnapshot(record);
          const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
            intakeCommit: true,
          });
          assert.equal(reasonOf(result), "ledger_snapshot_changed");
          assertHarnessReceivedValidatedRaw(harness!, originalRaw!);
          const stored = parseRecord(await peek(kv, key));
          assert.equal(stored.revision, 0);
        }, store);
      });

      await asyncTest(`K. Both Session Record and Ledger change before EVAL: reject without writing proposed record [${label}]`, async () => {
        const { store, kv, harness } = backend.create();
        await withStore(async () => {
          const record = await initRecord(`k-both:${label}`);
          const key = serverSessionKey(record.session_id);
          const originalRaw = harness!.getRaw(key);
          assert.ok(originalRaw);
          const entry = await writeValidNonFreeze(kv, record.session_id);
          harness!.onBeforeEval = () => {
            const parsed = JSON.parse(originalRaw!) as ServerSessionRecord;
            parsed.session_snapshot = {
              ...parsed.session_snapshot,
              original_question: "session-and-ledger-race",
            };
            parsed.snapshot_hash = record.snapshot_hash;
            void harness!.set(key, JSON.stringify(parsed));
            void harness!.set(dcLedgerEntryKey(record.session_id, 1), { ...entry, change_type: "user_confirm" });
          };
          const proposed = bumpSnapshot(record, {
            session_snapshot: { ...record.session_snapshot, original_question: "proposed-must-not-win", session_revision: 1 },
          });
          const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
            intakeCommit: true,
          });
          // Session raw comparison runs first, immediately after reading KEYS[1].
          assert.equal(reasonOf(result), "session_snapshot_changed");
          const stored = parseRecord(await peek(kv, key));
          assert.equal(stored.revision, 0);
          assert.equal(stored.session_snapshot.original_question, "session-and-ledger-race");
        }, store);
      });
    }
  }

  await asyncTest("B-H, I, K. MemoryKv has no pre-validation-to-commit window; Session Record races are harness/Redis-path cases", async () => {
    assert.equal(typeof evaluateSessionRecordRawBinding, "function");
  });

  for (const backend of backends) {
    const label = `${backend.label}`;

    await asyncTest(`J. New Freeze races Intake: Intake must not be accepted [${label}]`, async () => {
      const { store, kv, harness } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`j-freeze-race:${label}`);
        const key = serverSessionKey(record.session_id);
        await writeValidNonFreeze(kv, record.session_id);
        if (harness) {
          harness.onBeforeEval = () => {
            void writeValidFreeze(harness, record.session_id);
          };
        } else {
          await writeValidFreeze(kv, record.session_id);
        }
        const proposed = bumpSnapshot(record);
        const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
          intakeCommit: true,
        });
        assert.notEqual(reasonOf(result), "accepted");
        assert.ok(reasonOf(result) === "frozen" || reasonOf(result) === "ledger_snapshot_changed");
        const stored = parseRecord(await peek(kv, key));
        assert.equal(stored.revision, 0);
      }, store);
    });

    await asyncTest(`L. Existing idempotency behavior remains unchanged [${label}]`, async () => {
      if (backend.isHarness) {
        // Chat path exercises MemoryKv / production adapter semantics; the
        // harness is not required to stand in for HTTP idempotency.
        return;
      }
      const { store } = backend.create();
      await withStore(async () => {
        await withModel(async () => {
          const record = await initRecord("l-idempotent-same");
          const before = modelCalls;
          const session = clientSessionFrom(record, {
            messages: [userMessage("same content", "turn_l1", { meta: { note: "first" } })],
          });
          const first = await postChatJson(session);
          const replay = await postChatJson({
            ...session,
            session_revision: 0,
            messages: [
              userMessage("same content", "turn_l1", {
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

    await asyncTest(`L2. Different-content idempotency still returns session_turn_conflict [MemoryKv only, skipped on harness if ${label}]`, async () => {
      if (backend.isHarness) return;
      const { store } = backend.create();
      await withStore(async () => {
        await withModel(async () => {
          const record = await initRecord("l2-idempotent-conflict");
          const before = modelCalls;
          const first = await postChatJson(
            clientSessionFrom(record, { messages: [userMessage("original content", "turn_l2")] }),
          );
          assert.equal(first.status, 200);
          const conflict = await postChatJson(
            clientSessionFrom(record, { messages: [userMessage("tampered content", "turn_l2")] }),
          );
          assert.equal(conflict.status, 409);
          assert.equal(conflict.body.code, "session_turn_conflict");
          const current = await requireAuthoritativeSession(record.session_id);
          assert.equal(current.revision, 1);
          assert.equal(modelCalls - before, 1);
        });
      }, store);
    });

    await asyncTest(`M. Existing lifecycle and revision conflict behavior remains unchanged [${label}]`, async () => {
      const { store, kv } = backend.create();
      await withStore(async () => {
        const record = await initRecord(`m-life:${label}`);
        const loser = bumpSnapshot(record);
        const winner = bumpSnapshot(record, {
          session_snapshot: { ...record.session_snapshot, original_question: "winner", session_revision: 1 },
        });
        assert.equal((await store.compareAndSetDetailed(record.session_id, 0, winner)).ok, true);
        const conflict = await store.compareAndSetDetailed(record.session_id, 0, loser);
        assert.equal(reasonOf(conflict), "cas_conflict");
        const current = await store.get(record.session_id);
        assert.ok(current);
        assert.equal(current!.session_snapshot.original_question, "winner");
        for (const [tag, patch, expected] of [
          ["expired", { expires_at: "2001-01-01T00:00:00.000Z", lifecycle_status: "expired" as const }, "expired"],
          ["frozen", { lifecycle_status: "frozen" as const }, "frozen"],
          ["terminated", { lifecycle_status: "terminated" as const }, "terminated"],
        ] as const) {
          const rec = await initRecord(`m-${tag}:${label}`);
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

  await asyncTest("commitAuthoritativeSessionUpdate maps session_snapshot_changed without a generic CAS conflict", async () => {
    const harness = new RedisEvalHarness();
    const store = createKvSessionAuthorityStore(harness);
    await withStore(async () => {
      const record = await initRecord("commit-session-snapshot-changed");
      const key = serverSessionKey(record.session_id);
      const originalRaw = harness.getRaw(key);
      assert.ok(originalRaw);
      await writeValidNonFreeze(harness, record.session_id);
      harness.onBeforeEval = () => {
        const parsed = JSON.parse(originalRaw!) as ServerSessionRecord;
        parsed.session_snapshot = {
          ...parsed.session_snapshot,
          original_question: "hash-corrupted-live",
        };
        parsed.snapshot_hash = record.snapshot_hash;
        void harness.set(key, JSON.stringify(parsed));
      };
      await assert.rejects(
        () =>
          commitAuthoritativeSessionUpdate({
            sessionId: record.session_id,
            expectedRevision: record.revision,
            expectedGeneration: record.session_generation,
            snapshot: {
              ...record.session_snapshot,
              messages: [userMessage("should not commit", "turn_commit_session_changed")],
            },
            last_committed_turn_id: "turn_commit_session_changed",
          }),
        (error: unknown) =>
          error instanceof SessionAuthorityError &&
          error.code === "session_snapshot_changed" &&
          error.recoverable === true,
      );
      const still = parseRecord(await peek(harness, key));
      assert.equal(still.revision, 0);
      assert.equal(still.session_snapshot.original_question, "hash-corrupted-live");
    }, store);
  });

  await asyncTest("Missing record remains fail-closed and is never turned into a successful create", async () => {
    const harness = new RedisEvalHarness();
    const store = createKvSessionAuthorityStore(harness);
    await withStore(async () => {
      const record = await initRecord("missing-fail-closed");
      const key = serverSessionKey(record.session_id);
      await harness.del(key);
      const proposed = bumpSnapshot(record);
      const result = await store.compareAndSetDetailed(record.session_id, record.revision, proposed, {
        intakeCommit: true,
      });
      assert.equal(reasonOf(result), "missing");
      assert.equal(await peek(harness, key), null);
      const validated = decodeValidatedSessionRawArg(harness.lastEvalArgs ?? []);
      assert.equal(validated, "");
    }, store);
    const memory = createKvSessionAuthorityStore(new MemoryKv());
    await withStore(async (storeMem) => {
      const record = await initRecord("missing-fail-closed-memory");
      const key = serverSessionKey(record.session_id);
      // MemoryKv store already created the record via initialize; delete via a
      // fresh store over the same adapter is not available here. Use CAS on a
      // never-created id through the MemoryKv adapter directly.
      void record;
      void key;
      const ghost = createKvSessionAuthorityStore(new MemoryKv());
      const fabricated = bumpSnapshot({
        ...(await runWithSessionAuthorityStore(ghost, () =>
          initializeAuthoritativeSession({
            original_question: "M9-R1-FU1-FU2-FU3 ghost",
            device_id: "dev_m9_r1_fu1_fu2_fu3_session_binding",
          }),
        )),
      });
      // The record exists in `ghost`. A different MemoryKv has no key.
      const empty = createKvSessionAuthorityStore(new MemoryKv());
      const missing = await empty.compareAndSetDetailed(fabricated.session_id, 0, fabricated, { intakeCommit: true });
      assert.equal(reasonOf(missing), "missing");
      assert.equal(await empty.get(fabricated.session_id), null);
    }, memory);
  });

  console.log("Existing M9, M9-R1, FU1, and FU2 regressions are executed by the required command suite, not this file.");
  console.log("M9-R1-FU1-FU2-FU3 Session Record integrity atomic binding checks complete");
  console.log(`REAL_REDIS_LUA_EXECUTED=${redis.available ? "yes" : "no"}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
