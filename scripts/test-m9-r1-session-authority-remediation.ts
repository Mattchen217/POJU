/**
 * M9-R1 ? Session Authority remediation
 *
 *   pnpm test:m9-r1-session-authority-remediation
 *
 * Covers the independent-review findings: terminal commit race, idempotency
 * content binding, record integrity, and the production CAS contract.
 * Production entries (POST /api/poju/chat, POST /api/poju/session,
 * createPojuChatStreamResponse) and createKvSessionAuthorityStore are used
 * at the adapter boundary. Model calls are stubbed. Live Upstash is not used.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import type { POJULLMResponse } from "../lib/llm/poju-llm";
import type { POJUMessage, POJUSessionState } from "../lib/poju/types";
import { POST as postChat } from "../app/api/poju/chat/route";
import { POST as postSession } from "../app/api/poju/session/route";
import { MemoryKv, isRemoteKvConfigured } from "../lib/kv/memory-kv";
import { canonicalHash, normalizeJson } from "../lib/poju/decision-authority/hash";
import {
  dcLedgerEntryKey,
  dcLedgerHeadKey,
} from "../lib/poju/decision-authority/server/ledger-store";
import { DC_LEDGER_SCHEMA_VERSION } from "../lib/poju/decision-authority/types";
import {
  SERVER_SESSION_TTL_SECONDS,
  SESSION_AUTHORITY_CAS_LUA,
  SessionRecordIntegrityError,
  applySessionAuthorityCas,
  createKvSessionAuthorityStore,
  createMemorySessionAuthorityStore,
  inspectStoredSessionRecord,
  runWithSessionAuthorityStore,
  sessionCasResultToLuaCode,
  type SessionAuthorityStore,
  type SessionCasResult,
} from "../lib/poju/session-authority/store";
import {
  SessionAuthorityError,
  commitAuthoritativeSessionUpdate,
  extractIncomingUserTurn,
  hashSessionSnapshot,
  initializeAuthoritativeSession,
  requireAuthoritativeSession,
} from "../lib/poju/session-authority/lifecycle";
import { runWithAuthoritativeChatTestHooks, runWithTestChatModel } from "../lib/poju/session-authority/chat-hooks";
import { mergeAnswerInterpretationTestHooks } from "./fixtures/test-answer-interpretation-hook";
import type { ServerSessionRecord } from "../lib/poju/session-authority/types";
import { serverSessionKey } from "../lib/poju/session-authority/types";

installIntakeR6TestGlobals("dev_m9_r1_session_authority");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "m9-r1-session-authority-test-secret";
}

const asyncTest = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`PASS ${name}`);
};

function cannedLlm(text: string): POJULLMResponse {
  return {
    response: text,
    model: "m9-r1-test-model",
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
    original_question: `M9-R1 ${tag}`,
    device_id: "dev_m9_r1_session_authority",
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
    return impl ? impl(session) : cannedLlm(`M9-R1 reply #${modelCalls}`);
  }, fn);
}

async function replaceRecord(sessionId: string, next: ServerSessionRecord): Promise<boolean> {
  const { getSessionAuthorityStore } = await import("../lib/poju/session-authority/store");
  const current = await requireAuthoritativeSession(sessionId);
  return getSessionAuthorityStore().compareAndSet(sessionId, current.revision, next);
}

function bumpSnapshot(record: ServerSessionRecord, patch: Partial<ServerSessionRecord>): ServerSessionRecord {
  const session_snapshot = patch.session_snapshot ?? {
    ...record.session_snapshot,
    session_revision: (patch.revision ?? record.revision + 1),
  };
  const revision = patch.revision ?? record.revision + 1;
  session_snapshot.session_revision = revision;
  return {
    ...record,
    ...patch,
    revision,
    session_snapshot,
    snapshot_hash: hashSessionSnapshot(session_snapshot),
  };
}

async function writeLedgerFreeze(kv: MemoryKv | RedisEvalHarness, sessionId: string): Promise<void> {
  const rest = normalizeJson({
    schema_version: DC_LEDGER_SCHEMA_VERSION,
    change_type: "freeze",
    dc_status: "final",
    commit_version: 1,
    previous_commit_version: null,
    previous_entry_hash: null,
    session_id: sessionId,
  }) as Record<string, unknown>;
  const entry = { ...rest, entry_hash: canonicalHash(rest) };
  await kv.set(dcLedgerEntryKey(sessionId, 1), entry);
  await kv.set(dcLedgerHeadKey(sessionId), { commit_version: 1 });
}

/**
 * Contract harness for the production eval branch of createKvSessionAuthorityStore.
 * It refuses compareAndSetExact / getSync so the adapter must call kv.eval with
 * SESSION_AUTHORITY_CAS_LUA. The harness asserts it received that production
 * Lua source, then executes the shared production CAS predicate used to
 * translate the script. This is not a live Redis or Lua VM.
 */
class RedisEvalHarness {
  private readonly data = new Map<string, string>();
  lastEvalScript: string | null = null;
  lastEvalTtl: string | null = null;

  getRaw(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = this.data.get(key);
    return raw == null ? null : (JSON.parse(raw) as T);
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
        return raw == null ? null : JSON.parse(raw);
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

async function main() {
  console.log("M9-R1 session authority remediation tests starting");
  console.log(
    `live_upstash_configured=${isRemoteKvConfigured() ? "yes" : "no"} (tests use in-process MemoryKv / eval harness only)`,
  );

  await asyncTest("A. Session Frozen during model execution; commit is rejected", async () => {
    await withStore(async () => {
      const record = await initRecord("a-freeze-during-model");
      let proceed!: () => void;
      const gate = new Promise<void>((resolve) => {
        proceed = resolve;
      });
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const pending = withModel(
        () =>
          postChatJson(
            clientSessionFrom(record, { messages: [userMessage("in flight freeze", "turn_a1")] }),
          ),
        async () => {
          entered();
          await gate;
          return cannedLlm("should-not-commit-frozen");
        },
      );
      await started;
      assert.equal(
        await replaceRecord(record.session_id, { ...record, lifecycle_status: "frozen" }),
        true,
      );
      proceed();
      const result = await pending;
      assert.equal(result.status, 409);
      assert.equal(result.body.code, "session_frozen");
      const still = await requireAuthoritativeSession(record.session_id);
      assert.equal(still.revision, 0);
      assert.equal(still.lifecycle_status, "frozen");
      assert.equal(still.session_snapshot.messages.length, 0);
      assert.equal(still.last_committed_turn_id, null);
    });
  });

  await asyncTest("B. Session Terminated during model execution; commit is rejected", async () => {
    await withStore(async () => {
      const record = await initRecord("b-terminate-during-model");
      let proceed!: () => void;
      const gate = new Promise<void>((resolve) => {
        proceed = resolve;
      });
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const pending = withModel(
        () =>
          postChatJson(
            clientSessionFrom(record, { messages: [userMessage("in flight terminate", "turn_b1")] }),
          ),
        async () => {
          entered();
          await gate;
          return cannedLlm("should-not-commit-terminated");
        },
      );
      await started;
      assert.equal(
        await replaceRecord(record.session_id, { ...record, lifecycle_status: "terminated" }),
        true,
      );
      proceed();
      const result = await pending;
      assert.equal(result.status, 409);
      assert.equal(result.body.code, "session_terminated");
      const still = await requireAuthoritativeSession(record.session_id);
      assert.equal(still.revision, 0);
      assert.equal(still.lifecycle_status, "terminated");
      assert.equal(still.session_snapshot.messages.length, 0);
    });
  });

  await asyncTest("C. Session expires during model execution; commit is rejected", async () => {
    await withStore(async () => {
      const record = await initRecord("c-expire-during-model");
      let proceed!: () => void;
      const gate = new Promise<void>((resolve) => {
        proceed = resolve;
      });
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const pending = withModel(
        () =>
          postChatJson(
            clientSessionFrom(record, { messages: [userMessage("in flight expire", "turn_c1")] }),
          ),
        async () => {
          entered();
          await gate;
          return cannedLlm("should-not-commit-expired");
        },
      );
      await started;
      assert.equal(
        await replaceRecord(record.session_id, {
          ...record,
          expires_at: "2000-01-01T00:00:00.000Z",
          lifecycle_status: "expired",
        }),
        true,
      );
      proceed();
      const result = await pending;
      assert.equal(result.status, 409);
      assert.equal(result.body.code, "session_expired");
      const still = await requireAuthoritativeSession(record.session_id);
      assert.equal(still.revision, 0);
      assert.equal(still.expires_at, "2000-01-01T00:00:00.000Z");
      assert.equal(still.session_snapshot.messages.length, 0);
    });
  });

  await asyncTest("D. Concurrent Freeze and Session CAS cannot commit an Intake turn after Freeze", async () => {
    const kv = new MemoryKv();
    const store = createKvSessionAuthorityStore(kv);
    await withStore(async () => {
      const record = await initRecord("d-freeze-cas-race");
      let proceed!: () => void;
      const gate = new Promise<void>((resolve) => {
        proceed = resolve;
      });
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const pending = withModel(
        () =>
          postChatJson(
            clientSessionFrom(record, { messages: [userMessage("intake after freeze", "turn_d1")] }),
          ),
        async () => {
          entered();
          await gate;
          return cannedLlm("illegal-if-committed");
        },
      );
      await started;
      // Freeze independently of Session revision: ledger keys only, same KV as the Session record.
      await writeLedgerFreeze(kv, record.session_id);
      proceed();
      const result = await pending;
      assert.equal(result.status, 409);
      assert.equal(result.body.code, "session_frozen");
      const still = await requireAuthoritativeSession(record.session_id);
      assert.equal(still.revision, 0);
      assert.equal(still.session_snapshot.messages.some((m) => m.content === "intake after freeze"), false);
      assert.equal(still.last_committed_turn_id, null);
      // Illegal outcome: ledger already frozen AND an intake turn committed into a valid session.
      assert.notEqual(still.lifecycle_status === "active" && still.revision > 0, true);
    }, store);
  });

  await asyncTest("E. Same turn ID + same content is idempotent", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("e-idempotent-same");
        const before = modelCalls;
        const session = clientSessionFrom(record, {
          messages: [userMessage("same content", "turn_e1", { meta: { note: "first" } })],
        });
        const first = await postChatJson(session);
        const replay = await postChatJson({
          ...session,
          session_revision: 0,
          messages: [userMessage("same content", "turn_e1", { meta: { note: "edited-meta" }, timestamp: "2099-01-01T00:00:00.000Z" })],
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

  await asyncTest("F. Same turn ID + different content is a conflict", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("f-idempotent-conflict");
        const before = modelCalls;
        const first = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("original content", "turn_f1")] }),
        );
        assert.equal(first.status, 200);
        const conflict = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("tampered content", "turn_f1")] }),
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

  await asyncTest("G. Replaying the same turn does not call the model again", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("g-replay-no-model");
        const before = modelCalls;
        const session = clientSessionFrom(record, { messages: [userMessage("replay me", "turn_g1")] });
        const first = await postChatJson(session);
        const second = await postChatJson(session);
        const third = await postChatJson(session, { expected_revision: 99, user_message: "replay me", client_turn_id: "turn_g1" });
        assert.equal(first.status, 200);
        assert.equal(second.status, 200);
        assert.equal(third.status, 200);
        assert.equal(second.body.turn_idempotent, true);
        assert.equal(third.body.turn_idempotent, true);
        assert.equal(modelCalls - before, 1);
        const current = await requireAuthoritativeSession(record.session_id);
        assert.equal(current.revision, 1);
      });
    });
  });

  await asyncTest("H. Record session_id vs storage key mismatch fails closed", async () => {
    const kv = new MemoryKv();
    const store = createKvSessionAuthorityStore(kv);
    await withStore(async () => {
      const record = await initRecord("h-id-mismatch");
      await kv.set(serverSessionKey(record.session_id), { ...record, session_id: "other-session-id" });
      await assert.rejects(
        () => store.get(record.session_id),
        (error: unknown) => error instanceof SessionRecordIntegrityError,
      );
      await assert.rejects(
        () => requireAuthoritativeSession(record.session_id),
        (error: unknown) => error instanceof SessionAuthorityError && error.code === "invalid_session_record",
      );
      const viaApi = await postSession(
        new Request("http://localhost/api/poju/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get", session_id: record.session_id }),
        }),
      );
      assert.equal(viaApi.status, 409);
      const body = (await viaApi.json()) as { code?: string };
      assert.equal(body.code, "invalid_session_record");
      const created = await store.createNx({ ...record, snapshot_hash: record.snapshot_hash });
      assert.equal(created, false, "corrupt record must not be treated as missing and re-initialized");
    }, store);
  });

  await asyncTest("I. Snapshot session_id vs Record mismatch fails closed", async () => {
    const kv = new MemoryKv();
    const store = createKvSessionAuthorityStore(kv);
    await withStore(async () => {
      const record = await initRecord("i-snapshot-id");
      const damaged = {
        ...record,
        session_snapshot: { ...record.session_snapshot, session_id: "mismatched-snapshot" },
      };
      await kv.set(serverSessionKey(record.session_id), damaged);
      await assert.rejects(() => store.get(record.session_id), (error: unknown) => error instanceof SessionRecordIntegrityError);
      const chat = await postChatJson(
        clientSessionFrom(record, { messages: [userMessage("hello", "turn_i1")] }),
      );
      assert.equal(chat.status, 409);
      assert.equal(chat.body.code, "invalid_session_record");
    }, store);
  });

  await asyncTest("J. Snapshot hash mismatch fails closed", async () => {
    const kv = new MemoryKv();
    const store = createKvSessionAuthorityStore(kv);
    await withStore(async () => {
      const record = await initRecord("j-hash-mismatch");
      await kv.set(serverSessionKey(record.session_id), { ...record, snapshot_hash: "0".repeat(64) });
      await assert.rejects(() => store.get(record.session_id), (error: unknown) => error instanceof SessionRecordIntegrityError);
      await assert.rejects(
        () => requireAuthoritativeSession(record.session_id),
        (error: unknown) => error instanceof SessionAuthorityError && error.code === "invalid_session_record",
      );
    }, store);
  });

  await asyncTest("K. Revision vs snapshot revision mismatch fails closed", async () => {
    const kv = new MemoryKv();
    const store = createKvSessionAuthorityStore(kv);
    await withStore(async () => {
      const record = await initRecord("k-rev-mismatch");
      await kv.set(serverSessionKey(record.session_id), { ...record, revision: record.revision + 1 });
      await assert.rejects(() => store.get(record.session_id), (error: unknown) => error instanceof SessionRecordIntegrityError);
      const missing = inspectStoredSessionRecord("no-such-session", null);
      assert.equal(missing, null);
    }, store);
  });

  await asyncTest("L. CAS revision race: loser does not overwrite winner (MemoryKv and eval harness)", async () => {
    async function raceOn(store: SessionAuthorityStore) {
      const record = await initRecord("l-cas-race");
      const winnerSnap = { ...record.session_snapshot, session_revision: 1, original_question: "winner-question" };
      const loserSnap = { ...record.session_snapshot, session_revision: 1, original_question: "loser-question" };
      const winnerNext = {
        ...record,
        revision: 1,
        session_snapshot: winnerSnap,
        snapshot_hash: hashSessionSnapshot(winnerSnap),
      };
      const loserNext = {
        ...record,
        revision: 1,
        session_snapshot: loserSnap,
        snapshot_hash: hashSessionSnapshot(loserSnap),
      };
      const [a, b] = await Promise.all([
        store.compareAndSet(record.session_id, 0, winnerNext),
        store.compareAndSet(record.session_id, 0, loserNext),
      ]);
      assert.equal([a, b].filter(Boolean).length, 1);
      const current = await store.get(record.session_id);
      assert.ok(current);
      assert.equal(current!.revision, 1);
      assert.equal(current!.session_snapshot.original_question, a ? "winner-question" : "loser-question");
      const lost = a ? "loser-question" : "winner-question";
      assert.notEqual(current!.session_snapshot.original_question, a && b ? lost : undefined);
      assert.notEqual(current!.session_snapshot.original_question, a || b ? (a ? "loser-question" : "winner-question") : "");
    }
    await withStore(async (store) => {
      await raceOn(store);
    });
    const harness = new RedisEvalHarness();
    const evalStore = createKvSessionAuthorityStore(harness);
    await withStore(async (store) => {
      await raceOn(store);
      assert.equal(harness.lastEvalScript, SESSION_AUTHORITY_CAS_LUA);
      assert.equal(harness.lastEvalTtl, String(SERVER_SESSION_TTL_SECONDS));
    }, evalStore);
  });

  await asyncTest("M. CAS does not recreate a Session that no longer exists", async () => {
    const kv = new MemoryKv();
    const store = createKvSessionAuthorityStore(kv);
    await withStore(async () => {
      const record = await initRecord("m-no-recreate");
      const key = serverSessionKey(record.session_id);
      await kv.del(key);
      const next = bumpSnapshot(record, { revision: 1 });
      const result = await store.compareAndSetDetailed(record.session_id, 0, next);
      assert.equal(result.ok, false);
      assert.equal(result.ok ? "" : result.reason, "missing");
      const got = await store.get(record.session_id);
      assert.equal(got, null);
      await assert.rejects(
        () => requireAuthoritativeSession(record.session_id),
        (error: unknown) => error instanceof SessionAuthorityError && error.code === "session_not_found",
      );
    }, store);

    const harness = new RedisEvalHarness();
    const evalStore = createKvSessionAuthorityStore(harness);
    await withStore(async () => {
      const record = await initRecord("m-no-recreate-eval");
      await harness.del(serverSessionKey(record.session_id));
      const next = bumpSnapshot(record, { revision: 1 });
      const result = await evalStore.compareAndSetDetailed(record.session_id, 0, next);
      assert.equal(result.ok, false);
      assert.equal(result.ok ? "" : result.reason, "missing");
      assert.equal(await evalStore.get(record.session_id), null);
    }, evalStore);
  });

  await asyncTest("N. After Expiry / Freeze / Terminate, no new turn can be committed", async () => {
    await withStore(async () => {
      await withModel(async () => {
        for (const [tag, patch, code] of [
          ["n-expired", { expires_at: "2001-01-01T00:00:00.000Z", lifecycle_status: "expired" as const }, "session_expired"],
          ["n-frozen", { lifecycle_status: "frozen" as const }, "session_frozen"],
          ["n-terminated", { lifecycle_status: "terminated" as const }, "session_terminated"],
        ] as const) {
          const record = await initRecord(tag);
          assert.equal(await replaceRecord(record.session_id, { ...record, ...patch }), true);
          const result = await postChatJson(
            clientSessionFrom(record, { messages: [userMessage("new after terminal", `turn_${tag}`)] }),
          );
          assert.equal(result.status, 409);
          assert.equal(result.body.code, code);
          const still = await requireAuthoritativeSession(record.session_id);
          assert.equal(still.revision, 0);
          assert.equal(still.session_snapshot.messages.length, 0);
        }
      });
    });
  });

  await asyncTest("CAS contract: generation, session id, expires_at, and backward revision are rejected", async () => {
    async function assertContract(store: SessionAuthorityStore) {
      const record = await initRecord("cas-contract");
      const base = bumpSnapshot(record, { revision: 1 });
      const gen = await store.compareAndSetDetailed(record.session_id, 0, { ...base, session_generation: 99 });
      assert.equal(gen.ok, false);
      const idChange: ServerSessionRecord = {
        ...base,
        session_id: "hijacked-id",
        session_snapshot: { ...base.session_snapshot, session_id: "hijacked-id" },
      };
      idChange.snapshot_hash = hashSessionSnapshot(idChange.session_snapshot);
      const idResult = await store.compareAndSetDetailed(record.session_id, 0, idChange);
      assert.equal(idResult.ok, false);
      const extended = { ...base, expires_at: "2099-12-31T00:00:00.000Z" };
      const ext = await store.compareAndSetDetailed(record.session_id, 0, extended);
      assert.equal(ext.ok, false);
      const skipped = bumpSnapshot(record, { revision: 2 });
      const skip = await store.compareAndSetDetailed(record.session_id, 0, skipped);
      assert.equal(skip.ok, false);
      const advanced = bumpSnapshot(record, { revision: 1 });
      assert.equal((await store.compareAndSetDetailed(record.session_id, 0, advanced)).ok, true);
      const backward = bumpSnapshot(record, { revision: 0 });
      const back = await store.compareAndSetDetailed(record.session_id, 1, backward);
      assert.equal(back.ok, false);
      const still = await store.get(record.session_id);
      assert.equal(still?.revision, 1);
      assert.equal(still?.session_generation, 1);
      assert.equal(still?.expires_at, record.expires_at);
      assert.equal(still?.session_id, record.session_id);
    }
    await withStore((store) => assertContract(store));
    const harness = new RedisEvalHarness();
    await withStore((store) => assertContract(store), createKvSessionAuthorityStore(harness));
    assert.equal(harness.lastEvalTtl, String(SERVER_SESSION_TTL_SECONDS));
  });

  await asyncTest("Production Lua source includes atomic compare, no-create, and ledger probe", async () => {
    const lua = SESSION_AUTHORITY_CAS_LUA;
    assert.match(lua, /redis\.call\('GET', KEYS\[1\]\)/);
    assert.match(lua, /if not raw then return 5 end/);
    assert.match(lua, /tonumber\(obj\['revision'\]\) ~= expected/);
    assert.match(lua, /nextObj\['session_generation'\]/);
    assert.match(lua, /nextObj\['expires_at'\] > obj\['expires_at'\]/);
    assert.match(lua, /change_type'\] == 'freeze'/);
    assert.match(lua, /redis\.call\('SET', KEYS\[1\], ARGV\[2\], 'EX'/);
    assert.equal(lua.includes("SET', KEYS[1], ARGV[2], 'EX'") || lua.includes('SET\', KEYS[1], ARGV[2], \'EX\''), true);
  });

  await asyncTest("Idempotency extractor binds content and ignores meta/timestamp/revision edits", async () => {
    const snapshot = {
      session_id: "s-extract",
      messages: [userMessage("stored", "turn_bound")],
    } as POJUSessionState;
    const same = extractIncomingUserTurn({
      serverSnapshot: snapshot,
      client_turn_id: "turn_bound",
      user_message: "stored",
      clientSession: {
        ...snapshot,
        session_revision: 99,
        messages: [userMessage("stored", "turn_bound", { timestamp: "2099-01-01T00:00:00.000Z", meta: { x: 1 } })],
      },
    });
    assert.deepEqual(same, { idempotent: true, client_turn_id: "turn_bound" });
    assert.throws(
      () =>
        extractIncomingUserTurn({
          serverSnapshot: snapshot,
          client_turn_id: "turn_bound",
          user_message: "different",
        }),
      (error: unknown) => error instanceof SessionAuthorityError && error.code === "session_turn_conflict",
    );
  });

  console.log("M9-R1 session authority remediation checks complete");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
